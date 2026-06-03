import { useSweepStore } from '../../store/useSweepStore';
import { Badge, Button } from '../ui/primitives';
import type { ParsedSweep } from '../../lib/ingest/types';

function statusTone(s: ParsedSweep) {
  if (s.status.level === 'error') return 'fail' as const;
  if (s.status.level === 'warn') return 'warn' as const;
  return 'pass' as const;
}

export function FileStatusList() {
  const sweeps = useSweepStore((s) => s.sweeps);
  const removeSweep = useSweepStore((s) => s.removeSweep);
  const clearAll = useSweepStore((s) => s.clearAll);

  if (sweeps.length === 0) return null;

  const errors = sweeps.filter((s) => s.status.level === 'error').length;
  const warns = sweeps.filter((s) => s.status.level === 'warn').length;

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-ink-600">
          {sweeps.length} loaded{errors ? ` · ${errors} error` : ''}{warns ? ` · ${warns} warning` : ''}
        </span>
        <Button size="sm" variant="ghost" onClick={clearAll}>
          Clear all
        </Button>
      </div>
      <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
        {sweeps.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-2 rounded-md border border-ink-100 bg-white px-2 py-1"
            title={s.status.messages.join('\n') || s.fileName}
          >
            <span className="flex items-center gap-2 truncate text-xs text-ink-700">
              <Badge tone={statusTone(s)}>{s.status.level}</Badge>
              <span className="truncate">
                Model {s.model} · P{s.profile}
              </span>
            </span>
            <button
              type="button"
              onClick={() => removeSweep(s.id)}
              className="shrink-0 text-ink-400 hover:text-red-600"
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
