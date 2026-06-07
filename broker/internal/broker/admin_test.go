package broker

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

// noRedirectClient returns an http.Client that never follows redirects so tests
// can assert on 3xx Location headers directly.
func noRedirectClient(srv *httptest.Server) *http.Client {
	c := srv.Client()
	c.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return c
}

// adminLogin performs the login flow and returns the session cookie. It fails
// the test if login does not succeed.
func adminLogin(t *testing.T, srv *httptest.Server, key string) *http.Cookie {
	t.Helper()
	form := url.Values{"secret_key": {key}}
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/admin/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := noRedirectClient(srv).Do(req)
	if err != nil {
		t.Fatalf("login request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusSeeOther {
		t.Fatalf("login: expected 303, got %d", resp.StatusCode)
	}
	for _, c := range resp.Cookies() {
		if c.Name == adminCookieName && c.Value != "" {
			return c
		}
	}
	t.Fatalf("login: no admin cookie set")
	return nil
}

func TestAdminUnauthenticatedRedirects(t *testing.T) {
	s, _ := newTestServer(t, "http://unused", "tok")
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()

	for _, path := range []string{"/admin", "/admin/embeds/new"} {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+path, nil)
		resp, err := noRedirectClient(srv).Do(req)
		if err != nil {
			t.Fatalf("%s: %v", path, err)
		}
		if resp.StatusCode != http.StatusSeeOther {
			t.Fatalf("%s: expected 303 redirect, got %d", path, resp.StatusCode)
		}
		if loc := resp.Header.Get("Location"); loc != "/admin/login" {
			t.Fatalf("%s: expected redirect to /admin/login, got %q", path, loc)
		}
		resp.Body.Close()
	}
}

func TestAdminLoginWrongKeyRejected(t *testing.T) {
	s, _ := newTestServer(t, "http://unused", "tok")
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()

	form := url.Values{"secret_key": {"sk_live_wrong"}}
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/admin/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := noRedirectClient(srv).Do(req)
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong key, got %d", resp.StatusCode)
	}
	for _, c := range resp.Cookies() {
		if c.Name == adminCookieName && c.Value != "" {
			t.Fatalf("cookie should NOT be set on failed login")
		}
	}
	body, _ := io.ReadAll(resp.Body)
	// The configured secret value must never be echoed back to the client.
	if strings.Contains(string(body), s.secretKey) {
		t.Fatalf("login page leaked the configured sk_ value")
	}
}

func TestAdminLoginCorrectKeyGrantsAccess(t *testing.T) {
	s, _ := newTestServer(t, "http://unused", "tok")
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()

	cookie := adminLogin(t, srv, "sk_live_test_secret_value")

	// Cookie hardening.
	if !cookie.HttpOnly {
		t.Errorf("admin cookie not HttpOnly")
	}
	if !cookie.Secure {
		t.Errorf("admin cookie not Secure")
	}
	if cookie.SameSite != http.SameSiteLaxMode {
		t.Errorf("admin cookie not SameSite=Lax")
	}

	// Authenticated dashboard returns 200 and does not contain the sk_.
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/admin", nil)
	req.AddCookie(cookie)
	resp, err := noRedirectClient(srv).Do(req)
	if err != nil {
		t.Fatalf("dashboard: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on authed dashboard, got %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if strings.Contains(string(body), s.secretKey) {
		t.Fatalf("dashboard leaked the sk_ secret key")
	}
	if !strings.Contains(string(body), "Support Bot") {
		t.Fatalf("dashboard missing the seeded embed")
	}
}

func TestAdminCookieTamperRejected(t *testing.T) {
	s, _ := newTestServer(t, "http://unused", "tok")
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()

	good := adminLogin(t, srv, "sk_live_test_secret_value")

	// Forge an extended expiry while keeping the original signature. The HMAC
	// covers the expiry, so this must be rejected.
	dot := strings.IndexByte(good.Value, '.')
	if dot <= 0 {
		t.Fatalf("unexpected cookie format: %q", good.Value)
	}
	forged := *good
	forged.Value = "9999999999" + good.Value[dot:] // far-future expiry, original sig

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/admin", nil)
	req.AddCookie(&forged)
	resp, err := noRedirectClient(srv).Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusSeeOther {
		t.Fatalf("forged cookie should be rejected (redirect to login), got %d", resp.StatusCode)
	}
	if loc := resp.Header.Get("Location"); loc != "/admin/login" {
		t.Fatalf("expected redirect to login, got %q", loc)
	}
}

func TestAdminCreateEmbedForm(t *testing.T) {
	s, _ := newTestServer(t, "http://unused", "tok")
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()
	cookie := adminLogin(t, srv, "sk_live_test_secret_value")

	form := url.Values{
		"agent":            {"Docs Bot"},
		"allowed_origins":  {"https://a.example.com, https://b.example.com"},
		"daily_token_budget": {"50000"},
		"gateway_url":      {"http://gw.svc:8080"},
		"hooks_token":      {"a-hooks-token"},
	}
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/admin/embeds", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.AddCookie(cookie)
	resp, err := noRedirectClient(srv).Do(req)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("create form: expected 200, got %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(body), "pk_live_") {
		t.Fatalf("created page should show the new pk_live_ key, got: %s", body)
	}

	// The embed must be persisted with both origins parsed.
	embeds, _ := s.store.List()
	var found *Embed
	for _, e := range embeds {
		if e.Agent == "Docs Bot" {
			found = e
		}
	}
	if found == nil {
		t.Fatalf("created embed not persisted")
	}
	if len(found.AllowedOrigins) != 2 {
		t.Fatalf("expected 2 origins parsed, got %v", found.AllowedOrigins)
	}
	if found.HooksToken != "a-hooks-token" {
		t.Fatalf("hooks_token not persisted")
	}
}

func TestAdminCreateEmbedValidation(t *testing.T) {
	s, _ := newTestServer(t, "http://unused", "tok")
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()
	cookie := adminLogin(t, srv, "sk_live_test_secret_value")

	// Missing gateway_url AND agent_ref -> bad request, re-renders form.
	form := url.Values{
		"agent":           {"Broken"},
		"allowed_origins": {"https://x.example.com"},
	}
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/admin/embeds", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.AddCookie(cookie)
	resp, err := noRedirectClient(srv).Do(req)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid create, got %d", resp.StatusCode)
	}
	embeds, _ := s.store.List()
	for _, e := range embeds {
		if e.Agent == "Broken" {
			t.Fatalf("invalid embed should not be persisted")
		}
	}
}

func TestAdminRotateToggleDelete(t *testing.T) {
	s, embed := newTestServer(t, "http://unused", "tok")
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()
	cookie := adminLogin(t, srv, "sk_live_test_secret_value")

	post := func(path string) *http.Response {
		req, _ := http.NewRequest(http.MethodPost, srv.URL+path, nil)
		req.AddCookie(cookie)
		resp, err := noRedirectClient(srv).Do(req)
		if err != nil {
			t.Fatalf("POST %s: %v", path, err)
		}
		return resp
	}

	// Rotate key.
	oldPK := embed.PublishableKey
	r := post("/admin/embeds/" + embed.ID + "/rotate-key")
	r.Body.Close()
	if r.StatusCode != http.StatusSeeOther {
		t.Fatalf("rotate: expected 303, got %d", r.StatusCode)
	}
	after, _ := s.store.Get(embed.ID)
	if after.PublishableKey == oldPK {
		t.Fatalf("rotate did not change the publishable key")
	}

	// Toggle to disabled.
	r = post("/admin/embeds/" + embed.ID + "/toggle")
	r.Body.Close()
	after, _ = s.store.Get(embed.ID)
	if after.Status != "disabled" {
		t.Fatalf("toggle did not disable embed, status=%q", after.Status)
	}

	// Toggle back to enabled.
	r = post("/admin/embeds/" + embed.ID + "/toggle")
	r.Body.Close()
	after, _ = s.store.Get(embed.ID)
	if after.Status != "enabled" {
		t.Fatalf("toggle did not re-enable embed, status=%q", after.Status)
	}

	// Delete.
	r = post("/admin/embeds/" + embed.ID + "/delete")
	r.Body.Close()
	if _, err := s.store.Get(embed.ID); err != ErrNotFound {
		t.Fatalf("delete did not remove embed, err=%v", err)
	}
}

func TestAdminActionsRequireAuth(t *testing.T) {
	s, embed := newTestServer(t, "http://unused", "tok")
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()

	// Unauthenticated delete must redirect to login and NOT delete.
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/admin/embeds/"+embed.ID+"/delete", nil)
	resp, err := noRedirectClient(srv).Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusSeeOther || resp.Header.Get("Location") != "/admin/login" {
		t.Fatalf("unauth action should redirect to login, got %d %q", resp.StatusCode, resp.Header.Get("Location"))
	}
	if _, err := s.store.Get(embed.ID); err != nil {
		t.Fatalf("embed should still exist after unauth delete attempt")
	}
}

func TestAdminLogoutClearsCookie(t *testing.T) {
	s, _ := newTestServer(t, "http://unused", "tok")
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()
	cookie := adminLogin(t, srv, "sk_live_test_secret_value")

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/admin/logout", nil)
	req.AddCookie(cookie)
	resp, err := noRedirectClient(srv).Do(req)
	if err != nil {
		t.Fatalf("logout: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusSeeOther {
		t.Fatalf("logout: expected 303, got %d", resp.StatusCode)
	}
	var cleared bool
	for _, c := range resp.Cookies() {
		if c.Name == adminCookieName && c.MaxAge < 0 {
			cleared = true
		}
	}
	if !cleared {
		t.Fatalf("logout did not clear the admin cookie")
	}
}

func TestAdminSignerVerify(t *testing.T) {
	signer := newAdminSigner([]byte("a-secret"))
	val := signer.sign()
	if err := signer.verify(val); err != nil {
		t.Fatalf("fresh cookie should verify: %v", err)
	}
	// Wrong secret.
	other := newAdminSigner([]byte("different"))
	if err := other.verify(val); err == nil {
		t.Fatalf("cookie should not verify under a different secret")
	}
	// Malformed.
	for _, bad := range []string{"", "noseparator", "abc.def", "9999999999."} {
		if err := signer.verify(bad); err == nil {
			t.Fatalf("malformed cookie %q should not verify", bad)
		}
	}
}
