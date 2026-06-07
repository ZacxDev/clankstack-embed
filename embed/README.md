# @kubeclaw/agent-embed

The **"Stripe Checkout of agents"** — paste a snippet, get a streaming agent chat
on any website. Ships a self-contained `<kubeclaw-agent>` web component **and** a
headless `KubeclawAgent` JS SDK (the "Stripe.js" tier) in a single ESM file.

- **Single file, zero config.** `dist/agent.js` bundles Lit + the SDK + markdown
  rendering. Drop in a `<script type="module">` and a `<kubeclaw-agent>` tag.
- **Shadow DOM** for full style encapsulation; theme via CSS custom properties and
  `::part()`.
- **Streaming** via `fetch` + a robust SSE parser (not `EventSource` — we need to
  POST with an `Authorization` header).
- **Talks to a broker**, never to the agent gateway directly. The browser sends a
  publishable key, the broker mints a short-lived session token, and the chat
  stream is authorized with that token.

---

## Install

### CDN (paste snippet)

```html
<script type="module" src="https://cdn.kubeclaw.dev/agent.js"></script>

<kubeclaw-agent
  publishable-key="pk_live_xxx"
  mode="popup"
></kubeclaw-agent>
```

That's it — a floating launcher appears bottom-right.

### npm

```bash
npm install @kubeclaw/agent-embed
```

```ts
import '@kubeclaw/agent-embed'; // registers <kubeclaw-agent>
// or, headless only:
import { KubeclawAgent } from '@kubeclaw/agent-embed';
```

---

## Component: `<kubeclaw-agent>`

### Attributes / properties

| Attribute          | Type                              | Default                     | Description |
|--------------------|-----------------------------------|-----------------------------|-------------|
| `publishable-key`  | string (**required**)             | —                           | `pk_live_…` key. |
| `endpoint`         | string                            | `https://api.kubeclaw.dev`  | Broker base URL. |
| `agent`            | string                            | —                           | Optional display override (the broker config also provides one). |
| `mode`             | `inline` \| `popup` \| `fullscreen` | `popup`                   | Embedded panel, floating launcher, or full-screen. |
| `theme`            | `light` \| `dark` \| `auto`       | `auto`                      | `auto` follows `prefers-color-scheme`. |
| `title`            | string                            | broker config / `Assistant` | Header title (host value wins over broker config). |
| `greeting`         | string                            | broker config               | Seeded assistant greeting (host value wins). |
| `placeholder`      | string                            | `Ask anything…`             | Input placeholder. |
| `persist-session`  | boolean                           | `false`                     | Persist a generated visitor id in `localStorage` for returning-visitor continuity. **Never** persists the `cs_` session token. |

### Events

All are `CustomEvent`, **bubbling + composed** (cross shadow boundaries):

| Event              | `detail`                          |
|--------------------|-----------------------------------|
| `kubeclaw:ready`   | `{}` — element initialized.       |
| `kubeclaw:session` | the `config` object from the session exchange. |
| `kubeclaw:open`    | `{}` — panel opened.              |
| `kubeclaw:close`   | `{}` — panel closed.             |
| `kubeclaw:message` | `{ role: 'user' \| 'assistant', content: string }` |
| `kubeclaw:error`   | `{ code: string, message: string }` |

```js
document.querySelector('kubeclaw-agent')
  .addEventListener('kubeclaw:message', (e) => console.log(e.detail));
```

### Methods (imperative API)

```ts
const el = document.querySelector('kubeclaw-agent');
el.open();
el.close();
el.reset();                 // clear transcript + drop session
await el.sendMessage('hi'); // programmatically send
```

### Theming

**CSS custom properties** (set on the element or any ancestor — they're inherited):

```css
kubeclaw-agent {
  --kc-accent: #0ea5e9;
  --kc-accent-fg: #ffffff;
  --kc-radius: 12px;
  --kc-font: 'Inter', sans-serif;
  --kc-bg: #ffffff;
  --kc-fg: #1f2330;
  --kc-surface: #f4f5f7;   /* assistant bubbles / header */
  --kc-surface-2: #eceef1; /* code blocks, hovers */
  --kc-border: #e2e4e9;
  --kc-muted: #6b7280;
}
```

**`::part()`** for structural overrides:

```css
kubeclaw-agent::part(launcher) { box-shadow: none; }
kubeclaw-agent::part(panel)    { border-radius: 4px; }
kubeclaw-agent::part(header)   { background: #111; color: #fff; }
kubeclaw-agent::part(messages) { padding: 24px; }
kubeclaw-agent::part(input)    { font-size: 16px; }
kubeclaw-agent::part(send)     { background: #000; }
```

Exposed parts: `launcher`, `panel`, `header`, `close`, `messages`, `message`,
`typing`, `composer`, `input`, `send`.

The broker `config.theme` object can also push `accent`, `accentFg`, `radius`,
`font`, `bg`, `fg`, `surface` values; host-page CSS always wins because it has
higher specificity than the inline vars we set.

### Accessibility

- Message list is `role="log"` + `aria-live="polite"`.
- Labelled input; **Enter** sends, **Shift+Enter** newlines.
- Input is disabled while a response streams; a typing indicator shows.
- Focus returns to the input after open/send.
- `prefers-reduced-motion` disables animations and smooth scroll.

---

## Headless SDK: `KubeclawAgent`

Use the wire protocol without any UI. The component is built on top of this — it
is the single source of truth.

```ts
import { KubeclawAgent } from '@kubeclaw/agent-embed';

const agent = new KubeclawAgent({
  endpoint: 'https://api.kubeclaw.dev',
  publishableKey: 'pk_live_xxx',
});

const result = agent.send('hello');
for await (const delta of result) {
  renderToken(delta); // each text chunk as it streams
}
const full = await result.text;     // assembled final reply
console.log(agent.config?.title);   // session config after first send
```

`send(text)` returns an `AsyncIterable<string>` with an extra `.text` promise:

- Bootstraps the session lazily on first call, reuses the token afterward.
- On session expiry (`401` / `session_expired`) it re-runs the session exchange
  **once** and retries the stream transparently.
- Errors (origin denied, quota, rate limit, stream `error` events, network) are
  thrown as a typed `KubeclawError` with `.code` and optional `.status`.

```ts
import { KubeclawError } from '@kubeclaw/agent-embed';
try {
  for await (const d of agent.send('hi')) use(d);
} catch (e) {
  if (e instanceof KubeclawError && e.code === 'rate_limited') backOff();
}
```

Also exported: `ensureSession()`, `reset()`, `config`, `hasSession`, and the SSE
primitives `SSEParser` / `parseSSEStream` for advanced integrations.

---

## Wire contract (the broker it depends on)

The component/SDK only ever talks to a **broker** at `endpoint`. Two calls:

### 1. Session exchange — `POST {endpoint}/v1/embed/session`

Request (browser auto-sends `Origin`; we never set it; `credentials: 'omit'`):

```json
{ "publishable_key": "pk_live_…" }
```

Success `200`:

```json
{
  "session_token": "cs_…",
  "expires_in": 900,
  "config": { "title": "…", "greeting": "…", "theme": {}, "agent": "…" }
}
```

Error (non-`200`):

```json
{ "error": { "code": "origin_denied", "message": "…" } }
```

Codes: `origin_denied`, `embed_not_found`, `rate_limited`, `quota_exceeded`, …

### 2. Chat stream — `POST {endpoint}/v1/embed/chat`

Headers: `Authorization: Bearer cs_…`, `Content-Type: application/json`.
Body: `{ "message": "<user text>" }`.

Response is **SSE** (`text/event-stream`). Each `data: <json>` line is one of:

```jsonc
{ "type": "delta", "text": "<chunk>" }   // append to current assistant message
{ "type": "done" }                        // message complete
{ "type": "error", "code": "<code>", "message": "<msg>" }
```

On `401` the SDK re-runs the session exchange once and retries. Friendly UI text
is shown for `quota_exceeded` / `session_quota_exceeded` ("temporarily
unavailable") and `rate_limited` ("slow down").

---

## Development

This repo is **not** a git repo and ships no lockfile assumptions. On NixOS:

```bash
nix-shell -p nodejs --run "npm install"
nix-shell -p nodejs --run "npm run typecheck"   # tsc --noEmit (strict)
nix-shell -p nodejs --run "npm test"            # vitest (sse + client)
nix-shell -p nodejs --run "npm run build"       # -> dist/agent.js (+ types)
```

Open `examples/index.html` after building to see inline + popup modes. Point
`endpoint` at a locally-running broker (e.g. `http://localhost:8787`).

### Source layout

| File                      | Purpose |
|---------------------------|---------|
| `src/types.ts`            | Wire-contract types + `KubeclawError`. |
| `src/sse.ts`              | Streaming SSE line parser (unit-tested). |
| `src/client.ts`          | Headless SDK + session/stream logic. |
| `src/markdown.ts`         | XSS-safe markdown rendering (`marked` + sanitizer). |
| `src/kubeclaw-agent.ts`   | The Lit custom element (built on the SDK). |
| `src/index.ts`            | Exports + `customElements.define`. |

## Security note

Agent output is rendered as markdown but **raw HTML from the stream is escaped,
not injected**. The renderer additionally strips disallowed elements/attributes,
neutralizes `javascript:`/`data:` URLs, and forces `rel="noopener"` on links.
The `cs_` session token is held in memory only and is never persisted.

## License

MIT
