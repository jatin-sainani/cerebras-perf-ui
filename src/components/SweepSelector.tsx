import { useMemo } from 'react';
import clsx from 'clsx';
import { useSweepStore } from '../store/useSweepStore';
import { Button } from './ui/primitives';

/**
 * Selection surface: sweeps grouped by model with profile sub-chips. The
 * selected set drives every downstream view and comparison.
 */
export function SweepSelector() {
  const rawSweeps = useSweepStore((s) => s.sweeps);
  const sweeps = useMemo(() => rawSweeps.filter((x) => x.status.level !== 'error'), [rawSweeps]);
  const selectedIds = useSweepStore((s) => s.selectedIds);
  const toggle = useSweepStore((s) => s.toggleSelected);
  const selectAll = useSweepStore((s) => s.selectAll);
  const clear = useSweepStore((s) => s.clearSelection);
  const setSelected = useSweepStore((s) => s.setSelected);

  const byModel = useMemo(() => {
    const m = new Map<string, typeof sweeps>();
    for (const s of sweeps) {
      const arr = m.get(s.model) ?? [];
      arr.push(s);
      m.set(s.model, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sweeps]);

  if (sweeps.length === 0) return null;
  const selected = new Set(selectedIds);

  const toggleModel = (ids: string[]) => {
    const allOn = ids.every((id) => selected.has(id));
    const next = new Set(selected);
    for (const id of ids) (allOn ? next.delete(id) : next.add(id));
    setSelected([...next]);
  };

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Compare</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={selectAll}>All</Button>
          <Button size="sm" variant="ghost" onClick={clear}>None</Button>
        </div>
      </div>
      <div className="space-y-2">
        {byModel.map(([model, list]) => {
          const ids = list.map((s) => s.id);
          const allOn = ids.every((id) => selected.has(id));
          return (
            <div key={model} className="rounded-lg border border-ink-100 bg-white p-2">
              <button
                type="button"
                onClick={() => toggleModel(ids)}
                className={clsx(
                  'mb-1.5 text-xs font-semibold',
                  allOn ? 'text-brand-700' : 'text-ink-700',
                )}
              >
                Model {model}
              </button>
              <div className="flex flex-wrap gap-1">
                {list
                  .sort((a, b) => a.profile - b.profile)
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={clsx(
                        'rounded-md border px-2 py-0.5 text-xs transition',
                        selected.has(s.id)
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-ink-200 text-ink-600 hover:border-ink-300',
                      )}
                      title={`Input ${s.workload.inputLength} / Output ${s.workload.outputLength} / Cache ${Math.round(s.workload.cachePct * 100)}%`}
                    >
                      P{s.profile}
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
