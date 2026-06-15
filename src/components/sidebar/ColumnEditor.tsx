import { memo, useCallback, useMemo, useState } from 'react';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';
import type { Column } from '@/types/schema';
import { DATA_TYPES } from '@/constants/data-types';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KeyRound, Square, X, GripVertical, PlusCircle } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ColumnEditorProps {
  tableId: string;
  columns: Column[];
}

const VIRTUALIZE_THRESHOLD = 60;
const ITEM_HEIGHT = 88;
const OVERSCAN = 6;

function ColumnIcon({ column }: { column: Column }) {
  if (column.isPrimaryKey) {
    return <KeyRound className="size-3.5 text-amber-500 shrink-0" />;
  }
  // No FK detection for now (would need relationships)
  return <Square className="size-3 text-gray-400 dark:text-zinc-600 shrink-0" />;
}

function SortableColumn({ column, tableId }: { column: Column; tableId: string }) {
  const updateColumn = useStore((s) => s.updateColumn);
  const removeColumn = useStore((s) => s.removeColumn);
  const dialect = useStore((s) => s.dialect);
  const dataTypes = DATA_TYPES[dialect] ?? DATA_TYPES['mysql'];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40 p-2.5',
        isDragging && 'opacity-50 z-50'
      )}
    >
      {/* Top row: drag handle + icon + name + close */}
      <div className="flex items-center gap-1.5 mb-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400"
        >
          <GripVertical className="size-3" />
        </button>
        <ColumnIcon column={column} />
        <Input
          value={column.name}
          onChange={(e) => updateColumn(tableId, column.id, { name: e.target.value })}
          className="h-6 flex-1 text-xs font-bold border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
        />
        <button
          onClick={() => removeColumn(tableId, column.id)}
          className="text-gray-400 dark:text-zinc-600 hover:text-red-500 transition-colors"
        >
          <X className="size-3" />
        </button>
      </div>

      {/* Bottom row: type select + checkboxes */}
      <div className="flex items-center gap-2">
        <Select
          value={column.dataType}
          onValueChange={(value) => updateColumn(tableId, column.id, { dataType: value })}
        >
          <SelectTrigger size="sm" className="h-6 text-[11px] flex-1 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dataTypes.map((type) => (
              <SelectItem key={type} value={type} className="text-xs">
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 shrink-0">
          <label className="flex items-center gap-0.5 cursor-pointer">
            <Checkbox
              checked={!column.nullable}
              onCheckedChange={(checked) => updateColumn(tableId, column.id, { nullable: !checked })}
              className="size-3.5"
            />
            <span className="text-[10px] text-gray-500 dark:text-zinc-500">NN</span>
          </label>
          <label className="flex items-center gap-0.5 cursor-pointer">
            <Checkbox
              checked={column.autoIncrement}
              onCheckedChange={(checked) => updateColumn(tableId, column.id, { autoIncrement: !!checked })}
              className="size-3.5"
            />
            <span className="text-[10px] text-gray-500 dark:text-zinc-500">AI</span>
          </label>
          <label className="flex items-center gap-0.5 cursor-pointer">
            <Checkbox
              checked={column.isUnique}
              onCheckedChange={(checked) => updateColumn(tableId, column.id, { isUnique: !!checked })}
              className="size-3.5"
            />
            <span className="text-[10px] text-gray-500 dark:text-zinc-500">UQ</span>
          </label>
        </div>
      </div>
    </div>
  );
}

const MemoSortableColumn = memo(
  SortableColumn,
  (prev, next) => prev.tableId === next.tableId && isSameColumn(prev.column, next.column),
);

function PlainColumn({ column, tableId }: { column: Column; tableId: string }) {
  const updateColumn = useStore((s) => s.updateColumn);
  const removeColumn = useStore((s) => s.removeColumn);
  const dialect = useStore((s) => s.dialect);
  const dataTypes = DATA_TYPES[dialect] ?? DATA_TYPES['mysql'];

  return (
    <div
      className={cn(
        'rounded border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40 p-2.5',
      )}
      style={{ height: ITEM_HEIGHT }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <button
          className="cursor-not-allowed text-gray-300 dark:text-zinc-700"
          title="Reorder is disabled in virtualized mode"
          disabled
        >
          <GripVertical className="size-3" />
        </button>
        <ColumnIcon column={column} />
        <Input
          value={column.name}
          onChange={(e) => updateColumn(tableId, column.id, { name: e.target.value })}
          className="h-6 flex-1 text-xs font-bold border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
        />
        <button
          onClick={() => removeColumn(tableId, column.id)}
          className="text-gray-400 dark:text-zinc-600 hover:text-red-500 transition-colors"
        >
          <X className="size-3" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={column.dataType}
          onValueChange={(value) => updateColumn(tableId, column.id, { dataType: value })}
        >
          <SelectTrigger size="sm" className="h-6 text-[11px] flex-1 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dataTypes.map((type) => (
              <SelectItem key={type} value={type} className="text-xs">
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 shrink-0">
          <label className="flex items-center gap-0.5 cursor-pointer">
            <Checkbox
              checked={!column.nullable}
              onCheckedChange={(checked) => updateColumn(tableId, column.id, { nullable: !checked })}
              className="size-3.5"
            />
            <span className="text-[10px] text-gray-500 dark:text-zinc-500">NN</span>
          </label>
          <label className="flex items-center gap-0.5 cursor-pointer">
            <Checkbox
              checked={column.autoIncrement}
              onCheckedChange={(checked) => updateColumn(tableId, column.id, { autoIncrement: !!checked })}
              className="size-3.5"
            />
            <span className="text-[10px] text-gray-500 dark:text-zinc-500">AI</span>
          </label>
          <label className="flex items-center gap-0.5 cursor-pointer">
            <Checkbox
              checked={column.isUnique}
              onCheckedChange={(checked) => updateColumn(tableId, column.id, { isUnique: !!checked })}
              className="size-3.5"
            />
            <span className="text-[10px] text-gray-500 dark:text-zinc-500">UQ</span>
          </label>
        </div>
      </div>
    </div>
  );
}

const MemoPlainColumn = memo(
  PlainColumn,
  (prev, next) => prev.tableId === next.tableId && isSameColumn(prev.column, next.column),
);

export function ColumnEditor({ tableId, columns }: ColumnEditorProps) {
  const addColumn = useStore((s) => s.addColumn);
  const reorderColumns = useStore((s) => s.reorderColumns);
  const [scrollTop, setScrollTop] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = columns.findIndex((c) => c.id === active.id);
      const newIndex = columns.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(columns.map((c) => c.id), oldIndex, newIndex);
      reorderColumns(tableId, newOrder);
    },
    [columns, tableId, reorderColumns]
  );

  const useVirtualized = columns.length >= VIRTUALIZE_THRESHOLD;
  const viewportHeight = 400;
  const totalHeight = columns.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    columns.length,
    Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + OVERSCAN,
  );
  const visibleColumns = useMemo(
    () => (useVirtualized ? columns.slice(startIndex, endIndex) : columns),
    [columns, useVirtualized, startIndex, endIndex],
  );
  const topSpacer = useVirtualized ? startIndex * ITEM_HEIGHT : 0;
  const bottomSpacer = useVirtualized ? Math.max(0, totalHeight - endIndex * ITEM_HEIGHT) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
          Columns
        </span>
        <button
          onClick={() => addColumn(tableId)}
          className="text-blue-500 hover:text-blue-400 transition-colors"
        >
          <PlusCircle className="size-4" />
        </button>
      </div>

      <ScrollArea className="max-h-[400px]" onScrollCapture={(e) => {
        const t = e.target as HTMLElement;
        if (useVirtualized) setScrollTop(t.scrollTop);
      }}>
        {useVirtualized ? (
          <div>
            {topSpacer > 0 && <div style={{ height: topSpacer }} />}
            <div className="space-y-1.5">
              {visibleColumns.map((column) => (
                <MemoPlainColumn key={column.id} column={column} tableId={tableId} />
              ))}
            </div>
            {bottomSpacer > 0 && <div style={{ height: bottomSpacer }} />}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {columns.map((column) => (
                  <MemoSortableColumn key={column.id} column={column} tableId={tableId} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </ScrollArea>

      <button
        onClick={() => addColumn(tableId)}
        className="text-xs text-blue-500 hover:text-blue-400 font-medium transition-colors"
      >
        + Add Column
      </button>
    </div>
  );
}

function isSameColumn(a: Column, b: Column): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.dataType === b.dataType &&
    a.nullable === b.nullable &&
    a.autoIncrement === b.autoIncrement &&
    a.isUnique === b.isUnique &&
    a.isPrimaryKey === b.isPrimaryKey
  );
}
