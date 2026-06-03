import { useMemo } from 'react';
import type { ParsedSweep } from '../../lib/ingest/types';
import { useSweepStore } from '../../store/useSweepStore';
import { evaluateSet, type SweepVerdict } from '../../lib/analysis/operatingPoint';
import { classifyProfile } from '../../lib/analysis/derived';
import { Card, CardHeader, Badge, Stat, EmptyState } from '../ui/primitives';
import { WorkloadForm } from './WorkloadForm';
import { fmtInt, fmtMs, fmtNum } from '../../lib/format';

function VerdictCard({ v }: { v: SweepVerdict }) {
  const s = v.sweep;
  const profile = classifyProfile(s.workload);
  return (
    <Card className={v.pass ? 'ring-1 ring-green-200' : ''}>
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-ink-900">Model {s.model}</div>
          <div className="text-xs text-ink-500">
            Profile {s.profile} · {profile.label}
          </div>
        </div>
        <Badge tone={v.pass ? 'pass' : 'fail'}>{v.pass ? 'GO' : 'NO-GO'}</Badge>
      </div>
      <div className="p-3">
        {v.pass && v.best ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Gen speed" value={fmtNum(v.best.row.genSpeedTsUser, 0)} unit="tok/s/user" />
              <Stat label="TTFT" value={fmtMs(v.best.row.ttftMs)} />
              <Stat label="Throughput" value={fmtNum(v.best.row.throughputTs)} unit="tok/s" />
              <Stat label="At batch" value={fmtInt(v.best.row.batchSize)} hint="best operating point" />
            </div>
            {v.costIndex != null && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2">
                <span className="text-xs text-ink-600">Relative cost</span>
                <span className="text-sm font-semibold text-brand-700">
                  {v.costIndex <= 1.001 ? 'cheapest' : `${v.costIndex.toFixed(2)}× cheapest`}
                </span>
              </div>
            )}
          </>
        ) : (
          <ul className="space-y-1 text-xs text-red-700">
            {v.reasons.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/** Side-by-side GO/NO-GO matrix across the selected models. */
function PassFailMatrix({ verdicts }: { verdicts: SweepVerdict[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-100">
      <table className="min-w-full text-sm">
        <thead className="bg-ink-50 text-xs text-ink-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Model · Profile</th>
            <th className="px-3 py-2 text-left font-medium">Verdict</th>
            <th className="px-3 py-2 text-right font-medium">Gen speed</th>
            <th className="px-3 py-2 text-right font-medium">TTFT</th>
            <th className="px-3 py-2 text-right font-medium">Throughput</th>
            <th className="px-3 py-2 text-right font-medium">Rel. cost</th>
          </tr>
        </thead>
        <tbody>
          {verdicts.map((v) => (
            <tr key={v.sweep.id} className="border-t border-ink-100">
              <td className="px-3 py-2 font-medium text-ink-800">
                {v.sweep.model} · P{v.sweep.profile}
              </td>
              <td className="px-3 py-2">
                <Badge tone={v.pass ? 'pass' : 'fail'}>{v.pass ? 'GO' : 'NO-GO'}</Badge>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                {v.best ? fmtNum(v.best.row.genSpeedTsUser, 0) : '—'}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                {v.best ? fmtMs(v.best.row.ttftMs) : '—'}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                {v.best ? fmtNum(v.best.row.throughputTs) : '—'}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                {v.costIndex != null ? `${v.costIndex.toFixed(2)}×` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CustomerView({ sweeps }: { sweeps: ParsedSweep[] }) {
  const workload = useSweepStore((s) => s.workload);

  const verdicts = useMemo(() => {
    const evald = evaluateSet(sweeps, workload);
    // Passing first, then by cost; failing last.
    return [...evald].sort((a, b) => {
      if (a.pass !== b.pass) return a.pass ? -1 : 1;
      return (a.costIndex ?? Infinity) - (b.costIndex ?? Infinity);
    });
  }, [sweeps, workload]);

  const passCount = verdicts.filter((v) => v.pass).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Your workload" subtitle="Describe the SLA; models are scored GO / NO-GO against it." />
        <div className="p-3">
          <WorkloadForm />
        </div>
      </Card>

      {sweeps.length === 0 ? (
        <EmptyState title="Select models to get a go / no-go">
          Pick one or more sweeps from the panel on the left. Each is scored against the workload above;
          when several are selected they're ranked side by side by whether they pass and how much they cost.
        </EmptyState>
      ) : (
        <>
          <div className="text-sm text-ink-600">
            <span className="font-semibold text-ink-900">{passCount}</span> of {verdicts.length} pass the SLA.
            {passCount > 0 && verdicts[0].pass && (
              <>
                {' '}Best fit: <span className="font-semibold text-brand-700">Model {verdicts[0].sweep.model}</span>.
              </>
            )}
          </div>

          {sweeps.length > 1 && (
            <Card>
              <CardHeader title="Side-by-side" subtitle="GO / NO-GO across the selected models, cheapest passing first." />
              <div className="p-3">
                <PassFailMatrix verdicts={verdicts} />
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {verdicts.map((v) => (
              <VerdictCard key={v.sweep.id} v={v} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
