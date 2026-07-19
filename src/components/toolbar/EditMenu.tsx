import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store';
import { undo, redo, useHistoryStore } from '@/store/history';
import { usePaletteStore } from '@/features/palette/store';

export function EditMenu() {
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const removeTable = useStore((s) => s.removeTable);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);

  const handleDeleteSelected = () => {
    for (const id of selectedNodeIds) {
      removeTable(id);
    }
  };

  const handleSelectAll = () => {
    const tables = useStore.getState().tables;
    useStore.getState().setSelectedNodeIds(Object.keys(tables));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" className="text-gray-700 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200">
          Edit
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem disabled={!canUndo} onClick={() => undo()}>
          Undo
          <DropdownMenuShortcut>Ctrl+Z</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canRedo} onClick={() => redo()}>
          Redo
          <DropdownMenuShortcut>Ctrl+Y</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={selectedNodeIds.length === 0}
          onClick={handleDeleteSelected}
        >
          Delete Selected
          <DropdownMenuShortcut>Del</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSelectAll}>
          Select All
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => usePaletteStore.getState().setOpen(true)}>
          Command Palette
          <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
