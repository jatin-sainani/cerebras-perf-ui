import type { ParsedSweep, SweepRow } from '../ingest/types';

/** What the customer/PM describes about their workload. */
export interface WorkloadSpec {
  /** Required per-user generation speed (tok/s/user). The "does it feel fast?" knob. */
  minGenSpeed: number;
  /** Maximum acceptable time-to-first-token (ms). */
  maxTtft: number;
  /** Optional minimum aggregate requests/min the deployment must sustain. */
  minRpm?: number;
}

export interface OperatingPoint {
  row: SweepRow;
  /** Boxes needed to serve `minRpm` (or 1 box's worth) at this row, >= 1. */
  boxesForRpm: number;
}

export interface SweepVerdict {
  sweep: ParsedSweep;
  pass: boolean;
  /** Best qualifying operating point (max total throughput among passing rows). */
  best?: OperatingPoint;
  /** Why it failed, when it did. */
  reasons: string[];
  /** Relative cost index (1 = cheapest passing model in the set). */
  costIndex?: number;
}

/** Boxes required to hit a target aggregate token rate at a given row. */
function boxesForThroughput(row: SweepRow, requiredTokPerSec: number): number {
  if (!row.throughputPerBoxTs || row.throughputPerBoxTs <= 0) return 1;
  return Math.max(1, Math.ceil(requiredTokPerSec / row.throughputPerBoxTs));
}

/**
 * Evaluate one sweep against the workload spec. A model PASSES if at least one
 * batch size meets both the per-user gen-speed floor and the TTFT ceiling (and
 * RPM floor when given). The reported operating point is the qualifying row
 * with the highest aggregate throughput (most headroom).
 */
export function evaluateSweep(sweep: ParsedSweep, spec: WorkloadSpec): SweepVerdict {
  const qualifying = sweep.rows.filter((r) => {
    if (r.genSpeedTsUser == null || r.genSpeedTsUser < spec.minGenSpeed) return false;
    if (r.ttftMs == null || r.ttftMs > spec.maxTtft) return false;
    if (spec.minRpm != null && (r.rpm == null || r.rpm < spec.minRpm)) return false;
    return true;
  });

  if (qualifying.length === 0) {
    const reasons: string[] = [];
    const maxGen = Math.max(...sweep.rows.map((r) => r.genSpeedTsUser ?? 0));
    const minTtft = Math.min(...sweep.rows.map((r) => r.ttftMs ?? Infinity));
    if (maxGen < spec.minGenSpeed)
      reasons.push(`Peak gen speed ${maxGen.toFixed(0)} < target ${spec.minGenSpeed} tok/s/user`);
    if (minTtft > spec.maxTtft)
      reasons.push(`Best TTFT ${minTtft.toFixed(0)}ms > budget ${spec.maxTtft}ms`);
    if (spec.minRpm != null) {
      const maxRpm = Math.max(...sweep.rows.map((r) => r.rpm ?? 0));
      if (maxRpm < spec.minRpm) reasons.push(`Peak ${maxRpm.toFixed(0)} RPM < target ${spec.minRpm}`);
    }
    if (reasons.length === 0) reasons.push('No batch size satisfies all constraints simultaneously');
    return { sweep, pass: false, reasons };
  }

  const best = qualifying.reduce((a, b) => ((b.throughputTs ?? 0) > (a.throughputTs ?? 0) ? b : a));
  const requiredTok = spec.minRpm != null ? (best.throughputTs ?? 0) : (best.throughputPerBoxTs ?? 0);
  const boxesForRpm =
    spec.minRpm != null
      ? boxesForThroughput(best, (best.throughputTs ?? 0) * (spec.minRpm / Math.max(best.rpm ?? 1, 1)))
      : 1;

  void requiredTok;
  return {
    sweep,
    pass: true,
    best: { row: best, boxesForRpm },
    reasons: [],
  };
}

/**
 * Evaluate a set of sweeps and assign a relative cost index across the passing
 * ones, using per-box throughput at the operating point as the cost proxy
 * (more boxes per unit of useful throughput = more expensive). 1.0 = cheapest.
 */
export function evaluateSet(sweeps: ParsedSweep[], spec: WorkloadSpec): SweepVerdict[] {
  const verdicts = sweeps.map((s) => evaluateSweep(s, spec));
  const passing = verdicts.filter((v) => v.pass && v.best);
  if (passing.length > 0) {
    // Cost per useful token ∝ 1 / throughputPerBox at the operating point.
    const costs = passing.map((v) => 1 / Math.max(v.best!.row.throughputPerBoxTs ?? 1, 1e-9));
    const minCost = Math.min(...costs);
    passing.forEach((v, i) => {
      v.costIndex = costs[i] / minCost;
    });
  }
  return verdicts;
}
