import { useStore } from '@/store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  Database,
  Plus,
  Undo2,
  Redo2,
  LayoutDashboard,
  Maximize2,
} from 'lucide-react';
import { FileMenu } from '@/components/toolbar/FileMenu';
import { EditMenu } from '@/components/toolbar/EditMenu';
import { ViewMenu } from '@/components/toolbar/ViewMenu';
import { ToolsMenu } from '@/components/toolbar/ToolsMenu';

function QuickAction({ icon: Icon, label, onClick, disabled, node }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  // C2 노출 — data-node 로 ui.tree/ui.input.click 도달. 미지정 시 속성 없음(미노출).
  node?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClick}
          disabled={disabled}
          data-node={node}
          className="text-gray-600 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-200"
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Toolbar() {
  const dialect = useStore((s) => s.dialect);
  const setDialect = useStore((s) => s.setDialect);
  const zoom = useStore((s) => s.viewport.zoom);
  const tables = useStore((s) => s.tables);
  const setCreateTableDialogOpen = useStore((s) => s.setCreateTableDialogOpen);

  const tableCount = Object.keys(tables).length;
  const zoomPct = Math.round(zoom * 100);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2">
        {/* Left: Logo + Menus */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1.5 px-2">
            <Database className="size-4 text-blue-500" />
            <span className="text-sm font-bold text-blue-500">Abyss ERD</span>
          </div>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <FileMenu />
          <EditMenu />
          <ViewMenu />
          <ToolsMenu />
        </div>

        {/* Center: Quick Actions */}
        <div className="flex items-center gap-0.5">
          <QuickAction icon={Plus} label="Add Table" node="add-table" onClick={() => setCreateTableDialogOpen(true)} />
          <QuickAction icon={Undo2} label="Undo" node="undo" onClick={() => useStore.getState().undoLastOperation()} />
          <QuickAction icon={Redo2} label="Redo" disabled />
          <QuickAction icon={LayoutDashboard} label="Auto Layout" node="auto-layout" onClick={() => useStore.getState().triggerAutoLayout()} />
          <QuickAction icon={Maximize2} label="Fit View" node="fit-view" onClick={() => useStore.getState().fitViewFn?.()} />
        </div>

        {/* Right: Dialect, Zoom, Count, Export */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-gray-200 dark:border-zinc-700 overflow-hidden">
            <button
              data-node="dialect-mysql"
              onClick={() => setDialect('mysql')}
              className={cn(
                'px-2 py-1 text-[11px] font-medium transition-colors',
                dialect === 'mysql'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
              )}
            >
              MySQL
            </button>
            <button
              data-node="dialect-postgresql"
              onClick={() => setDialect('postgresql')}
              className={cn(
                'px-2 py-1 text-[11px] font-medium transition-colors',
                dialect === 'postgresql'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
              )}
            >
              PostgreSQL
            </button>
          </div>
          <span className="text-xs text-gray-500 dark:text-zinc-500">{zoomPct}%</span>
          <span className="text-xs text-gray-500 dark:text-zinc-500">{tableCount} tables</span>
          <Button size="xs" className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold">
            Export
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
