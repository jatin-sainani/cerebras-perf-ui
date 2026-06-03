import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseSweep } from '../../ingest/parseWorkbook';
import type { ParsedSweep } from '../../ingest/types';
import { evaluateSet } from '../operatingPoint';
import { detectAnomalies } from '../anomalies';
import { detectAxis, overlaySeries } from '../compare';
import { rankBySize, classifyProfile } from '../derived';

const SAMPLE_DIR = join(process.cwd(), 'public', 'sample');

function loadAll(): ParsedSweep[] {
  if (!existsSync(SAMPLE_DIR)) return [];
  const out: ParsedSweep[] = [];
  for (const dir of readdirSync(SAMPLE_DIR)) {
    const full = join(SAMPLE_DIR, dir);
    let entries: string[];
    try {
      entries = readdirSync(full);
    } catch {
      continue;
    }
    for (const f of entries) {
      if (!f.endsWith('.xlsx')) continue;
      const buf = readFileSync(join(full, f));
      out.push(
        parseSweep({
          relPath: `${dir}/${f}`,
          fileName: f,
          buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
        }),
      );
    }
  }
  return out;
}

const all = loadAll();

describe('end-to-end analysis pipeline over shipped data', () => {
  it('loads sweeps', () => {
    expect(all.length).toBe(77);
  });

  it('customer evaluation produces verdicts with cost ranking', () => {
    const profile1 = all.filter((s) => s.profile === 1);
    const verdicts = evaluateSet(profile1, { minGenSpeed: 30, maxTtft: 500 });
    expect(verdicts.length).toBe(profile1.length);
    // At a lenient SLA at least some models should pass.
    expect(verdicts.some((v) => v.pass)).toBe(true);
    // Passing verdicts get a cost index >= 1, cheapest == 1.
    const passing = verdicts.filter((v) => v.pass);
    expect(Math.min(...passing.map((v) => v.costIndex ?? Infinity))).toBeCloseTo(1, 5);
  });

  it('an impossible SLA yields all NO-GO with reasons', () => {
    const verdicts = evaluateSet(all.filter((s) => s.profile === 1), {
      minGenSpeed: 1e9,
      maxTtft: 0,
    });
    expect(verdicts.every((v) => !v.pass)).toBe(true);
    expect(verdicts.every((v) => v.reasons.length > 0)).toBe(true);
  });

  it('axis detection identifies model vs profile comparisons', () => {
    const modelsOnP1 = all.filter((s) => s.profile === 1);
    expect(detectAxis(modelsOnP1)).toBe('models');
    const modelAprofiles = all.filter((s) => s.model === 'A');
    expect(detectAxis(modelAprofiles)).toBe('profiles');
    expect(detectAxis([all[0]])).toBe('single');
  });

  it('overlay series aligns sweeps on a shared batch axis', () => {
    const pick = all.filter((s) => s.profile === 1).slice(0, 3);
    const series = overlaySeries(pick, 'throughputTs');
    expect(series.length).toBeGreaterThan(0);
    // Every row has a batchSize and at least one series value.
    for (const row of series) {
      expect(row.batchSize).toBeGreaterThan(0);
    }
  });

  it('size ranking orders models and returns a proxy in [0,1]', () => {
    const ranks = rankBySize(all.filter((s) => s.profile === 1));
    expect(ranks.length).toBeGreaterThan(1);
    for (const r of ranks) {
      expect(r.sizeProxy).toBeGreaterThanOrEqual(0);
      expect(r.sizeProxy).toBeLessThanOrEqual(1);
    }
    // Sorted descending by size proxy.
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i - 1].sizeProxy).toBeGreaterThanOrEqual(ranks[i].sizeProxy);
    }
  });

  it('classifies every shipped profile into a use case', () => {
    const profiles = new Map<number, ParsedSweep>();
    for (const s of all) if (!profiles.has(s.profile)) profiles.set(s.profile, s);
    for (const s of profiles.values()) {
      const c = classifyProfile(s.workload);
      expect(c.label).toBeTruthy();
      expect(c.rationale).toBeTruthy();
    }
  });

  it('anomaly detection runs on every sweep without throwing', () => {
    for (const s of all) {
      expect(() => detectAnomalies(s)).not.toThrow();
    }
  });
});
