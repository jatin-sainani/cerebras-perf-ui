import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import type { ParsedSweep, SweepRow } from '../../lib/ingest/types';
import { COLUMN_BY_KEY } from '../../lib/ingest/columns';
import { fmtNum } from '../../lib/format';
import { Button } from '../ui/primitives';

/** Readable, sortable raw view of one sweep's rows — replaces the static dump. */
export function RawTable({ sweep }: { sweep: ParsedSweep }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'batchSize', desc: false }]);

  const columns = useMemo<ColumnDef<SweepRow>[]>(() => {
    return sweep.presentColumns.map((key) => {
      const def = COLUMN_BY_KEY[key];
      return {
        accessorKey: key,
        header: `${def.label}${def.unit ? ` (${def.unit})` : ''}`,
        cell: (ctx) => {
          const v = ctx.getValue<number | undefined>();
          if (key === 'cachePct') return v == null ? '—' : `${Math.round(v * 100)}%`;
          return fmtNum(v, key === 'batchSize' ? 0 : 1);
        },
      };
    });
  }, [sweep]);

  const table = useReactTable({
    data: sweep.rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const exportCsv = () => {
    const headers = sweep.presentColumns.map((k) => COLUMN_BY_KEY[k].label);
    const lines = [headers.join(',')];
    for (const r of sweep.rows) {
      lines.push(sweep.presentColumns.map((k) => (r as unknown as Record<string, unknown>)[k] ?? '').join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sweep.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-ink-500">
          Model {sweep.model} · Profile {sweep.profile} · {sweep.rows.length} rows
        </span>
        <Button size="sm" variant="secondary" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-ink-100">
        <table className="min-w-full text-right text-xs">
          <thead className="bg-ink-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className="cursor-pointer whitespace-nowrap px-2.5 py-2 font-medium text-ink-600 hover:text-ink-900"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-ink-100 odd:bg-white even:bg-ink-50/40">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="whitespace-nowrap px-2.5 py-1.5 tabular-nums text-ink-700">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
