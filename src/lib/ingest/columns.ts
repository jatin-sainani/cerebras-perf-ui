import type { CanonicalKey, ColumnDef } from './types';

/**
 * The column contract. The shipped sweeps use the labels in `aliases`, but the
 * matcher is deliberately tolerant (normalize -> exact -> alias -> fuzzy) so a
 * brand-new model (e.g. Model L) with slightly reworded headers still binds
 * with zero code edits.
 */
export const CANONICAL_COLUMNS: ColumnDef[] = [
  {
    key: 'inputLength',
    label: 'Input Length',
    unit: 'tok',
    kind: 'dimension',
    mergedDimension: true,
    required: true,
    aliases: ['input length', 'input len', 'prompt length', 'input tokens'],
  },
  {
    key: 'outputLength',
    label: 'Output Length',
    unit: 'tok',
    kind: 'dimension',
    mergedDimension: true,
    required: true,
    aliases: ['output length', 'output len', 'gen length', 'output tokens', 'generation length'],
  },
  {
    key: 'cachePct',
    label: 'Cache %',
    unit: '%',
    kind: 'dimension',
    mergedDimension: true,
    required: true,
    aliases: ['cache', 'cache pct', 'cache percent', 'cache hit', 'cache hit rate', 'cache ratio'],
  },
  {
    key: 'batchSize',
    label: 'Batch Size',
    unit: '',
    kind: 'dimension',
    required: true,
    aliases: ['batch size', 'batch', 'concurrency', 'num users', 'users', 'concurrent users'],
  },
  {
    key: 'maxMs',
    label: 'Max ms',
    unit: 'ms',
    kind: 'latency',
    aliases: ['max number of milliseconds', 'max ms', 'max milliseconds', 'max latency'],
  },
  {
    key: 'targetMaxMs',
    label: 'Target Max ms',
    unit: 'ms',
    kind: 'latency',
    aliases: ['target max number of milliseconds', 'target max ms', 'target max milliseconds', 'target latency'],
  },
  {
    key: 'promptOnlyThroughputTs',
    label: 'Prompt-only Throughput',
    unit: 'tok/s',
    kind: 'throughput',
    higherIsBetter: true,
    aliases: ['prompt only throughput', 'prompt only throughput t/s', 'prompt throughput'],
  },
  {
    key: 'genOnlyThroughputTs',
    label: 'Gen-only Throughput',
    unit: 'tok/s',
    kind: 'throughput',
    higherIsBetter: true,
    aliases: ['gen only throughput', 'gen only throughput t/s', 'generation throughput'],
  },
  {
    key: 'throughputTs',
    label: 'Throughput',
    unit: 'tok/s',
    kind: 'throughput',
    required: true,
    higherIsBetter: true,
    aliases: ['throughput', 'throughput t/s', 'total throughput', 'aggregate throughput'],
  },
  {
    key: 'throughputPerBoxTs',
    label: 'Throughput / box',
    unit: 'tok/s/hw',
    kind: 'efficiency',
    required: true,
    higherIsBetter: true,
    aliases: ['throughput / box', 'throughput per box', 'throughput / box t/s/hardware', 'throughput per hardware'],
  },
  {
    key: 'uncachedThroughputTs',
    label: 'Uncached Throughput',
    unit: 'tok/s',
    kind: 'throughput',
    higherIsBetter: true,
    aliases: ['uncached throughput', 'uncached throughput t/s'],
  },
  {
    key: 'uncachedThroughputPerBoxTs',
    label: 'Uncached Throughput / box',
    unit: 'tok/s/hw',
    kind: 'efficiency',
    higherIsBetter: true,
    aliases: ['uncached throughput / box', 'uncached throughput per box'],
  },
  {
    key: 'cachedThroughputTs',
    label: 'Cached Throughput',
    unit: 'tok/s',
    kind: 'throughput',
    higherIsBetter: true,
    aliases: ['cached throughput', 'cached throughput t/s'],
  },
  {
    key: 'cachedThroughputPerBoxTs',
    label: 'Cached Throughput / box',
    unit: 'tok/s/hw',
    kind: 'efficiency',
    higherIsBetter: true,
    aliases: ['cached throughput / box', 'cached throughput per box'],
  },
  {
    key: 'ttftMs',
    label: 'TTFT',
    unit: 'ms',
    kind: 'latency',
    required: true,
    higherIsBetter: false,
    aliases: ['ttft', 'ttft ms', 'time to first token', 'time to first token ms', 'first token latency'],
  },
  {
    key: 'realPromptSpeedTsUser',
    label: 'Real Prompt Speed',
    unit: 'tok/s/user',
    kind: 'perUser',
    higherIsBetter: true,
    aliases: ['real prompt speed', 'real prompt speed t/s/user', 'prompt speed'],
  },
  {
    key: 'promptSpeedQueuedTsUser',
    label: 'Prompt Speed (queued)',
    unit: 'tok/s/user',
    kind: 'perUser',
    higherIsBetter: true,
    aliases: ['prompt speed with queueing', 'prompt speed with queueing t/s/user', 'prompt speed queued', 'queued prompt speed'],
  },
  {
    key: 'genSpeedTsUser',
    label: 'Gen Speed',
    unit: 'tok/s/user',
    kind: 'perUser',
    required: true,
    higherIsBetter: true,
    aliases: ['gen speed', 'gen speed t/s/user', 'generation speed', 'per user gen speed', 'output speed', 'tokens per second per user'],
  },
  {
    key: 'rpm',
    label: 'RPM',
    unit: 'req/min',
    kind: 'rate',
    higherIsBetter: true,
    aliases: ['rpm', 'requests per minute', 'req/min', 'requests/min'],
  },
];

export const COLUMN_BY_KEY: Record<CanonicalKey, ColumnDef> = Object.fromEntries(
  CANONICAL_COLUMNS.map((c) => [c.key, c]),
) as Record<CanonicalKey, ColumnDef>;

export const REQUIRED_KEYS: CanonicalKey[] = CANONICAL_COLUMNS.filter((c) => c.required).map(
  (c) => c.key,
);

export const MERGED_DIMENSION_KEYS: CanonicalKey[] = CANONICAL_COLUMNS.filter(
  (c) => c.mergedDimension,
).map((c) => c.key);

/**
 * Normalize a header cell: lowercase, drop parenthetical units, strip unit
 * tokens and punctuation, collapse whitespace. "TTFT (ms)" -> "ttft".
 */
export function normalizeHeader(raw: unknown): string {
  if (raw == null) return '';
  return String(raw)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // remove parenthetical units e.g. "(ms)"
    .replace(/\b(t\/s\/user|t\/s|tok\/s|tokens?\/s|ms|milliseconds?|req\/min|rpm)\b/g, ' ')
    .replace(/[%#]/g, ' ')
    .replace(/[_/\\-]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Token-overlap (Jaccard) similarity between two normalized header strings. */
function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}

// Precompute normalized aliases per column.
const NORMALIZED_ALIASES: { key: CanonicalKey; norms: string[] }[] = CANONICAL_COLUMNS.map((c) => ({
  key: c.key,
  norms: [normalizeHeader(c.label), ...c.aliases.map(normalizeHeader)].filter(Boolean),
}));

export interface HeaderMatch {
  key: CanonicalKey;
  score: number; // 1 = exact/alias, <1 = fuzzy
}

/**
 * Map a single raw header to a canonical key. Returns null if nothing clears
 * the fuzzy threshold. Exact/alias matches score 1.0; otherwise best token
 * overlap above 0.5.
 */
export function matchHeader(rawHeader: unknown): HeaderMatch | null {
  const norm = normalizeHeader(rawHeader);
  if (!norm) return null;

  // Exact / alias match.
  for (const { key, norms } of NORMALIZED_ALIASES) {
    if (norms.includes(norm)) return { key, score: 1 };
  }

  // Fuzzy fallback by token overlap.
  let best: HeaderMatch | null = null;
  for (const { key, norms } of NORMALIZED_ALIASES) {
    for (const n of norms) {
      const s = tokenSimilarity(norm, n);
      if (s > (best?.score ?? 0)) best = { key, score: s };
    }
  }
  return best && best.score >= 0.5 ? best : null;
}

/**
 * Given a candidate header row, resolve each cell to a canonical key.
 * The same canonical key may be matched by multiple cells (e.g. fuzzy
 * collisions); we keep the highest-scoring column index per key.
 */
export function resolveHeaderRow(row: unknown[]): {
  columnIndex: Partial<Record<CanonicalKey, number>>;
  matchedCount: number;
} {
  const bestPerKey: Partial<Record<CanonicalKey, { index: number; score: number }>> = {};
  row.forEach((cell, index) => {
    const m = matchHeader(cell);
    if (!m) return;
    const prev = bestPerKey[m.key];
    if (!prev || m.score > prev.score) bestPerKey[m.key] = { index, score: m.score };
  });
  const columnIndex: Partial<Record<CanonicalKey, number>> = {};
  for (const [key, v] of Object.entries(bestPerKey)) {
    columnIndex[key as CanonicalKey] = v!.index;
  }
  return { columnIndex, matchedCount: Object.keys(columnIndex).length };
}
