import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import type { SQLDialect } from '@/types/schema';
import type { Theme } from '@/constants/theme';

// 세션 간 영속되는 크롬 환경설정의 복원 입력. store 가 자기 필드의 유효범위를 소유하므로
// applyChromePrefs 가 값별로 검증한다(손상/외부 문서가 store 를 망가뜨리지 못하게). 이 목록이
// 곧 "무엇이 크롬 환경설정인가"의 단일 진실이다 — prefs 문서(plugin/prefs.ts)는 이걸 직렬화한다.
export interface ChromePrefsInput {
  leftSidebarOpen?: boolean;
  rightSidebarOpen?: boolean;
  bottomPanelOpen?: boolean;
  bottomPanelTab?: 'sql' | 'mermaid' | 'console';
  showMinimap?: boolean;
  showGrid?: boolean;
  renderQualityLevel?: 0 | 1 | 2;
  showOnlyVisibleRelatedEdges?: boolean;
  showOnlySelectedRelatedEdges?: boolean;
  edgeRoutingMode?: 'direct' | 'ortho_short';
  edgeWorkerEnabled?: boolean;
  leftWidth?: number;
  rightWidth?: number;
  bottomHeight?: number;
}

export interface UISlice {
  // Sidebar & Panel visibility
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  bottomPanelOpen: boolean;
  bottomPanelTab: 'sql' | 'mermaid' | 'console';

  // Panel sizes (px) — store-owned so they persist across sessions (prefs 문서).
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;

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
  // 호버(또는 에이전트가 강조)한 컬럼 행 — 일시 UI 상태(영속 안 함, selection 과 동급).
  hoveredRow: { tableId: string; index: number } | null;

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
  // 캔버스 렌더러 introspection — get-render-state 가 store 가 아닌 캔버스 진실을 보고한다.
  renderStatsFn: (() => { rendererCount: number }) | null;
  setRenderStatsFn: (fn: (() => { rendererCount: number }) | null) => void;

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
  setPanelSizes: (sizes: { leftWidth?: number; rightWidth?: number; bottomHeight?: number }) => void;
  applyChromePrefs: (prefs: ChromePrefsInput) => void;
  setRelationshipCreateMode: (mode: null | '1:N' | '1:1' | '1|N' | '1|1') => void;
  setRelationshipCreateSourceTableId: (tableId: string | null) => void;
  clearRelationshipCreateState: () => void;
  setHoveredRow: (row: { tableId: string; index: number } | null) => void;
  setFitViewFn: (fn: (() => void) | null) => void;
}

export const createUISlice: StateCreator<StoreState, [['zustand/immer', never]], [], UISlice> = (set) => ({
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  bottomPanelOpen: true,
  bottomPanelTab: 'sql',
  leftWidth: 240,
  rightWidth: 320,
  bottomHeight: 260,
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
  hoveredRow: null,
  autoLayoutTrigger: 0,
  autoLayoutRunning: false,
  zoomInFn: null,
  zoomOutFn: null,
  setZoomToFn: null,
  panToFn: null,
  fitViewFn: null,
  renderStatsFn: null,

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
  setPanelSizes: (sizes) => set((state) => {
    if (sizes.leftWidth !== undefined) state.leftWidth = sizes.leftWidth;
    if (sizes.rightWidth !== undefined) state.rightWidth = sizes.rightWidth;
    if (sizes.bottomHeight !== undefined) state.bottomHeight = sizes.bottomHeight;
  }),
  // 크롬 환경설정 복원 — 값별로 검증한다(손상/외부 문서 방어). 유효하지 않은 값은 무시(기본 유지).
  applyChromePrefs: (prefs) => set((state) => {
    const bool = (v: unknown): v is boolean => typeof v === 'boolean';
    const size = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
    if (bool(prefs.leftSidebarOpen)) state.leftSidebarOpen = prefs.leftSidebarOpen;
    if (bool(prefs.rightSidebarOpen)) state.rightSidebarOpen = prefs.rightSidebarOpen;
    if (bool(prefs.bottomPanelOpen)) state.bottomPanelOpen = prefs.bottomPanelOpen;
    if (prefs.bottomPanelTab === 'sql' || prefs.bottomPanelTab === 'mermaid' || prefs.bottomPanelTab === 'console') {
      state.bottomPanelTab = prefs.bottomPanelTab;
    }
    if (bool(prefs.showMinimap)) state.showMinimap = prefs.showMinimap;
    if (bool(prefs.showGrid)) state.showGrid = prefs.showGrid;
    if (prefs.renderQualityLevel === 0 || prefs.renderQualityLevel === 1 || prefs.renderQualityLevel === 2) {
      state.renderQualityLevel = prefs.renderQualityLevel;
    }
    if (bool(prefs.showOnlyVisibleRelatedEdges)) state.showOnlyVisibleRelatedEdges = prefs.showOnlyVisibleRelatedEdges;
    if (bool(prefs.showOnlySelectedRelatedEdges)) state.showOnlySelectedRelatedEdges = prefs.showOnlySelectedRelatedEdges;
    if (prefs.edgeRoutingMode === 'direct' || prefs.edgeRoutingMode === 'ortho_short') {
      state.edgeRoutingMode = prefs.edgeRoutingMode;
    }
    if (bool(prefs.edgeWorkerEnabled)) state.edgeWorkerEnabled = prefs.edgeWorkerEnabled;
    if (size(prefs.leftWidth)) state.leftWidth = prefs.leftWidth;
    if (size(prefs.rightWidth)) state.rightWidth = prefs.rightWidth;
    if (size(prefs.bottomHeight)) state.bottomHeight = prefs.bottomHeight;
  }),
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
  setHoveredRow: (row) => set((state) => {
    // 같은 값이면 무시(불필요 리렌더 방지).
    const cur = state.hoveredRow;
    if (cur === row || (cur && row && cur.tableId === row.tableId && cur.index === row.index)) return;
    state.hoveredRow = row;
  }),
  setFitViewFn: (fn) => set((state) => { state.fitViewFn = fn; }),
  setRenderStatsFn: (fn) => set((state) => { state.renderStatsFn = fn; }),
});
