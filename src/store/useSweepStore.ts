import { create } from 'zustand';
import type { ParsedSweep } from '../lib/ingest/types';
import { parseSweep, parseSweepFile } from '../lib/ingest';
import type { WorkloadSpec } from '../lib/analysis/operatingPoint';

export type Audience = 'customer' | 'engineer';

interface SweepState {
  sweeps: ParsedSweep[];
  selectedIds: string[];
  audience: Audience;
  workload: WorkloadSpec;
  parsing: boolean;
  sampleLoaded: boolean;

  setAudience: (a: Audience) => void;
  setWorkload: (w: Partial<WorkloadSpec>) => void;
  toggleSelected: (id: string) => void;
  setSelected: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  removeSweep: (id: string) => void;
  clearAll: () => void;

  addFiles: (files: File[]) => Promise<void>;
  loadSamples: () => Promise<void>;
}

const DEFAULT_WORKLOAD: WorkloadSpec = {
  minGenSpeed: 30, // tok/s/user — comfortably faster than human reading
  maxTtft: 500, // ms
};

/** Merge new sweeps in, replacing any existing sweep with the same id. */
function mergeSweeps(existing: ParsedSweep[], incoming: ParsedSweep[]): ParsedSweep[] {
  const map = new Map(existing.map((s) => [s.id, s]));
  for (const s of incoming) map.set(s.id, s);
  return [...map.values()].sort((a, b) =>
    a.model === b.model ? a.profile - b.profile : a.model.localeCompare(b.model),
  );
}

export const useSweepStore = create<SweepState>((set, get) => ({
  sweeps: [],
  selectedIds: [],
  audience: 'customer',
  workload: DEFAULT_WORKLOAD,
  parsing: false,
  sampleLoaded: false,

  setAudience: (audience) => set({ audience }),
  setWorkload: (w) => set((s) => ({ workload: { ...s.workload, ...w } })),

  toggleSelected: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),
  setSelected: (ids) => set({ selectedIds: ids }),
  selectAll: () => set((s) => ({ selectedIds: s.sweeps.map((x) => x.id) })),
  clearSelection: () => set({ selectedIds: [] }),

  removeSweep: (id) =>
    set((s) => ({
      sweeps: s.sweeps.filter((x) => x.id !== id),
      selectedIds: s.selectedIds.filter((x) => x !== id),
    })),
  clearAll: () => set({ sweeps: [], selectedIds: [], sampleLoaded: false }),

  addFiles: async (files) => {
    const xlsx = files.filter((f) => /\.xlsx$/i.test(f.name));
    if (xlsx.length === 0) return;
    set({ parsing: true });
    try {
      const parsed = await Promise.all(xlsx.map((f) => parseSweepFile(f)));
      set((s) => {
        const merged = mergeSweeps(s.sweeps, parsed);
        const newOk = parsed.filter((p) => p.status.level !== 'error').map((p) => p.id);
        // Auto-select freshly added valid sweeps so the user sees them immediately.
        const selectedIds = Array.from(new Set([...s.selectedIds, ...newOk]));
        return { sweeps: merged, selectedIds };
      });
    } finally {
      set({ parsing: false });
    }
  },

  loadSamples: async () => {
    if (get().sampleLoaded) return;
    set({ parsing: true });
    try {
      const base = import.meta.env.BASE_URL ?? '/';
      const manifest: string[] = await fetch(`${base}sample/manifest.json`).then((r) => r.json());
      const parsed = await Promise.all(
        manifest.map(async (rel) => {
          const buffer = await fetch(`${base}${rel}`).then((r) => r.arrayBuffer());
          const fileName = rel.split('/').pop() ?? rel;
          // strip leading "sample/" so identity sees the Model_X_profile_N folder
          const relPath = rel.replace(/^sample\//, '');
          return parseSweep({ fileName, relPath, buffer });
        }),
      );
      set((s) => {
        const sweeps = mergeSweeps(s.sweeps, parsed);
        // First load with nothing selected: default to all models on the first
        // profile, so the side-by-side comparison is meaningful out of the box.
        let selectedIds = s.selectedIds;
        if (selectedIds.length === 0) {
          const ok = sweeps.filter((x) => x.status.level !== 'error');
          const firstProfile = Math.min(...ok.map((x) => x.profile));
          selectedIds = ok.filter((x) => x.profile === firstProfile).map((x) => x.id);
        }
        return { sweeps, selectedIds, sampleLoaded: true };
      });
    } finally {
      set({ parsing: false });
    }
  },
}));

/** Selector: the currently selected sweeps, in store order. */
export function selectedSweeps(s: SweepState): ParsedSweep[] {
  const set = new Set(s.selectedIds);
  return s.sweeps.filter((x) => set.has(x.id) && x.status.level !== 'error');
}
