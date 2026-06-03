import type { ParsedSweep, Profile } from '../ingest/types';

/**
 * Heuristic use-case label for a traffic profile, derived purely from its
 * (input, output, cache) shape. No profile numbers are hard-coded — a new
 * profile gets classified the same way.
 */
export function classifyProfile(p: Profile): { label: string; rationale: string } {
  const { inputLength: inp, outputLength: out, cachePct: cache } = p;
  const ratio = out > 0 ? inp / out : Infinity;

  if (cache >= 0.5 && ratio >= 5) {
    return {
      label: 'RAG / repeated-context',
      rationale: 'Large input, small output, high cache reuse — long shared context answered concisely.',
    };
  }
  if (ratio >= 5) {
    return {
      label: 'Summarization / extraction',
      rationale: 'Long input, short output — condensing a large prompt into a small answer.',
    };
  }
  if (ratio <= 0.5) {
    return {
      label: 'Long-form generation',
      rationale: 'Short prompt, long output — drafting, code, or content generation.',
    };
  }
  if (cache >= 0.5) {
    return {
      label: 'Agentic / multi-turn',
      rationale: 'Balanced shape with high cache reuse — iterative tool/chat loops over shared state.',
    };
  }
  return {
    label: 'Interactive chat',
    rationale: 'Roughly balanced input and output with modest cache — conversational turns.',
  };
}

export interface SizeRank {
  model: string;
  /** Median per-user gen speed across the compared rows (lower => larger model). */
  medGenSpeed: number;
  /** Median throughput/box (lower => larger model). */
  medPerBox: number;
  /** Normalized 0..1 size proxy (1 = largest in the set). */
  sizeProxy: number;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Rank models by an inferred "size" proxy. A larger model is slower per user
 * and yields less throughput per box at the same workload, so we combine the
 * two (lower speed + lower per-box => larger). Only meaningful when comparing
 * models on the SAME profile; the caller should pass one profile's sweeps.
 */
export function rankBySize(sweeps: ParsedSweep[]): SizeRank[] {
  const byModel = new Map<string, ParsedSweep[]>();
  for (const s of sweeps) {
    const arr = byModel.get(s.model) ?? [];
    arr.push(s);
    byModel.set(s.model, arr);
  }

  const raw = [...byModel.entries()].map(([model, list]) => {
    const gen = list.flatMap((s) => s.rows.map((r) => r.genSpeedTsUser).filter((v): v is number => v != null));
    const box = list.flatMap((s) => s.rows.map((r) => r.throughputPerBoxTs).filter((v): v is number => v != null));
    return { model, medGenSpeed: median(gen), medPerBox: median(box) };
  });

  // Normalize each metric to 0..1, then size proxy = 1 - mean(normalized speed,
  // normalized per-box). Faster / more efficient => smaller.
  const norm = (vals: number[]) => {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    return (v: number) => (v - min) / span;
  };
  const ng = norm(raw.map((r) => r.medGenSpeed));
  const nb = norm(raw.map((r) => r.medPerBox));

  return raw
    .map((r) => ({
      ...r,
      sizeProxy: 1 - (ng(r.medGenSpeed) + nb(r.medPerBox)) / 2,
    }))
    .sort((a, b) => b.sizeProxy - a.sizeProxy);
}
