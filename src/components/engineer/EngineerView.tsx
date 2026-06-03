import { useState } from 'react';
import type { ParsedSweep, SweepRow } from '../../lib/ingest/types';
import { detectAxis, axisLabel } from '../../lib/analysis/compare';
import { Card, CardHeader, EmptyState, Badge } from '../ui/primitives';
import { OverlayChart } from '../charts/OverlayChart';
import { TradeoffScatter } from '../charts/TradeoffScatter';
import { AnomalyPanel } from './AnomalyPanel';
import { RawTable } from './RawTable';

const SENSITIVITY: { metric: keyof SweepRow; title: string; expect: string }[] = [
  { metric: 'throughputTs', title: 'Total throughput vs batch', expect: 'Should rise, then saturate' },
  { metric: 'genSpeedTsUser', title: 'Per-user gen speed vs batch', expect: 'Should fall (the core tradeoff)' },
  { metric: 'ttftMs', title: 'TTFT vs batch', expect: 'Should be non-decreasing' },
  { metric: 'throughputPerBoxTs', title: 'Throughput / box vs batch', expect: 'Efficiency / cost frontier' },
];

export function EngineerView({ sweeps }: { sweeps: ParsedSweep[] }) {
  const [log, setLog] = useState(false);
  const [rawId, setRawId] = useState<string | null>(null);
  const axis = detectAxis(sweeps);

  if (sweeps.length === 0) {
    return (
      <EmptyState title="Select one or more sweeps to inspect">
        Pick sweeps from the panel on the left. The engineer view overlays config-sensitivity
        curves, flags anomalies in the projection, and lets you read the raw numbers.
      </EmptyState>
    );
  }

  const rawSweep = sweeps.find((s) => s.id === rawId) ?? sweeps[0];

  return (
    <div className="space-y-4">
      {axis !== 'single' && (
        <div className="flex items-center gap-2 text-sm text-ink-600">
          <Badge tone="brand">{sweeps.length} sweeps</Badge>
          {axisLabel(axis)}
        </div>
      )}

      <Card>
        <CardHeader
          title="Latency vs throughput frontier"
          subtitle="Per-user gen speed vs aggregate throughput; each point is a batch size."
        />
        <div className="p-3">
          <TradeoffScatter sweeps={sweeps} axis={axis} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Config sensitivity"
          subtitle="How each projection shifts with batch size."
          right={
            <label className="flex items-center gap-1.5 text-xs text-ink-600">
              <input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} />
              Log scale
            </label>
          }
        />
        <div className="grid grid-cols-1 gap-4 p-3 md:grid-cols-2">
          {SENSITIVITY.map((s) => (
            <div key={String(s.metric)}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs font-medium text-ink-700">{s.title}</span>
                <span className="text-[11px] text-ink-400">{s.expect}</span>
              </div>
              <OverlayChart sweeps={sweeps} metric={s.metric} axis={axis} logScale={log} height={200} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Anomaly checks" subtitle="Physical-plausibility sanity tests across the selected sweeps." />
        <div className="p-3">
          <AnomalyPanel sweeps={sweeps} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Raw projection"
          subtitle="Every column, sortable, with CSV export."
          right={
            sweeps.length > 1 ? (
              <select
                value={rawSweep.id}
                onChange={(e) => setRawId(e.target.value)}
                className="rounded-md border border-ink-200 px-2 py-1 text-xs"
              >
                {sweeps.map((s) => (
                  <option key={s.id} value={s.id}>
                    Model {s.model} · P{s.profile}
                  </option>
                ))}
              </select>
            ) : undefined
          }
        />
        <div className="p-3">
          <RawTable sweep={rawSweep} />
        </div>
      </Card>
    </div>
  );
}
