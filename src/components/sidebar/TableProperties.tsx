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

        <div className="space-y-2">
          <label className="text-[11px] text-gray-500 dark:text-zinc-500">Color</label>
          <ColorRow
            value={table.color}
            onPick={(color) => updateTable(table.id, { color })}
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

// 테이블 하이라이트 색 프리셋. 노드 주소 문법이 '#' 를 불허하므로 data-node 세그먼트는 '#' 없는
// 소문자 hex(table-color-swatch/<hex>), 저장 값은 '#'+hex. 클리어는 table-color-clear.
const COLOR_PRESETS = [
  '#ef4444', '#f59e0b', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
] as const;

function ColorRow({ value, onPick }: { value?: string; onPick: (color: string | undefined) => void }) {
  const active = value?.toLowerCase();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {COLOR_PRESETS.map((hex) => {
        const isActive = active === hex;
        return (
          <button
            key={hex}
            type="button"
            data-node={`table-color-swatch/${hex.slice(1)}`}
            aria-label={`Set table color ${hex}`}
            aria-pressed={isActive}
            onClick={() => onPick(hex)}
            style={{ backgroundColor: hex }}
            className={
              'h-5 w-5 rounded-full border transition-transform hover:scale-110 ' +
              (isActive
                ? 'border-gray-900 dark:border-white ring-2 ring-offset-1 ring-gray-400 dark:ring-zinc-400 ring-offset-white dark:ring-offset-zinc-900'
                : 'border-black/20 dark:border-white/20')
            }
          />
        );
      })}
      <button
        type="button"
        data-node="table-color-clear"
        aria-label="Clear table color"
        aria-pressed={!active}
        onClick={() => onPick(undefined)}
        className={
          'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] leading-none transition-transform hover:scale-110 ' +
          (!active
            ? 'border-gray-900 dark:border-white text-gray-700 dark:text-zinc-200'
            : 'border-black/20 dark:border-white/20 text-gray-400 dark:text-zinc-500')
        }
      >
        ✕
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
