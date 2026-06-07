package broker

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"strings"
)

// createEmbedRequest is the body of POST /v1/embeds.
type createEmbedRequest struct {
	Agent               string          `json:"agent"`
	AllowedOrigins      []string        `json:"allowed_origins"`
	DailyTokenBudget    int             `json:"daily_token_budget"`
	PerSessionMsgBudget int             `json:"per_session_msg_budget"`
	PerSessionTokBudget int             `json:"per_session_tok_budget"`
	SessionsPerMin      int             `json:"sessions_per_min"`
	GatewayURL          string          `json:"gateway_url,omitempty"`
	HooksToken          string          `json:"hooks_token,omitempty"`
	AgentRef            string          `json:"agent_ref,omitempty"`
	Model               string          `json:"model,omitempty"`
	Theme               json.RawMessage `json:"theme,omitempty"`
	Title               string          `json:"title,omitempty"`
	Greeting            string          `json:"greeting,omitempty"`
}

// requireSecretKey enforces Authorization: Bearer sk_live_<secret> via constant-
// time comparison. Returns true if authorized.
func (s *Server) requireSecretKey(w http.ResponseWriter, r *http.Request) bool {
	tok := bearerToken(r)
	if !strings.HasPrefix(tok, "sk_live_") {
		writeError(w, errUnauthorized())
		return false
	}
	if subtle.ConstantTimeCompare([]byte(tok), []byte(s.secretKey)) != 1 {
		writeError(w, errUnauthorized())
		return false
	}
	return true
}

// handleEmbeds routes /v1/embeds and /v1/embeds/{id}[/rotate-key].
func (s *Server) handleEmbeds(w http.ResponseWriter, r *http.Request) {
	if !s.requireSecretKey(w, r) {
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/v1/embeds")
	path = strings.Trim(path, "/")

	switch {
	case path == "" && r.Method == http.MethodPost:
		s.createEmbed(w, r)
	case path == "" && r.Method == http.MethodGet:
		s.listEmbeds(w, r)
	case strings.HasSuffix(path, "/rotate-key") && r.Method == http.MethodPost:
		id := strings.TrimSuffix(path, "/rotate-key")
		s.rotateEmbedKey(w, r, id)
	case !strings.Contains(path, "/") && r.Method == http.MethodGet:
		s.getEmbed(w, r, path)
	case !strings.Contains(path, "/") && r.Method == http.MethodPatch:
		s.patchEmbed(w, r, path)
	case !strings.Contains(path, "/") && r.Method == http.MethodDelete:
		s.deleteEmbed(w, r, path)
	default:
		writeError(w, newAPIError(http.StatusNotFound, "not_found", "no such management route"))
	}
}

func (s *Server) createEmbed(w http.ResponseWriter, r *http.Request) {
	var req createEmbedRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&req); err != nil {
		writeError(w, errBadRequest("invalid JSON body"))
		return
	}
	if req.Agent == "" {
		writeError(w, errBadRequest("agent is required"))
		return
	}
	if len(req.AllowedOrigins) == 0 {
		writeError(w, errBadRequest("allowed_origins must contain at least one origin"))
		return
	}
	if req.GatewayURL == "" && req.AgentRef == "" {
		writeError(w, errBadRequest("either gateway_url+hooks_token or agent_ref is required"))
		return
	}
	if req.GatewayURL != "" && req.HooksToken == "" {
		writeError(w, errBadRequest("hooks_token is required when gateway_url is set"))
		return
	}

	e := &Embed{
		Agent:               req.Agent,
		AllowedOrigins:      req.AllowedOrigins,
		DailyTokenBudget:    req.DailyTokenBudget,
		PerSessionMsgBudget: req.PerSessionMsgBudget,
		PerSessionTokBudget: req.PerSessionTokBudget,
		SessionsPerMin:      req.SessionsPerMin,
		GatewayURL:          req.GatewayURL,
		HooksToken:          req.HooksToken,
		AgentRef:            req.AgentRef,
		Model:               req.Model,
		Theme:               req.Theme,
		Title:               req.Title,
		Greeting:            req.Greeting,
		Status:              "enabled",
	}
	if err := s.store.Create(e); err != nil {
		s.log.Error("create embed", "err", err)
		writeError(w, errInternal())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{
		"id":              e.ID,
		"publishable_key": e.PublishableKey,
	})
}

func (s *Server) listEmbeds(w http.ResponseWriter, _ *http.Request) {
	embeds, err := s.store.List()
	if err != nil {
		writeError(w, errInternal())
		return
	}
	out := make([]Embed, 0, len(embeds))
	for _, e := range embeds {
		out = append(out, e.redacted())
	}
	writeJSON(w, http.StatusOK, map[string]any{"embeds": out})
}

func (s *Server) getEmbed(w http.ResponseWriter, _ *http.Request, id string) {
	e, err := s.store.Get(id)
	if err != nil {
		writeError(w, errEmbedNotFound())
		return
	}
	red := e.redacted()
	writeJSON(w, http.StatusOK, red)
}

func (s *Server) patchEmbed(w http.ResponseWriter, r *http.Request, id string) {
	var req map[string]json.RawMessage
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&req); err != nil {
		writeError(w, errBadRequest("invalid JSON body"))
		return
	}
	updated, err := s.store.Update(id, func(e *Embed) error {
		return applyPatch(e, req)
	})
	if err == ErrNotFound {
		writeError(w, errEmbedNotFound())
		return
	}
	if err != nil {
		writeError(w, errBadRequest(err.Error()))
		return
	}
	red := updated.redacted()
	writeJSON(w, http.StatusOK, red)
}

// applyPatch applies a partial update to an embed from a raw field map. Only
// known, mutable fields are honored.
func applyPatch(e *Embed, patch map[string]json.RawMessage) error {
	assignStr := func(key string, dst *string) error {
		if raw, ok := patch[key]; ok {
			return json.Unmarshal(raw, dst)
		}
		return nil
	}
	assignInt := func(key string, dst *int) error {
		if raw, ok := patch[key]; ok {
			return json.Unmarshal(raw, dst)
		}
		return nil
	}
	for _, fn := range []func() error{
		func() error { return assignStr("agent", &e.Agent) },
		func() error { return assignStr("status", &e.Status) },
		func() error { return assignStr("gateway_url", &e.GatewayURL) },
		func() error { return assignStr("hooks_token", &e.HooksToken) },
		func() error { return assignStr("agent_ref", &e.AgentRef) },
		func() error { return assignStr("model", &e.Model) },
		func() error { return assignStr("title", &e.Title) },
		func() error { return assignStr("greeting", &e.Greeting) },
		func() error { return assignInt("daily_token_budget", &e.DailyTokenBudget) },
		func() error { return assignInt("per_session_msg_budget", &e.PerSessionMsgBudget) },
		func() error { return assignInt("per_session_tok_budget", &e.PerSessionTokBudget) },
		func() error { return assignInt("sessions_per_min", &e.SessionsPerMin) },
	} {
		if err := fn(); err != nil {
			return err
		}
	}
	if raw, ok := patch["allowed_origins"]; ok {
		if err := json.Unmarshal(raw, &e.AllowedOrigins); err != nil {
			return err
		}
	}
	if raw, ok := patch["theme"]; ok {
		e.Theme = raw
	}
	if e.Status != "enabled" && e.Status != "disabled" {
		e.Status = "enabled"
	}
	return nil
}

func (s *Server) deleteEmbed(w http.ResponseWriter, _ *http.Request, id string) {
	if err := s.store.Delete(id); err != nil {
		writeError(w, errEmbedNotFound())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
}

func (s *Server) rotateEmbedKey(w http.ResponseWriter, _ *http.Request, id string) {
	e, err := s.store.RotateKey(id)
	if err != nil {
		writeError(w, errEmbedNotFound())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"id":              e.ID,
		"publishable_key": e.PublishableKey,
	})
}
