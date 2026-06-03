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
  it('shows welcome, loads samples, and renders a go/no-go verdict', async () => {
    render(<App />);

    // 1. Welcome / upload-first state.
    expect(screen.getByText(/Upload perf sweeps to begin/i)).toBeTruthy();

    // 2. Load the bundled sample sweeps (same path a real upload takes).
    fireEvent.click(screen.getByText(/Load sample data to explore/i));

    // 3. Sweeps appear in the selector grouped by model.
    await waitFor(() => expect(screen.getByText('Model A')).toBeTruthy(), { timeout: 5000 });

    // 4. Select everything, then the customer view scores GO/NO-GO.
    fireEvent.click(screen.getAllByText('All')[0]);
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
  });
});
