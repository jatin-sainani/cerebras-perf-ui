import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseSweep } from '../parseWorkbook';
import { matchHeader, resolveHeaderRow, normalizeHeader } from '../columns';
import { deriveIdentity } from '../identity';

const SAMPLE_DIR = join(process.cwd(), 'public', 'sample');

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function listSampleFiles(): { relPath: string; fileName: string; path: string }[] {
  if (!existsSync(SAMPLE_DIR)) return [];
  const out: { relPath: string; fileName: string; path: string }[] = [];
  for (const dir of readdirSync(SAMPLE_DIR)) {
    const full = join(SAMPLE_DIR, dir);
    let entries: string[];
    try {
      entries = readdirSync(full);
    } catch {
      continue; // not a directory
    }
    for (const f of entries) {
      if (f.endsWith('.xlsx')) {
        out.push({ relPath: `${dir}/${f}`, fileName: f, path: join(full, f) });
      }
    }
  }
  return out;
}

describe('header normalization & matching', () => {
  it('normalizes units and punctuation away', () => {
    expect(normalizeHeader('TTFT (ms)')).toBe('ttft');
    expect(normalizeHeader('Throughput / box (t/s/hardware)')).toBe('throughput box');
    expect(normalizeHeader('Gen Speed (t/s/user)')).toBe('gen speed');
    expect(normalizeHeader('Cache %')).toBe('cache');
  });

  it('matches exact shipped headers', () => {
    expect(matchHeader('Input Length')?.key).toBe('inputLength');
    expect(matchHeader('Throughput (t/s)')?.key).toBe('throughputTs');
    expect(matchHeader('Throughput / box (t/s/hardware)')?.key).toBe('throughputPerBoxTs');
    expect(matchHeader('TTFT (ms)')?.key).toBe('ttftMs');
    expect(matchHeader('Gen Speed (t/s/user)')?.key).toBe('genSpeedTsUser');
  });

  it('tolerates reworded headers (defensibility for unseen models)', () => {
    // Slightly different wording a new model export might use.
    expect(matchHeader('Prompt Length')?.key).toBe('inputLength');
    expect(matchHeader('Concurrency')?.key).toBe('batchSize');
    expect(matchHeader('Time to First Token (ms)')?.key).toBe('ttftMs');
    expect(matchHeader('Output Speed (t/s/user)')?.key).toBe('genSpeedTsUser');
    expect(matchHeader('Cache Hit Rate')?.key).toBe('cachePct');
  });

  it('resolves a full reworded header row to the required keys', () => {
    const { columnIndex, matchedCount } = resolveHeaderRow([
      'Prompt Length',
      'Generation Length',
      'Cache Hit Rate',
      'Concurrency',
      'Total Throughput (t/s)',
      'Throughput per Box',
      'Time to First Token (ms)',
      'Output Speed (t/s/user)',
    ]);
    expect(matchedCount).toBeGreaterThanOrEqual(6);
    expect(columnIndex.inputLength).toBe(0);
    expect(columnIndex.batchSize).toBe(3);
    expect(columnIndex.throughputTs).toBe(4);
    expect(columnIndex.ttftMs).toBe(6);
    expect(columnIndex.genSpeedTsUser).toBe(7);
  });
});

describe('identity parsing', () => {
  it('parses folder-style paths', () => {
    const id = deriveIdentity('Model_A_profile_1/Model A profile 1.xlsx', 'Model A profile 1.xlsx');
    expect(id).toEqual({ model: 'A', profile: 1, inferred: false });
  });
  it('parses an unseen model L with zero special-casing', () => {
    const id = deriveIdentity('Model_L_profile_3/Model L profile 3.xlsx', 'Model L profile 3.xlsx');
    expect(id).toEqual({ model: 'L', profile: 3, inferred: false });
  });
  it('flags unparseable names as inferred', () => {
    const id = deriveIdentity('', 'random_export.xlsx');
    expect(id.inferred).toBe(true);
  });
});

const files = listSampleFiles();

describe('parsing all shipped sweeps', () => {
  it('found the 77 shipped sample files', () => {
    expect(files.length).toBe(77);
  });

  it.each(files)('parses $relPath cleanly', ({ relPath, fileName, path }) => {
    const buffer = toArrayBuffer(readFileSync(path));
    const sweep = parseSweep({ relPath, fileName, buffer });

    expect(sweep.status.level).not.toBe('error');
    expect(sweep.model).toMatch(/^[A-Z]$/);
    expect(sweep.profile).toBeGreaterThanOrEqual(1);
    expect(sweep.profile).toBeLessThanOrEqual(7);
    expect(sweep.rows.length).toBeGreaterThan(0);

    // Required metrics present.
    for (const key of ['throughputTs', 'ttftMs', 'genSpeedTsUser', 'throughputPerBoxTs'] as const) {
      expect(sweep.presentColumns).toContain(key);
    }

    // Merged dimension columns forward-filled onto every row.
    for (const row of sweep.rows) {
      expect(row.inputLength).toBeGreaterThan(0);
      expect(row.outputLength).toBeGreaterThan(0);
      expect(row.batchSize).toBeGreaterThan(0);
      expect(row.cachePct).toBeGreaterThanOrEqual(0);
      expect(row.cachePct).toBeLessThanOrEqual(1);
    }

    // Rows sorted ascending by batch size.
    const batches = sweep.rows.map((r) => r.batchSize);
    expect([...batches].sort((a, b) => a - b)).toEqual(batches);
  });
});

describe('Model L defensibility (zero code edits)', () => {
  it('renders an unseen Model L sweep from existing bytes + new path', () => {
    const sample = files.find((f) => f.relPath.includes('Model_A_profile_1'));
    expect(sample).toBeTruthy();
    const buffer = toArrayBuffer(readFileSync(sample!.path));
    const sweep = parseSweep({
      relPath: 'Model_L_profile_3/Model L profile 3.xlsx',
      fileName: 'Model L profile 3.xlsx',
      buffer,
    });
    expect(sweep.status.level).not.toBe('error');
    expect(sweep.model).toBe('L');
    expect(sweep.profile).toBe(3);
    expect(sweep.rows.length).toBeGreaterThan(0);
  });
});

describe('malformed input isolation', () => {
  it('returns an error status instead of throwing', () => {
    const sweep = parseSweep({
      relPath: 'junk.xlsx',
      fileName: 'junk.xlsx',
      buffer: new TextEncoder().encode('this is not a spreadsheet').buffer,
    });
    expect(sweep.status.level).toBe('error');
    expect(sweep.rows.length).toBe(0);
  });
});
