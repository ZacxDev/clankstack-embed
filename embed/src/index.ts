/**
 * @clank-stack/agent-embed — public entry point.
 *
 * Importing this module (or loading the built `dist/agent.js` via
 * `<script type="module">`) registers the `<clankstack-agent>` custom element and
 * exposes the headless {@link ClankstackAgent} SDK.
 */
import { ClankstackAgentElement } from './clankstack-agent.js';

// Headless SDK ("Stripe.js" tier).
export { ClankstackAgent, type SendResult } from './client.js';

// Web component class (already decorated with @customElement, but we also
// guard-register here so the side effect is explicit and idempotent).
export { ClankstackAgentElement } from './clankstack-agent.js';

// Types + error class.
export {
  ClankstackError,
  DEFAULT_ENDPOINT,
  type ClankstackAgentOptions,
  type ClankstackSessionConfig,
  type ClankstackThemeConfig,
  type ClankstackErrorCode,
  type SessionExchangeResponse,
  type StreamEvent,
  type ErrorEnvelope,
} from './types.js';

// SSE primitives (useful for advanced integrations / testing).
export { SSEParser, parseSSEStream, type SSEEvent } from './sse.js';
export { renderMarkdown } from './markdown.js';

// Idempotent registration (the @customElement decorator also registers; this
// guard prevents a throw if the module is somehow evaluated twice).
if (typeof customElements !== 'undefined' && !customElements.get('clankstack-agent')) {
  customElements.define('clankstack-agent', ClankstackAgentElement);
}
