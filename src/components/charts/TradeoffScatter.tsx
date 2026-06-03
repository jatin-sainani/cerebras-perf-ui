import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import type { ParsedSweep } from '../../lib/ingest/types';
import { colorForIndex, sweepLabel, type CompareAxis } from '../../lib/analysis/compare';
import { fmtNum } from '../../lib/format';

/**
 * The single chart that tells the latency/throughput story: per-user gen speed
 * (x) vs aggregate throughput (y), each point a batch size. Up-and-to-the-right
 * is the efficient frontier; points label their batch size.
 */
export function TradeoffScatter({ sweeps, axis, height = 280 }: { sweeps: ParsedSweep[]; axis: CompareAxis; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 20, bottom: 16, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
        <XAxis
          type="number"
          dataKey="x"
          name="Gen speed"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickFormatter={(v) => fmtNum(v, 0)}
          label={{ value: 'Gen speed (tok/s/user) →', position: 'insideBottom', offset: -6, fontSize: 11, fill: '#94a3b8' }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Throughput"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickFormatter={(v) => fmtNum(v, 0)}
          width={52}
          label={{ value: 'Throughput ↑', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#94a3b8' }}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          formatter={(v, n) => [fmtNum(Number(v)), String(n)]}
          labelFormatter={() => ''}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
        <Legend verticalAlign="top" align="center" wrapperStyle={{ fontSize: 11 }} />
        {sweeps.map((s, i) => (
          <Scatter
            key={s.id}
            name={sweepLabel(s, axis)}
            data={s.rows
              .filter((r) => r.genSpeedTsUser != null && r.throughputTs != null)
              .map((r) => ({ x: r.genSpeedTsUser, y: r.throughputTs, batch: r.batchSize }))}
            fill={colorForIndex(i)}
            line
            isAnimationActive={false}
          >
            <LabelList dataKey="batch" position="top" style={{ fontSize: 9, fill: '#94a3b8' }} />
          </Scatter>
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
