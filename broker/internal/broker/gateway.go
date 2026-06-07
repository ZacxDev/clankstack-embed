package broker

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

// gatewayToken derives the OpenClaw gateway bearer from HOOKS_TOKEN. It MUST
// match the chart derivation: sha256("gw-" + HOOKS_TOKEN), lowercase hex.
func gatewayToken(hooksToken string) string {
	sum := sha256.Sum256([]byte("gw-" + hooksToken))
	return hex.EncodeToString(sum[:])
}

// chatMessage is one OpenAI-style message.
type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// resolvedGateway is the concrete upstream target for an embed: a base URL and
// the hooks token used to derive the bearer.
type resolvedGateway struct {
	GatewayURL string
	HooksToken string
	Model      string
}

// GatewayResolver maps an embed to its concrete upstream gateway. The explicit
// implementation reads gateway_url + hooks_token directly off the embed; an
// in-cluster implementation (resolving agent_ref via the Kubernetes API) is
// stubbed behind the same interface.
type GatewayResolver interface {
	Resolve(ctx context.Context, e *Embed) (resolvedGateway, error)
}

// ExplicitResolver resolves embeds that carry gateway_url + hooks_token. If an
// embed only has agent_ref it delegates to a fallback resolver (if configured).
type ExplicitResolver struct {
	// Fallback handles embeds that specify agent_ref instead of an explicit URL.
	// May be nil, in which case agent_ref embeds error.
	Fallback GatewayResolver
}

// Resolve implements GatewayResolver for the explicit path.
func (r *ExplicitResolver) Resolve(ctx context.Context, e *Embed) (resolvedGateway, error) {
	if e.GatewayURL != "" && e.HooksToken != "" {
		return resolvedGateway{
			GatewayURL: strings.TrimRight(e.GatewayURL, "/"),
			HooksToken: e.HooksToken,
			Model:      e.Model,
		}, nil
	}
	if e.AgentRef != "" {
		if r.Fallback != nil {
			return r.Fallback.Resolve(ctx, e)
		}
		return resolvedGateway{}, fmt.Errorf("embed %s uses agent_ref %q but in-cluster resolver is not configured", e.ID, e.AgentRef)
	}
	return resolvedGateway{}, fmt.Errorf("embed %s has no gateway_url/hooks_token and no agent_ref", e.ID)
}

// InClusterResolver resolves agent_ref ("namespace/name") to an in-cluster
// devpod gateway service and reads HOOKS_TOKEN from the devpod-secrets Secret.
//
// This is intentionally a stub for the MVP: it implements the GatewayResolver
// interface but returns a descriptive error unless wired to a real Kubernetes
// client. The explicit resolver path is the complete, working MVP.
type InClusterResolver struct {
	// KubeConfigured is set true once a real client.Reader / clientset is wired
	// in. Until then Resolve returns a clear "not configured" error rather than
	// pretending to work.
	KubeConfigured bool
}

// inClusterGatewayURL builds the devpod gateway URL from an agent name, matching
// the cluster convention: http://<name>-devpod.devpod-<name>.svc.cluster.local:18789
func inClusterGatewayURL(name string) string {
	return fmt.Sprintf("http://%s-devpod.devpod-%s.svc.cluster.local:18789", name, name)
}

// Resolve implements GatewayResolver for the in-cluster path.
func (r *InClusterResolver) Resolve(ctx context.Context, e *Embed) (resolvedGateway, error) {
	if !r.KubeConfigured {
		return resolvedGateway{}, errors.New(
			"in-cluster agent_ref resolution requires a Kubernetes client (devpod-secrets lookup); " +
				"not configured in this MVP — use explicit gateway_url + hooks_token instead")
	}
	// When wired: parse namespace/name, read the devpod-secrets Secret's
	// HOOKS_TOKEN, and return inClusterGatewayURL(name). Unreachable until
	// KubeConfigured is set by a real client wiring.
	parts := strings.SplitN(e.AgentRef, "/", 2)
	name := parts[len(parts)-1]
	return resolvedGateway{GatewayURL: inClusterGatewayURL(name), Model: e.Model}, errors.New("k8s secret lookup not implemented")
}

// GatewayClient performs streaming chat-completions against an OpenClaw gateway.
type GatewayClient struct {
	HTTP *http.Client
}

// upstreamError is returned when the gateway responds with a non-200 or the
// connection fails.
type upstreamError struct{ msg string }

func (e *upstreamError) Error() string { return e.msg }

// StreamChat POSTs a streaming chat-completions request and invokes emit for
// each assistant content delta. sessionKey sets X-Openclaw-Session-Key for
// per-visitor isolation. It returns the assembled assistant text. emit may be
// nil.
func (c *GatewayClient) StreamChat(
	ctx context.Context,
	rg resolvedGateway,
	sessionKey string,
	messages []chatMessage,
	emit func(delta string) error,
) (string, error) {
	body := map[string]any{
		"messages": messages,
		"stream":   true,
	}
	if rg.Model != "" {
		body["model"] = rg.Model
	}
	reqBody, _ := json.Marshal(body)

	url := rg.GatewayURL + "/v1/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+gatewayToken(rg.HooksToken))
	req.Header.Set("Accept", "text/event-stream")
	if sessionKey != "" {
		req.Header.Set("X-Openclaw-Session-Key", sessionKey)
	}

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return "", &upstreamError{msg: "gateway request failed: " + err.Error()}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", &upstreamError{msg: fmt.Sprintf("gateway returned status %d", resp.StatusCode)}
	}

	var full strings.Builder
	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			break
		}
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue // tolerate keepalives / non-JSON comment lines
		}
		for _, ch := range chunk.Choices {
			if ch.Delta.Content == "" {
				continue
			}
			full.WriteString(ch.Delta.Content)
			if emit != nil {
				if err := emit(ch.Delta.Content); err != nil {
					return full.String(), err
				}
			}
		}
	}
	if err := sc.Err(); err != nil {
		return full.String(), &upstreamError{msg: "stream read error: " + err.Error()}
	}
	return full.String(), nil
}
