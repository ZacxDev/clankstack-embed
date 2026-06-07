/**
 * Shared types for the kubeclaw agent embed SDK + web component.
 *
 * These mirror the broker wire contract exactly. A Go broker is built in
 * parallel against the same contract; do not deviate from these shapes.
 */

/** Error codes the broker may return (session exchange or stream error events). */
export type KubeclawErrorCode =
  | 'origin_denied'
  | 'embed_not_found'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'session_quota_exceeded'
  | 'session_expired'
  | 'invalid_request'
  | 'internal_error'
  | (string & {});

/** Theme object passed through from the broker config (free-form). */
export interface KubeclawThemeConfig {
  [key: string]: unknown;
}

/** Config returned by the session exchange and surfaced to the host page. */
export interface KubeclawSessionConfig {
  title: string;
  greeting: string;
  theme: KubeclawThemeConfig;
  agent: string;
}

/** Successful session-exchange response body. */
export interface SessionExchangeResponse {
  session_token: string;
  expires_in: number;
  config: KubeclawSessionConfig;
}

/** Error envelope shared by the session exchange and (non-SSE) error bodies. */
export interface ErrorEnvelope {
  error: {
    code: KubeclawErrorCode;
    message: string;
  };
}

/** SSE event shapes emitted on the chat stream. */
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; code: KubeclawErrorCode; message: string };

/** Options for constructing the headless {@link KubeclawAgent} client. */
export interface KubeclawAgentOptions {
  /** Broker base URL, e.g. https://api.kubeclaw.dev (no trailing slash required). */
  endpoint?: string;
  /** Publishable key, e.g. pk_live_… */
  publishableKey: string;
  /**
   * Optional stable client id for returning-visitor continuity. Sent as a
   * best-effort hint; never contains sensitive data. The web component
   * generates/persists this in localStorage when `persist-session` is set.
   */
  visitorId?: string;
  /** Optional custom fetch (for testing / SSR-less environments). */
  fetchImpl?: typeof fetch;
}

/** Typed error thrown by the SDK for any broker/transport failure. */
export class KubeclawError extends Error {
  readonly code: KubeclawErrorCode;
  readonly status?: number;
  constructor(code: KubeclawErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'KubeclawError';
    this.code = code;
    this.status = status;
  }
}

export const DEFAULT_ENDPOINT = 'https://api.kubeclaw.dev';
