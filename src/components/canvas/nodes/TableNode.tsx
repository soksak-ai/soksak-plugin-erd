import { memo, type FC } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TableNodeData } from '@/types/diagram';
import type { Column } from '@/types/schema';
import { cn } from '@/lib/utils';
import { KeyRound, Link2 } from 'lucide-react';

// ZERO store subscriptions - all data via props
// Beautiful design maintained - React Flow virtualizes off-screen nodes

function ColumnIcon({ column, isFK }: { column: Column; isFK: boolean }) {
  if (column.isPrimaryKey) {
    return <KeyRound className="size-3.5 shrink-0 text-amber-500" />;
  }
  if (isFK) {
    return <Link2 className="size-3.5 shrink-0 text-blue-400" />;
  }
  return <span className="size-3.5 shrink-0" />;
}

const TableNodeComponent: FC<NodeProps> = ({ data, selected }) => {
  const { tableName, columns, fkColumnIds } = data as TableNodeData;
  if (!columns) return null;
  const fkSet = fkColumnIds ?? [];

  return (
    <div
      className={cn(
        'min-w-[200px] max-w-[400px] rounded-lg border bg-zinc-900 shadow-md',
        selected
          ? 'border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]'
          : 'border-zinc-700'
      )}
      style={{ contain: 'layout style paint' }}
    >
      <Handle type="target" position={Position.Left} id="table-target" className="!-left-[5px] !size-2.5 !border-zinc-600 !bg-zinc-400 hover:!bg-blue-400" />
      <Handle type="source" position={Position.Right} id="table-source" className="!-right-[5px] !size-2.5 !border-zinc-600 !bg-zinc-400 hover:!bg-blue-400" />

      {/* Header */}
      <div className={cn(
        'flex h-8 items-center gap-2 rounded-t-lg px-3',
        selected ? 'bg-blue-900/50' : 'bg-zinc-800'
      )}>
        <span className="flex-1 truncate text-sm font-medium text-zinc-100">{tableName}</span>
        <span className="text-[10px] text-zinc-500">{columns.length}</span>
      </div>

      {/* Columns */}
      {columns.length > 0 && (
        <div className="border-t border-zinc-700">
          {columns.map((col) => {
            const isFK = fkSet.includes(col.id);
            return (
              <div key={col.id} className="flex h-[26px] items-center gap-2 px-3 hover:bg-zinc-800/50">
                <ColumnIcon column={col} isFK={isFK} />
                <span className="truncate text-xs font-mono text-zinc-200">{col.name}</span>
                <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                  {col.dataType}
                  {col.isPrimaryKey && <span className="text-amber-500/70">PK</span>}
                  {isFK && <span className="text-blue-400/70">FK</span>}
                  {col.isUnique && !col.isPrimaryKey && <span className="text-purple-400/70">UQ</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const TableNode = memo(TableNodeComponent, (prev, next) => {
  return prev.id === next.id && prev.selected === next.selected && prev.data === next.data;
});
