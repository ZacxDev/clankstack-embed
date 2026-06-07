/**
 * @vitest-environment node
 *
 * In a non-DOM runtime (`DOMParser` undefined — e.g. SSR / plain Node), the
 * sanitizer takes the regex `stripHtmlFallback` path. These cases lock that
 * branch's behavior: it must still strip the dangerous script-bearing
 * constructs even without a real DOM to walk.
 */
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/markdown.js';

describe('renderMarkdown — non-DOM fallback (stripHtmlFallback)', () => {
  it('confirms no DOMParser in this environment (fallback path is active)', () => {
    expect(typeof DOMParser).toBe('undefined');
  });

  it('still renders ordinary markdown', () => {
    const out = renderMarkdown('**bold**');
    expect(out).toContain('<strong>bold</strong>');
  });

  it('strips raw <script> via the regex fallback', () => {
    // marked escapes inline HTML, but assert the fallback also strips it defensively.
    const out = renderMarkdown('text <script>alert(1)</script>').toLowerCase();
    expect(out).not.toContain('<script');
  });

  it('strips iframe/object/embed/style/link/meta tags via the regex fallback', () => {
    for (const tag of ['iframe', 'object', 'embed', 'style', 'link', 'meta']) {
      const out = renderMarkdown(`<${tag}>x</${tag}>`).toLowerCase();
      expect(out).not.toContain(`<${tag}`);
    }
  });

  it('strips javascript: substrings in the fallback path', () => {
    const out = renderMarkdown('[x](javascript:alert(1))').toLowerCase();
    expect(out).not.toContain('javascript:');
  });

  it('never throws on empty or malformed input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(() => renderMarkdown('](((')).not.toThrow();
  });
});
