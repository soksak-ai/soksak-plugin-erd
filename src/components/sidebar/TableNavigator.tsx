import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Search, Table2, Eye, Plus, Link2 } from 'lucide-react';
import { Minimap } from '@/components/canvas/pixi/Minimap';
import { focusTable } from '@/features/navigation/focus-table';

const ITEM_HEIGHT = 32; // px per table row
const OVERSCAN = 10; // extra items rendered above/below viewport

// 관계 모드 → 노드 주소 슬러그(주소 그램마 [a-z0-9.-] 준수). identifying('|')은 'id-' 접두.
const MODE_SLUG: Record<'1:N' | '1:1' | '1|N' | '1|1', string> = {
  '1:N': 'one-many',
  '1:1': 'one-one',
  '1|N': 'id-one-many',
  '1|1': 'id-one-one',
};

export function TableNavigator() {
  const tables = useStore((s) => s.tables);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const setCreateTableDialogOpen = useStore((s) => s.setCreateTableDialogOpen);
  const relationshipCreateMode = useStore((s) => s.relationshipCreateMode);
  const relationshipCreateSourceTableId = useStore((s) => s.relationshipCreateSourceTableId);
  const setRelationshipCreateMode = useStore((s) => s.setRelationshipCreateMode);
  const clearRelationshipCreateState = useStore((s) => s.clearRelationshipCreateState);
  const [search, setSearch] = useState('');

  const tableList = useMemo(() => {
    const list = Object.values(tables).sort((a, b) =>
      a.name.localeCompare(b.name, 'ko-KR', { sensitivity: 'base' }),
    );
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((t) => t.name.toLowerCase().includes(q));
  }, [tables, search]);

  const tableCount = Object.keys(tables).length;
  const relationshipSourceTable = relationshipCreateSourceTableId
    ? tables[relationshipCreateSourceTableId]
    : null;

  const onFocusTable = useCallback((tableId: string) => {
    focusTable(tableId);
  }, []);

  // Virtual scroll state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Measure container height
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Calculate visible range
  const totalHeight = tableList.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    tableList.length,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN,
  );
  const visibleItems = tableList.slice(startIndex, endIndex);
  const offsetY = startIndex * ITEM_HEIGHT;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
          Tables
        </span>
        <span className="rounded bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[11px] text-gray-500 dark:text-zinc-400">
          {tableCount}
        </span>
      </div>

      <div className="px-2 pb-2">
        <Minimap />
      </div>

      {/* Search */}
      <div className="relative px-2 pb-2">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 dark:text-zinc-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tables..."
          className="h-7 pl-8 text-xs bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800"
        />
      </div>

      {/* Virtual table list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2"
        onScroll={onScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleItems.map((table) => {
              const isSelected = selectedNodeIds.includes(table.id);
              return (
                <button
                  key={table.id}
                  onClick={() => onFocusTable(table.id)}
                  style={{ height: ITEM_HEIGHT }}
                  className={cn(
                    'group flex w-full items-center gap-2 rounded-lg px-2 text-left transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-blue-500/10 text-blue-500'
                      : 'text-gray-700 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white',
                  )}
                >
                  <Table2 className="size-[18px] shrink-0" />
                  <span className="text-xs font-medium truncate">{table.name}</span>
                  <Eye className="ml-auto size-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add table button */}
      <div className="p-2">
        <div className="mb-1.5 grid grid-cols-4 gap-1">
          {(['1:N', '1:1', '1|N', '1|1'] as const).map((mode) => {
            const active = relationshipCreateMode === mode;
            // 노드 주소 그램마([a-z0-9.-])에 맞춘 슬러그 — 클릭은 버튼 자신의 onClick 이 실제 모드를 세팅.
            const slug = MODE_SLUG[mode];
            return (
              <button
                key={mode}
                data-node={`relmode/${slug}`}
                onClick={() => setRelationshipCreateMode(active ? null : mode)}
                className={cn(
                  'flex items-center justify-center gap-1 rounded px-1.5 py-1 text-[10px] font-semibold transition-colors',
                  active
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
                )}
                title={`Create relationship mode: ${mode}`}
              >
                <Link2 className="size-3" />
                {mode}
              </button>
            );
          })}
        </div>
        {relationshipCreateMode && (
          <div className="mb-1.5 rounded border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[10px] text-blue-300">
            <p className="font-semibold">REL MODE {relationshipCreateMode}</p>
            <p className="truncate">
              {relationshipSourceTable ? `1st: ${relationshipSourceTable.name}` : '1st: select source table'}
            </p>
            <button
              data-node="relmode-cancel"
              onClick={clearRelationshipCreateState}
              className="mt-1 text-[10px] underline underline-offset-2 hover:text-blue-200"
            >
              cancel
            </button>
          </div>
        )}
        <button
          onClick={() => setCreateTableDialogOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <Plus className="size-3.5" />
          NEW TABLE
        </button>
      </div>
    </div>
  );
}
