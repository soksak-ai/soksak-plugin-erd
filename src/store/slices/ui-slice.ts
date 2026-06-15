import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import type { SQLDialect } from '@/types/schema';
import type { Theme } from '@/constants/theme';

export interface UISlice {
  // Sidebar & Panel visibility
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  bottomPanelOpen: boolean;
  bottomPanelTab: 'sql' | 'mermaid' | 'console';

  // Dialogs
  createTableDialogOpen: boolean;
  importSQLDialogOpen: boolean;
  importMermaidDialogOpen: boolean;
  importMWBDialogOpen: boolean;

  // Settings
  dialect: SQLDialect;
  theme: Theme;
  showMinimap: boolean;
  showGrid: boolean;
  renderQualityLevel: 0 | 1 | 2;
  showOnlyVisibleRelatedEdges: boolean;
  showOnlySelectedRelatedEdges: boolean;
  edgeWorkerEnabled: boolean;
  edgeRoutingMode: 'direct' | 'ortho_short';
  relationshipCreateMode: null | '1:N' | '1:1' | '1|N' | '1|1';
  relationshipCreateSourceTableId: string | null;

  // Auto Layout
  autoLayoutTrigger: number;
  autoLayoutRunning: boolean;
  triggerAutoLayout: () => void;
  setAutoLayoutRunning: (running: boolean) => void;

  // Zoom/view functions (registered by ERDCanvas)
  zoomInFn: (() => void) | null;
  zoomOutFn: (() => void) | null;
  setZoomToFn: ((zoom: number) => void) | null;
  panToFn: ((x: number, y: number) => void) | null;
  fitViewFn: (() => void) | null;
  setZoomInFn: (fn: (() => void) | null) => void;
  setZoomOutFn: (fn: (() => void) | null) => void;
  setSetZoomToFn: (fn: ((zoom: number) => void) | null) => void;
  setPanToFn: (fn: ((x: number, y: number) => void) | null) => void;

  // Actions
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  toggleBottomPanel: () => void;
  setBottomPanelTab: (tab: 'sql' | 'mermaid' | 'console') => void;
  setCreateTableDialogOpen: (open: boolean) => void;
  setImportSQLDialogOpen: (open: boolean) => void;
  setImportMermaidDialogOpen: (open: boolean) => void;
  setImportMWBDialogOpen: (open: boolean) => void;
  setDialect: (dialect: SQLDialect) => void;
  setTheme: (theme: Theme) => void;
  toggleMinimap: () => void;
  toggleGrid: () => void;
  setRenderQualityLevel: (level: 0 | 1 | 2) => void;
  toggleOnlyVisibleRelatedEdges: () => void;
  toggleOnlySelectedRelatedEdges: () => void;
  toggleEdgeWorkerEnabled: () => void;
  setEdgeRoutingMode: (mode: 'direct' | 'ortho_short') => void;
  setRelationshipCreateMode: (mode: null | '1:N' | '1:1' | '1|N' | '1|1') => void;
  setRelationshipCreateSourceTableId: (tableId: string | null) => void;
  clearRelationshipCreateState: () => void;
  setFitViewFn: (fn: (() => void) | null) => void;
}

export const createUISlice: StateCreator<StoreState, [['zustand/immer', never]], [], UISlice> = (set) => ({
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  bottomPanelOpen: true,
  bottomPanelTab: 'sql',
  createTableDialogOpen: false,
  importSQLDialogOpen: false,
  importMermaidDialogOpen: false,
  importMWBDialogOpen: false,
  dialect: 'mysql',
  theme: 'dark',
  showMinimap: true,
  showGrid: true,
  renderQualityLevel: 1,
  showOnlyVisibleRelatedEdges: true,
  showOnlySelectedRelatedEdges: false,
  edgeWorkerEnabled: false,
  edgeRoutingMode: 'direct',
  relationshipCreateMode: null,
  relationshipCreateSourceTableId: null,
  autoLayoutTrigger: 0,
  autoLayoutRunning: false,
  zoomInFn: null,
  zoomOutFn: null,
  setZoomToFn: null,
  panToFn: null,
  fitViewFn: null,

  triggerAutoLayout: () => set((state) => { state.autoLayoutTrigger += 1; }),
  setAutoLayoutRunning: (running) => set((state) => { state.autoLayoutRunning = running; }),
  setZoomInFn: (fn) => set((state) => { state.zoomInFn = fn; }),
  setZoomOutFn: (fn) => set((state) => { state.zoomOutFn = fn; }),
  setSetZoomToFn: (fn) => set((state) => { state.setZoomToFn = fn; }),
  setPanToFn: (fn) => set((state) => { state.panToFn = fn; }),

  toggleLeftSidebar: () => set((state) => { state.leftSidebarOpen = !state.leftSidebarOpen; }),
  toggleRightSidebar: () => set((state) => { state.rightSidebarOpen = !state.rightSidebarOpen; }),
  toggleBottomPanel: () => set((state) => { state.bottomPanelOpen = !state.bottomPanelOpen; }),
  setBottomPanelTab: (tab) => set((state) => { state.bottomPanelTab = tab; }),
  setCreateTableDialogOpen: (open) => set((state) => { state.createTableDialogOpen = open; }),
  setImportSQLDialogOpen: (open) => set((state) => { state.importSQLDialogOpen = open; }),
  setImportMermaidDialogOpen: (open) => set((state) => { state.importMermaidDialogOpen = open; }),
  setImportMWBDialogOpen: (open) => set((state) => { state.importMWBDialogOpen = open; }),
  setDialect: (dialect) => set((state) => { state.dialect = dialect; }),
  setTheme: (theme) => set((state) => { state.theme = theme; }),
  toggleMinimap: () => set((state) => { state.showMinimap = !state.showMinimap; }),
  toggleGrid: () => set((state) => { state.showGrid = !state.showGrid; }),
  setRenderQualityLevel: (level) => set((state) => { state.renderQualityLevel = level; }),
  toggleOnlyVisibleRelatedEdges: () => set((state) => {
    state.showOnlyVisibleRelatedEdges = !state.showOnlyVisibleRelatedEdges;
  }),
  toggleOnlySelectedRelatedEdges: () => set((state) => {
    state.showOnlySelectedRelatedEdges = !state.showOnlySelectedRelatedEdges;
  }),
  toggleEdgeWorkerEnabled: () => set((state) => {
    state.edgeWorkerEnabled = !state.edgeWorkerEnabled;
  }),
  setEdgeRoutingMode: (mode) => set((state) => {
    state.edgeRoutingMode = mode;
  }),
  setRelationshipCreateMode: (mode) => set((state) => {
    state.relationshipCreateMode = mode;
    if (mode === null) state.relationshipCreateSourceTableId = null;
  }),
  setRelationshipCreateSourceTableId: (tableId) => set((state) => {
    state.relationshipCreateSourceTableId = tableId;
  }),
  clearRelationshipCreateState: () => set((state) => {
    state.relationshipCreateMode = null;
    state.relationshipCreateSourceTableId = null;
  }),
  setFitViewFn: (fn) => set((state) => { state.fitViewFn = fn; }),
});
