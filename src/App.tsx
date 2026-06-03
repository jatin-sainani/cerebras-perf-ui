import { useMemo } from 'react';
import clsx from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useSweepStore, selectedSweeps, type Audience } from './store/useSweepStore';
import { Dropzone } from './components/Upload/Dropzone';
import { FileStatusList } from './components/Upload/FileStatusList';
import { SweepSelector } from './components/SweepSelector';
import { CustomerView } from './components/customer/CustomerView';
import { EngineerView } from './components/engineer/EngineerView';
import { InsightsView } from './components/insights/InsightsView';
import { Button } from './components/ui/primitives';

type View = Audience | 'insights';

const TABS: { id: View; label: string; blurb: string }[] = [
  { id: 'customer', label: 'Customer', blurb: 'Go / no-go for a workload' },
  { id: 'engineer', label: 'Engineer', blurb: 'Sanity-check a projection' },
  { id: 'insights', label: 'Insights', blurb: 'Model sizes & profiles' },
];

export default function App() {
  const audience = useSweepStore((s) => s.audience);
  const setAudience = useSweepStore((s) => s.setAudience);
  const loadSamples = useSweepStore((s) => s.loadSamples);
  const sampleLoaded = useSweepStore((s) => s.sampleLoaded);
  const parsing = useSweepStore((s) => s.parsing);
  const sweeps = useSweepStore((s) => s.sweeps);
  const allSweeps = useMemo(() => sweeps.filter((x) => x.status.level !== 'error'), [sweeps]);
  const selected = useSweepStore(useShallow(selectedSweeps));

  // `audience` holds customer/engineer; we extend it with an "insights" view id.
  const view = audience as View;
  const setView = (v: View) => setAudience(v as Audience);

  const hasData = allSweeps.length > 0;
  const main = useMemo(() => {
    if (view === 'engineer') return <EngineerView sweeps={selected} />;
    if (view === 'insights') return <InsightsView allSweeps={allSweeps} selected={selected} />;
    return <CustomerView sweeps={selected} />;
  }, [view, selected, allSweeps]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div>
            <h1 className="text-lg font-semibold text-ink-900">Perf Sweep Explorer</h1>
            <p className="text-xs text-ink-500">Turn perf projections into a go/no-go — for customers and engineers.</p>
          </div>
          <nav className="flex rounded-lg border border-ink-200 bg-ink-50 p-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setView(t.id)}
                title={t.blurb}
                className={clsx(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition',
                  view === t.id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800',
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-5 py-5 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-72">
          <div className="lg:sticky lg:top-5">
            <Dropzone />
            <div className="mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void loadSamples()}
                disabled={parsing || sampleLoaded}
              >
                {sampleLoaded ? 'Sample data loaded' : 'Load sample data (11 models × 7 profiles)'}
              </Button>
            </div>
            <FileStatusList />
            <SweepSelector />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {!hasData && view === 'customer' ? (
            <Welcome onLoad={() => void loadSamples()} parsing={parsing} />
          ) : (
            main
          )}
        </main>
      </div>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-5 py-3 text-xs text-ink-400">
          Parsing runs entirely in your browser. Any conforming{' '}
          <code className="rounded bg-ink-100 px-1">Model_&lt;X&gt;_profile_&lt;N&gt;.xlsx</code> sweep renders with no rebuild.
        </div>
      </footer>
    </div>
  );
}

function Welcome({ onLoad, parsing }: { onLoad: () => void; parsing: boolean }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-white p-10 text-center">
      <h2 className="text-xl font-semibold text-ink-900">Upload perf sweeps to begin</h2>
      <p className="mt-2 max-w-lg text-sm text-ink-500">
        Drop one or many <code className="rounded bg-ink-100 px-1">.xlsx</code> sweeps (or a whole sweep folder) on the
        left. Then switch between the <b>Customer</b> go/no-go view, the <b>Engineer</b> sanity-check, and{' '}
        <b>Insights</b>. Comparing several models at once is the common case.
      </p>
      <div className="mt-5">
        <Button variant="primary" onClick={onLoad} disabled={parsing}>
          {parsing ? 'Loading…' : 'Load sample data to explore'}
        </Button>
      </div>
    </div>
  );
}
