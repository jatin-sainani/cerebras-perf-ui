import * as XLSX from 'xlsx';
import type { CanonicalKey, ParsedSweep, SweepRow, SweepStatus } from './types';
import { MERGED_DIMENSION_KEYS, REQUIRED_KEYS, resolveHeaderRow, COLUMN_BY_KEY } from './columns';
import { coerceNumber, normalizeCachePct } from './coerce';
import { deriveIdentity } from './identity';

const SUMMARY_SHEET_HINTS = ['summary', 'sheet1', 'data'];
const HEADER_SCAN_ROWS = 12; // how many leading rows to scan for the header
const HEADER_MIN_MATCHES = 6; // minimum canonical columns to accept a header row

export interface ParseInput {
  fileName: string;
  relPath: string; // webkitRelativePath or ""
  buffer: ArrayBuffer;
}

/** Locate the most plausible worksheet: prefer a "Summary"-like name, else first. */
function pickSheet(wb: XLSX.WorkBook): { name: string; ws: XLSX.WorkSheet } | null {
  if (wb.SheetNames.length === 0) return null;
  const byHint = wb.SheetNames.find((n) => SUMMARY_SHEET_HINTS.includes(n.trim().toLowerCase()));
  const name = byHint ?? wb.SheetNames[0];
  return { name, ws: wb.Sheets[name] };
}

/** Find the header row index = the row (within the scan window) with the most matches. */
function findHeaderRow(matrix: unknown[][]): { index: number; columnIndex: Partial<Record<CanonicalKey, number>> } | null {
  let best: { index: number; columnIndex: Partial<Record<CanonicalKey, number>>; count: number } | null = null;
  const limit = Math.min(HEADER_SCAN_ROWS, matrix.length);
  for (let i = 0; i < limit; i++) {
    const { columnIndex, matchedCount } = resolveHeaderRow(matrix[i] ?? []);
    if (matchedCount > (best?.count ?? 0)) best = { index: i, columnIndex, count: matchedCount };
  }
  if (!best || best.count < HEADER_MIN_MATCHES) return null;
  return { index: best.index, columnIndex: best.columnIndex };
}

/**
 * Parse one xlsx sweep file into a ParsedSweep. Never throws on malformed
 * content — errors are returned in `status` and the file is isolated.
 */
export function parseSweep(input: ParseInput): ParsedSweep {
  const { fileName, relPath, buffer } = input;
  const identity = deriveIdentity(relPath, fileName);
  const messages: string[] = [];

  const fail = (msg: string): ParsedSweep => ({
    id: `${identity.model}__profile_${identity.profile}`,
    model: identity.model,
    profile: identity.profile,
    workload: { inputLength: 0, outputLength: 0, cachePct: 0 },
    rows: [],
    fileName,
    status: { level: 'error', messages: [msg, ...messages], identityInferred: identity.inferred },
    presentColumns: [],
  });

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array' });
  } catch (e) {
    return fail(`Could not read workbook: ${(e as Error).message}`);
  }

  const sheet = pickSheet(wb);
  if (!sheet) return fail('Workbook has no sheets.');
  if (!SUMMARY_SHEET_HINTS.includes(sheet.name.trim().toLowerCase())) {
    messages.push(`No "Summary" sheet found; using "${sheet.name}".`);
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet.ws, {
    header: 1,
    defval: null,
    blankrows: false,
  });

  const header = findHeaderRow(matrix);
  if (!header) {
    return fail('Could not locate a recognizable header row (column names did not match the perf-sweep contract).');
  }
  const { index: headerIdx, columnIndex } = header;

  const presentColumns = Object.keys(columnIndex) as CanonicalKey[];
  const missingRequired = REQUIRED_KEYS.filter((k) => !(k in columnIndex));
  if (missingRequired.length > 0) {
    return fail(
      `Missing required column(s): ${missingRequired.map((k) => COLUMN_BY_KEY[k].label).join(', ')}.`,
    );
  }

  // Build rows from the data region, forward-filling merged dimension columns.
  const dataRows = matrix.slice(headerIdx + 1);
  const headerCells = matrix[headerIdx] ?? [];
  const carried: Partial<Record<CanonicalKey, unknown>> = {};
  const rows: SweepRow[] = [];

  for (const r of dataRows) {
    if (!r || r.every((c) => c == null || c === '')) continue;

    const getRaw = (key: CanonicalKey): unknown => {
      const idx = columnIndex[key];
      if (idx == null) return undefined;
      let v = r[idx];
      // Merged dimensions: only the first row of a block carries the value.
      if (MERGED_DIMENSION_KEYS.includes(key)) {
        if (v == null || v === '') v = carried[key];
        else carried[key] = v;
      }
      return v;
    };

    const batchSize = coerceNumber(getRaw('batchSize'));
    if (batchSize == null) continue; // not a real data row

    const inputLength = coerceNumber(getRaw('inputLength')) ?? 0;
    const outputLength = coerceNumber(getRaw('outputLength')) ?? 0;
    const cachePct = normalizeCachePct(getRaw('cachePct')) ?? 0;

    const row: SweepRow = {
      batchSize,
      inputLength,
      outputLength,
      cachePct,
      raw: {},
    };

    // Numeric metrics.
    for (const key of presentColumns) {
      if (key === 'batchSize' || key === 'inputLength' || key === 'outputLength' || key === 'cachePct') continue;
      const v = coerceNumber(getRaw(key));
      if (v != null) (row as unknown as Record<string, unknown>)[key] = v;
    }

    // Preserve every original cell for the raw table.
    headerCells.forEach((h, i) => {
      if (h == null || h === '') return;
      row.raw[String(h)] = (r[i] ?? null) as number | string | null;
    });

    rows.push(row);
  }

  if (rows.length === 0) {
    return fail('Header recognized but no data rows were found.');
  }

  rows.sort((a, b) => a.batchSize - b.batchSize);

  if (identity.inferred) {
    messages.push('Model/profile could not be parsed from the file name — please confirm.');
  }
  const unknownCols = headerCells.filter((h) => h != null && h !== '').length - presentColumns.length;
  if (unknownCols > 0) messages.push(`${unknownCols} unrecognized column(s) ignored.`);

  const level: SweepStatus['level'] = messages.length > 0 ? 'warn' : 'ok';
  const first = rows[0];

  return {
    id: `${identity.model}__profile_${identity.profile}`,
    model: identity.model,
    profile: identity.profile,
    workload: {
      inputLength: first.inputLength,
      outputLength: first.outputLength,
      cachePct: first.cachePct,
    },
    rows,
    fileName,
    status: { level, messages, identityInferred: identity.inferred },
    presentColumns,
  };
}
