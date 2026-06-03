/** Compact number formatting for dashboards: 1.2K, 3.4M, etc. */
export function fmtNum(v: number | undefined | null, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(digits)}K`;
  if (abs >= 100) return v.toFixed(0);
  return v.toFixed(digits);
}

export function fmtInt(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString();
}

export function fmtPct(v: number | undefined | null, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtMs(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v < 1) return `${(v * 1000).toFixed(0)}µs`;
  if (v >= 1000) return `${(v / 1000).toFixed(2)}s`;
  return `${v.toFixed(v < 10 ? 1 : 0)}ms`;
}
