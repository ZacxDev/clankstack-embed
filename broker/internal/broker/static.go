package broker

import (
	_ "embed"
	"net/http"
)

// The embeddable web component bundle and a self-contained demo page are baked
// into the binary so the broker can serve its own integration surface — the
// demo page is then same-origin with the broker, making CORS and the origin
// allowlist trivial.

//go:embed web/agent.js
var agentJS []byte

//go:embed web/demo.html
var demoHTML []byte

// app.css is the pre-built, minified Tailwind stylesheet for the demo and admin
// pages. It is generated from broker/web-src/ with the standalone Tailwind CLI
// (no Node in the broker build) and committed; see web-src/README.md to rebuild.
//
//go:embed web/app.css
var appCSS []byte

// handleAppCSS serves the pre-built Tailwind stylesheet for the server-rendered
// pages (demo + admin). Same-origin only, so no CORS header is needed.
func (s *Server) handleAppCSS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, newAPIError(http.StatusMethodNotAllowed, "method_not_allowed", "use GET"))
		return
	}
	w.Header().Set("Content-Type", "text/css; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = w.Write(appCSS)
}

// handleAgentJS serves the <kubeclaw-agent> ESM bundle.
func (s *Server) handleAgentJS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, newAPIError(http.StatusMethodNotAllowed, "method_not_allowed", "use GET"))
		return
	}
	w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("Access-Control-Allow-Origin", "*") // a static script is safe to serve cross-origin
	_, _ = w.Write(agentJS)
}

// handleRoot redirects the root path to the demo page. Any other unmatched path
// gets a clean 404 (this handler is the catch-all for the mux).
func (s *Server) handleRoot(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		writeError(w, newAPIError(http.StatusNotFound, "not_found", "no such path"))
		return
	}
	http.Redirect(w, r, "/demo", http.StatusFound)
}

// handleDemo serves the self-contained demo page.
func (s *Server) handleDemo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, newAPIError(http.StatusMethodNotAllowed, "method_not_allowed", "use GET"))
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(demoHTML)
}
