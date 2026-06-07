package broker

import (
	"crypto/subtle"
	"html/template"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// The web admin UI is a small set of server-rendered pages under /admin, gated
// by an HMAC-signed session cookie. It is a thin shell over the same store and
// validation paths used by the /v1/embeds JSON API — no logic is duplicated.

// adminTmpl holds all admin templates parsed once at init. html/template
// auto-escapes interpolated values, so user-supplied fields (agent name,
// origins, etc.) are safe to render directly.
var adminTmpl = template.Must(template.New("admin").Parse(adminTemplates))

// adminPage is the data passed to the list page template.
type adminPage struct {
	Embeds []adminEmbedRow
	Flash  string
}

// adminEmbedRow is one embed enriched with live usage for the table.
type adminEmbedRow struct {
	*Embed
	UsedToday int
	AgentRef  bool // true when resolution is via agent_ref (vs explicit gateway)
}

// adminCreatedPage is shown once after a successful create, exposing the new pk.
type adminCreatedPage struct {
	ID             string
	PublishableKey string
}

// requireAdmin wraps an admin handler, redirecting unauthenticated requests to
// the login page (a redirect, never a 200).
func (s *Server) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.admin.authenticated(r) {
			http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
			return
		}
		next(w, r)
	}
}

// handleAdminLogin renders the login form (GET) and verifies the sk_ (POST).
func (s *Server) handleAdminLogin(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		// Already logged in -> straight to the dashboard.
		if s.admin.authenticated(r) {
			http.Redirect(w, r, "/admin", http.StatusSeeOther)
			return
		}
		s.renderAdmin(w, http.StatusOK, "login", map[string]string{})
	case http.MethodPost:
		if err := r.ParseForm(); err != nil {
			s.renderAdmin(w, http.StatusBadRequest, "login", map[string]string{"Error": "invalid form"})
			return
		}
		key := strings.TrimSpace(r.PostFormValue("secret_key"))
		// Constant-time compare against the broker's configured sk_. The key is
		// never echoed back into any response.
		if subtle.ConstantTimeCompare([]byte(key), []byte(s.secretKey)) != 1 {
			s.renderAdmin(w, http.StatusUnauthorized, "login", map[string]string{"Error": "invalid secret key"})
			return
		}
		s.admin.setAdminCookie(w)
		http.Redirect(w, r, "/admin", http.StatusSeeOther)
	default:
		writeError(w, newAPIError(http.StatusMethodNotAllowed, "method_not_allowed", "use GET or POST"))
	}
}

// handleAdminLogout clears the session cookie.
func (s *Server) handleAdminLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, newAPIError(http.StatusMethodNotAllowed, "method_not_allowed", "use POST"))
		return
	}
	clearAdminCookie(w)
	http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
}

// handleAdminList renders the embeds dashboard.
func (s *Server) handleAdminList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, newAPIError(http.StatusMethodNotAllowed, "method_not_allowed", "use GET"))
		return
	}
	embeds, err := s.store.List()
	if err != nil {
		writeError(w, errInternal())
		return
	}
	rows := make([]adminEmbedRow, 0, len(embeds))
	for _, e := range embeds {
		rows = append(rows, adminEmbedRow{
			Embed:     e,
			UsedToday: s.quotas.SpendUsedToday(e.ID),
			AgentRef:  e.GatewayURL == "" && e.AgentRef != "",
		})
	}
	s.renderAdmin(w, http.StatusOK, "list", adminPage{
		Embeds: rows,
		Flash:  r.URL.Query().Get("flash"),
	})
}

// handleAdminEmbeds dispatches the /admin/embeds family of routes:
//
//	GET  /admin/embeds            -> redirect to dashboard (canonical list is /admin)
//	POST /admin/embeds            -> create from form
//	GET  /admin/embeds/new        -> create form
//	POST /admin/embeds/{id}/...   -> rotate-key | toggle | delete
func (s *Server) handleAdminEmbeds(w http.ResponseWriter, r *http.Request) {
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/admin/embeds"), "/")
	switch {
	case rest == "" && r.Method == http.MethodPost:
		s.handleAdminCreate(w, r)
	case rest == "" && r.Method == http.MethodGet:
		http.Redirect(w, r, "/admin", http.StatusSeeOther)
	case rest == "new":
		s.handleAdminNew(w, r)
	case strings.Contains(rest, "/"):
		s.handleAdminEmbedAction(w, r)
	default:
		http.Redirect(w, r, "/admin", http.StatusSeeOther)
	}
}

// handleAdminNew renders the create-embed form.
func (s *Server) handleAdminNew(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, newAPIError(http.StatusMethodNotAllowed, "method_not_allowed", "use GET"))
		return
	}
	s.renderAdmin(w, http.StatusOK, "new", map[string]string{})
}

// handleAdminCreate processes the create-embed form (POST /admin/embeds).
func (s *Server) handleAdminCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, newAPIError(http.StatusMethodNotAllowed, "method_not_allowed", "use POST"))
		return
	}
	if err := r.ParseForm(); err != nil {
		s.renderAdmin(w, http.StatusBadRequest, "new", map[string]string{"Error": "invalid form"})
		return
	}

	req := createEmbedRequest{
		Agent:               strings.TrimSpace(r.PostFormValue("agent")),
		AllowedOrigins:      splitOrigins(r.PostFormValue("allowed_origins")),
		DailyTokenBudget:    atoiDefault(r.PostFormValue("daily_token_budget"), 0),
		PerSessionMsgBudget: atoiDefault(r.PostFormValue("per_session_msg_budget"), 0),
		PerSessionTokBudget: atoiDefault(r.PostFormValue("per_session_tok_budget"), 0),
		SessionsPerMin:      atoiDefault(r.PostFormValue("sessions_per_min"), 0),
		GatewayURL:          strings.TrimSpace(r.PostFormValue("gateway_url")),
		HooksToken:          strings.TrimSpace(r.PostFormValue("hooks_token")),
		AgentRef:            strings.TrimSpace(r.PostFormValue("agent_ref")),
		Model:               strings.TrimSpace(r.PostFormValue("model")),
		Title:               strings.TrimSpace(r.PostFormValue("title")),
		Greeting:            strings.TrimSpace(r.PostFormValue("greeting")),
	}

	e, aerr := embedFromCreateRequest(req)
	if aerr != nil {
		s.renderAdmin(w, aerr.status, "new", map[string]string{"Error": aerr.Message})
		return
	}
	if err := s.store.Create(e); err != nil {
		s.log.Error("admin create embed", "err", err)
		s.renderAdmin(w, http.StatusInternalServerError, "new", map[string]string{"Error": "failed to create embed"})
		return
	}
	s.renderAdmin(w, http.StatusOK, "created", adminCreatedPage{
		ID:             e.ID,
		PublishableKey: e.PublishableKey,
	})
}

// handleAdminEmbedAction routes per-embed POST actions:
//
//	/admin/embeds/{id}/rotate-key
//	/admin/embeds/{id}/toggle
//	/admin/embeds/{id}/delete
func (s *Server) handleAdminEmbedAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, newAPIError(http.StatusMethodNotAllowed, "method_not_allowed", "use POST"))
		return
	}
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/admin/embeds/"), "/")
	id, action, ok := strings.Cut(rest, "/")
	if !ok || id == "" {
		http.Redirect(w, r, "/admin", http.StatusSeeOther)
		return
	}

	switch action {
	case "rotate-key":
		if _, err := s.store.RotateKey(id); err != nil {
			s.redirectFlash(w, r, "embed not found")
			return
		}
		s.redirectFlash(w, r, "publishable key rotated")
	case "delete":
		if err := s.store.Delete(id); err != nil {
			s.redirectFlash(w, r, "embed not found")
			return
		}
		s.redirectFlash(w, r, "embed deleted")
	case "toggle":
		_, err := s.store.Update(id, func(e *Embed) error {
			if e.Status == "enabled" {
				e.Status = "disabled"
			} else {
				e.Status = "enabled"
			}
			return nil
		})
		if err != nil {
			s.redirectFlash(w, r, "embed not found")
			return
		}
		s.redirectFlash(w, r, "embed status updated")
	default:
		http.Redirect(w, r, "/admin", http.StatusSeeOther)
	}
}

// redirectFlash sends the operator back to the dashboard with a status message.
func (s *Server) redirectFlash(w http.ResponseWriter, r *http.Request, msg string) {
	v := url.Values{}
	v.Set("flash", msg)
	http.Redirect(w, r, "/admin?"+v.Encode(), http.StatusSeeOther)
}

// renderAdmin renders a named admin template with a consistent content type.
func (s *Server) renderAdmin(w http.ResponseWriter, status int, name string, data any) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	if err := adminTmpl.ExecuteTemplate(w, name, data); err != nil {
		s.log.Error("render admin template", "tmpl", name, "err", err)
	}
}

// splitOrigins parses a comma/newline/whitespace-separated origin list.
func splitOrigins(raw string) []string {
	fields := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\r' || r == ' ' || r == '\t'
	})
	out := make([]string, 0, len(fields))
	for _, f := range fields {
		if f = strings.TrimSpace(f); f != "" {
			out = append(out, f)
		}
	}
	return out
}

// atoiDefault parses an int, returning def on empty/invalid input.
func atoiDefault(s string, def int) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}
