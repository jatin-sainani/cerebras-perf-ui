import type { ParsedSweep } from '../ingest/types';

/**
 * When several sweeps are selected, the comparison usually falls on one of two
 * axes. We auto-detect which dominates so the UI can label charts sensibly,
 * while still supporting a mixed selection.
 */
export type CompareAxis = 'models' | 'profiles' | 'mixed' | 'single';

export function detectAxis(sweeps: ParsedSweep[]): CompareAxis {
  if (sweeps.length <= 1) return 'single';
  const models = new Set(sweeps.map((s) => s.model));
  const profiles = new Set(sweeps.map((s) => s.profile));
  if (models.size > 1 && profiles.size === 1) return 'models'; // many models, one workload
  if (models.size === 1 && profiles.size > 1) return 'profiles'; // one model, many workloads
  return 'mixed';
}

export function axisLabel(axis: CompareAxis): string {
  switch (axis) {
    case 'models':
      return 'Comparing models on one workload';
    case 'profiles':
      return 'Comparing workloads for one model';
    case 'mixed':
      return 'Comparing across models and workloads';
    default:
      return '';
  }
}

/** A stable, readable label for a sweep within a comparison. */
export function sweepLabel(s: ParsedSweep, axis: CompareAxis): string {
  switch (axis) {
    case 'models':
      return `Model ${s.model}`;
    case 'profiles':
      return `Profile ${s.profile}`;
    default:
      return `${s.model} · P${s.profile}`;
  }
}

/** Deterministic color per sweep id, stable across renders. */
const PALETTE = [
  '#ea580c', '#2563eb', '#16a34a', '#9333ea', '#dc2626',
  '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#65a30d',
  '#0d9488', '#e11d48',
];
export function colorForIndex(i: number): string {
  return PALETTE[i % PALETTE.length];
}

/**
 * Align selected sweeps on a shared batch-size axis for overlay charts.
 * Returns one row per batch size present in any sweep, with a column per sweep.
 */
export function overlaySeries(
  sweeps: ParsedSweep[],
  metric: keyof import('../ingest/types').SweepRow,
): { batchSize: number; [seriesId: string]: number }[] {
  const batches = new Set<number>();
  for (const s of sweeps) for (const r of s.rows) batches.add(r.batchSize);
  const sorted = [...batches].sort((a, b) => a - b);
  return sorted.map((b) => {
    const point: { batchSize: number; [k: string]: number } = { batchSize: b };
    for (const s of sweeps) {
      const row = s.rows.find((r) => r.batchSize === b);
      const v = row ? (row[metric] as number | undefined) : undefined;
      if (v != null) point[s.id] = v;
    }
    return point;
  });
}
