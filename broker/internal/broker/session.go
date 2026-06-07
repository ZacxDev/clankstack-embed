package broker

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
)

// sessionRequest is the body of POST /v1/embed/session.
type sessionRequest struct {
	PublishableKey string `json:"publishable_key"`
	TurnstileToken string `json:"turnstile_token,omitempty"` // ignored in MVP
	VisitorID      string `json:"visitor_id,omitempty"`      // optional stable id
}

// sessionResponse is the success body of POST /v1/embed/session.
type sessionResponse struct {
	SessionToken string        `json:"session_token"`
	ExpiresIn    int           `json:"expires_in"`
	Config       sessionConfig `json:"config"`
}

type sessionConfig struct {
	Title    string          `json:"title"`
	Greeting string          `json:"greeting"`
	Theme    json.RawMessage `json:"theme,omitempty"`
	Agent    string          `json:"agent"`
}

// handleSession implements POST /v1/embed/session. Origin-scoped, CORS-enabled.
func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, newAPIError(http.StatusMethodNotAllowed, "method_not_allowed", "use POST"))
		return
	}

	var req sessionRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&req); err != nil {
		writeError(w, errBadRequest("invalid JSON body"))
		return
	}
	if req.PublishableKey == "" {
		writeError(w, errBadRequest("publishable_key is required"))
		return
	}

	origin := r.Header.Get("Origin")

	// (a) embed exists & enabled.
	embed, err := s.store.GetByPublishableKey(req.PublishableKey)
	if err != nil || embed.Status != "enabled" {
		writeError(w, errEmbedNotFound())
		return
	}

	// (b) origin allowed. Set CORS header only after this check passes.
	if !originAllowed(origin, embed.AllowedOrigins) {
		writeError(w, errOriginDenied())
		return
	}
	setCORS(w, origin)

	// (c) per-(embed,ip) session rate limit.
	ip := clientIP(r)
	if !s.quotas.AllowSession(embed.ID, ip, embed.SessionsPerMin) {
		writeError(w, errRateLimited())
		return
	}

	// (d) daily spend cap.
	if !s.quotas.SpendAvailable(embed.ID, embed.DailyTokenBudget) {
		writeError(w, errQuotaExceeded())
		return
	}

	visitorID := req.VisitorID
	if !strings.HasPrefix(visitorID, "vis_") {
		visitorID = newVisitorID()
	}

	token, exp, err := s.minter.Mint(
		embed.ID, visitorID, origin, embed.Agent,
		embed.PerSessionMsgBudget, embed.PerSessionTokBudget,
	)
	if err != nil {
		s.log.Error("mint session token", "err", err)
		writeError(w, errInternal())
		return
	}

	resp := sessionResponse{
		SessionToken: token,
		ExpiresIn:    int(exp.Sub(s.now()).Seconds()),
		Config: sessionConfig{
			Title:    embed.Title,
			Greeting: embed.Greeting,
			Theme:    embed.Theme,
			Agent:    embed.Agent,
		},
	}
	writeJSON(w, http.StatusOK, resp)
}

// originAllowed reports whether origin exactly matches one of allowed. An empty
// origin (non-browser caller) is never allowed for embed-scoped endpoints.
func originAllowed(origin string, allowed []string) bool {
	if origin == "" {
		return false
	}
	for _, a := range allowed {
		if strings.EqualFold(strings.TrimRight(a, "/"), strings.TrimRight(origin, "/")) {
			return true
		}
	}
	return false
}

// setCORS writes the CORS allow headers reflecting a specific origin. Never "*"
// (we may carry credentials/Authorization).
func setCORS(w http.ResponseWriter, origin string) {
	if origin == "" {
		return
	}
	h := w.Header()
	h.Set("Access-Control-Allow-Origin", origin)
	h.Set("Vary", "Origin")
	h.Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
}

// clientIP extracts the best-effort client IP, honoring X-Forwarded-For when
// present (left-most entry) and falling back to RemoteAddr.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		ip := strings.TrimSpace(parts[0])
		if ip != "" {
			return ip
		}
	}
	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		return strings.TrimSpace(xrip)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
