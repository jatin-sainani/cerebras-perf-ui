export * from './types';
export { CANONICAL_COLUMNS, COLUMN_BY_KEY, REQUIRED_KEYS, normalizeHeader, matchHeader } from './columns';
export { parseSweep } from './parseWorkbook';
export type { ParseInput } from './parseWorkbook';
export { deriveIdentity } from './identity';

import { parseSweep, type ParseInput } from './parseWorkbook';
import type { ParsedSweep } from './types';

/** Convenience: parse a browser File (carries webkitRelativePath when dropped as a folder). */
export async function parseSweepFile(file: File): Promise<ParsedSweep> {
  const buffer = await file.arrayBuffer();
  const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
  const input: ParseInput = { fileName: file.name, relPath, buffer };
  return parseSweep(input);
}
