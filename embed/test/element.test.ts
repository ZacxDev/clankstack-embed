/**
 * @vitest-environment jsdom
 *
 * Integration tests for the <clankstack-agent> Lit element. These mount the
 * real custom element in a DOM, drive its public API (open/sendMessage/reset),
 * and assert on rendered shadow-DOM output + the custom events it emits. The
 * element builds its own ClankstackAgent against globalThis.fetch, so we stub
 * that to control the broker responses.
 *
 * jsdom (not happy-dom) is used here because Lit's nested-template rendering
 * relies on <template> cloning that happy-dom renders as empty part markers.
 * jsdom lacks matchMedia, so we polyfill it (the element reads it for the
 * `theme="auto"` resolution path).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

if (typeof window !== 'undefined' && !window.matchMedia) {
  // Minimal matchMedia stub: reports "light" (matches=false) and accepts listeners.
  (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (
    query: string,
  ) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

import { ClankstackAgentElement } from '../src/clankstack-agent.js';
import '../src/index.js'; // side-effect: customElements.define('clankstack-agent', …)

const PK = 'pk_live_elem123';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sseResponse(...dataLines: string[]): Response {
  const payload = dataLines.map((d) => `data: ${d}\n\n`).join('');
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function goodSession(overrides: Record<string, unknown> = {}) {
  return {
    session_token: 'cs_elem',
    expires_in: 900,
    config: {
      title: 'Broker Title',
      greeting: 'Broker greeting',
      theme: { accent: '#123456' },
      agent: 'a1',
      ...overrides,
    },
  };
}

/** Install a fetch stub that answers session + chat for the element's client. */
function installFetch(
  chat: () => Response,
  session: () => Response = () => jsonResponse(goodSession()),
) {
  const impl = vi.fn(async (url: string | URL | Request) => {
    if (String(url).endsWith('/v1/embed/session')) return session();
    return chat();
  });
  (globalThis as { fetch?: unknown }).fetch = impl as unknown as typeof fetch;
  return impl;
}

let origFetch: unknown;

beforeEach(() => {
  origFetch = (globalThis as { fetch?: unknown }).fetch;
});

afterEach(() => {
  (globalThis as { fetch?: unknown }).fetch = origFetch;
  document.body.innerHTML = '';
});

async function mount(attrs: Record<string, string> = {}): Promise<ClankstackAgentElement> {
  const el = document.createElement('clankstack-agent') as ClankstackAgentElement;
  el.setAttribute('publishable-key', PK);
  el.setAttribute('endpoint', 'https://broker.test');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('<clankstack-agent> element', () => {
  it('registers the custom element', () => {
    expect(customElements.get('clankstack-agent')).toBe(ClankstackAgentElement);
  });

  it('mounts and reflects the publishable-key / endpoint attributes', async () => {
    installFetch(() => sseResponse('{"type":"done"}'));
    const el = await mount();
    expect(el.publishableKey).toBe(PK);
    expect(el.endpoint).toBe('https://broker.test');
    expect(el.shadowRoot).toBeTruthy();
  });

  it('emits clankstack:ready on connect when a publishable key is present', async () => {
    installFetch(() => sseResponse('{"type":"done"}'));
    const el = document.createElement('clankstack-agent') as ClankstackAgentElement;
    const ready = vi.fn();
    el.addEventListener('clankstack:ready', ready);
    el.setAttribute('publishable-key', PK);
    el.setAttribute('endpoint', 'https://broker.test');
    document.body.appendChild(el);
    await el.updateComplete;
    // bootstrap() runs in firstUpdated and may re-run via updated() when the
    // connection props settle on first mount, so ready fires at least once.
    expect(ready.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('renders a launcher button in popup mode and a panel after open()', async () => {
    installFetch(() => sseResponse('{"type":"done"}'));
    const el = await mount({ mode: 'popup' });
    expect(el.shadowRoot?.querySelector('.launcher')).toBeTruthy();
    el.open();
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.panel, [class*="panel"]')).toBeTruthy();
  });

  it('runs a full send: streams deltas into an assistant bubble and emits message events', async () => {
    installFetch(() =>
      sseResponse(
        '{"type":"delta","text":"Hel"}',
        '{"type":"delta","text":"lo"}',
        '{"type":"done"}',
      ),
    );
    const el = await mount();
    const messages: Array<{ role: string; content: string }> = [];
    el.addEventListener('clankstack:message', (e) =>
      messages.push((e as CustomEvent).detail),
    );

    el.open();
    await el.updateComplete;
    await el.sendMessage('hi there');
    await el.updateComplete;

    // The user + assistant messages are rendered.
    const text = el.shadowRoot?.textContent ?? '';
    expect(text).toContain('hi there');
    expect(text).toContain('Hello');

    // Events: one user, one assistant (final).
    expect(messages).toContainEqual({ role: 'user', content: 'hi there' });
    expect(messages).toContainEqual({ role: 'assistant', content: 'Hello' });
  });

  it('applies broker session config (title/greeting) when host did not set them', async () => {
    installFetch(() => sseResponse('{"type":"done"}'));
    const el = await mount();
    el.open();
    await el.updateComplete;
    // ensureConfig resolves async; wait a microtask turn then re-render.
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    const text = el.shadowRoot?.textContent ?? '';
    expect(text).toContain('Broker Title');
    expect(text).toContain('Broker greeting');
  });

  it('renders a friendly error and emits clankstack:error when the stream errors', async () => {
    installFetch(() =>
      sseResponse('{"type":"error","code":"rate_limited","message":"slow"}'),
    );
    const el = await mount();
    const errors: Array<{ code: string }> = [];
    el.addEventListener('clankstack:error', (e) => errors.push((e as CustomEvent).detail));

    el.open();
    await el.updateComplete;
    await el.sendMessage('hi');
    await el.updateComplete;

    expect(errors[0]?.code).toBe('rate_limited');
    const text = el.shadowRoot?.textContent ?? '';
    expect(text.toLowerCase()).toContain('too quickly');
  });

  it('ignores empty/whitespace sendMessage and does not start streaming', async () => {
    const fetchImpl = installFetch(() => sseResponse('{"type":"done"}'));
    const el = await mount();
    el.open();
    await el.updateComplete;
    fetchImpl.mockClear();
    await el.sendMessage('   ');
    // No chat call made for an empty message.
    const chatCalls = fetchImpl.mock.calls.filter((c) => String(c[0]).endsWith('/v1/embed/chat'));
    expect(chatCalls).toHaveLength(0);
  });

  it('reset() clears messages and the underlying client session', async () => {
    installFetch(() =>
      sseResponse('{"type":"delta","text":"x"}', '{"type":"done"}'),
    );
    const el = await mount();
    el.open();
    await el.updateComplete;
    await el.sendMessage('uniquemsg');
    await el.updateComplete;
    // Count rendered message bubbles, not raw textContent (CSS contains words).
    const bubblesBefore = el.shadowRoot?.querySelectorAll('.bubble');
    expect((bubblesBefore?.length ?? 0)).toBeGreaterThan(0);
    expect(el.shadowRoot?.innerHTML).toContain('uniquemsg');

    el.reset();
    await el.updateComplete;
    expect(el.shadowRoot?.innerHTML).not.toContain('uniquemsg'); // user bubble gone
  });

  it('open() then close() toggles the panel and emits open/close events', async () => {
    installFetch(() => sseResponse('{"type":"done"}'));
    const el = await mount({ mode: 'popup' });
    const events: string[] = [];
    el.addEventListener('clankstack:open', () => events.push('open'));
    el.addEventListener('clankstack:close', () => events.push('close'));
    el.open();
    await el.updateComplete;
    el.close();
    await el.updateComplete;
    expect(events).toEqual(['open', 'close']);
  });

  it('renders the markdown in an assistant reply as sanitized HTML (no live script)', async () => {
    installFetch(() =>
      sseResponse(
        '{"type":"delta","text":"**bold** and <script>alert(1)</script>"}',
        '{"type":"done"}',
      ),
    );
    const el = await mount();
    el.open();
    await el.updateComplete;
    await el.sendMessage('hi');
    await el.updateComplete;

    const html = el.shadowRoot?.innerHTML ?? '';
    expect(html).toContain('<strong>bold</strong>');
    // No live <script> element made it into the shadow root.
    expect(html.toLowerCase()).not.toMatch(/<script[\s>]/);
  });
});
