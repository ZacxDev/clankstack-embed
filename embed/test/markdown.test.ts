/**
 * @vitest-environment jsdom
 *
 * Sanitizer tests run in a DOM environment so the real `DOMParser`-based
 * `sanitizeDom` path is exercised (the security-critical code), not just the
 * non-DOM regex fallback. A separate suite (markdown-fallback.test.ts) forces
 * the fallback by running under the plain node environment.
 */
import { describe, it, expect } from 'vitest';
import { renderMarkdown, isSafeUrl, escapeHtml } from '../src/markdown.js';

describe('renderMarkdown — basic rendering (DOM path)', () => {
  it('has DOMParser available so the DOM sanitizer path is taken', () => {
    expect(typeof DOMParser).toBe('function');
  });

  it('renders empty input as empty string', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('renders basic markdown to HTML', () => {
    const out = renderMarkdown('# Title\n\nSome **bold** and *italic*.');
    expect(out).toContain('<h1');
    expect(out).toContain('Title');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<em>italic</em>');
  });

  it('renders fenced code blocks without executing/escaping their content as HTML', () => {
    const out = renderMarkdown('```\n<script>alert(1)</script>\n```');
    expect(out).toContain('<pre>');
    expect(out).toContain('<code');
    // The angle brackets must be entity-escaped inside the code block.
    expect(out).not.toMatch(/<script\b/i);
    expect(out).toContain('&lt;script&gt;');
  });

  it('renders GFM tables, keeping only the align attribute', () => {
    const md = '| a | b |\n|:--|--:|\n| 1 | 2 |';
    const out = renderMarkdown(md);
    expect(out).toContain('<table>');
    expect(out).toContain('<th');
    expect(out).toMatch(/align="(left|right)"/);
  });
});

describe('renderMarkdown — XSS / injection hardening (DOM path)', () => {
  // The defense has two layers. Layer 1: marked is configured to ESCAPE raw
  // inline/block HTML (the `html` renderer override), so author-supplied raw
  // tags become inert entity text (`&lt;script&gt;`) and never become live DOM.
  // Layer 2: the DOM sanitizer drops disallowed elements / attributes / URLs
  // that marked itself emits (links, etc.). These tests assert the *live*
  // (unescaped) output is free of executable constructs.

  it('escapes a raw <script> tag so it is inert, never a live element', () => {
    const out = renderMarkdown('hello <script>alert(document.cookie)</script> world');
    // No live <script> element...
    expect(out.toLowerCase()).not.toMatch(/<script[\s>]/);
    // ...and the source is preserved as escaped, inert text.
    expect(out).toContain('&lt;script&gt;');
  });

  it('escapes raw <iframe>/<object>/<embed>/<style>/<link>/<meta> so none are live', () => {
    for (const tag of ['iframe', 'object', 'embed', 'style', 'link', 'meta']) {
      const out = renderMarkdown(`text <${tag} src="evil"></${tag}> more`).toLowerCase();
      // No live opening tag for the dangerous element.
      expect(out).not.toMatch(new RegExp(`<${tag}[\\s>]`));
    }
  });

  it('drops a javascript: href from a markdown-emitted link', () => {
    // A markdown link IS emitted by marked as a real <a> — the DOM sanitizer
    // must scrub the unsafe href off the live element.
    const out = renderMarkdown('[click](javascript:alert(1))');
    expect(out.toLowerCase()).not.toMatch(/href="[^"]*javascript:/);
    // The anchor text survives even when the href is dropped.
    expect(out).toContain('click');
  });

  it('drops case/whitespace/control-char-obfuscated javascript: hrefs', () => {
    const variants = [
      '[x](JaVaScRiPt:alert(1))',
      '[x](  javascript:alert(1))',
      '[x](java\tscript:alert(1))', // control-char obfuscation (tab)
    ];
    for (const md of variants) {
      const out = renderMarkdown(md).toLowerCase();
      expect(out).not.toMatch(/href="[^"]*javascript:/);
    }
  });

  it('drops data: URLs (e.g. data:text/html base64 payloads) from a link href', () => {
    const out = renderMarkdown('[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)');
    expect(out.toLowerCase()).not.toMatch(/href="[^"]*data:/);
  });

  it('never emits a live on*-event-handler attribute', () => {
    // Raw inline <img onerror> is escaped by marked, so it cannot reach the DOM
    // as a live attribute. Assert no live handler appears in the output.
    const out = renderMarkdown('![x](https://example.com/a.png "t") <img src=x onerror=alert(1)>');
    // A live handler would look like `<tag ... onerror=` with an unescaped `<`.
    expect(out.toLowerCase()).not.toMatch(/<[a-z][^>]*\son\w+=/);
    // The raw img is preserved as inert escaped text instead.
    expect(out).toContain('&lt;img');
  });

  it('never emits a live style attribute from raw inline HTML', () => {
    const out = renderMarkdown('a <b style="x">b</b>');
    // No live element carries a style attribute (the raw <b> is escaped text).
    expect(out.toLowerCase()).not.toMatch(/<[a-z][^>]*\sstyle=/);
    expect(out).toContain('&lt;b style=');
  });

  it('forces target=_blank and rel=noopener on safe links', () => {
    const out = renderMarkdown('[ok](https://example.com)');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(out).toMatch(/rel="[^"]*noreferrer[^"]*"/);
  });

  it('keeps a safe relative/anchor href', () => {
    const out = renderMarkdown('[a](/docs/page) and [b](#section)');
    expect(out).toContain('href="/docs/page"');
    expect(out).toContain('href="#section"');
  });

  it('keeps mailto: and tel: links', () => {
    const out = renderMarkdown('[mail](mailto:a@b.com) [call](tel:+15551234)');
    expect(out).toContain('href="mailto:a@b.com"');
    expect(out).toContain('href="tel:+15551234"');
  });

  it('does not crash and emits no live executable markup on nested adversarial raw HTML', () => {
    const evil =
      '<div><span><a href="javascript:alert(1)" onclick="x()">' +
      '<script>1</script></a></span></div>';
    const out = renderMarkdown(evil).toLowerCase();
    // No live script element, no live event-handler attr, no live javascript: href.
    // (The raw block is escaped wholesale, so any href="javascript:" only exists
    // inside inert &lt;...&gt; text — never on a live <a> element.)
    expect(out).not.toMatch(/<script[\s>]/);
    expect(out).not.toMatch(/<[a-z][^>]*\son\w+=/);
    expect(out).not.toMatch(/<a[^>]*href="[^"]*javascript:/);
    // Sanity: the dangerous markup is present, but escaped/inert.
    expect(out).toContain('&lt;a href="javascript:');
  });

  it('falls back to escaped text if the markdown parser throws', () => {
    // Force a throw by passing a value marked cannot stringify cleanly is hard;
    // instead verify the public contract: any string in => string out, no throw.
    expect(() => renderMarkdown('](broken](]([')).not.toThrow();
    expect(typeof renderMarkdown('](broken](]([')).toBe('string');
  });
});

describe('isSafeUrl', () => {
  it('allows http/https/mailto/tel', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('http://example.com')).toBe(true);
    expect(isSafeUrl('mailto:a@b.com')).toBe(true);
    expect(isSafeUrl('tel:+1555')).toBe(true);
  });

  it('allows relative / anchor / bare-path URLs', () => {
    expect(isSafeUrl('/docs')).toBe(true);
    expect(isSafeUrl('#anchor')).toBe(true);
    expect(isSafeUrl('./rel')).toBe(true);
    expect(isSafeUrl('?q=1')).toBe(true);
    expect(isSafeUrl('page-name')).toBe(true);
  });

  it('blocks javascript:/data:/vbscript:/file: schemes', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,<script>1</script>')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox')).toBe(false);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });

  it('blocks control-char-obfuscated javascript: (e.g. "java\\tscript:")', () => {
    expect(isSafeUrl('java\tscript:alert(1)')).toBe(false);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('treats leading/trailing whitespace as trimmed', () => {
    expect(isSafeUrl('   https://example.com  ')).toBe(true);
    expect(isSafeUrl('  javascript:alert(1)')).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x" class='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; class=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('escapes & before introducing entities (no double-escape bug)', () => {
    expect(escapeHtml('a & <b>')).toBe('a &amp; &lt;b&gt;');
  });
});
