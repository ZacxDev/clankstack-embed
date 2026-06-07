import { describe, it, expect } from 'vitest';
import { SSEParser, parseSSEStream } from '../src/sse.js';

describe('SSEParser', () => {
  it('parses a single data event', () => {
    const p = new SSEParser();
    const events = p.push('data: hello\n\n');
    expect(events).toHaveLength(1);
    expect(events[0]?.data).toBe('hello');
    expect(events[0]?.event).toBe('message');
  });

  it('parses multiple events in one chunk', () => {
    const p = new SSEParser();
    const events = p.push('data: a\n\ndata: b\n\ndata: c\n\n');
    expect(events.map((e) => e.data)).toEqual(['a', 'b', 'c']);
  });

  it('reassembles an event split across partial chunks', () => {
    const p = new SSEParser();
    expect(p.push('data: hel')).toEqual([]);
    expect(p.push('lo wor')).toEqual([]);
    const events = p.push('ld\n\n');
    expect(events).toHaveLength(1);
    expect(events[0]?.data).toBe('hello world');
  });

  it('handles event boundary split across chunks (\\n then \\n)', () => {
    const p = new SSEParser();
    expect(p.push('data: x\n')).toEqual([]); // first newline only
    const events = p.push('\n'); // completing blank line
    expect(events).toHaveLength(1);
    expect(events[0]?.data).toBe('x');
  });

  it('joins multiple data lines within one event with newlines', () => {
    const p = new SSEParser();
    const events = p.push('data: line1\ndata: line2\n\n');
    expect(events).toHaveLength(1);
    expect(events[0]?.data).toBe('line1\nline2');
  });

  it('strips a single leading space after the colon', () => {
    const p = new SSEParser();
    const events = p.push('data:  two-spaces\n\n');
    expect(events[0]?.data).toBe(' two-spaces');
  });

  it('ignores comment lines and empty heartbeats', () => {
    const p = new SSEParser();
    const events = p.push(': keep-alive comment\n\ndata: real\n\n');
    expect(events).toHaveLength(1);
    expect(events[0]?.data).toBe('real');
  });

  it('parses event type and id fields', () => {
    const p = new SSEParser();
    const events = p.push('event: delta\nid: 42\ndata: {"x":1}\n\n');
    expect(events[0]?.event).toBe('delta');
    expect(events[0]?.id).toBe('42');
    expect(events[0]?.data).toBe('{"x":1}');
  });

  it('handles \\r\\n line endings', () => {
    const p = new SSEParser();
    const events = p.push('data: crlf\r\n\r\n');
    expect(events).toHaveLength(1);
    expect(events[0]?.data).toBe('crlf');
  });

  it('handles \\r\\n boundary split across chunks', () => {
    const p = new SSEParser();
    // \r at the very end must wait until next chunk to disambiguate \r\n.
    expect(p.push('data: y\r')).toEqual([]);
    expect(p.push('\n\r\n')).toEqual([{ event: 'message', data: 'y' }]);
  });

  it('flushes a final event with no trailing blank line', () => {
    const p = new SSEParser();
    expect(p.push('data: trailing')).toEqual([]);
    const flushed = p.flush();
    expect(flushed).toHaveLength(1);
    expect(flushed[0]?.data).toBe('trailing');
  });

  it('parses a realistic broker delta/done sequence', () => {
    const p = new SSEParser();
    const chunk =
      'data: {"type":"delta","text":"Hel"}\n\n' +
      'data: {"type":"delta","text":"lo"}\n\n' +
      'data: {"type":"done"}\n\n';
    const events = p.push(chunk);
    expect(events).toHaveLength(3);
    const payloads = events.map((e) => JSON.parse(e.data));
    expect(payloads[0]).toEqual({ type: 'delta', text: 'Hel' });
    expect(payloads[2]).toEqual({ type: 'done' });
  });
});

describe('parseSSEStream', () => {
  function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
    const enc = new TextEncoder();
    let i = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < chunks.length) {
          controller.enqueue(enc.encode(chunks[i++]!));
        } else {
          controller.close();
        }
      },
    });
  }

  it('yields events from a chunked byte stream', async () => {
    const stream = streamOf('data: {"type":"de', 'lta","text":"hi"}\n\n', 'data: {"type":"done"}\n\n');
    const out: string[] = [];
    for await (const ev of parseSSEStream(stream)) out.push(ev.data);
    expect(out).toEqual(['{"type":"delta","text":"hi"}', '{"type":"done"}']);
  });

  it('handles multi-byte UTF-8 split across chunk boundaries', async () => {
    const enc = new TextEncoder();
    const bytes = enc.encode('data: café\n\n'); // é is 2 bytes
    // Split in the middle of the é byte sequence.
    const splitIdx = bytes.indexOf(0xc3) + 1; // between the two é bytes
    const a = bytes.slice(0, splitIdx);
    const b = bytes.slice(splitIdx);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(a);
        controller.enqueue(b);
        controller.close();
      },
    });
    const out: string[] = [];
    for await (const ev of parseSSEStream(stream)) out.push(ev.data);
    expect(out).toEqual(['café']);
  });
});
