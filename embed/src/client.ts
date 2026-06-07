/**
 * Headless kubeclaw agent SDK ("Stripe.js" tier).
 *
 * Single source of truth for the broker wire contract. The web component is
 * built on top of this client. Usage:
 *
 * ```ts
 * const agent = new KubeclawAgent({ endpoint, publishableKey });
 * for await (const delta of agent.send('hello')) renderToken(delta);
 * ```
 *
 * `send(text)` returns an async iterable of text deltas. It bootstraps a
 * session lazily, retries once on session expiry (401 / session_expired), and
 * surfaces all failures as thrown {@link KubeclawError}s.
 */
import { parseSSEStream } from './sse.js';
import {
  DEFAULT_ENDPOINT,
  KubeclawError,
  type KubeclawAgentOptions,
  type KubeclawSessionConfig,
  type SessionExchangeResponse,
  type StreamEvent,
} from './types.js';

/** Result handle returned by {@link KubeclawAgent.send}. */
export interface SendResult extends AsyncIterable<string> {
  /** Resolves to the fully assembled assistant text once the stream is done. */
  readonly text: Promise<string>;
}

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${b}${path}`;
}

function isErrorEnvelope(v: unknown): v is { error: { code: string; message: string } } {
  return (
    typeof v === 'object' &&
    v !== null &&
    'error' in v &&
    typeof (v as { error: unknown }).error === 'object' &&
    (v as { error: unknown }).error !== null
  );
}

export class KubeclawAgent {
  readonly endpoint: string;
  readonly publishableKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly visitorId: string | undefined;

  private sessionToken: string | null = null;
  private sessionConfig: KubeclawSessionConfig | null = null;
  /** De-dupes concurrent session exchanges. */
  private sessionInflight: Promise<SessionExchangeResponse> | null = null;

  constructor(options: KubeclawAgentOptions) {
    if (!options.publishableKey) {
      throw new KubeclawError('invalid_request', 'publishableKey is required');
    }
    this.endpoint = options.endpoint?.trim() || DEFAULT_ENDPOINT;
    this.publishableKey = options.publishableKey;
    this.visitorId = options.visitorId;
    // Bind so the user can pass a bare `fetch`.
    const impl = options.fetchImpl ?? globalThis.fetch;
    if (typeof impl !== 'function') {
      throw new KubeclawError('internal_error', 'No fetch implementation available');
    }
    this.fetchImpl = impl.bind(globalThis);
  }

  /** The session config from the last successful exchange, if any. */
  get config(): KubeclawSessionConfig | null {
    return this.sessionConfig;
  }

  /** Whether a session token is currently held. */
  get hasSession(): boolean {
    return this.sessionToken !== null;
  }

  /** Drop any cached session token/config. */
  reset(): void {
    this.sessionToken = null;
    this.sessionConfig = null;
    this.sessionInflight = null;
  }

  /**
   * Ensure a valid session exists, performing the session exchange if needed.
   * Returns the session config. De-dupes concurrent callers.
   */
  async ensureSession(force = false): Promise<KubeclawSessionConfig> {
    if (!force && this.sessionToken && this.sessionConfig) {
      return this.sessionConfig;
    }
    if (force) {
      this.sessionToken = null;
      this.sessionConfig = null;
    }
    if (!this.sessionInflight) {
      this.sessionInflight = this.exchangeSession().finally(() => {
        this.sessionInflight = null;
      });
    }
    const res = await this.sessionInflight;
    return res.config;
  }

  private async exchangeSession(): Promise<SessionExchangeResponse> {
    const url = joinUrl(this.endpoint, '/v1/embed/session');
    const body: Record<string, unknown> = { publishable_key: this.publishableKey };
    if (this.visitorId) body['visitor_id'] = this.visitorId;

    let resp: Response;
    try {
      resp = await this.fetchImpl(url, {
        method: 'POST',
        // Browser auto-sends Origin; never set it manually.
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'omit',
      });
    } catch (e) {
      throw new KubeclawError(
        'internal_error',
        `Network error during session exchange: ${(e as Error).message}`,
      );
    }

    if (!resp.ok) {
      throw await this.errorFromResponse(resp, 'Session exchange failed');
    }

    let json: unknown;
    try {
      json = await resp.json();
    } catch {
      throw new KubeclawError('internal_error', 'Malformed session response', resp.status);
    }
    const data = json as SessionExchangeResponse;
    if (!data || typeof data.session_token !== 'string' || !data.config) {
      throw new KubeclawError('internal_error', 'Invalid session response shape', resp.status);
    }

    this.sessionToken = data.session_token;
    this.sessionConfig = data.config;
    return data;
  }

  private async errorFromResponse(resp: Response, fallback: string): Promise<KubeclawError> {
    let code = 'internal_error';
    let message = fallback;
    try {
      const json: unknown = await resp.json();
      if (isErrorEnvelope(json)) {
        code = json.error.code || code;
        message = json.error.message || message;
      }
    } catch {
      // Non-JSON body — keep fallback message.
    }
    if (resp.status === 401 && code === 'internal_error') code = 'session_expired';
    if (resp.status === 429 && code === 'internal_error') code = 'rate_limited';
    return new KubeclawError(code, message, resp.status);
  }

  /**
   * Send a user message and stream the assistant reply.
   *
   * Returns an async-iterable of text deltas plus a `.text` promise that
   * resolves to the assembled final reply. Bootstraps the session and retries
   * once on session expiry.
   */
  send(message: string): SendResult {
    let resolveText!: (v: string) => void;
    let rejectText!: (e: unknown) => void;
    const textPromise = new Promise<string>((res, rej) => {
      resolveText = res;
      rejectText = rej;
    });
    // Avoid unhandled rejection if caller never awaits `.text`.
    textPromise.catch(() => {});

    const self = this;
    async function* generator(): AsyncGenerator<string, void, void> {
      let assembled = '';
      try {
        await self.ensureSession();
        // First attempt; on 401/session_expired, refresh once and retry.
        let stream: ReadableStream<Uint8Array>;
        try {
          stream = await self.openChatStream(message);
        } catch (e) {
          if (e instanceof KubeclawError && self.isExpiry(e)) {
            await self.ensureSession(true);
            stream = await self.openChatStream(message);
          } else {
            throw e;
          }
        }

        for await (const sse of parseSSEStream(stream)) {
          if (sse.data === '') continue;
          let evt: StreamEvent;
          try {
            evt = JSON.parse(sse.data) as StreamEvent;
          } catch {
            // Ignore non-JSON keepalive/comment payloads.
            continue;
          }
          if (evt.type === 'delta') {
            if (evt.text) {
              assembled += evt.text;
              yield evt.text;
            }
          } else if (evt.type === 'done') {
            break;
          } else if (evt.type === 'error') {
            throw new KubeclawError(evt.code, evt.message);
          }
        }
        resolveText(assembled);
      } catch (e) {
        rejectText(e);
        throw e;
      }
    }

    const iterable = generator();
    return {
      [Symbol.asyncIterator]: () => iterable,
      text: textPromise,
    };
  }

  private isExpiry(e: KubeclawError): boolean {
    return e.status === 401 || e.code === 'session_expired';
  }

  private async openChatStream(message: string): Promise<ReadableStream<Uint8Array>> {
    if (!this.sessionToken) {
      throw new KubeclawError('session_expired', 'No active session');
    }
    const url = joinUrl(this.endpoint, '/v1/embed/chat');
    let resp: Response;
    try {
      resp = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
        credentials: 'omit',
      });
    } catch (e) {
      throw new KubeclawError(
        'internal_error',
        `Network error during chat stream: ${(e as Error).message}`,
      );
    }

    if (resp.status === 401) {
      throw new KubeclawError('session_expired', 'Session expired', 401);
    }
    if (!resp.ok) {
      throw await this.errorFromResponse(resp, 'Chat request failed');
    }
    if (!resp.body) {
      throw new KubeclawError('internal_error', 'Chat response had no body');
    }
    return resp.body;
  }
}
