import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store';

export function ViewMenu() {
  const leftSidebarOpen = useStore((s) => s.leftSidebarOpen);
  const rightSidebarOpen = useStore((s) => s.rightSidebarOpen);
  const bottomPanelOpen = useStore((s) => s.bottomPanelOpen);
  const showMinimap = useStore((s) => s.showMinimap);
  const showGrid = useStore((s) => s.showGrid);
  const renderQualityLevel = useStore((s) => s.renderQualityLevel);
  const showOnlyVisibleRelatedEdges = useStore((s) => s.showOnlyVisibleRelatedEdges);
  const showOnlySelectedRelatedEdges = useStore((s) => s.showOnlySelectedRelatedEdges);
  const edgeWorkerEnabled = useStore((s) => s.edgeWorkerEnabled);
  const edgeRoutingMode = useStore((s) => s.edgeRoutingMode);
  const notationStyle = useStore((s) => s.notationStyle);
  const setNotationStyle = useStore((s) => s.setNotationStyle);
  const toggleLeftSidebar = useStore((s) => s.toggleLeftSidebar);
  const toggleRightSidebar = useStore((s) => s.toggleRightSidebar);
  const toggleBottomPanel = useStore((s) => s.toggleBottomPanel);
  const toggleMinimap = useStore((s) => s.toggleMinimap);
  const toggleGrid = useStore((s) => s.toggleGrid);
  const setRenderQualityLevel = useStore((s) => s.setRenderQualityLevel);
  const toggleOnlyVisibleRelatedEdges = useStore((s) => s.toggleOnlyVisibleRelatedEdges);
  const toggleOnlySelectedRelatedEdges = useStore((s) => s.toggleOnlySelectedRelatedEdges);
  const toggleEdgeWorkerEnabled = useStore((s) => s.toggleEdgeWorkerEnabled);
  const setEdgeRoutingMode = useStore((s) => s.setEdgeRoutingMode);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" className="text-gray-700 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200">
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuCheckboxItem checked={leftSidebarOpen} onCheckedChange={toggleLeftSidebar}>
          Left Sidebar
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={rightSidebarOpen} onCheckedChange={toggleRightSidebar}>
          Right Sidebar
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={bottomPanelOpen} onCheckedChange={toggleBottomPanel}>
          Bottom Panel
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={showMinimap} onCheckedChange={toggleMinimap}>
          Minimap
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={showGrid} onCheckedChange={toggleGrid}>
          Grid
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showOnlyVisibleRelatedEdges}
          onCheckedChange={toggleOnlyVisibleRelatedEdges}
        >
          Visible-Related Edges Only
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showOnlySelectedRelatedEdges}
          onCheckedChange={toggleOnlySelectedRelatedEdges}
        >
          Selected-Related Edges Only
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={edgeWorkerEnabled}
          onCheckedChange={toggleEdgeWorkerEnabled}
        >
          Edge Worker
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Edge Routing</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={edgeRoutingMode}
          onValueChange={(v) => setEdgeRoutingMode(v as 'direct' | 'ortho_short')}
        >
          <DropdownMenuRadioItem value="direct">Direct</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="ortho_short">Ortho (0/1 bend + lane gap)</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Notation</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={notationStyle}
          onValueChange={(v) => setNotationStyle(v as 'crowsfoot' | 'numeric')}
        >
          <DropdownMenuRadioItem value="crowsfoot" data-node="notation/crowsfoot">Crow's Foot</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="numeric" data-node="notation/numeric">Numeric (1 / N / 0..1)</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Render Quality</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={String(renderQualityLevel)}
          onValueChange={(v) => setRenderQualityLevel(Number(v) as 0 | 1 | 2)}
        >
          <DropdownMenuRadioItem value="0">0 - Full Fidelity</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="1">1 - Balanced</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="2">2 - Performance</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => useStore.getState().zoomInFn?.()}>Zoom In</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => useStore.getState().zoomOutFn?.()}>Zoom Out</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => useStore.getState().fitViewFn?.()}>Fit View</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
