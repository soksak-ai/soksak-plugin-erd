import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import type { Table } from '@/types/schema';
import { ENGINES } from '@/constants/defaults';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ColumnEditor } from '@/components/sidebar/ColumnEditor';

interface TablePropertiesProps {
  table: Table;
}

export function TableProperties({ table }: TablePropertiesProps) {
  const updateTable = useStore((s) => s.updateTable);
  const dialect = useStore((s) => s.dialect);

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* General Section */}
      <div className="space-y-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
          General
        </span>

        <div className="space-y-2">
          <label className="text-[11px] text-gray-500 dark:text-zinc-500">Table Name</label>
          <Input
            value={table.name}
            onChange={(e) => updateTable(table.id, { name: e.target.value })}
            className="h-8 text-sm font-mono"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] text-gray-500 dark:text-zinc-500">Schema</label>
          <Input
            value={table.schema ?? ''}
            onChange={(e) => updateTable(table.id, { schema: e.target.value || undefined })}
            placeholder="public"
            className="h-8 text-sm"
          />
        </div>

        {dialect === 'mysql' && (
          <div className="space-y-2">
            <label className="text-[11px] text-gray-500 dark:text-zinc-500">Engine</label>
            <Select
              value={table.engine ?? 'InnoDB'}
              onValueChange={(value) => updateTable(table.id, { engine: value })}
            >
              <SelectTrigger size="sm" className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGINES.map((engine) => (
                  <SelectItem key={engine} value={engine}>
                    {engine}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[11px] text-gray-500 dark:text-zinc-500">Comment</label>
          <Textarea
            value={table.comment ?? ''}
            onChange={(e) => updateTable(table.id, { comment: e.target.value || undefined })}
            rows={2}
            className="text-sm min-h-0"
          />
        </div>
      </div>

      <Separator />

      {/* Columns Section */}
      <DeferredColumnEditor tableId={table.id} columns={table.columns} />

      {/* Update Schema Button */}
      <button className="w-full rounded border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 py-2.5 text-xs font-bold text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
        UPDATE SCHEMA
      </button>
    </div>
  );
}

function DeferredColumnEditor({ tableId, columns }: { tableId: string; columns: Table['columns'] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 120);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) {
    return (
      <div className="rounded border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40 p-3 text-xs text-gray-500 dark:text-zinc-500">
        Loading columns...
      </div>
    );
  }

  return <ColumnEditor tableId={tableId} columns={columns} />;
}
