// Core data model for a parsed perf sweep.
// A "sweep" = one model's projected performance for one traffic profile,
// expressed as a set of rows keyed by batch size.

export type ColumnKind =
  | 'dimension' // workload knobs (input/output length, cache %, batch size)
  | 'throughput' // aggregate tokens/sec across all users
  | 'latency' // time-to-first-token, ms budgets
  | 'perUser' // per-user speeds (tok/s/user)
  | 'efficiency' // per-box / per-hardware figures (cost proxy)
  | 'rate' // requests/min
  | 'other';

/** Canonical, code-stable keys. UI and analysis only ever reference these. */
export type CanonicalKey =
  | 'inputLength'
  | 'outputLength'
  | 'cachePct'
  | 'batchSize'
  | 'maxMs'
  | 'targetMaxMs'
  | 'promptOnlyThroughputTs'
  | 'genOnlyThroughputTs'
  | 'throughputTs'
  | 'throughputPerBoxTs'
  | 'uncachedThroughputTs'
  | 'uncachedThroughputPerBoxTs'
  | 'cachedThroughputTs'
  | 'cachedThroughputPerBoxTs'
  | 'ttftMs'
  | 'realPromptSpeedTsUser'
  | 'promptSpeedQueuedTsUser'
  | 'genSpeedTsUser'
  | 'rpm';

export interface ColumnDef {
  key: CanonicalKey;
  /** Human label shown in tables/charts. */
  label: string;
  /** Short unit suffix, e.g. "tok/s", "ms". */
  unit: string;
  kind: ColumnKind;
  /** Lowercased normalized header strings that should map to this key. */
  aliases: string[];
  /** Whether a sweep is unusable without this column. */
  required?: boolean;
  /** A row carrying this dimension value only on the first row of a block. */
  mergedDimension?: boolean;
  /** Higher is better? Used for "best in column" highlighting. */
  higherIsBetter?: boolean;
}

/** One row of a sweep, at a single batch size. All metrics optional except batchSize. */
export interface SweepRow {
  batchSize: number;
  inputLength: number;
  outputLength: number;
  cachePct: number; // normalized 0..1

  maxMs?: number;
  targetMaxMs?: number;
  promptOnlyThroughputTs?: number;
  genOnlyThroughputTs?: number;
  throughputTs?: number;
  throughputPerBoxTs?: number;
  uncachedThroughputTs?: number;
  uncachedThroughputPerBoxTs?: number;
  cachedThroughputTs?: number;
  cachedThroughputPerBoxTs?: number;
  ttftMs?: number;
  realPromptSpeedTsUser?: number;
  promptSpeedQueuedTsUser?: number;
  genSpeedTsUser?: number;
  rpm?: number;

  /** Original header -> raw cell value, preserved for the engineer raw table. */
  raw: Record<string, number | string | null>;
}

/** The workload shape a profile represents. */
export interface Profile {
  inputLength: number;
  outputLength: number;
  cachePct: number;
}

export type StatusLevel = 'ok' | 'warn' | 'error';

export interface SweepStatus {
  level: StatusLevel;
  messages: string[];
  identityInferred: boolean;
}

export interface ParsedSweep {
  /** Stable id: `${model}__profile_${profile}`. */
  id: string;
  model: string; // e.g. "A".."L" — never enumerated in code
  profile: number; // 1..7 (or any int)
  workload: Profile;
  rows: SweepRow[]; // sorted ascending by batchSize
  fileName: string;
  status: SweepStatus;
  /** Canonical keys actually found in this file. */
  presentColumns: CanonicalKey[];
}
