package broker

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestParseAgentRef(t *testing.T) {
	cases := []struct{ ref, ns, name string }{
		{"support", "devpod-support", "support"},
		{"devpod-foo/foo-devpod", "devpod-foo", "foo-devpod"},
		{"custom-ns/bar", "custom-ns", "bar"},
	}
	for _, c := range cases {
		ns, name := parseAgentRef(c.ref)
		if ns != c.ns || name != c.name {
			t.Errorf("parseAgentRef(%q) = (%q,%q); want (%q,%q)", c.ref, ns, name, c.ns, c.name)
		}
	}
}

func TestDevpodGatewayURL(t *testing.T) {
	got := devpodGatewayURL("devpod-support", "support")
	want := "http://support-devpod.devpod-support.svc.cluster.local:18789"
	if got != want {
		t.Errorf("devpodGatewayURL = %q; want %q", got, want)
	}
}

// fakeKubeAPI serves a single Secret and counts GET hits.
func fakeKubeAPI(t *testing.T, namespace, name, key, value string, hits *int32) *kubeClient {
	t.Helper()
	enc := base64.StdEncoding.EncodeToString([]byte(value))
	path := fmt.Sprintf("/api/v1/namespaces/%s/secrets/%s", namespace, name)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != path {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-sa-token" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		atomic.AddInt32(hits, 1)
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"kind":"Secret","data":{%q:%q}}`, key, enc)
	}))
	t.Cleanup(ts.Close)
	return &kubeClient{
		apiServer: ts.URL,
		http:      ts.Client(),
		tokenFn:   func() (string, error) { return "test-sa-token", nil },
	}
}

func TestKubeSecretResolver(t *testing.T) {
	var hits int32
	kc := fakeKubeAPI(t, "devpod-support", "devpod-secrets", "HOOKS_TOKEN", "s3cr3t-hooks", &hits)
	r := NewKubeSecretResolver(kc, "", "", time.Minute)

	rg, err := r.Resolve(context.Background(), &Embed{ID: "emb_x", AgentRef: "support", Model: "openrouter/x"})
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if rg.GatewayURL != "http://support-devpod.devpod-support.svc.cluster.local:18789" {
		t.Errorf("GatewayURL = %q", rg.GatewayURL)
	}
	if rg.HooksToken != "s3cr3t-hooks" {
		t.Errorf("HooksToken = %q; want s3cr3t-hooks", rg.HooksToken)
	}
	if rg.Model != "openrouter/x" {
		t.Errorf("Model = %q", rg.Model)
	}
	// Derived bearer must match the chart convention sha256("gw-"+token).
	if want := gatewayToken("s3cr3t-hooks"); gatewayToken(rg.HooksToken) != want {
		t.Errorf("derived bearer mismatch")
	}

	// Second resolve within TTL must be served from cache (no extra API hit).
	if _, err := r.Resolve(context.Background(), &Embed{ID: "emb_x", AgentRef: "support"}); err != nil {
		t.Fatalf("Resolve(cached): %v", err)
	}
	if got := atomic.LoadInt32(&hits); got != 1 {
		t.Errorf("API hits = %d; want 1 (second call should be cached)", got)
	}

	// After TTL expiry the cache is bypassed and the API is hit again.
	r.nowFn = func() time.Time { return time.Now().Add(2 * time.Minute) }
	if _, err := r.Resolve(context.Background(), &Embed{ID: "emb_x", AgentRef: "support"}); err != nil {
		t.Fatalf("Resolve(expired): %v", err)
	}
	if got := atomic.LoadInt32(&hits); got != 2 {
		t.Errorf("API hits = %d; want 2 (post-expiry refetch)", got)
	}
}

func TestKubeSecretResolverMissingKey(t *testing.T) {
	var hits int32
	kc := fakeKubeAPI(t, "devpod-support", "devpod-secrets", "OTHER_KEY", "v", &hits)
	r := NewKubeSecretResolver(kc, "", "", time.Minute)
	if _, err := r.Resolve(context.Background(), &Embed{ID: "emb_x", AgentRef: "support"}); err == nil {
		t.Fatal("expected error for missing HOOKS_TOKEN key, got nil")
	}
}
