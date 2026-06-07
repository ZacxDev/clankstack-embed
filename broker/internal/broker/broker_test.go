package broker

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func newTestServer(t *testing.T, gatewayURL, hooksToken string) (*Server, *Embed) {
	t.Helper()
	cfg := Config{
		Addr:            ":0",
		JWTSecret:       []byte("test-jwt-secret-please-change"),
		SecretKey:       "sk_live_test_secret_value",
		SessionTTL:      15 * time.Minute,
		UpstreamTimeout: 30 * time.Second,
	}
	s, err := New(cfg, testLogger())
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	embed := &Embed{
		Agent:               "Support Bot",
		AllowedOrigins:      []string{"https://example.com"},
		DailyTokenBudget:    100000,
		PerSessionMsgBudget: 5,
		PerSessionTokBudget: 10000,
		SessionsPerMin:      10,
		GatewayURL:          gatewayURL,
		HooksToken:          hooksToken,
		Title:               "Help",
		Greeting:            "Hi there!",
	}
	if err := s.store.Create(embed); err != nil {
		t.Fatalf("create embed: %v", err)
	}
	return s, embed
}

func TestTokenMintVerify(t *testing.T) {
	m := NewTokenMinter([]byte("secret-key-material"), 15*time.Minute)
	tok, exp, err := m.Mint("emb_1", "vis_1", "https://example.com", "Bot", 5, 1000)
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	if !strings.HasPrefix(tok, "cs_") {
		t.Fatalf("token missing cs_ prefix: %q", tok)
	}
	if exp.Before(time.Now()) {
		t.Fatalf("token already expired")
	}

	claims, err := m.Verify(tok)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if claims.EmbedID != "emb_1" || claims.VisitorID != "vis_1" {
		t.Fatalf("claims roundtrip mismatch: %+v", claims)
	}
	if claims.Origin != "https://example.com" || claims.MsgBudget != 5 || claims.TokBudget != 1000 {
		t.Fatalf("claims fields mismatch: %+v", claims)
	}
	if claims.ID == "" {
		t.Fatalf("expected non-empty jti")
	}

	// Wrong secret must fail.
	other := NewTokenMinter([]byte("different-secret"), 15*time.Minute)
	if _, err := other.Verify(tok); err == nil {
		t.Fatalf("expected verify failure with wrong secret")
	}

	// Tampered prefix must fail.
	if _, err := m.Verify("xx_" + strings.TrimPrefix(tok, "cs_")); err == nil {
		t.Fatalf("expected failure on bad prefix")
	}

	// Expired token must fail.
	expM := NewTokenMinter([]byte("secret-key-material"), -1*time.Minute)
	expired, _, _ := expM.Mint("e", "v", "o", "a", 1, 1)
	if _, err := m.Verify(expired); err == nil {
		t.Fatalf("expected expired token to fail verify")
	}
}

// fakeGateway returns an httptest server emulating the OpenClaw SSE gateway. It
// asserts the bearer is the sha256("gw-"+hooksToken) derivation and the session
// key header is present.
func fakeGateway(t *testing.T, hooksToken string) *httptest.Server {
	t.Helper()
	wantBearer := "Bearer " + func() string {
		sum := sha256.Sum256([]byte("gw-" + hooksToken))
		return hex.EncodeToString(sum[:])
	}()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		if got := r.Header.Get("Authorization"); got != wantBearer {
			t.Errorf("bad bearer: got %q want %q", got, wantBearer)
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if sk := r.Header.Get("X-Openclaw-Session-Key"); !strings.HasPrefix(sk, "embed:") {
			t.Errorf("missing/invalid session key: %q", sk)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		flusher := w.(http.Flusher)
		for _, word := range []string{"hello", "world"} {
			chunk := map[string]any{"choices": []map[string]any{{"delta": map[string]any{"content": word + " "}}}}
			b, _ := json.Marshal(chunk)
			fmt.Fprintf(w, "data: %s\n\n", b)
			flusher.Flush()
		}
		fmt.Fprint(w, "data: [DONE]\n\n")
		flusher.Flush()
	}))
}

func TestSessionAndChatFlow(t *testing.T) {
	const hooksToken = "dev-hooks-token"
	gw := fakeGateway(t, hooksToken)
	defer gw.Close()

	s, embed := newTestServer(t, gw.URL, hooksToken)
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()

	client := srv.Client()

	// 1. Mint a session.
	sessBody, _ := json.Marshal(map[string]string{"publishable_key": embed.PublishableKey})
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/embed/session", strings.NewReader(string(sessBody)))
	req.Header.Set("Origin", "https://example.com")
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("session request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("session status %d: %s", resp.StatusCode, body)
	}
	if ao := resp.Header.Get("Access-Control-Allow-Origin"); ao != "https://example.com" {
		t.Fatalf("missing/incorrect CORS allow-origin: %q", ao)
	}
	var sess sessionResponse
	if err := json.NewDecoder(resp.Body).Decode(&sess); err != nil {
		t.Fatalf("decode session: %v", err)
	}
	resp.Body.Close()
	if !strings.HasPrefix(sess.SessionToken, "cs_") {
		t.Fatalf("bad session token: %q", sess.SessionToken)
	}
	if sess.Config.Agent != "Support Bot" || sess.Config.Greeting != "Hi there!" {
		t.Fatalf("bad config: %+v", sess.Config)
	}

	// 2. Chat using the session token; expect SSE deltas + done.
	chatBody, _ := json.Marshal(map[string]string{"message": "ping"})
	creq, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/embed/chat", strings.NewReader(string(chatBody)))
	creq.Header.Set("Origin", "https://example.com")
	creq.Header.Set("Content-Type", "application/json")
	creq.Header.Set("Authorization", "Bearer "+sess.SessionToken)
	cresp, err := client.Do(creq)
	if err != nil {
		t.Fatalf("chat request: %v", err)
	}
	defer cresp.Body.Close()
	if cresp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(cresp.Body)
		t.Fatalf("chat status %d: %s", cresp.StatusCode, body)
	}
	if ct := cresp.Header.Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("expected SSE content-type, got %q", ct)
	}

	var deltas []string
	var sawDone bool
	sc := bufio.NewScanner(cresp.Body)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		var ev struct {
			Type string `json:"type"`
			Text string `json:"text"`
			Code string `json:"code"`
		}
		if err := json.Unmarshal([]byte(data), &ev); err != nil {
			t.Fatalf("bad SSE json %q: %v", data, err)
		}
		switch ev.Type {
		case "delta":
			deltas = append(deltas, ev.Text)
		case "done":
			sawDone = true
		case "error":
			t.Fatalf("unexpected error event: code=%s", ev.Code)
		}
	}
	joined := strings.Join(deltas, "")
	if !strings.Contains(joined, "hello") || !strings.Contains(joined, "world") {
		t.Fatalf("missing expected deltas, got %q", joined)
	}
	if !sawDone {
		t.Fatalf("never saw done event")
	}
}

func TestSessionOriginDenied(t *testing.T) {
	s, embed := newTestServer(t, "http://unused", "tok")
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()

	body, _ := json.Marshal(map[string]string{"publishable_key": embed.PublishableKey})
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/embed/session", strings.NewReader(string(body)))
	req.Header.Set("Origin", "https://evil.com")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	var env struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	json.NewDecoder(resp.Body).Decode(&env)
	if env.Error.Code != "origin_denied" {
		t.Fatalf("expected origin_denied, got %q", env.Error.Code)
	}
}

func TestChatOriginMismatch(t *testing.T) {
	s, embed := newTestServer(t, "http://unused", "tok")
	tok, _, _ := s.minter.Mint(embed.ID, "vis_x", "https://example.com", "Bot", 5, 1000)

	srv := httptest.NewServer(s.Handler())
	defer srv.Close()

	body, _ := json.Marshal(map[string]string{"message": "hi"})
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/embed/chat", strings.NewReader(string(body)))
	req.Header.Set("Origin", "https://attacker.com") // mismatched
	req.Header.Set("Authorization", "Bearer "+tok)
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestManagementRequiresSecretKey(t *testing.T) {
	s, _ := newTestServer(t, "http://unused", "tok")
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()

	// No auth -> 401.
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/v1/embeds", nil)
	resp, _ := srv.Client().Do(req)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 without key, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Correct key -> 200 and hooks_token redacted.
	req2, _ := http.NewRequest(http.MethodGet, srv.URL+"/v1/embeds", nil)
	req2.Header.Set("Authorization", "Bearer sk_live_test_secret_value")
	resp2, _ := srv.Client().Do(req2)
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 with key, got %d", resp2.StatusCode)
	}
	var out struct {
		Embeds []Embed `json:"embeds"`
	}
	json.NewDecoder(resp2.Body).Decode(&out)
	resp2.Body.Close()
	if len(out.Embeds) != 1 {
		t.Fatalf("expected 1 embed, got %d", len(out.Embeds))
	}
	if out.Embeds[0].HooksToken == "tok" {
		t.Fatalf("hooks_token was not redacted: %q", out.Embeds[0].HooksToken)
	}
}

func TestSessionMessageBudgetExhausted(t *testing.T) {
	const hooksToken = "tok"
	gw := fakeGateway(t, hooksToken)
	defer gw.Close()
	s, embed := newTestServer(t, gw.URL, hooksToken)
	// Force a 1-message budget.
	s.store.Update(embed.ID, func(e *Embed) error { e.PerSessionMsgBudget = 1; return nil })

	tok, _, _ := s.minter.Mint(embed.ID, "vis_b", "https://example.com", "Bot", 1, 10000)
	s.quotas.InitSession(extractJTI(t, s, tok), 1, 10000)

	srv := httptest.NewServer(s.Handler())
	defer srv.Close()

	do := func() *http.Response {
		body, _ := json.Marshal(map[string]string{"message": "hi"})
		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/embed/chat", strings.NewReader(string(body)))
		req.Header.Set("Origin", "https://example.com")
		req.Header.Set("Authorization", "Bearer "+tok)
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("request: %v", err)
		}
		return resp
	}

	// First call succeeds.
	r1 := do()
	io.Copy(io.Discard, r1.Body)
	r1.Body.Close()

	// Second call must stream a session_quota_exceeded error.
	r2 := do()
	defer r2.Body.Close()
	body, _ := io.ReadAll(r2.Body)
	if !strings.Contains(string(body), "session_quota_exceeded") {
		t.Fatalf("expected session_quota_exceeded, got: %s", body)
	}
}

// extractJTI verifies a token and returns its jti for test budget seeding.
func extractJTI(t *testing.T, s *Server, tok string) string {
	t.Helper()
	c, err := s.minter.Verify(tok)
	if err != nil {
		t.Fatalf("verify in helper: %v", err)
	}
	return c.ID
}
