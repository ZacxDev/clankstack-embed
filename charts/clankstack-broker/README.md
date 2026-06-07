# clankstack-broker (Helm chart)

Deploy the [clankstack](https://github.com/ZacxDev/kubeclaw-embed) embed broker —
the public edge that fronts your OpenClaw agent gateways and serves the
`<clankstack-agent>` web component safely (origin-bound publishable-key sessions,
rate limits, durable daily spend caps).

## Install

```bash
helm install broker ./charts/clankstack-broker -n clankstack --create-namespace
```

By default this brings up the broker + a small bundled Postgres (durable spend
caps) and auto-generates `BROKER_JWT_SECRET` / `BROKER_SK` (preserved across
upgrades). See `NOTES.txt` output for how to create an embed and get a `pk_`.

## Two ways the broker reaches your agents

**Explicit mode (default, works anywhere).** Each embed carries
`gatewayUrl` + `hooksToken`. No special RBAC. Good for agents reachable by URL.

**In-cluster mode.** For OpenClaw agents deployed as `devpod-<name>` with a
`devpod-secrets` Secret, the broker resolves `agentRef` and reads `HOOKS_TOKEN`
itself. Enable it and grant least-privilege secret reads:

```yaml
inClusterResolver:
  enabled: true
  agentNamespaces: ["devpod-foo", "devpod-bar"]   # per-namespace GET on devpod-secrets
  # clusterWide: true                              # or cluster-wide (single-tenant only)
```

## Key values

| Key | Default | Notes |
|-----|---------|-------|
| `image.repository` / `image.tag` | `ghcr.io/zacxdev/clankstack-broker` / appVersion | broker image |
| `broker.jwtSecret` / `broker.secretKey` | auto-generated | pin to set explicitly |
| `broker.existingSecret` | `""` | use your own Secret (`BROKER_JWT_SECRET`, `BROKER_SK`, `DATABASE_URL`) |
| `postgres.enabled` | `true` | bundle Postgres for durable spend caps |
| `externalDatabaseUrl` | `""` | DSN when `postgres.enabled=false` |
| `inClusterResolver.enabled` | `false` | resolve `agentRef` via in-cluster Secret reads |
| `inClusterResolver.agentNamespaces` | `[]` | namespaces to grant GET `devpod-secrets` |
| `embeds` | `[]` | seed embeds (stored in a Secret) |
| `ingress.enabled` / `ingress.host` | `false` / `""` | expose publicly |
| `service.type` / `service.port` | `ClusterIP` / `8090` | |

> ⚠️ With `postgres.enabled=false` **and** no `externalDatabaseUrl`, daily spend
> caps run in-memory and reset on restart — fine for a demo, not for a public
> endpoint. A public embed spends real model tokens; keep the cap durable.

## Seeding an embed via values

```yaml
embeds:
  - publishableKey: pk_live_demo
    agent: Demo
    allowedOrigins: ["https://yoursite.com"]
    dailyTokenBudget: 50000
    agentRef: my-agent        # in-cluster mode
    # gatewayUrl: http://...  # OR explicit mode
    # hooksToken: "..."
    title: Demo
    greeting: "Hi! Ask me anything."
```

Or skip the seed and create embeds at runtime via `POST /v1/embeds` (Bearer `sk_`).
