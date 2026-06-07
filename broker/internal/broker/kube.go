package broker

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// Standard in-pod ServiceAccount mount paths.
const (
	saTokenPath = "/var/run/secrets/kubernetes.io/serviceaccount/token"
	saCAPath    = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
)

// kubeClient is a minimal read-only Kubernetes API client built on the pod's
// ServiceAccount credentials and the stdlib. It exists solely to GET a Secret;
// using client-go for that would drag a large dependency tree into this lean
// edge service. Fields are exported-by-construction so tests can point it at an
// httptest server.
type kubeClient struct {
	apiServer string                 // e.g. https://10.0.0.1:443
	http      *http.Client           // TLS-configured for the cluster CA
	tokenFn   func() (string, error) // reads the SA bearer token fresh each call
}

// newInClusterKubeClient builds a kubeClient from the in-pod ServiceAccount
// mount and the KUBERNETES_SERVICE_* env vars. It returns an error (not a panic)
// when not running inside a cluster, so the caller can fall back cleanly.
func newInClusterKubeClient() (*kubeClient, error) {
	host := os.Getenv("KUBERNETES_SERVICE_HOST")
	port := os.Getenv("KUBERNETES_SERVICE_PORT")
	if host == "" || port == "" {
		return nil, fmt.Errorf("not in cluster: KUBERNETES_SERVICE_HOST/PORT unset")
	}
	ca, err := os.ReadFile(saCAPath)
	if err != nil {
		return nil, fmt.Errorf("read cluster CA: %w", err)
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(ca) {
		return nil, fmt.Errorf("cluster CA: no valid certificates in %s", saCAPath)
	}
	// Verify the token file exists now so we fail fast on misconfiguration, but
	// read it fresh on every call (projected SA tokens rotate ~hourly).
	if _, err := os.Stat(saTokenPath); err != nil {
		return nil, fmt.Errorf("SA token not present: %w", err)
	}
	return &kubeClient{
		apiServer: fmt.Sprintf("https://%s:%s", host, port),
		http: &http.Client{
			Timeout:   10 * time.Second,
			Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}},
		},
		tokenFn: func() (string, error) {
			b, err := os.ReadFile(saTokenPath)
			if err != nil {
				return "", err
			}
			return strings.TrimSpace(string(b)), nil
		},
	}, nil
}

// getSecret fetches a core/v1 Secret and returns its decoded data map.
func (k *kubeClient) getSecret(ctx context.Context, namespace, name string) (map[string][]byte, error) {
	token, err := k.tokenFn()
	if err != nil {
		return nil, fmt.Errorf("read SA token: %w", err)
	}
	url := fmt.Sprintf("%s/api/v1/namespaces/%s/secrets/%s", k.apiServer, namespace, name)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := k.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("kube GET secret: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("kube GET secret %s/%s: status %d", namespace, name, resp.StatusCode)
	}

	var out struct {
		Data map[string]string `json:"data"` // base64-encoded values
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("decode secret JSON: %w", err)
	}
	decoded := make(map[string][]byte, len(out.Data))
	for kk, vv := range out.Data {
		raw, err := base64.StdEncoding.DecodeString(vv)
		if err != nil {
			return nil, fmt.Errorf("secret key %q: base64 decode: %w", kk, err)
		}
		decoded[kk] = raw
	}
	return decoded, nil
}

// parseAgentRef resolves an embed agent_ref to a (namespace, name) pair. It
// accepts either "namespace/name" or a bare "name", in which case the namespace
// follows the cluster convention devpod-<name>.
func parseAgentRef(ref string) (namespace, name string) {
	if i := strings.IndexByte(ref, '/'); i >= 0 {
		return ref[:i], ref[i+1:]
	}
	return "devpod-" + ref, ref
}

// devpodGatewayURL builds the in-cluster OpenClaw gateway URL for an agent,
// matching the chart's Service: <name>-devpod.<namespace>.svc.cluster.local:18789
func devpodGatewayURL(namespace, name string) string {
	return fmt.Sprintf("http://%s-devpod.%s.svc.cluster.local:18789", name, namespace)
}

// cachedHooks is a HOOKS_TOKEN read with an expiry.
type cachedHooks struct {
	token string
	exp   time.Time
}

// KubeSecretResolver implements GatewayResolver for embeds that specify
// agent_ref. It derives the in-cluster gateway URL and reads HOOKS_TOKEN from
// the agent's devpod-secrets Secret, caching the value with a short TTL to avoid
// hitting the API server on every chat turn.
type KubeSecretResolver struct {
	Kube       *kubeClient
	SecretName string        // default "devpod-secrets"
	SecretKey  string        // default "HOOKS_TOKEN"
	TTL        time.Duration // default 5m

	nowFn func() time.Time

	mu    sync.Mutex
	cache map[string]cachedHooks // key: namespace/name
}

// NewKubeSecretResolver constructs a resolver with sensible defaults.
func NewKubeSecretResolver(k *kubeClient, secretName, secretKey string, ttl time.Duration) *KubeSecretResolver {
	if secretName == "" {
		secretName = "devpod-secrets"
	}
	if secretKey == "" {
		secretKey = "HOOKS_TOKEN"
	}
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	return &KubeSecretResolver{
		Kube:       k,
		SecretName: secretName,
		SecretKey:  secretKey,
		TTL:        ttl,
		cache:      make(map[string]cachedHooks),
	}
}

func (r *KubeSecretResolver) now() time.Time {
	if r.nowFn != nil {
		return r.nowFn()
	}
	return time.Now()
}

// Resolve implements GatewayResolver for the in-cluster agent_ref path.
func (r *KubeSecretResolver) Resolve(ctx context.Context, e *Embed) (resolvedGateway, error) {
	if e.AgentRef == "" {
		return resolvedGateway{}, fmt.Errorf("embed %s has no agent_ref", e.ID)
	}
	namespace, name := parseAgentRef(e.AgentRef)
	key := namespace + "/" + name

	r.mu.Lock()
	if c, ok := r.cache[key]; ok && r.now().Before(c.exp) {
		tok := c.token
		r.mu.Unlock()
		return resolvedGateway{GatewayURL: devpodGatewayURL(namespace, name), HooksToken: tok, Model: e.Model}, nil
	}
	r.mu.Unlock()

	data, err := r.Kube.getSecret(ctx, namespace, r.SecretName)
	if err != nil {
		return resolvedGateway{}, fmt.Errorf("read %s/%s: %w", namespace, r.SecretName, err)
	}
	raw, ok := data[r.SecretKey]
	if !ok || len(raw) == 0 {
		return resolvedGateway{}, fmt.Errorf("secret %s/%s has no key %q", namespace, r.SecretName, r.SecretKey)
	}
	tok := strings.TrimSpace(string(raw))

	r.mu.Lock()
	r.cache[key] = cachedHooks{token: tok, exp: r.now().Add(r.TTL)}
	r.mu.Unlock()

	return resolvedGateway{GatewayURL: devpodGatewayURL(namespace, name), HooksToken: tok, Model: e.Model}, nil
}
