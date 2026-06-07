/**
 * @kubeclaw/agent-embed — public entry point.
 *
 * Importing this module (or loading the built `dist/agent.js` via
 * `<script type="module">`) registers the `<kubeclaw-agent>` custom element and
 * exposes the headless {@link KubeclawAgent} SDK.
 */
import { KubeclawAgentElement } from './kubeclaw-agent.js';

// Headless SDK ("Stripe.js" tier).
export { KubeclawAgent, type SendResult } from './client.js';

// Web component class (already decorated with @customElement, but we also
// guard-register here so the side effect is explicit and idempotent).
export { KubeclawAgentElement } from './kubeclaw-agent.js';

// Types + error class.
export {
  KubeclawError,
  DEFAULT_ENDPOINT,
  type KubeclawAgentOptions,
  type KubeclawSessionConfig,
  type KubeclawThemeConfig,
  type KubeclawErrorCode,
  type SessionExchangeResponse,
  type StreamEvent,
  type ErrorEnvelope,
} from './types.js';

// SSE primitives (useful for advanced integrations / testing).
export { SSEParser, parseSSEStream, type SSEEvent } from './sse.js';
export { renderMarkdown } from './markdown.js';

// Idempotent registration (the @customElement decorator also registers; this
// guard prevents a throw if the module is somehow evaluated twice).
if (typeof customElements !== 'undefined' && !customElements.get('kubeclaw-agent')) {
  customElements.define('kubeclaw-agent', KubeclawAgentElement);
}
