import { useSweepStore } from '../../store/useSweepStore';

function Field({
  label,
  value,
  onChange,
  unit,
  hint,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-600">{label}</span>
      <div className="mt-1 flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2 focus-within:border-brand-400">
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-full py-1.5 text-sm outline-none"
        />
        <span className="shrink-0 text-xs text-ink-400">{unit}</span>
      </div>
      {hint && <span className="mt-0.5 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  );
}

/** The customer describes their workload SLA; everything downstream re-evaluates. */
export function WorkloadForm() {
  const workload = useSweepStore((s) => s.workload);
  const setWorkload = useSweepStore((s) => s.setWorkload);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Field
        label="Min gen speed"
        unit="tok/s/user"
        value={workload.minGenSpeed}
        onChange={(v) => setWorkload({ minGenSpeed: v ?? 0 })}
        hint="How fast each user's stream must feel"
      />
      <Field
        label="Max TTFT"
        unit="ms"
        value={workload.maxTtft}
        onChange={(v) => setWorkload({ maxTtft: v ?? 0 })}
        hint="Acceptable wait for the first token"
      />
      <Field
        label="Min throughput"
        unit="RPM"
        value={workload.minRpm}
        onChange={(v) => setWorkload({ minRpm: v })}
        hint="Optional — required requests/min"
      />
    </div>
  );
}
