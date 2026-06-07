# kubeclaw-broker

A public HTTP service that fronts OpenClaw agent gateways and turns them into a
safe, abuse-bounded, embeddable web surface. A browser-side Lit web component
talks to this broker; the broker mints short-lived, origin-bound session tokens,
enforces per-session and per-embed budgets, and proxies a streaming chat to the
upstream OpenClaw gateway.

The broker never exposes the upstream gateway bearer or hooks token to the
browser. The browser only ever holds a **publishable key** (a public identifier)
and a short-lived **client session token** (`cs_`), both useless outside their
bound origin and budgets.

## Architecture

```
browser (Lit component)
  │  POST /v1/embed/session   (publishable_key + Origin)
  │  POST /v1/embed/chat      (Authorization: Bearer cs_…, SSE response)
  ▼
kubeclaw-broker ──► OpenClaw gateway  POST <gatewayURL>/v1/chat/completions
  │                  Authorization: Bearer sha256("gw-"+HOOKS_TOKEN)
  │                  X-Openclaw-Session-Key: embed:<embedID>:<visitorID>
  └─ management API (Authorization: Bearer sk_live_…, never from a browser)
```

## Token formats

| Token | Shape | Carries secret? | Where used |
|-------|-------|-----------------|------------|
| Publishable key | `pk_live_<base62>` / `pk_test_<base62>` | No | Browser → `/v1/embed/session` |
| Client session  | `cs_` + HS256 JWT | Signed, short TTL (~15m) | Browser → `/v1/embed/chat` (Bearer) |
| Secret key      | `sk_live_<secret>` | Yes | Server-only → management API (Bearer) |

`cs_` JWT claims: `embed_id`, `visitor_id`, `origin`, `agent`, `msg_budget`,
`tok_budget`, `iat`, `exp`, `jti`. Signed HS256 with `BROKER_JWT_SECRET`.

## Endpoints

### Browser-callable (CORS, origin-scoped)

**`OPTIONS *`** — CORS preflight. Reflects the request `Origin` only if it is in
some enabled embed's `allowed_origins`. Returns
`Access-Control-Allow-Methods: POST, OPTIONS`,
`Access-Control-Allow-Headers: Authorization, Content-Type`,
`Access-Control-Max-Age: 600`. Never uses `*`.

**`POST /v1/embed/session`** — mint a session. Body:
`{ "publishable_key": "pk_live_…", "turnstile_token": "…"(optional), "visitor_id": "vis_…"(optional) }`.
Checks, in order:
1. embed exists & `status == enabled` → else `404 embed_not_found`
2. `Origin` ∈ `allowed_origins` → else `403 origin_denied`
3. per-(embed, client IP) session rate limit → else `429 rate_limited`
4. daily spend cap not exhausted → else `429 quota_exceeded`

Success `200`:
```json
{ "session_token": "cs_…", "expires_in": 900,
  "config": { "title": "...", "greeting": "...", "theme": {…}, "agent": "..." } }
```

**`POST /v1/embed/chat`** — SSE chat. `Authorization: Bearer cs_…`. Verifies the
token prefix, JWT signature, `exp`, and that request `Origin` == the token's
`origin` claim (else `401 invalid_session`). Body:
`{ "message": "..." }` (single, uses stored per-visitor history) **or**
`{ "messages": [ {"role","content"} ] }` (passthrough).

Response is `text/event-stream`:
- `data: {"type":"delta","text":"<chunk>"}` per content delta
- `data: {"type":"done"}` on upstream `[DONE]`
- `data: {"type":"error","code":"...","message":"..."}` on error, then close

Budget exhaustion streams a single `error` event with code
`session_quota_exceeded` or `quota_exceeded` and closes.

### Management API (server-only, `Authorization: Bearer sk_live_…`)

- `POST /v1/embeds` — create. Body: `{ agent, allowed_origins[], daily_token_budget, per_session_msg_budget, per_session_tok_budget, sessions_per_min, gateway_url?, hooks_token?, agent_ref?, model?, theme?, title?, greeting? }` → `{ id, publishable_key }`.
- `GET /v1/embeds` — list (hooks_token redacted).
- `GET /v1/embeds/{id}` — fetch one (redacted).
- `PATCH /v1/embeds/{id}` — partial update.
- `DELETE /v1/embeds/{id}` — delete.
- `POST /v1/embeds/{id}/rotate-key` — issue a new publishable key, invalidating the old.

### Error shape (non-streaming)

```json
{ "error": { "code": "...", "message": "..." } }
```

## Upstream resolution

Each embed resolves to an upstream gateway via the `GatewayResolver` interface:

- **Explicit mode** (`gateway_url` + `hooks_token`): the bearer is derived as
  `sha256("gw-" + hooks_token)` (lowercase hex). Good for dev and for fronting a
  gateway that isn't a standard devpod.
- **In-cluster mode** (`agent_ref`): resolves to
  `http://<name>-devpod.<namespace>.svc.cluster.local:18789` and reads
  `HOOKS_TOKEN` from the agent's Secret (default `devpod-secrets`), caching it
  with a short TTL. `agent_ref` accepts `namespace/name` or a bare `name` (which
  maps to namespace `devpod-<name>` by convention).

The in-cluster client is a minimal **stdlib-only** Kubernetes reader built on the
pod's ServiceAccount (token + CA from `/var/run/secrets/kubernetes.io/...`) — no
client-go dependency. It is enabled automatically when those credentials are
present (`BROKER_KUBE=auto`); set `BROKER_KUBE=on` to require it (fail fast if
absent) or `off` to disable. When disabled/unavailable, `agent_ref` embeds return
a clear error while explicit-mode embeds keep working.

**RBAC:** the broker's ServiceAccount needs `get` on `secrets` in each agent
namespace (e.g. a Role in every `devpod-*` namespace, or a narrowly-scoped
ClusterRole). It needs nothing else.

## Token accounting

Streamed tokens are approximated by **`len(text) / 4`** (a common rough heuristic
for English). The inbound prompt is charged up front; completion tokens are
charged incrementally as the assistant text grows. Charges decrement both the
embed's daily budget and the session's token budget; hitting either mid-stream
stops the stream and emits a `session_quota_exceeded` error.

## Configuration (environment)

| Var | Default | Required | Meaning |
|-----|---------|----------|---------|
| `BROKER_ADDR` | `:8090` | no | Listen address |
| `BROKER_JWT_SECRET` | — | **yes** | HS256 secret for `cs_` tokens |
| `BROKER_SK` | — | **yes** | The full `sk_live_…` management secret |
| `BROKER_SESSION_TTL` | `900` (s) | no | `cs_` token TTL (seconds, or Go duration) |
| `BROKER_UPSTREAM_TIMEOUT` | `120` (s) | no | Hard timeout per upstream stream |
| `BROKER_EMBEDS_SEED` | — | no | Path to a JSON array of seed embeds (dev) |
| `BROKER_KUBE` | `auto` | no | In-cluster `agent_ref` resolver: `auto` \| `on` \| `off` |
| `BROKER_SECRET_NAME` | `devpod-secrets` | no | Secret to read the hooks token from |
| `BROKER_SECRET_KEY` | `HOOKS_TOKEN` | no | Key within that Secret |
| `BROKER_SECRET_TTL` | `5m` | no | How long a resolved hooks token is cached |

`BROKER_SESSION_TTL` / `BROKER_UPSTREAM_TIMEOUT` accept a bare integer (seconds)
or a Go duration string (e.g. `2m`).

## Build & test

This repo uses only the Go stdlib plus `github.com/golang-jwt/jwt/v5`.

```bash
go build ./...
go vet ./...
go test ./...
```

## Run locally end-to-end (with the fake gateway)

A `cmd/fakegateway` emulates the OpenClaw SSE gateway so the whole stack runs
without a cluster. It echoes your last user message back as streamed deltas and
validates the derived bearer.

```bash
# Terminal 1 — fake OpenClaw gateway on :18789
FAKE_ADDR=:18789 FAKE_HOOKS_TOKEN=dev-secret go run ./cmd/fakegateway

# Terminal 2 — broker, seeded with an embed pointing at the fake gateway
cp embeds.seed.example.json /tmp/embeds.json   # gateway_url: http://localhost:18789
BROKER_JWT_SECRET=dev-jwt \
BROKER_SK=sk_live_dev_secret \
BROKER_EMBEDS_SEED=/tmp/embeds.json \
go run .
```

### curl smoke test

```bash
# 1. CORS preflight
curl -i -X OPTIONS http://localhost:8090/v1/embed/session -H 'Origin: https://example.com'

# 2. Mint a session
SESS=$(curl -s -X POST http://localhost:8090/v1/embed/session \
  -H 'Origin: https://example.com' -H 'Content-Type: application/json' \
  -d '{"publishable_key":"pk_live_demo000000000000000000"}')
TOKEN=$(printf '%s' "$SESS" | grep -o '"session_token":"[^"]*"' | cut -d'"' -f4)

# 3. Stream a chat (SSE)
curl -N -X POST http://localhost:8090/v1/embed/chat \
  -H 'Origin: https://example.com' -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"hello there broker"}'
# => data: {"text":"You ","type":"delta"}
#    data: {"text":"said: ","type":"delta"}
#    ...
#    data: {"type":"done"}

# 4. Management API (server-only)
curl -s -X POST http://localhost:8090/v1/embeds \
  -H 'Authorization: Bearer sk_live_dev_secret' -H 'Content-Type: application/json' \
  -d '{"agent":"New Bot","allowed_origins":["https://site.com"],
       "daily_token_budget":5000,"per_session_msg_budget":10,
       "per_session_tok_budget":2000,"sessions_per_min":5,
       "gateway_url":"http://localhost:18789","hooks_token":"dev-secret"}'
```

## Docker

```bash
docker build -t kubeclaw-broker:dev .
docker run --rm -p 8090:8090 \
  -e BROKER_JWT_SECRET=dev-jwt -e BROKER_SK=sk_live_dev_secret \
  kubeclaw-broker:dev
```

Multi-stage, CGO-disabled, distroless `nonroot` runtime.

## Notes & limitations

- The embed store, rate limiter, spend caps, per-session counters, and visitor
  history are **in-memory** — single-process only. The `Store` and quota types
  are designed so a Postgres/Redis implementation can drop in later (the `Store`
  interface is the seam; only `MemStore` is provided here).
- `turnstile_token` is accepted and ignored in this MVP.
- The in-cluster `agent_ref` resolver reads only Secrets, over a minimal
  stdlib Kubernetes client (no client-go). The cluster CA is read once at
  startup; the SA token is re-read per call (handles rotation).
