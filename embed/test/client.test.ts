import { describe, it, expect, vi } from 'vitest';
import { ClankstackAgent } from '../src/client.js';
import { ClankstackError } from '../src/types.js';

const ENDPOINT = 'https://broker.test';
const PK = 'pk_live_test123';

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

function goodSession() {
  return {
    session_token: 'cs_abc123',
    expires_in: 900,
    config: {
      title: 'Support',
      greeting: 'Hi there!',
      theme: { accent: '#ff0000' },
      agent: 'support-agent',
    },
  };
}

describe('ClankstackAgent.send', () => {
  it('performs session exchange then streams deltas', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      if (String(url).endsWith('/v1/embed/session')) return jsonResponse(goodSession());
      return sseResponse(
        '{"type":"delta","text":"Hel"}',
        '{"type":"delta","text":"lo"}',
        '{"type":"done"}',
      );
    }) as unknown as typeof fetch;

    const agent = new ClankstackAgent({ endpoint: ENDPOINT, publishableKey: PK, fetchImpl });
    const result = agent.send('hi');
    const deltas: string[] = [];
    for await (const d of result) deltas.push(d);

    expect(deltas).toEqual(['Hel', 'lo']);
    expect(await result.text).toBe('Hello');

    // Session exchange request shape.
    const sessionCall = calls.find((c) => c.url.endsWith('/v1/embed/session'))!;
    expect(sessionCall.init.method).toBe('POST');
    expect(sessionCall.init.credentials).toBe('omit');
    expect(JSON.parse(sessionCall.init.body as string)).toMatchObject({
      publishable_key: PK,
    });
    const headers = new Headers(sessionCall.init.headers);
    expect(headers.get('content-type')).toBe('application/json');

    // Chat request carries the bearer token.
    const chatCall = calls.find((c) => c.url.endsWith('/v1/embed/chat'))!;
    const chatHeaders = new Headers(chatCall.init.headers);
    expect(chatHeaders.get('authorization')).toBe('Bearer cs_abc123');
    expect(JSON.parse(chatCall.init.body as string)).toEqual({ message: 'hi' });

    expect(agent.config?.title).toBe('Support');
  });

  it('reuses the session token across multiple sends', async () => {
    let sessionCount = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith('/v1/embed/session')) {
        sessionCount++;
        return jsonResponse(goodSession());
      }
      return sseResponse('{"type":"delta","text":"x"}', '{"type":"done"}');
    }) as unknown as typeof fetch;

    const agent = new ClankstackAgent({ endpoint: ENDPOINT, publishableKey: PK, fetchImpl });
    for await (const _ of agent.send('a')) void _;
    for await (const _ of agent.send('b')) void _;
    expect(sessionCount).toBe(1);
  });

  it('re-runs session exchange once on a 401 and retries the stream', async () => {
    let sessionCount = 0;
    let chatCount = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith('/v1/embed/session')) {
        sessionCount++;
        return jsonResponse(goodSession());
      }
      chatCount++;
      const token = new Headers(init?.headers).get('authorization');
      // First chat call: simulate expired session token.
      if (chatCount === 1) {
        expect(token).toBe('Bearer cs_abc123');
        return jsonResponse({ error: { code: 'session_expired', message: 'expired' } }, 401);
      }
      return sseResponse('{"type":"delta","text":"ok"}', '{"type":"done"}');
    }) as unknown as typeof fetch;

    const agent = new ClankstackAgent({ endpoint: ENDPOINT, publishableKey: PK, fetchImpl });
    const deltas: string[] = [];
    for await (const d of agent.send('hi')) deltas.push(d);

    expect(deltas).toEqual(['ok']);
    expect(sessionCount).toBe(2); // initial + refresh
    expect(chatCount).toBe(2); // 401 then success
  });

  it('throws a typed error on an SSE error event', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith('/v1/embed/session')) return jsonResponse(goodSession());
      return sseResponse('{"type":"error","code":"rate_limited","message":"slow down"}');
    }) as unknown as typeof fetch;

    const agent = new ClankstackAgent({ endpoint: ENDPOINT, publishableKey: PK, fetchImpl });
    await expect(async () => {
      for await (const _ of agent.send('hi')) void _;
    }).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('surfaces a session-exchange error envelope as a typed error', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { code: 'origin_denied', message: 'nope' } }, 403),
    ) as unknown as typeof fetch;

    const agent = new ClankstackAgent({ endpoint: ENDPOINT, publishableKey: PK, fetchImpl });
    await expect(agent.ensureSession()).rejects.toBeInstanceOf(ClankstackError);
    await expect(agent.ensureSession()).rejects.toMatchObject({
      code: 'origin_denied',
      status: 403,
    });
  });

  it('rejects the .text promise when the stream errors', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith('/v1/embed/session')) return jsonResponse(goodSession());
      return sseResponse('{"type":"error","code":"internal_error","message":"boom"}');
    }) as unknown as typeof fetch;

    const agent = new ClankstackAgent({ endpoint: ENDPOINT, publishableKey: PK, fetchImpl });
    const result = agent.send('hi');
    // Consume without throwing inside the loop assertion.
    const consume = (async () => {
      for await (const _ of result) void _;
    })();
    await expect(consume).rejects.toMatchObject({ code: 'internal_error' });
    await expect(result.text).rejects.toMatchObject({ code: 'internal_error' });
  });

  it('requires a publishable key', () => {
    expect(() => new ClankstackAgent({ publishableKey: '' })).toThrow(ClankstackError);
  });
});
