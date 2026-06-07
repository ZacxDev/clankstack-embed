/**
 * <clankstack-agent> — embeddable streaming agent chat web component.
 *
 * Built on top of the headless {@link ClankstackAgent} SDK (single source of
 * truth for the wire protocol). Shadow DOM for full style encapsulation;
 * theming via CSS custom properties and ::part() hooks.
 */
import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { classMap } from 'lit/directives/class-map.js';
import { ClankstackAgent } from './client.js';
import { renderMarkdown } from './markdown.js';
import { ClankstackError, type ClankstackSessionConfig } from './types.js';

type Mode = 'inline' | 'popup' | 'fullscreen';
type ThemeAttr = 'light' | 'dark' | 'auto';
type Role = 'user' | 'assistant';

interface ChatMessage {
  id: number;
  role: Role;
  /** Raw markdown/text content. */
  content: string;
  /** True while this assistant message is still streaming. */
  streaming?: boolean;
  /** Set when this message is an error bubble. */
  error?: boolean;
}

const VISITOR_KEY = 'clankstack:visitor_id';

let messageSeq = 0;

@customElement('clankstack-agent')
export class ClankstackAgentElement extends LitElement {
  // ---- Public reactive attributes ----
  @property({ attribute: 'publishable-key' }) publishableKey = '';
  @property() endpoint = 'https://api.clankstack.dev';
  @property() agent = '';
  @property() mode: Mode = 'popup';
  @property() theme: ThemeAttr = 'auto';
  @property() title = '';
  @property() greeting = '';
  @property() placeholder = 'Ask anything…';
  @property({ attribute: 'persist-session', type: Boolean }) persistSession = false;

  // ---- Internal state ----
  @state() private open_ = false;
  @state() private messages: ChatMessage[] = [];
  @state() private streaming = false;
  @state() private ready = false;
  @state() private resolvedTitle = '';
  @state() private resolvedGreeting = '';
  @state() private draft = '';

  private client: ClankstackAgent | null = null;
  private sessionConfig: ClankstackSessionConfig | null = null;
  private abortStream: (() => void) | null = null;

  static override styles = css`
    :host {
      --cs-accent: #6d28d9;
      --cs-accent-fg: #ffffff;
      --cs-radius: 16px;
      --cs-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica,
        Arial, sans-serif;
      --cs-bg: #ffffff;
      --cs-fg: #1f2330;
      --cs-surface: #f4f5f7;
      --cs-surface-2: #eceef1;
      --cs-border: #e2e4e9;
      --cs-muted: #6b7280;
      --cs-user-bg: var(--cs-accent);
      --cs-user-fg: var(--cs-accent-fg);
      --cs-shadow: 0 12px 40px rgba(15, 18, 30, 0.18);
      --cs-z: 2147483000;

      font-family: var(--cs-font);
      color: var(--cs-fg);
      box-sizing: border-box;
    }
    :host([theme='dark']),
    :host([data-resolved-theme='dark']) {
      --cs-bg: #16181d;
      --cs-fg: #f2f3f5;
      --cs-surface: #21242b;
      --cs-surface-2: #2a2e37;
      --cs-border: #353a44;
      --cs-muted: #9aa1ad;
      --cs-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    }
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    /* ---- Launcher (popup mode) ---- */
    .launcher {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: var(--cs-accent);
      color: var(--cs-accent-fg);
      cursor: pointer;
      box-shadow: var(--cs-shadow);
      display: grid;
      place-items: center;
      z-index: var(--cs-z);
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }
    .launcher:hover {
      transform: translateY(-2px) scale(1.03);
    }
    .launcher:focus-visible {
      outline: 3px solid var(--cs-accent);
      outline-offset: 3px;
    }
    .launcher svg {
      width: 26px;
      height: 26px;
    }

    /* ---- Panel ---- */
    .panel {
      display: flex;
      flex-direction: column;
      background: var(--cs-bg);
      color: var(--cs-fg);
      border: 1px solid var(--cs-border);
      border-radius: var(--cs-radius);
      box-shadow: var(--cs-shadow);
      overflow: hidden;
      min-height: 0;
    }
    :host([mode='popup']) .panel {
      position: fixed;
      bottom: 88px;
      right: 20px;
      width: min(384px, calc(100vw - 40px));
      height: min(560px, calc(100vh - 120px));
      z-index: var(--cs-z);
      transform-origin: bottom right;
      animation: kc-pop 0.18s ease;
    }
    :host([mode='inline']) .panel {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 420px;
    }
    :host([mode='fullscreen']) .panel {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      border-radius: 0;
      border: none;
      z-index: var(--cs-z);
    }
    @keyframes kc-pop {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .panel,
      .launcher {
        animation: none !important;
        transition: none !important;
      }
    }

    /* ---- Header ---- */
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: var(--cs-surface);
      border-bottom: 1px solid var(--cs-border);
      flex: 0 0 auto;
    }
    .header .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #2ecc71;
      flex: 0 0 auto;
    }
    .header .title {
      font-weight: 600;
      font-size: 15px;
      flex: 1 1 auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header .agent {
      font-size: 12px;
      color: var(--cs-muted);
    }
    .icon-btn {
      background: transparent;
      border: none;
      color: var(--cs-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 8px;
      display: grid;
      place-items: center;
    }
    .icon-btn:hover {
      background: var(--cs-surface-2);
      color: var(--cs-fg);
    }
    .icon-btn:focus-visible {
      outline: 2px solid var(--cs-accent);
    }

    /* ---- Messages ---- */
    .messages {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }
    @media (prefers-reduced-motion: reduce) {
      .messages {
        scroll-behavior: auto;
      }
    }
    .row {
      display: flex;
      max-width: 100%;
    }
    .row.user {
      justify-content: flex-end;
    }
    .bubble {
      max-width: 82%;
      padding: 9px 13px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    .bubble.assistant {
      background: var(--cs-surface);
      border-top-left-radius: 4px;
    }
    .bubble.user {
      background: var(--cs-user-bg);
      color: var(--cs-user-fg);
      border-top-right-radius: 4px;
    }
    .bubble.error {
      background: #fdecec;
      color: #8a1c1c;
      border: 1px solid #f3c2c2;
    }
    :host([theme='dark']) .bubble.error,
    :host([data-resolved-theme='dark']) .bubble.error {
      background: #3a1d1d;
      color: #ffb4b4;
      border-color: #5c2a2a;
    }
    .bubble :first-child {
      margin-top: 0;
    }
    .bubble :last-child {
      margin-bottom: 0;
    }
    .bubble p {
      margin: 0 0 8px;
    }
    .bubble pre {
      background: var(--cs-surface-2);
      padding: 10px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 12.5px;
    }
    .bubble code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.9em;
    }
    .bubble :not(pre) > code {
      background: var(--cs-surface-2);
      padding: 1px 5px;
      border-radius: 5px;
    }
    .bubble a {
      color: var(--cs-accent);
    }
    .bubble ul,
    .bubble ol {
      margin: 0 0 8px;
      padding-left: 20px;
    }

    /* Typing indicator */
    .typing {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding: 4px 2px;
    }
    .typing span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--cs-muted);
      animation: kc-blink 1.2s infinite ease-in-out both;
    }
    .typing span:nth-child(2) {
      animation-delay: 0.18s;
    }
    .typing span:nth-child(3) {
      animation-delay: 0.36s;
    }
    @keyframes kc-blink {
      0%,
      80%,
      100% {
        opacity: 0.25;
      }
      40% {
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .typing span {
        animation: none;
        opacity: 0.6;
      }
    }

    /* ---- Composer ---- */
    .composer {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      padding: 12px;
      border-top: 1px solid var(--cs-border);
      background: var(--cs-bg);
      flex: 0 0 auto;
    }
    .input {
      flex: 1 1 auto;
      resize: none;
      border: 1px solid var(--cs-border);
      border-radius: 12px;
      padding: 9px 12px;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.4;
      max-height: 120px;
      background: var(--cs-bg);
      color: var(--cs-fg);
      outline: none;
    }
    .input:focus {
      border-color: var(--cs-accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--cs-accent) 20%, transparent);
    }
    .input:disabled {
      opacity: 0.6;
    }
    .send {
      flex: 0 0 auto;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: var(--cs-accent);
      color: var(--cs-accent-fg);
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .send:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .send:focus-visible {
      outline: 2px solid var(--cs-accent);
      outline-offset: 2px;
    }
    .send svg {
      width: 18px;
      height: 18px;
    }
    .footer {
      text-align: center;
      font-size: 10.5px;
      color: var(--cs-muted);
      padding: 0 0 8px;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;

  // ---- Lifecycle ----
  override connectedCallback(): void {
    super.connectedCallback();
    this.applyResolvedTheme();
    if (this.theme === 'auto') {
      this.mql = window.matchMedia('(prefers-color-scheme: dark)');
      this.mql.addEventListener('change', this.onThemeChange);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.mql?.removeEventListener('change', this.onThemeChange);
    this.abortStream?.();
  }

  private mql: MediaQueryList | null = null;
  private onThemeChange = (): void => this.applyResolvedTheme();

  override firstUpdated(): void {
    this.bootstrap();
  }

  override updated(changed: PropertyValues): void {
    if (changed.has('theme')) {
      this.applyResolvedTheme();
    }
    if (
      changed.has('publishableKey') ||
      changed.has('endpoint') ||
      changed.has('persistSession')
    ) {
      if (this.hasUpdated && changed.size && this.ready) {
        // Re-create client if connection params changed after init.
        this.bootstrap();
      }
    }
  }

  private applyResolvedTheme(): void {
    let resolved: 'light' | 'dark' = 'light';
    if (this.theme === 'dark') resolved = 'dark';
    else if (this.theme === 'light') resolved = 'light';
    else resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    this.setAttribute('data-resolved-theme', resolved);
  }

  private bootstrap(): void {
    if (!this.publishableKey) {
      // eslint-disable-next-line no-console
      console.error('[clankstack-agent] publishable-key attribute is required');
      return;
    }
    const visitorId = this.persistSession ? this.getVisitorId() : undefined;
    this.client = new ClankstackAgent({
      endpoint: this.endpoint,
      publishableKey: this.publishableKey,
      ...(visitorId ? { visitorId } : {}),
    });
    this.resolvedTitle = this.title || 'Assistant';
    this.resolvedGreeting = this.greeting;
    this.ready = true;
    this.emit('clankstack:ready', {});
  }

  private getVisitorId(): string {
    try {
      const existing = localStorage.getItem(VISITOR_KEY);
      if (existing) return existing;
      const id = `vis_${crypto.randomUUID()}`;
      localStorage.setItem(VISITOR_KEY, id);
      return id;
    } catch {
      // localStorage unavailable (private mode) — ephemeral id.
      return `vis_${Math.random().toString(36).slice(2)}`;
    }
  }

  // ---- Session config resolution ----
  private async ensureConfig(): Promise<void> {
    if (!this.client || this.sessionConfig) return;
    try {
      const cfg = await this.client.ensureSession();
      this.sessionConfig = cfg;
      // Broker config can override title/greeting/agent unless host set them.
      if (!this.title && cfg.title) this.resolvedTitle = cfg.title;
      if (!this.greeting && cfg.greeting) this.resolvedGreeting = cfg.greeting;
      this.applyThemeConfig(cfg.theme);
      this.emit('clankstack:session', cfg);
      this.seedGreeting();
    } catch (e) {
      this.handleError(e);
    }
  }

  private applyThemeConfig(theme: ClankstackSessionConfig['theme']): void {
    if (!theme || typeof theme !== 'object') return;
    const map: Record<string, string> = {
      accent: '--cs-accent',
      accentFg: '--cs-accent-fg',
      radius: '--cs-radius',
      font: '--cs-font',
      bg: '--cs-bg',
      fg: '--cs-fg',
      surface: '--cs-surface',
    };
    for (const [key, cssVar] of Object.entries(map)) {
      const v = (theme as Record<string, unknown>)[key];
      if (typeof v === 'string' && v) this.style.setProperty(cssVar, v);
    }
  }

  private seedGreeting(): void {
    if (this.resolvedGreeting && this.messages.length === 0) {
      this.messages = [
        {
          id: ++messageSeq,
          role: 'assistant',
          content: this.resolvedGreeting,
        },
      ];
    }
  }

  // ---- Public imperative API ----
  open(): void {
    if (this.open_) return;
    this.open_ = true;
    void this.ensureConfig();
    this.emit('clankstack:open', {});
    this.updateComplete.then(() => this.focusInput());
  }

  close(): void {
    if (!this.open_) return;
    this.open_ = false;
    this.emit('clankstack:close', {});
  }

  reset(): void {
    this.abortStream?.();
    this.streaming = false;
    this.messages = [];
    this.sessionConfig = null;
    this.client?.reset();
    void this.ensureConfig();
  }

  async sendMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || this.streaming || !this.client) return;

    await this.ensureConfig();

    const userMsg: ChatMessage = {
      id: ++messageSeq,
      role: 'user',
      content: trimmed,
    };
    const assistantMsg: ChatMessage = {
      id: ++messageSeq,
      role: 'assistant',
      content: '',
      streaming: true,
    };
    this.messages = [...this.messages, userMsg, assistantMsg];
    this.streaming = true;
    this.emit('clankstack:message', { role: 'user', content: trimmed });
    this.scrollToBottom();

    let aborted = false;
    this.abortStream = () => {
      aborted = true;
    };

    try {
      const result = this.client.send(trimmed);
      for await (const delta of result) {
        if (aborted) break;
        assistantMsg.content += delta;
        this.bumpMessage(assistantMsg.id, { content: assistantMsg.content });
        this.scrollToBottom();
      }
      if (!aborted) {
        this.bumpMessage(assistantMsg.id, { streaming: false });
        this.emit('clankstack:message', {
          role: 'assistant',
          content: assistantMsg.content,
        });
      }
    } catch (e) {
      // Replace the (likely empty) streaming bubble with a friendly error.
      this.messages = this.messages.filter((m) => m.id !== assistantMsg.id);
      this.handleError(e);
    } finally {
      this.streaming = false;
      this.abortStream = null;
      this.scrollToBottom();
      this.updateComplete.then(() => this.focusInput());
    }
  }

  private bumpMessage(id: number, patch: Partial<ChatMessage>): void {
    this.messages = this.messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
  }

  private handleError(e: unknown): void {
    const err =
      e instanceof ClankstackError
        ? e
        : new ClankstackError('internal_error', (e as Error)?.message ?? 'Unknown error');
    const friendly = this.friendlyError(err);
    this.messages = [
      ...this.messages,
      { id: ++messageSeq, role: 'assistant', content: friendly, error: true },
    ];
    this.emit('clankstack:error', { code: err.code, message: err.message });
    this.scrollToBottom();
  }

  private friendlyError(err: ClankstackError): string {
    switch (err.code) {
      case 'quota_exceeded':
      case 'session_quota_exceeded':
        return 'This assistant is temporarily unavailable. Please try again later.';
      case 'rate_limited':
        return "You're sending messages too quickly — please slow down.";
      case 'origin_denied':
        return 'This assistant is not enabled for this site.';
      case 'embed_not_found':
        return 'This assistant is not configured. Please contact the site owner.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  // ---- UI events ----
  private onInput(e: Event): void {
    const ta = e.target as HTMLTextAreaElement;
    this.draft = ta.value;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  private onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.submit();
    }
  }

  private submit(): void {
    const text = this.draft.trim();
    if (!text || this.streaming) return;
    this.draft = '';
    const ta = this.renderRoot.querySelector('.input') as HTMLTextAreaElement | null;
    if (ta) ta.style.height = 'auto';
    void this.sendMessage(text);
  }

  private focusInput(): void {
    const ta = this.renderRoot.querySelector('.input') as HTMLTextAreaElement | null;
    ta?.focus();
  }

  private scrollToBottom(): void {
    this.updateComplete.then(() => {
      const list = this.renderRoot.querySelector('.messages');
      if (list) list.scrollTop = list.scrollHeight;
    });
  }

  private emit(name: string, detail: unknown): void {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true }),
    );
  }

  private toggle(): void {
    this.open_ ? this.close() : this.open();
  }

  // ---- Render ----
  override render() {
    const showLauncher = this.mode === 'popup';
    const showPanel = this.mode !== 'popup' || this.open_;
    return html`
      ${showLauncher ? this.renderLauncher() : nothing}
      ${showPanel ? this.renderPanel() : nothing}
    `;
  }

  private renderLauncher() {
    return html`
      <button
        class="launcher"
        part="launcher"
        @click=${this.toggle}
        aria-label=${this.open_ ? 'Close chat' : 'Open chat'}
        aria-expanded=${this.open_ ? 'true' : 'false'}
      >
        ${this.open_ ? closeIcon() : chatIcon()}
      </button>
    `;
  }

  private renderPanel() {
    return html`
      <section
        class="panel"
        part="panel"
        role="dialog"
        aria-label=${this.resolvedTitle || 'Chat'}
      >
        <header class="header" part="header">
          <span class="dot" aria-hidden="true"></span>
          <span class="title">${this.resolvedTitle}</span>
          ${this.agent || this.sessionConfig?.agent
            ? html`<span class="agent"
                >${this.agent || this.sessionConfig?.agent}</span
              >`
            : nothing}
          ${this.mode !== 'inline'
            ? html`<button
                class="icon-btn"
                part="close"
                @click=${this.close}
                aria-label="Close chat"
              >
                ${closeIcon()}
              </button>`
            : nothing}
        </header>

        <div
          class="messages"
          part="messages"
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
        >
          ${repeat(
            this.messages,
            (m) => m.id,
            (m) => this.renderMessage(m),
          )}
        </div>

        <form
          class="composer"
          part="composer"
          @submit=${(e: Event) => {
            e.preventDefault();
            this.submit();
          }}
        >
          <label class="sr-only" for="kc-input">Message</label>
          <textarea
            id="kc-input"
            class="input"
            part="input"
            rows="1"
            .value=${this.draft}
            placeholder=${this.placeholder}
            ?disabled=${this.streaming || !this.ready}
            aria-label="Message"
            @input=${this.onInput}
            @keydown=${this.onKeydown}
          ></textarea>
          <button
            class="send"
            part="send"
            type="submit"
            ?disabled=${this.streaming || !this.draft.trim() || !this.ready}
            aria-label="Send message"
          >
            ${sendIcon()}
          </button>
        </form>
      </section>
    `;
  }

  private renderMessage(m: ChatMessage) {
    const classes = classMap({
      bubble: true,
      [m.role]: true,
      error: Boolean(m.error),
    });
    const isEmptyStreaming = m.streaming && m.content.length === 0;
    const rendered =
      m.role === 'assistant' && !m.error
        ? unsafeHTML(renderMarkdown(m.content))
        : m.content;
    return html`
      <div class="row ${m.role}">
        <div class=${classes} part="message">
          ${isEmptyStreaming ? this.renderTyping() : rendered}
        </div>
      </div>
    `;
  }

  private renderTyping() {
    return html`<span class="typing" part="typing" aria-label="Assistant is typing">
      <span></span><span></span><span></span>
    </span>`;
  }
}

// ---- Inline SVG icons ----
function chatIcon() {
  return html`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-4.2 3.2A.6.6 0 0 1 4 18.7V5.5Z"
      fill="currentColor"
    />
  </svg>`;
}
function closeIcon() {
  return html`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M6 6l12 12M18 6L6 18"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  </svg>`;
}
function sendIcon() {
  return html`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M3.4 20.4 21 12 3.4 3.6 3.4 10l11 2-11 2v6.4Z"
      fill="currentColor"
    />
  </svg>`;
}

declare global {
  interface HTMLElementTagNameMap {
    'clankstack-agent': ClankstackAgentElement;
  }
}
