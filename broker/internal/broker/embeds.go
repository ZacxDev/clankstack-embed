package broker

import (
	"crypto/rand"
	"encoding/json"
	"math/big"
	"time"
)

// Embed is a server-side configuration record for one embeddable chat surface.
// It is referenced publicly by its PublishableKey (which carries no secret).
type Embed struct {
	ID             string `json:"id"`
	PublishableKey string `json:"publishable_key"`
	Status         string `json:"status"` // "enabled" | "disabled"

	Agent          string   `json:"agent"`           // display name shown to visitor
	AllowedOrigins []string `json:"allowed_origins"` // exact-match origins, e.g. https://foo.com

	// Budgets.
	DailyTokenBudget    int `json:"daily_token_budget"`
	PerSessionMsgBudget int `json:"per_session_msg_budget"`
	PerSessionTokBudget int `json:"per_session_tok_budget"`
	SessionsPerMin      int `json:"sessions_per_min"`

	// Upstream resolution: explicit mode (gateway_url + hooks_token) OR agent_ref.
	GatewayURL string `json:"gateway_url,omitempty"`
	HooksToken string `json:"hooks_token,omitempty"`
	AgentRef   string `json:"agent_ref,omitempty"` // "namespace/name" for in-cluster resolution
	Model      string `json:"model,omitempty"`     // optional upstream model name

	// Presentation handed to the browser at session time.
	Title    string          `json:"title,omitempty"`
	Greeting string          `json:"greeting,omitempty"`
	Theme    json.RawMessage `json:"theme,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// redacted returns a copy safe to expose over the management list/get API: the
// hooks_token is replaced with a sentinel.
func (e *Embed) redacted() Embed {
	c := *e
	if c.HooksToken != "" {
		c.HooksToken = "***redacted***"
	}
	return c
}

const base62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

// randBase62 returns a cryptographically-random base62 string of length n.
func randBase62(n int) string {
	b := make([]byte, n)
	max := big.NewInt(int64(len(base62)))
	for i := range b {
		idx, err := rand.Int(rand.Reader, max)
		if err != nil {
			// rand.Reader failure is fatal-ish; fall back to a fixed char so we
			// never emit a partially-zeroed key. This essentially never happens.
			b[i] = base62[0]
			continue
		}
		b[i] = base62[idx.Int64()]
	}
	return string(b)
}

// newEmbedID returns a fresh embed identifier.
func newEmbedID() string { return "emb_" + randBase62(20) }

// newPublishableKey returns a fresh pk_live_ publishable key.
func newPublishableKey() string { return "pk_live_" + randBase62(24) }

// newVisitorID returns a fresh visitor identifier.
func newVisitorID() string { return "vis_" + randBase62(20) }
