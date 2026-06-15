import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store';

export function ToolsMenu() {
  const setBottomPanelTab = useStore((s) => s.setBottomPanelTab);
  const bottomPanelOpen = useStore((s) => s.bottomPanelOpen);
  const toggleBottomPanel = useStore((s) => s.toggleBottomPanel);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" className="text-gray-700 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200">
          Tools
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => useStore.getState().triggerAutoLayout()}>Auto Layout</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => useStore.getState().setImportSQLDialogOpen(true)}>Import SQL</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => useStore.getState().setImportMermaidDialogOpen(true)}>Import Mermaid</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => useStore.getState().setImportMWBDialogOpen(true)}>Import .mwb</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => {
          setBottomPanelTab('console');
          if (!bottomPanelOpen) toggleBottomPanel();
        }}>Validate Schema</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
