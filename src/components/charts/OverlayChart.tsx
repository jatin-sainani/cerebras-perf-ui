import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ParsedSweep, SweepRow } from '../../lib/ingest/types';
import { overlaySeries, colorForIndex, sweepLabel, type CompareAxis } from '../../lib/analysis/compare';
import { fmtNum } from '../../lib/format';

interface Props {
  sweeps: ParsedSweep[];
  metric: keyof SweepRow;
  axis: CompareAxis;
  logScale?: boolean;
  height?: number;
}

/** Overlays one line per selected sweep on a shared batch-size x-axis. */
export function OverlayChart({ sweeps, metric, axis, logScale, height = 240 }: Props) {
  const data = overlaySeries(sweeps, metric);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
        <XAxis
          dataKey="batchSize"
          type="number"
          domain={['dataMin', 'dataMax']}
          tick={{ fontSize: 11, fill: '#64748b' }}
          label={{ value: 'Batch size', position: 'insideBottom', offset: -4, fontSize: 11, fill: '#94a3b8' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748b' }}
          scale={logScale ? 'log' : 'auto'}
          domain={logScale ? ['auto', 'auto'] : [0, 'auto']}
          tickFormatter={(v) => fmtNum(v, 0)}
          width={52}
        />
        <Tooltip
          formatter={(v, name) => [fmtNum(Number(v)), labelFor(sweeps, String(name), axis)]}
          labelFormatter={(l) => `Batch ${l}`}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
        <Legend verticalAlign="top" align="center" wrapperStyle={{ fontSize: 11 }} formatter={(name) => labelFor(sweeps, name, axis)} />
        {sweeps.map((s, i) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            stroke={colorForIndex(i)}
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function labelFor(sweeps: ParsedSweep[], id: string, axis: CompareAxis): string {
  const s = sweeps.find((x) => x.id === id);
  return s ? sweepLabel(s, axis) : id;
}
