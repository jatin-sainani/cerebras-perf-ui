import type { CanonicalKey } from './types';

/** Parse a possibly-stringy cell into a number, stripping %, commas, units. */
export function coerceNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const cleaned = String(value)
    .replace(/[,\s]/g, '')
    .replace(/%/g, '')
    .replace(/(t\/s\/user|t\/s|tok\/s|ms|req\/min|rpm)$/i, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Normalize a cache value to a 0..1 fraction. Sheets may store 0.5 (fraction)
 * or 50 (percent); anything > 1 is treated as a percent.
 */
export function normalizeCachePct(value: unknown): number | undefined {
  const n = coerceNumber(value);
  if (n == null) return undefined;
  return n > 1 ? n / 100 : n;
}

/** Detect whether a coerced value should be normalized as a cache fraction. */
export const CACHE_KEY: CanonicalKey = 'cachePct';
