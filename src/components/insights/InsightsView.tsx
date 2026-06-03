import { useMemo } from 'react';
import type { ParsedSweep } from '../../lib/ingest/types';
import { rankBySize } from '../../lib/analysis/derived';
import { classifyProfile } from '../../lib/analysis/derived';
import { Card, CardHeader, EmptyState, Badge } from '../ui/primitives';
import { fmtInt, fmtNum, fmtPct } from '../../lib/format';

/**
 * Derived, data-driven readings that help infer (a) relative model sizes and
 * (b) what each traffic profile is for — the two open questions in the brief.
 * Everything here is computed from the numbers; nothing is hard-coded per model.
 */
export function InsightsView({ allSweeps, selected }: { allSweeps: ParsedSweep[]; selected: ParsedSweep[] }) {
  // Model size ranking is only meaningful within a single profile. Use the
  // profile with the most models represented among the current selection
  // (falling back to all sweeps).
  const sizeBasis = useMemo(() => {
    const pool = selected.length > 1 ? selected : allSweeps;
    const byProfile = new Map<number, ParsedSweep[]>();
    for (const s of pool) {
      const arr = byProfile.get(s.profile) ?? [];
      arr.push(s);
      byProfile.set(s.profile, arr);
    }
    let bestProfile = -1;
    let best: ParsedSweep[] = [];
    for (const [p, list] of byProfile) {
      const models = new Set(list.map((s) => s.model));
      if (models.size > best.length || (models.size === best.length && p < bestProfile)) {
        best = list;
        bestProfile = p;
      }
    }
    return { profile: bestProfile, sweeps: best };
  }, [selected, allSweeps]);

  const ranks = useMemo(() => rankBySize(sizeBasis.sweeps), [sizeBasis]);

  // Profile legend: one row per distinct profile across all loaded sweeps.
  const profiles = useMemo(() => {
    const m = new Map<number, ParsedSweep>();
    for (const s of allSweeps) if (!m.has(s.profile)) m.set(s.profile, s);
    return [...m.values()].sort((a, b) => a.profile - b.profile);
  }, [allSweeps]);

  if (allSweeps.length === 0) {
    return (
      <EmptyState title="Load sweeps to see derived insights">
        This view infers relative model sizes from per-user speed and per-box efficiency, and labels each
        traffic profile from its input/output/cache shape.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Inferred model size"
          subtitle={
            sizeBasis.profile >= 0
              ? `Ranked on Profile ${sizeBasis.profile} (most models in common). Slower per user + less throughput/box ⇒ larger model.`
              : 'Select models that share a profile to rank by size.'
          }
        />
        <div className="p-3">
          {ranks.length < 2 ? (
            <p className="text-sm text-ink-500">Need ≥2 models on the same profile to rank by size.</p>
          ) : (
            <div className="space-y-1.5">
              {ranks.map((r) => (
                <div key={r.model} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-sm font-medium text-ink-800">Model {r.model}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.max(4, r.sizeProxy * 100)}%` }}
                    />
                  </div>
                  <span className="w-44 shrink-0 text-right text-xs text-ink-500">
                    {fmtNum(r.medGenSpeed, 0)} tok/s/user · {fmtNum(r.medPerBox)} /box
                  </span>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-ink-400">
                Bar length = relative size proxy (longer ⇒ larger). It’s an ordering, not an absolute parameter count.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Traffic profiles" subtitle="What each profile’s (input/output/cache) shape implies about its use case." />
        <div className="overflow-x-auto p-3">
          <table className="min-w-full text-sm">
            <thead className="bg-ink-50 text-xs text-ink-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Profile</th>
                <th className="px-3 py-2 text-right font-medium">Input</th>
                <th className="px-3 py-2 text-right font-medium">Output</th>
                <th className="px-3 py-2 text-right font-medium">Cache</th>
                <th className="px-3 py-2 text-left font-medium">Likely use case</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((s) => {
                const c = classifyProfile(s.workload);
                return (
                  <tr key={s.profile} className="border-t border-ink-100">
                    <td className="px-3 py-2 font-medium text-ink-800">P{s.profile}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-700">{fmtInt(s.workload.inputLength)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-700">{fmtInt(s.workload.outputLength)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-700">{fmtPct(s.workload.cachePct)}</td>
                    <td className="px-3 py-2">
                      <Badge tone="brand">{c.label}</Badge>
                      <span className="ml-2 text-xs text-ink-500">{c.rationale}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
