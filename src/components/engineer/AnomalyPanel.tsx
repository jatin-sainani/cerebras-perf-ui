import type { ParsedSweep } from '../../lib/ingest/types';
import { detectAnomalies, type Anomaly } from '../../lib/analysis/anomalies';
import { Badge } from '../ui/primitives';

const toneFor: Record<Anomaly['severity'], 'fail' | 'warn' | 'info'> = {
  critical: 'fail',
  warn: 'warn',
  info: 'info',
};

export function AnomalyPanel({ sweeps }: { sweeps: ParsedSweep[] }) {
  const items = sweeps.flatMap((s) =>
    detectAnomalies(s).map((a) => ({ sweep: s, anomaly: a })),
  );

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        ✓ No anomalies detected — curves behave as expected (throughput rises with batch, per-user speed falls, TTFT non-decreasing).
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(({ sweep, anomaly }, i) => (
        <div key={i} className="rounded-lg border border-ink-100 bg-white px-3 py-2">
          <div className="flex items-center gap-2">
            <Badge tone={toneFor[anomaly.severity]}>{anomaly.severity}</Badge>
            <span className="text-sm font-medium text-ink-800">{anomaly.title}</span>
            <span className="text-xs text-ink-400">
              Model {sweep.model} · P{sweep.profile}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-600">{anomaly.detail}</p>
        </div>
      ))}
    </div>
  );
}
