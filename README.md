# kubeclaw-embed

Put a kubeclaw agent on any website with a `<script>` tag and one element —
safely. This is the public web-integration surface for the kubeclaw agent
framework: the "Stripe Checkout of agents."

Two pieces, one wire contract:

| Dir | What | Stack | Status |
|-----|------|-------|--------|
| [`broker/`](broker/) | Public HTTP service that fronts the agent gateway: mints origin-bound session tokens, enforces budgets, proxies streaming chat. | Go (stdlib + `golang-jwt`) | MVP, builds + tested |
| [`embed/`](embed/) | `<kubeclaw-agent>` Lit web component + headless `KubeclawAgent` SDK. Single self-contained ESM bundle for a CDN. | TypeScript + Lit | MVP, builds + tested |

The agent's OpenClaw gateway is OpenAI-compatible but **ClusterIP-only, has no
CORS, and rejects mismatched Host/Origin** — so the browser can never reach it
directly. The broker is the mandatory, abuse-bounded edge between them.

```
┌ host web page ────────────────────────┐
│ <script src="cdn/agent.js">           │
│ <kubeclaw-agent publishable-key=pk_…> │   embed/  (Lit + headless SDK)
└──────────────┬────────────────────────┘
               │ pk_live_…  +  Origin                       (public)
               ▼
┌ kubeclaw-broker ──────────────────────┐
│ • origin allowlist, rate limit, caps  │   broker/  (Go)                (NEW)
│ • mint short-lived cs_ session (JWT)  │
│ • proxy SSE, inject gateway bearer    │
└──────────────┬────────────────────────┘
               │ Authorization: Bearer sha256("gw-"+HOOKS_TOKEN)
               │ X-Openclaw-Session-Key: embed:<embedID>:<visitorID>
               ▼
        OpenClaw agent gateway  :18789  /v1/chat/completions   (in-cluster)
```

## The wire contract (single source of truth)

The browser makes exactly two calls to the broker. Both pieces are built against
this; do not let them drift.

**1. Session exchange** — `POST {endpoint}/v1/embed/session`
- Request: `{ "publishable_key": "pk_live_…" }` (browser auto-sends `Origin`; `credentials: 'omit'`).
- Success `200`: `{ "session_token": "cs_…", "expires_in": 900, "config": { "title", "greeting", "theme", "agent" } }`
- Error: `{ "error": { "code", "message" } }` with a non-200 status (`origin_denied` 403, `embed_not_found` 404, `rate_limited`/`quota_exceeded` 429).

**2. Chat stream** — `POST {endpoint}/v1/embed/chat`
- Headers: `Authorization: Bearer cs_…`, `Content-Type: application/json`. Body: `{ "message": "…" }`.
- Response: SSE (`text/event-stream`). Each `data:` line is one JSON event:
  - `{ "type": "delta", "text": "<chunk>" }`
  - `{ "type": "done" }`
  - `{ "type": "error", "code": "<code>", "message": "<msg>" }`
- On `401` the client re-runs the session exchange once and retries.

Tokens: `pk_live_<id>` (public identifier, browser), `cs_<HS256 JWT>` (short-lived,
per-visitor, browser memory only), `sk_live_<secret>` (server-only, management API).

## Run the whole thing locally (no cluster needed)

`broker/cmd/fakegateway` emulates the OpenClaw SSE gateway, so you can run the full
browser→broker→gateway path on one machine. On NixOS, prefix toolchain commands
with `nix-shell -p go` / `nix-shell -p nodejs`.

```bash
# 1. Fake OpenClaw gateway on :18789 (echoes your message back as streamed deltas)
cd broker
nix-shell -p go --run "FAKE_ADDR=:18789 FAKE_HOOKS_TOKEN=dev-secret go run ./cmd/fakegateway"

# 2. Broker on :8090, seeded with an embed pointing at the fake gateway
cp embeds.seed.example.json /tmp/embeds.json   # gateway_url: http://localhost:18789
nix-shell -p go --run "BROKER_JWT_SECRET=dev-jwt BROKER_SK=sk_live_dev_secret \
  BROKER_EMBEDS_SEED=/tmp/embeds.json go run ."

# 3. Build the component and open the demo page, pointed at the local broker
cd ../embed
nix-shell -p nodejs --run "npm install && npm run build"
#   edit examples/index.html: set endpoint="http://localhost:8090"
#   then open examples/index.html (publishable-key=pk_live_demo000000000000000000)
```

A pure-curl smoke test (no browser) lives in [`broker/README.md`](broker/README.md#run-locally-end-to-end-with-the-fake-gateway).

### Verified end-to-end (2026-06-06)
`POST /session` → `cs_` minted; `POST /chat` streamed
`data:{"type":"delta",…}` … `data:{"type":"done"}`; the fake gateway confirmed it
received the **derived bearer** and per-visitor `X-Openclaw-Session-Key
embed:<id>:vis_<id>`. Abuse paths verified: disallowed origin → 403 `origin_denied`,
bad session → 401, management without `sk_` → 401. The real `clawdbot-gateway` on
this host's :18789 returns 405 to a direct browser-style POST — the exact
host/origin quirk the broker exists to absorb.

## Security model — read this before exposing a real agent

A publishable key is **safe in public HTML** because its power is bounded by
*origin allowlist + rate limit + daily spend cap*, not by secrecy (same model as
Stripe `pk_`). But be honest about the boundary:

- **Origin-lock is friction, not a wall.** Browsers set `Origin` truthfully so it
  blocks other *websites*, but a script (curl/Node) can forge it. The real
  backstops are **rate limits + daily token budget + (optional) Turnstile /
  authenticated-embed mode.** Treat a public embed as "anyone on the internet can
  talk to this agent, up to $X/day," and size the budget accordingly.
- **Never expose a privileged agent** (cluster-admin, shell, write tools) through a
  public embed. The auth model protects your wallet; the agent's own RBAC/tooling
  protects your cluster. Public embeds should map to a sandboxed agent profile.

## MVP scope / not yet built

In-memory store + quotas (single-process; `Store` interface is the Postgres seam)
and `turnstile_token` accepted-and-ignored are the main MVP shortcuts. Both
upstream-resolution modes work: explicit `gateway_url`+`hooks_token` and in-cluster
`agent_ref` (reads `HOOKS_TOKEN` from the agent's Secret over a stdlib-only kube
client — broker SA needs `get secrets` in `devpod-*`). Management API has no UI yet
— Clankup/clawgate would drive it. WebSocket transport, authenticated-embed mode,
and the self-hosted `kubeclaw-broker` Helm chart (with the SA/RBAC) are v1 items.

See the design spec: `homelab-talos/claudedocs/kubeclaw-embed-webcomponent-auth-spec.md`.
