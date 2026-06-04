// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import App from '../App';

const ROOT = process.cwd();

// Serve /sample/* from the real public/ directory so the test exercises the
// actual load -> parse -> render pipeline the deployed app uses.
const realFetch = globalThis.fetch;
beforeAll(() => {
  // recharts/ResizeObserver shim (not used on the customer view, but safe).
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const rel = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    const path = join(ROOT, 'public', decodeURIComponent(rel));
    if (!existsSync(path)) return new Response('not found', { status: 404 });
    const buf = readFileSync(path);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    return new Response(ab, { status: 200 });
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
  cleanup();
});

describe('App renders and ingests uploads end to end', () => {
  it('auto-preloads the sample models and renders a go/no-go verdict', async () => {
    render(<App />);

    // 1. Sample models pre-load on mount (no click) and appear in the selector.
    await waitFor(() => expect(screen.getAllByText('Model A').length).toBeGreaterThan(0), {
      timeout: 12000,
    });

    // 2. The customer view scores GO/NO-GO on the auto-selected default set.
    await waitFor(() => {
      const verdicts = screen.getAllByText(/^(GO|NO-GO)$/);
      expect(verdicts.length).toBeGreaterThan(0);
    });

    // 5. Engineer view renders charts + anomaly panel + raw table without crashing.
    fireEvent.click(screen.getByText('Engineer'));
    await waitFor(() => expect(screen.getByText(/Latency vs throughput frontier/i)).toBeTruthy());
    expect(screen.getByText(/Config sensitivity/i)).toBeTruthy();
    expect(screen.getByText(/Raw projection/i)).toBeTruthy();

    // 6. Insights view derives model sizes + profile use-cases.
    fireEvent.click(screen.getByText('Insights'));
    await waitFor(() => expect(screen.getByText(/Inferred model size/i)).toBeTruthy());
    expect(screen.getByText(/Traffic profiles/i)).toBeTruthy();
  }, 20000);
});
