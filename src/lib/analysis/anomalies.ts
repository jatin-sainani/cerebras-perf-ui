import type { ParsedSweep, SweepRow } from '../ingest/types';

export type AnomalySeverity = 'info' | 'warn' | 'critical';

export interface Anomaly {
  severity: AnomalySeverity;
  title: string;
  detail: string;
  /** Batch sizes implicated, for on-chart markers. */
  batchSizes: number[];
}

/** Numeric series (batch, value) for a metric, skipping missing values. */
function series(rows: SweepRow[], metric: keyof SweepRow): { batch: number; v: number }[] {
  return rows
    .map((r) => ({ batch: r.batchSize, v: r[metric] as number | undefined }))
    .filter((p): p is { batch: number; v: number } => p.v != null);
}

function zOutliers(values: number[]): number[] {
  const n = values.length;
  if (n < 4) return [];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  if (sd === 0) return [];
  return values.map((v, i) => (Math.abs((v - mean) / sd) > 3 ? i : -1)).filter((i) => i >= 0);
}

/**
 * Heuristic sanity checks an engineer would run on a projection. These are the
 * "does this curve look physically plausible?" tests; a clean sweep yields none.
 */
export function detectAnomalies(sweep: ParsedSweep): Anomaly[] {
  const out: Anomaly[] = [];
  const rows = sweep.rows;
  if (rows.length < 2) return out;

  // 1. Total throughput should rise (then saturate) with batch size.
  const tp = series(rows, 'throughputTs');
  for (let i = 1; i < tp.length; i++) {
    if (tp[i].v < tp[i - 1].v * 0.98) {
      out.push({
        severity: 'warn',
        title: 'Throughput drops as batch grows',
        detail: `Total throughput fell from ${tp[i - 1].v.toFixed(0)} to ${tp[i].v.toFixed(0)} tok/s between batch ${tp[i - 1].batch} and ${tp[i].batch}. Aggregate throughput should rise or plateau with batch size.`,
        batchSizes: [tp[i - 1].batch, tp[i].batch],
      });
    }
  }

  // 2. Per-user gen speed should fall (or hold) as batch grows.
  const gs = series(rows, 'genSpeedTsUser');
  for (let i = 1; i < gs.length; i++) {
    if (gs[i].v > gs[i - 1].v * 1.02) {
      out.push({
        severity: 'warn',
        title: 'Per-user speed rises with batch',
        detail: `Gen speed went up from ${gs[i - 1].v.toFixed(0)} to ${gs[i].v.toFixed(0)} tok/s/user between batch ${gs[i - 1].batch} and ${gs[i].batch}. More concurrent users should not make each user faster.`,
        batchSizes: [gs[i - 1].batch, gs[i].batch],
      });
    }
  }

  // 3. TTFT should be non-decreasing with batch; flag sharp spikes.
  const tt = series(rows, 'ttftMs');
  for (let i = 1; i < tt.length; i++) {
    if (tt[i].v > tt[i - 1].v * 2 && tt[i].v - tt[i - 1].v > 5) {
      out.push({
        severity: 'info',
        title: 'TTFT spike',
        detail: `TTFT jumped from ${tt[i - 1].v.toFixed(0)}ms to ${tt[i].v.toFixed(0)}ms at batch ${tt[i].batch} (>2x). Worth confirming the queueing model.`,
        batchSizes: [tt[i].batch],
      });
    }
  }

  // 4. Per-box efficiency collapse.
  const pb = series(rows, 'throughputPerBoxTs');
  for (let i = 1; i < pb.length; i++) {
    if (pb[i].v < pb[i - 1].v * 0.85) {
      out.push({
        severity: 'info',
        title: 'Per-box efficiency drop',
        detail: `Throughput/box fell ${(((pb[i - 1].v - pb[i].v) / pb[i - 1].v) * 100).toFixed(0)}% at batch ${pb[i].batch}. Past this point you pay more hardware for less marginal throughput.`,
        batchSizes: [pb[i].batch],
      });
    }
  }

  // 5. Statistical outliers on the headline metrics.
  for (const metric of ['throughputTs', 'ttftMs', 'genSpeedTsUser'] as const) {
    const s = series(rows, metric);
    const idx = zOutliers(s.map((p) => p.v));
    if (idx.length > 0) {
      out.push({
        severity: 'info',
        title: `Outlier in ${metric}`,
        detail: `Value(s) at batch ${idx.map((i) => s[i].batch).join(', ')} are >3σ from the mean for this sweep.`,
        batchSizes: idx.map((i) => s[i].batch),
      });
    }
  }

  return out;
}
