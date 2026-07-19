// PixiJS v8 ERD Canvas — WebGL-accelerated infinite canvas with viewport
// culling, LOD rendering, and spatial-index-based hit testing.

import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { useStore } from '@/store';
import type { Camera } from './camera';
import type { AnchorSide } from '@/types/schema';
import {
  screenToWorld,
  worldToScreen,
  zoomAtPoint,
  applyCameraToContainer,
  getViewportBounds,
  fitToView,
} from './camera';
import { overlayRectForHeader, isInHeaderBand, type OverlayRect } from './rename-overlay';
import { toast } from '@/store/toast-store';
import { createRelationship } from '@/features/relationship/create';
import { SpatialIndex } from './spatial-index';
import { TableNodeRenderer, refreshTableTextStyles } from './table-node';
import type { TableNodeData } from './table-node';
import { EdgeRenderer } from './edge-renderer';
import type { NodeEndpoint, EdgeData } from './edge-renderer';
import { buildEdgeData } from './edge-data';
import { columnsById } from '@/features/relationship/optionality';
import { NODE_WIDTH, COLORS, applyCanvasColors, getLOD, LOD } from './constants';
import { computeCanvasPalette } from '@/features/theme/host';
import { useHostThemeEpoch } from '@/hooks/useTheme';
import { CanvasContextMenu } from '../CanvasContextMenu';
import { PixiCanvasProvider } from './PixiCanvasContext';
import type { PixiCanvasAPI } from './PixiCanvasContext';
// 번들 플러그인(blob-URL ESM)에서는 `new Worker(new URL('@/...', import.meta.url))` 가 깨진다.
// build.mjs(Stage A) 가 워커를 IIFE 문자열(__ERD_WORKER_*)로 주입 → blobWorker 로 생성.
import { blobWorker } from '@/workers/inline-worker';

// ── Constants ────────────────────────────────────────────────────────

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 3;
const ZOOM_SPEED = 0.002;
const GRID_SIZE = 20;
const NODE_SYNC_CHUNK_SIZE = 120;
const LARGE_SYNC_THRESHOLD = 240;
const INTERACTION_SIMPLIFY_MS = 140;
const ENABLE_INTERACTION_SIMPLIFY = false;
const DRAG_START_THRESHOLD_PX = 4;
const DRAG_EDGE_REDRAW_INTERVAL_MS = 6;
const HOVER_EDGE_HITTEST_INTERVAL_MS = 24;
const EDGE_WORKER_INTERACT_UPDATE_MS = 6;
const EDGE_WORKER_IDLE_UPDATE_MS = 16;
const RENDER_IDLE_STOP_DELAY_MS = 120;
const GRID_REDRAW_INTERACT_MIN_MS = 24;
const GRID_REDRAW_IDLE_MIN_MS = 12;
const GRID_REDRAW_INTERACT_MIN_PX = 8;
const GRID_REDRAW_IDLE_MIN_PX = 3;
const GRID_REDRAW_INTERACT_MIN_ZOOM_DELTA = 0.01;
const GRID_REDRAW_IDLE_MIN_ZOOM_DELTA = 0.003;

const LAYOUT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
];

// ── Helpers ──────────────────────────────────────────────────────────

function computeFKColumnIds(
  relationships: Record<string, { targetTableId: string; targetColumnIds?: string[]; sourceTableId?: string; sourceColumnIds?: string[] }>,
): Map<string, Set<string>> {
  const byTable = new Map<string, Set<string>>();
  for (const rel of Object.values(relationships)) {
    // Canonical: FK lives on target side.
    const targetCols = rel.targetColumnIds ?? [];
    if (targetCols.length > 0) {
      const set = byTable.get(rel.targetTableId) ?? new Set<string>();
      for (const colId of targetCols) set.add(colId);
      byTable.set(rel.targetTableId, set);
      continue;
    }

    // Compatibility fallback for malformed/legacy imports.
    if (rel.sourceTableId && rel.sourceColumnIds && rel.sourceColumnIds.length > 0) {
      const set = byTable.get(rel.sourceTableId) ?? new Set<string>();
      for (const colId of rel.sourceColumnIds) set.add(colId);
      byTable.set(rel.sourceTableId, set);
    }
  }
  return byTable;
}

function drawGrid(
  gfx: Graphics,
  cam: Camera,
  w: number,
  h: number,
  visible: boolean,
): void {
  gfx.clear();
  if (!visible || cam.zoom < 0.1) return;

  // Adaptive spacing
  let spacing = GRID_SIZE;
  if (cam.zoom < 0.3) spacing = GRID_SIZE * 5;
  else if (cam.zoom < 0.5) spacing = GRID_SIZE * 2;

  // Viewport in world coords
  const halfW = w / 2 / cam.zoom;
  const halfH = h / 2 / cam.zoom;
  const minWX = cam.x - halfW;
  const maxWX = cam.x + halfW;
  const minWY = cam.y - halfH;
  const maxWY = cam.y + halfH;

  const startX = Math.floor(minWX / spacing) * spacing;
  const startY = Math.floor(minWY / spacing) * spacing;

  const alpha = Math.min(cam.zoom * 0.5, 0.3);

  // Vertical lines
  for (let wx = startX; wx <= maxWX; wx += spacing) {
    const sx = (wx - cam.x) * cam.zoom + w / 2;
    gfx.moveTo(sx, 0);
    gfx.lineTo(sx, h);
  }

  // Horizontal lines
  for (let wy = startY; wy <= maxWY; wy += spacing) {
    const sy = (wy - cam.y) * cam.zoom + h / 2;
    gfx.moveTo(0, sy);
    gfx.lineTo(w, sy);
  }

  gfx.stroke({ color: COLORS.grid, width: 1, alpha });
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function computeAnchorFromWorld(
  renderer: TableNodeRenderer,
  worldX: number,
  worldY: number,
): { side: AnchorSide; offset: number } {
  const pos = renderer.getPosition();
  const h = renderer.getHeight();
  const x0 = pos.x;
  const y0 = pos.y;
  const x1 = pos.x + NODE_WIDTH;
  const y1 = pos.y + h;

  const dLeft = Math.abs(worldX - x0);
  const dRight = Math.abs(worldX - x1);
  const dTop = Math.abs(worldY - y0);
  const dBottom = Math.abs(worldY - y1);
  const min = Math.min(dLeft, dRight, dTop, dBottom);

  if (min === dLeft) {
    return { side: 'left', offset: clamp01((worldY - y0) / Math.max(1, h)) };
  }
  if (min === dRight) {
    return { side: 'right', offset: clamp01((worldY - y0) / Math.max(1, h)) };
  }
  if (min === dTop) {
    return { side: 'top', offset: clamp01((worldX - x0) / Math.max(1, NODE_WIDTH)) };
  }
  return { side: 'bottom', offset: clamp01((worldX - x0) / Math.max(1, NODE_WIDTH)) };
}

function getLODForQuality(zoom: number, quality: 0 | 1 | 2): LOD {
  if (quality === 0) return LOD.FULL;
  if (quality === 2) {
    if (zoom >= 0.8) return LOD.FULL;
    if (zoom >= 0.35) return LOD.SKELETON;
    return LOD.DOT;
  }
  return getLOD(zoom);
}

function getAdaptiveEdgeWorkerDpr(baseDpr: number, zoom: number, interacting: boolean): number {
  if (interacting) return Math.max(0.75, Math.min(1, baseDpr));
  if (zoom < 0.35) return Math.max(0.75, Math.min(1, baseDpr));
  return Math.max(0.9, Math.min(1.25, baseDpr));
}

function getDynamicEdgeUpdateIntervalMs(
  interacting: boolean,
  mode: 'none' | 'pan' | 'drag' | 'bend' | 'anchor',
  zoom: number,
  workerEnabled: boolean,
): number {
  if (!interacting) return workerEnabled ? EDGE_WORKER_IDLE_UPDATE_MS : 0;
  if (mode === 'drag') {
    if (zoom < 0.25) return 14;
    if (zoom < 0.5) return 10;
    return 6;
  }
  if (mode === 'pan') {
    if (zoom < 0.25) return 16;
    if (zoom < 0.5) return 12;
    return 8;
  }
  if (mode === 'bend' || mode === 'anchor') return 8;
  return workerEnabled ? EDGE_WORKER_INTERACT_UPDATE_MS : 6;
}

function getDynamicHoverHitTestIntervalMs(zoom: number, edgeCount: number): number {
  if (zoom < 0.2) return 48;
  if (zoom < 0.35) return 36;
  if (edgeCount > 1800) return 36;
  if (edgeCount > 1000) return 30;
  return HOVER_EDGE_HITTEST_INTERVAL_MS;
}

function shouldRedrawGrid(
  prev: Camera | null,
  nowCam: Camera,
  elapsedMs: number,
  interacting: boolean,
): boolean {
  if (!prev) return true;
  const minInterval = interacting ? GRID_REDRAW_INTERACT_MIN_MS : GRID_REDRAW_IDLE_MIN_MS;
  if (elapsedMs < minInterval) return false;
  const minPx = interacting ? GRID_REDRAW_INTERACT_MIN_PX : GRID_REDRAW_IDLE_MIN_PX;
  const minZoomDelta = interacting ? GRID_REDRAW_INTERACT_MIN_ZOOM_DELTA : GRID_REDRAW_IDLE_MIN_ZOOM_DELTA;
  const dxPx = Math.abs((nowCam.x - prev.x) * nowCam.zoom);
  const dyPx = Math.abs((nowCam.y - prev.y) * nowCam.zoom);
  const dz = Math.abs(nowCam.zoom - prev.zoom);
  return dxPx >= minPx || dyPx >= minPx || dz >= minZoomDelta;
}

// ── Component ────────────────────────────────────────────────────────

export function PixiERDCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  // PixiJS objects
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const gridGfxRef = useRef<Graphics | null>(null);
  const nodeLayerRef = useRef<Container | null>(null);
  const nodeRenderers = useRef(new Map<string, TableNodeRenderer>());
  const edgeRendererRef = useRef<EdgeRenderer | null>(null);
  const edgeWorkerRef = useRef<Worker | null>(null);
  const edgeWorkerReadyRef = useRef(false);
  const edgeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastEdgeWorkerUpdateAtRef = useRef(0);
  const edgePickSeqRef = useRef(1);
  const edgePickInFlightRef = useRef(false);
  const pendingEdgePickRef = useRef<{ worldX: number; worldY: number; threshold: number; sx: number; sy: number } | null>(null);
  const lastHoverPickReqIdRef = useRef(0);
  const hoverPickPosRef = useRef(new Map<number, { x: number; y: number; t0: number }>());
  const edgePerfRef = useRef({
    avgDrawMs: 0,
    edgeCount: 0,
    segmentCount: 0,
    hitTestMs: 0,
    pickRttMs: 0,
    lastLogAt: 0,
  });
  const spatialRef = useRef(new SpatialIndex());
  const visibleNodeIdsRef = useRef<Set<string>>(new Set());
  const prevSelectedNodeIdsRef = useRef<Set<string>>(new Set());
  const lastDragEdgeRedrawAtRef = useRef(0);
  const lastHoverHitTestAtRef = useRef(0);
  const lastHoverUiUpdateAtRef = useRef(0);
  const hoveredEdgeIdRef = useRef<string | null>(null);
  const hoverEdgeUiRef = useRef<{ edgeId: string; x: number; y: number } | null>(null);
  const interactionSimplifyUntilRef = useRef(0);
  const interactionSimplifiedRef = useRef(false);
  const tablesSyncGenRef = useRef(0);
  const positionsSyncGenRef = useRef(0);
  const qualityRef = useRef<0 | 1 | 2>(1);
  const routingModeRef = useRef<'direct' | 'ortho_short'>('direct');
  const edgeDataRef = useRef<EdgeData[]>([]);
  const edgeIndexByNodeRef = useRef<Map<string, EdgeData[]>>(new Map());
  const edgeByIdRef = useRef<Map<string, EdgeData>>(new Map());
  const cachedWorkerEdgesRef = useRef<EdgeData[] | null>(null);
  const cachedWorkerEndpointsRef = useRef<Array<[string, NodeEndpoint]> | null>(null);
  const onlyVisibleEdgesRef = useRef(true);
  const onlySelectedEdgesRef = useRef(false);
  const lastActivityAtRef = useRef(0);
  const wakeRenderLoopRef = useRef<(() => void) | null>(null);
  const lastGridDrawAtRef = useRef(0);
  const lastGridCamRef = useRef<Camera | null>(null);
  const lastGridVisibleRef = useRef<boolean | null>(null);

  // Camera (mutable for perf — never triggers React re-render)
  const camRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const sizeRef = useRef({ w: 800, h: 600 });
  const lodRef = useRef<LOD>(LOD.FULL);

  // Dirty flags
  const camDirty = useRef(true);
  const edgeDirty = useRef(true);

  // Pointer interaction state (mutable)
  const ptrRef = useRef({
    down: false,
    mode: 'none' as 'none' | 'pan' | 'drag' | 'bend' | 'anchor' | 'connect',
    nodeId: null as string | null,
    edgeId: null as string | null,
    bendIndex: -1,
    anchorKind: null as null | 'sourceAnchor' | 'targetAnchor',
    // connect 제스처(Alt-드래그): 소스 테이블 id + 프리뷰 라인 끝(스크린 px).
    connectSourceId: null as string | null,
    connectSX: 0,
    connectSY: 0,
    sx: 0,
    sy: 0,
    camX: 0,
    camY: 0,
    nodeX: 0,
    nodeY: 0,
    moved: false,
  });
  // 드래그-연결 프리뷰 라인 오버레이(스크린 좌표) — 소스 노드 중심 → 커서.
  const [connectPreview, setConnectPreview] = useState<
    { x1: number; y1: number; x2: number; y2: number } | null
  >(null);

  // Worker
  const workerRef = useRef<Worker | null>(null);

  // Canvas API for context menu
  const [canvasApi, setCanvasApi] = useState<PixiCanvasAPI | null>(null);
  const [hoverEdgeUi, setHoverEdgeUi] = useState<{ edgeId: string; x: number; y: number } | null>(null);
  // 인라인 rename 오버레이 — GPU 헤더 위에 DOM input 을 띄운다(더블클릭 진입).
  const [renameUi, setRenameUi] = useState<
    { tableId: string; rect: OverlayRect; value: string } | null
  >(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  // 렌더-무관 커밋 훅 — [] deps 이벤트 핸들러(onPointerDown/onWheel)가 최신 rename 값을
  // 읽어 커밋할 수 있게 ref 로 노출한다. 캔버스에 새 pointerdown 이 오면(다른 테이블 클릭 등)
  // 진행 중 rename 을 확정한다 — blur 에 의존하지 않아 실사용·주입 모두에서 동작.
  const commitRenameRef = useRef<() => void>(() => {});
  // Pixi init(비동기) 완료 신호 — 마운트 이전부터 store 에 있던 스키마(영속 복원 경로)도
  // 동기화 effect 가 다시 보게 한다. ref 만으로는 effect 가 재실행되지 않는다.
  const [pixiReady, setPixiReady] = useState(false);
  const wakeRenderLoop = () => wakeRenderLoopRef.current?.();

  // ── Store selectors ────────────────────────────────────────────────
  const tables = useStore(s => s.tables);
  const relationships = useStore(s => s.relationships);
  // 관계 생성 모드 — 캔버스 상단 배너로 시각화(모드/단계). 캔버스만 보는 사용자도 모드를 인지.
  const relationshipCreateMode = useStore(s => s.relationshipCreateMode);
  const relationshipCreateSourceTableId = useStore(s => s.relationshipCreateSourceTableId);
  const nodePositions = useStore(s => s.nodePositions);
  const selectedNodeIds = useStore(s => s.selectedNodeIds);
  const selectedEdgeIds = useStore(s => s.selectedEdgeIds);
  const showGrid = useStore(s => s.showGrid);
  const renderQualityLevel = useStore(s => s.renderQualityLevel);
  const showOnlyVisibleRelatedEdges = useStore(s => s.showOnlyVisibleRelatedEdges);
  const showOnlySelectedRelatedEdges = useStore(s => s.showOnlySelectedRelatedEdges);
  const edgeWorkerEnabled = useStore(s => s.edgeWorkerEnabled);
  const edgeRoutingMode = useStore(s => s.edgeRoutingMode);
  const autoLayoutTrigger = useStore(s => s.autoLayoutTrigger);

  useEffect(() => {
    qualityRef.current = renderQualityLevel;
    for (const [, r] of nodeRenderers.current) {
      r.setRenderQualityLevel(renderQualityLevel);
    }
    camDirty.current = true;
    edgeDirty.current = true;
    wakeRenderLoop();
  }, [renderQualityLevel]);

  useEffect(() => {
    onlyVisibleEdgesRef.current = showOnlyVisibleRelatedEdges;
    edgeDirty.current = true;
    wakeRenderLoop();
  }, [showOnlyVisibleRelatedEdges]);

  useEffect(() => {
    onlySelectedEdgesRef.current = showOnlySelectedRelatedEdges;
    edgeDirty.current = true;
    wakeRenderLoop();
  }, [showOnlySelectedRelatedEdges]);

  useEffect(() => {
    routingModeRef.current = edgeRoutingMode;
    edgeRendererRef.current?.setRoutingMode(edgeRoutingMode);
    edgeDirty.current = true;
    wakeRenderLoop();
  }, [edgeRoutingMode]);

  // Host theme adoption — derive the canvas palette from host tokens and repaint on the host's
  // single change signal. applyCanvasColors runs synchronously on the first fire so tables first
  // render with the host palette (the PixiApp inits async, tables render later).
  useHostThemeEpoch(() => {
    applyCanvasColors(computeCanvasPalette(document.documentElement));
    refreshTableTextStyles();
    for (const [, r] of nodeRenderers.current) r.redraw();
    lastGridVisibleRef.current = null; // force a grid redraw with the new grid color
    camDirty.current = true;
    edgeDirty.current = true;
    wakeRenderLoop();
  });

  // ═══════════════════════════════════════════════════════════════════
  // Init PixiJS Application
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const app = new Application();
    let alive = true;
    // Pixi 의 resizeTo=el 은 window resize 만 듣는다 → allotment/사이드바/프로퍼티 패널로 캔버스
    // 요소가 리사이즈돼도(창 변화 없이) 렌더러가 안 따라가 우측이 잘린다(표준앱은 창과 함께만
    // 리사이즈돼 미발현, 유연 레이아웃 임베드에서 발현). 요소 ResizeObserver 로 렌더러를 동기화.
    let resizeObs: ResizeObserver | null = null;

    app.init({
      backgroundAlpha: 0,
      resizeTo: el,
      antialias: true,
      autoDensity: true,
      autoStart: false,
      resolution: window.devicePixelRatio || 1,
      preference: 'webgl',
    }).then(() => {
      if (!alive) {
        app.destroy(true);
        return;
      }

      const edgeCanvas = document.createElement('canvas');
      edgeCanvas.style.position = 'absolute';
      edgeCanvas.style.inset = '0';
      edgeCanvas.style.width = '100%';
      edgeCanvas.style.height = '100%';
      edgeCanvas.style.pointerEvents = 'none';
      edgeCanvas.style.zIndex = '1';
      el.appendChild(edgeCanvas);
      edgeCanvasRef.current = edgeCanvas;

      const pixiCanvas = app.canvas as HTMLCanvasElement;
      pixiCanvas.style.position = 'absolute';
      pixiCanvas.style.inset = '0';
      pixiCanvas.style.zIndex = '2';
      el.appendChild(pixiCanvas);
      appRef.current = app;
      sizeRef.current = { w: app.screen.width, h: app.screen.height };

      // 요소 크기 변화(창 resize 가 아닌 레이아웃 변화 포함)마다 렌더러를 el 크기로 맞춘다.
      // renderer.resize 는 CSS 픽셀을 받아 resolution(DPR)을 내부 적용 → 우측 클립 제거.
      resizeObs = new ResizeObserver(() => {
        if (!alive) return;
        const a = appRef.current;
        if (!a || el.clientWidth === 0 || el.clientHeight === 0) return;
        a.renderer.resize(el.clientWidth, el.clientHeight);
        sizeRef.current = { w: a.screen.width, h: a.screen.height };
        camDirty.current = true;
        wakeRenderLoopRef.current?.();
      });
      resizeObs.observe(el);

      // Grid layer (screen space, below world)
      const gridGfx = new Graphics();
      app.stage.addChild(gridGfx);
      gridGfxRef.current = gridGfx;

      // World container (camera transform applied here)
      const world = new Container();
      app.stage.addChild(world);
      worldRef.current = world;

      // Edge layer (inside world, below nodes)
      const edgeRenderer = new EdgeRenderer();
      edgeRenderer.setRoutingMode(routingModeRef.current);
      world.addChild(edgeRenderer.container);
      edgeRendererRef.current = edgeRenderer;

      edgeRenderer.container.visible = true;

      // Node layer (inside world, above edges)
      const nodeLayer = new Container();
      world.addChild(nodeLayer);
      nodeLayerRef.current = nodeLayer;

      // Load initial camera from store
      const vp = useStore.getState().viewport;
      camRef.current = { x: vp.x, y: vp.y, zoom: vp.zoom || 1 };
      camDirty.current = true;

      // 레이어 준비 완료 — 동기화 effect 재실행 신호(복원된 스키마의 첫 페인트 보장).
      setPixiReady(true);

      wakeRenderLoopRef.current = () => {
        lastActivityAtRef.current = performance.now();
        if (!app.ticker.started) app.ticker.start();
      };

      // ── Ticker (render loop) ─────────────────────────────────────
      app.ticker.add(() => {
        const now = performance.now();
        const interacting = ptrRef.current.down;
        let didWork = false;
        const quality = qualityRef.current;
        const isDraggingNode = ptrRef.current.down && ptrRef.current.mode === 'drag';
        const shouldSimplify = ENABLE_INTERACTION_SIMPLIFY
          && quality > 0
          && (isDraggingNode || now < interactionSimplifyUntilRef.current);
        const simplifyToggled = shouldSimplify !== interactionSimplifiedRef.current;
        if (simplifyToggled) {
          interactionSimplifiedRef.current = shouldSimplify;
          edgeRendererRef.current?.setInteractionSimplified(shouldSimplify);
          camDirty.current = true;
          edgeDirty.current = true;
          didWork = true;
        }

        // Track size changes (sidebar toggle, window resize)
        const newW = app.screen.width;
        const newH = app.screen.height;
        if (newW !== sizeRef.current.w || newH !== sizeRef.current.h) {
          sizeRef.current = { w: newW, h: newH };
          camDirty.current = true;
          didWork = true;
        }

        const cam = camRef.current;
        const { w, h } = sizeRef.current;

        // Camera transform + culling
        if (camDirty.current && worldRef.current) {
          didWork = true;
          applyCameraToContainer(cam, worldRef.current, w, h);

          // LOD update
          let lodChanged = false;
          const newLod = getLODForQuality(cam.zoom, quality);
          if (newLod !== lodRef.current) {
            lodRef.current = newLod;
            lodChanged = true;
          edgeRendererRef.current?.setLOD(newLod);
            // Edge style/complexity changes with LOD, so redraw once on LOD transition.
            edgeDirty.current = true;
          }

          // Viewport culling via spatial index
          const bounds = getViewportBounds(cam, w, h);
          const visible = spatialRef.current.queryViewport(bounds);
          const nextVisible = new Set(visible.map(v => v.id));
          const prevVisible = visibleNodeIdsRef.current;
          let visibleSetChanged = false;
          if (nextVisible.size !== prevVisible.size) {
            visibleSetChanged = true;
          } else {
            for (const id of nextVisible) {
              if (!prevVisible.has(id)) {
                visibleSetChanged = true;
                break;
              }
            }
          }
          const effectiveLod = interactionSimplifiedRef.current
            ? (lodRef.current === LOD.FULL ? LOD.SKELETON : lodRef.current)
            : lodRef.current;

          if (prevVisible.size === 0 && nodeRenderers.current.size > 0) {
            // First culling pass: initialize from full renderer set once.
            for (const [, r] of nodeRenderers.current) {
              r.container.visible = false;
            }
            for (const id of nextVisible) {
              const renderer = nodeRenderers.current.get(id);
              if (renderer) {
                renderer.setLOD(effectiveLod);
                renderer.setZoom(cam.zoom);
                renderer.container.visible = true;
              }
            }
          } else {
            // Incremental culling: toggle only changed nodes.
            for (const id of prevVisible) {
              if (!nextVisible.has(id)) {
                const renderer = nodeRenderers.current.get(id);
                if (renderer) renderer.container.visible = false;
              }
            }
            for (const id of nextVisible) {
              if (!prevVisible.has(id)) {
                const renderer = nodeRenderers.current.get(id);
                if (renderer) {
                  renderer.setLOD(effectiveLod);
                  renderer.setZoom(cam.zoom);
                  renderer.container.visible = true;
                }
              }
            }
          }
          // On zoom-threshold changes, update only visible nodes.
          if (lodChanged || simplifyToggled) {
            for (const id of nextVisible) {
              const renderer = nodeRenderers.current.get(id);
              if (renderer) {
                renderer.setLOD(effectiveLod);
                renderer.setZoom(cam.zoom);
              }
            }
          } else {
            for (const id of nextVisible) {
              const renderer = nodeRenderers.current.get(id);
              if (renderer) renderer.setZoom(cam.zoom);
            }
          }
          visibleNodeIdsRef.current = nextVisible;
          if (visibleSetChanged && (onlyVisibleEdgesRef.current || qualityRef.current > 0)) {
            edgeDirty.current = true;
          }

          // Grid
          if (gridGfxRef.current) {
            const gridVisible = useStore.getState().showGrid;
            const gridVisibilityChanged = lastGridVisibleRef.current === null || lastGridVisibleRef.current !== gridVisible;
            const redrawGrid = gridVisibilityChanged || shouldRedrawGrid(
              lastGridCamRef.current,
              cam,
              now - lastGridDrawAtRef.current,
              interacting,
            );
            if (redrawGrid) {
              drawGrid(gridGfxRef.current, cam, w, h, gridVisible);
              lastGridCamRef.current = { ...cam };
              lastGridDrawAtRef.current = now;
              lastGridVisibleRef.current = gridVisible;
            }
          }

          camDirty.current = false;
          // Worker-rendered edges are in screen space; redraw on every camera change.
          if (edgeWorkerReadyRef.current) edgeDirty.current = true;
        }

        // Edge update
        if (edgeDirty.current) {
          didWork = true;
          const interacting = ptrRef.current.down;
          const nowEdge = performance.now();
          const minInterval = getDynamicEdgeUpdateIntervalMs(
            interacting,
            ptrRef.current.mode,
            camRef.current.zoom,
            edgeWorkerReadyRef.current,
          );
          if (minInterval > 0 && nowEdge - lastEdgeWorkerUpdateAtRef.current < minInterval) {
            return;
          }
          lastEdgeWorkerUpdateAtRef.current = nowEdge;
          const isPanning = ptrRef.current.down && ptrRef.current.mode === 'pan';
          const allEdges = edgeDataRef.current;
          const edgesByNode = edgeIndexByNodeRef.current;
          const edgeById = edgeByIdRef.current;
          const visibleIds = visibleNodeIdsRef.current;
          const hoveredEdgeId = hoveredEdgeIdRef.current;
          const dragNodeId = (ptrRef.current.down && ptrRef.current.mode === 'drag')
            ? ptrRef.current.nodeId
            : null;
          const selectedNodeIds = useStore.getState().selectedNodeIds;
          const selectedSet = new Set(selectedNodeIds);
          let edges: EdgeData[] = [];
          if (isPanning && edgeWorkerReadyRef.current && cachedWorkerEdgesRef.current && cachedWorkerEndpointsRef.current) {
            edges = cachedWorkerEdgesRef.current;
          } else if (dragNodeId) {
            edges = edgesByNode.get(dragNodeId) ?? [];
          } else if (onlySelectedEdgesRef.current) {
            if (selectedSet.size > 0) {
              const picked = new Map<string, EdgeData>();
              for (const nodeId of selectedSet) {
                const list = edgesByNode.get(nodeId);
                if (!list) continue;
                for (const e of list) picked.set(e.id, e);
              }
              edges = Array.from(picked.values());
            } else {
              edges = [];
            }
          } else if (onlyVisibleEdgesRef.current || quality === 1 || quality === 2) {
            const picked = new Map<string, EdgeData>();
            for (const nodeId of visibleIds) {
              const list = edgesByNode.get(nodeId);
              if (!list) continue;
              for (const e of list) picked.set(e.id, e);
            }
            edges = quality === 2 && !onlyVisibleEdgesRef.current
              ? Array.from(picked.values()).filter((e) => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId))
              : Array.from(picked.values());
          } else {
            edges = allEdges;
          }
          // Keep explicitly selected edges visible regardless of viewport/quality filters.
          const selectedEdgeIds = useStore.getState().selectedEdgeIds;
          if (selectedEdgeIds.length > 0) {
            const included = new Set(edges.map((e) => e.id));
            for (const edgeId of selectedEdgeIds) {
              if (included.has(edgeId)) continue;
              const extra = edgeById.get(edgeId);
              if (extra) {
                edges.push(extra);
                included.add(edgeId);
              }
            }
          }
          const decoratedEdges = hoveredEdgeId
            ? edges.map((e) => (e.id === hoveredEdgeId ? { ...e, hovered: true } : e))
            : edges;

          let endpointEntries: Array<[string, NodeEndpoint]>;
          if (isPanning && edgeWorkerReadyRef.current && cachedWorkerEndpointsRef.current) {
            endpointEntries = cachedWorkerEndpointsRef.current;
          } else {
            const endpointIds = new Set<string>();
            for (const e of decoratedEdges) {
              endpointIds.add(e.sourceId);
              endpointIds.add(e.targetId);
            }
            const endpoints = new Map<string, NodeEndpoint>();
            for (const id of endpointIds) {
              const r = nodeRenderers.current.get(id);
              if (!r) continue;
              const pos = r.getPosition();
              const rh = r.getHeight();
              endpoints.set(id, {
                x: pos.x + NODE_WIDTH / 2,
                y: pos.y + rh / 2,
                width: NODE_WIDTH,
                height: rh,
              });
            }
            endpointEntries = Array.from(endpoints.entries());
            if (edgeWorkerReadyRef.current) {
              cachedWorkerEdgesRef.current = decoratedEdges;
              cachedWorkerEndpointsRef.current = endpointEntries;
            }
          }

          if (edgeWorkerReadyRef.current && edgeWorkerRef.current) {
            const adaptiveDpr = getAdaptiveEdgeWorkerDpr(
              window.devicePixelRatio || 1,
              camRef.current.zoom,
              interacting,
            );
            edgeWorkerRef.current.postMessage({
              type: 'update',
              payload: {
                width: w,
                height: h,
                dpr: adaptiveDpr,
                camera: camRef.current,
                routingMode: routingModeRef.current,
                lod: lodRef.current === LOD.FULL ? 'full' : lodRef.current === LOD.SKELETON ? 'skeleton' : 'dot',
                edges: decoratedEdges,
                endpoints: endpointEntries,
              },
            });
            // Keep hidden main-thread geometry for bend/anchor handle editing.
            if (edgeRendererRef.current) {
              const selectedOnly = decoratedEdges.filter((e) => e.selected);
              edgeRendererRef.current.updateEdges(selectedOnly, new Map(endpointEntries));
            }
          } else if (edgeRendererRef.current) {
            edgeRendererRef.current.updateEdges(decoratedEdges, new Map(endpointEntries));
          }
          edgeDirty.current = false;
        }

        if (didWork || interacting) {
          lastActivityAtRef.current = now;
          return;
        }
        if (now - lastActivityAtRef.current >= RENDER_IDLE_STOP_DELAY_MS) {
          app.ticker.stop();
        }
      });

      lastActivityAtRef.current = performance.now();
      app.ticker.start();

      // Expose canvas API for context menu
      setCanvasApi({
        screenToWorld: (clientX: number, clientY: number) => {
          const rect = el.getBoundingClientRect();
          return screenToWorld(
            camRef.current,
            clientX - rect.left,
            clientY - rect.top,
            sizeRef.current.w,
            sizeRef.current.h,
          );
        },
        hitTestAt: (clientX: number, clientY: number) => {
          const rect = el.getBoundingClientRect();
          const wp = screenToWorld(
            camRef.current,
            clientX - rect.left,
            clientY - rect.top,
            sizeRef.current.w,
            sizeRef.current.h,
          );
          const hit = spatialRef.current.hitTest(wp.x, wp.y);
          return hit ? hit.id : null;
        },
        hitTestEdgeAt: (clientX: number, clientY: number) => {
          if (edgeWorkerReadyRef.current) {
            // Worker pick is async; use current hover pick result for context actions.
            return hoveredEdgeIdRef.current;
          }
          const rect = el.getBoundingClientRect();
          const wp = screenToWorld(
            camRef.current,
            clientX - rect.left,
            clientY - rect.top,
            sizeRef.current.w,
            sizeRef.current.h,
          );
          const hitThreshold = Math.max(4, Math.min(20, 8 / Math.max(0.15, camRef.current.zoom)));
          return edgeRendererRef.current?.hitTestEdge(wp.x, wp.y, hitThreshold) ?? null;
        },
        panTo: (worldX: number, worldY: number) => {
          camRef.current = { ...camRef.current, x: worldX, y: worldY };
          camDirty.current = true;
          wakeRenderLoopRef.current?.();
        },
      });
    });

    return () => {
      alive = false;
      resizeObs?.disconnect();
      resizeObs = null;
      edgeWorkerRef.current?.terminate();
      edgeWorkerRef.current = null;
      edgeWorkerReadyRef.current = false;
      edgePickInFlightRef.current = false;
      pendingEdgePickRef.current = null;
      edgeCanvasRef.current = null;
      hoverPickPosRef.current.clear();
      // WebGL 컨텍스트 명시 해제 — remount(soksak 뷰 unmount→mount) 시 GL 컨텍스트 누수 방지.
      // Pixi v8 webgl 렌더러의 raw GL 핸들은 renderer.gl. destroy 전에 loseContext 호출.
      const gl = (appRef.current?.renderer as unknown as { gl?: WebGLRenderingContext })?.gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      appRef.current?.destroy(true);
      appRef.current = null;
      worldRef.current = null;
      gridGfxRef.current = null;
      nodeLayerRef.current = null;
      edgeRendererRef.current = null;
      nodeRenderers.current.clear();
      visibleNodeIdsRef.current.clear();
      prevSelectedNodeIdsRef.current.clear();
      wakeRenderLoopRef.current = null;
      setCanvasApi(null);
    };
  }, []);

  useEffect(() => {
    const edgeCanvas = edgeCanvasRef.current;
    const edgeRenderer = edgeRendererRef.current;
    if (!edgeCanvas || !edgeRenderer) return;

    if (!edgeWorkerEnabled) {
      edgeWorkerReadyRef.current = false;
      edgePickInFlightRef.current = false;
      pendingEdgePickRef.current = null;
      hoverPickPosRef.current.clear();
      edgeRenderer.container.visible = true;
      console.info('[EdgeWorker] toggled: OFF');
      edgeDirty.current = true;
      wakeRenderLoop();
      return;
    }

    if (!('transferControlToOffscreen' in edgeCanvas)) {
      edgeWorkerReadyRef.current = false;
      edgeRenderer.container.visible = true;
      edgeDirty.current = true;
      wakeRenderLoop();
      return;
    }

    if (!edgeWorkerRef.current) {
      const worker = blobWorker(__ERD_WORKER_EDGE__);
      edgeWorkerRef.current = worker;
      const offscreen = edgeCanvas.transferControlToOffscreen();
      worker.postMessage({
        type: 'init',
        payload: { canvas: offscreen, dpr: window.devicePixelRatio || 1 },
      }, [offscreen]);
      worker.onmessage = (evt: MessageEvent<
      | { type: 'hitTestResult'; payload: { requestId: number; edgeId: string | null; hitTestMs: number; sentAt?: number } }
      | { type: 'perf'; payload: { avgDrawMs: number; edges: number; segments: number } }
      >) => {
        if (evt.data.type === 'perf') {
          edgePerfRef.current.avgDrawMs = evt.data.payload.avgDrawMs;
          edgePerfRef.current.edgeCount = evt.data.payload.edges;
          edgePerfRef.current.segmentCount = evt.data.payload.segments;
          const now = performance.now();
          if (import.meta.env.DEV && now - edgePerfRef.current.lastLogAt > 2000) {
            edgePerfRef.current.lastLogAt = now;
            console.info(
              `[EdgeWorker] draw=${edgePerfRef.current.avgDrawMs.toFixed(2)}ms ` +
              `pick=${edgePerfRef.current.hitTestMs.toFixed(2)}ms ` +
              `rtt=${edgePerfRef.current.pickRttMs.toFixed(2)}ms ` +
              `edges=${edgePerfRef.current.edgeCount} segs=${edgePerfRef.current.segmentCount}`,
            );
          }
          return;
        }
        if (evt.data.type !== 'hitTestResult') return;
        const { requestId, edgeId, hitTestMs } = evt.data.payload;
        edgePickInFlightRef.current = false;
        edgePerfRef.current.hitTestMs = hitTestMs;
        if (requestId !== lastHoverPickReqIdRef.current) return;
        const hit = edgeId ?? null;
        if (hit !== hoveredEdgeIdRef.current) {
          hoveredEdgeIdRef.current = hit;
          edgeDirty.current = true;
          wakeRenderLoopRef.current?.();
        }
        const pos = hoverPickPosRef.current.get(requestId);
        hoverPickPosRef.current.delete(requestId);
        if (pos) edgePerfRef.current.pickRttMs = performance.now() - pos.t0;
        if (hit && pos) {
          const next = { edgeId: hit, x: pos.x, y: pos.y };
          hoverEdgeUiRef.current = next;
          setHoverEdgeUi(next);
        } else if (hoverEdgeUiRef.current !== null) {
          hoverEdgeUiRef.current = null;
          setHoverEdgeUi(null);
        }
        const pending = pendingEdgePickRef.current;
        if (pending) {
          pendingEdgePickRef.current = null;
          const worker2 = edgeWorkerRef.current;
          if (worker2 && edgeWorkerReadyRef.current) {
            const nextRequestId = edgePickSeqRef.current++;
            edgePickInFlightRef.current = true;
            lastHoverPickReqIdRef.current = nextRequestId;
            hoverPickPosRef.current.set(nextRequestId, { x: pending.sx, y: pending.sy, t0: performance.now() });
            worker2.postMessage({
              type: 'hitTest',
              payload: {
                requestId: nextRequestId,
                worldX: pending.worldX,
                worldY: pending.worldY,
                threshold: pending.threshold,
                sentAt: performance.now(),
              },
            });
          }
        }
      };
      console.info('[EdgeWorker] initialized');
    }

    edgeWorkerReadyRef.current = true;
    edgePickInFlightRef.current = false;
    pendingEdgePickRef.current = null;
    hoverPickPosRef.current.clear();
    edgeRenderer.container.visible = false;
    console.info('[EdgeWorker] toggled: ON');
    edgeDirty.current = true;
    wakeRenderLoop();

    // 이 effect 가 생성한 edge-render 워커는 이 effect 가 책임지고 회수한다.
    // (언마운트·toggle 시 OffscreenCanvas worker 누수 방지 — 메인 mount cleanup 과 멱등.)
    return () => {
      edgeWorkerRef.current?.terminate();
      edgeWorkerRef.current = null;
      edgeWorkerReadyRef.current = false;
      edgePickInFlightRef.current = false;
      pendingEdgePickRef.current = null;
      hoverPickPosRef.current.clear();
    };
  }, [edgeWorkerEnabled]);

  // Keep camera in sync with global viewport state (single source of truth).
  useEffect(() => {
    const unsub = useStore.subscribe((state, prevState) => {
      const vp = state.viewport;
      const prevVp = prevState.viewport;
      if (
        vp.x === prevVp.x &&
        vp.y === prevVp.y &&
        vp.zoom === prevVp.zoom
      ) {
        return;
      }

      const cam = camRef.current;
      if (
        Math.abs(cam.x - vp.x) < 0.01 &&
        Math.abs(cam.y - vp.y) < 0.01 &&
        Math.abs(cam.zoom - (vp.zoom || 1)) < 0.0001
      ) {
        return;
      }

      camRef.current = { x: vp.x, y: vp.y, zoom: vp.zoom || 1 };
      camDirty.current = true;
      edgeDirty.current = true;
      wakeRenderLoopRef.current?.();
    });
    return () => unsub();
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // Sync tables → PixiJS node renderers
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!nodeLayerRef.current) return;

    const layer = nodeLayerRef.current;
    const spatial = spatialRef.current;
    const renderers = nodeRenderers.current;
    const fkByTable = computeFKColumnIds(relationships);
    const selectedSet = new Set(useStore.getState().selectedNodeIds);
    const tableList = Object.values(tables);
    const activeIds = new Set(tableList.map((t) => t.id));
    const syncGen = ++tablesSyncGenRef.current;

    const processOne = (table: typeof tableList[number]) => {
      const existing = renderers.get(table.id);
      const fkSet = fkByTable.get(table.id) ?? new Set<string>();
      const fkColumnIds = table.columns.filter(c => fkSet.has(c.id)).map(c => c.id);
      const data: TableNodeData = {
        id: table.id,
        tableName: table.name,
        columns: table.columns,
        fkColumnIds,
        selected: selectedSet.has(table.id),
        color: table.color,
      };

      if (existing) {
        existing.update(data);
        existing.setRenderQualityLevel(qualityRef.current);
      } else {
        const pos = useStore.getState().nodePositions[table.id] ?? { x: 0, y: 0 };
        const r = new TableNodeRenderer(data);
        r.setLOD(lodRef.current);
        r.setZoom(camRef.current.zoom);
        r.setRenderQualityLevel(qualityRef.current);
        r.setPosition(pos.x, pos.y);
        layer.addChild(r.container);
        renderers.set(table.id, r);
      }
    };

    const finalize = () => {
      if (tablesSyncGenRef.current !== syncGen) return;

      for (const [id, r] of renderers) {
        if (!activeIds.has(id)) {
          r.destroy();
          renderers.delete(id);
        }
      }

      const items: Array<{ minX: number; minY: number; maxX: number; maxY: number; id: string }> = [];
      for (const [id, r] of renderers) {
        const b = r.getBounds();
        items.push({ id, minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY });
      }
      spatial.load(items);
      camDirty.current = true;
      edgeDirty.current = true;
      wakeRenderLoop();
    };

    if (tableList.length <= LARGE_SYNC_THRESHOLD) {
      for (const table of tableList) processOne(table);
      finalize();
      return;
    }

    const processChunk = (start: number) => {
      if (tablesSyncGenRef.current !== syncGen) return;
      const end = Math.min(start + NODE_SYNC_CHUNK_SIZE, tableList.length);
      for (let i = start; i < end; i++) {
        processOne(tableList[i]);
      }
      camDirty.current = true;
      wakeRenderLoop();
      if (end < tableList.length) {
        requestAnimationFrame(() => processChunk(end));
      } else {
        finalize();
      }
    };

    processChunk(0);

    return () => {
      tablesSyncGenRef.current += 1;
    };
    // pixiReady: init 완료 전 이 effect 는 nodeLayer 부재로 조기 반환한다 — 마운트 이전부터
    // 존재하던 스키마(영속 복원)는 tables 참조가 다시 바뀌지 않으므로, init 완료가 재실행을
    // 트리거해야 첫 페인트가 성립한다.
  }, [tables, relationships, pixiReady]);

  // Position-only sync (auto layout / load position apply): do not rebuild node content.
  useEffect(() => {
    const renderers = nodeRenderers.current;
    if (renderers.size === 0) return;
    const entries = Array.from(renderers.entries());
    const syncGen = ++positionsSyncGenRef.current;

    const applyChunk = (start: number) => {
      if (positionsSyncGenRef.current !== syncGen) return;
      const end = Math.min(start + NODE_SYNC_CHUNK_SIZE, entries.length);
      for (let i = start; i < end; i++) {
        const [id, r] = entries[i];
        const pos = nodePositions[id];
        if (pos) r.setPosition(pos.x, pos.y);
      }
      camDirty.current = true;
      edgeDirty.current = true;
      wakeRenderLoop();
      if (end < entries.length) {
        requestAnimationFrame(() => applyChunk(end));
        return;
      }

      const items: Array<{ minX: number; minY: number; maxX: number; maxY: number; id: string }> = [];
      for (const [id, r] of entries) {
        const b = r.getBounds();
        items.push({ id, minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY });
      }
      spatialRef.current.load(items);
      camDirty.current = true;
      edgeDirty.current = true;
      wakeRenderLoop();
    };

    if (entries.length <= LARGE_SYNC_THRESHOLD) {
      applyChunk(0);
      return;
    }
    requestAnimationFrame(() => applyChunk(0));

    return () => {
      positionsSyncGenRef.current += 1;
    };
  }, [nodePositions]);

  // Node selection change: update only changed nodes instead of full table sync.
  useEffect(() => {
    const prev = prevSelectedNodeIdsRef.current;
    const next = new Set(selectedNodeIds);
    const changedIds = new Set([...prev, ...next]);

    for (const id of changedIds) {
      const wasSelected = prev.has(id);
      const isSelected = next.has(id);
      if (wasSelected === isSelected) continue;
      const renderer = nodeRenderers.current.get(id);
      if (renderer) renderer.setSelected(isSelected);
    }

    prevSelectedNodeIdsRef.current = next;
  }, [selectedNodeIds]);

  // Edge selection change — 엣지 직접 선택 + 노드 선택 전파(related) 둘 다에 반응한다.
  useEffect(() => {
    const allEdges = buildEdgeData(
      useStore.getState().relationships,
      useStore.getState().selectedEdgeIds,
      useStore.getState().selectedNodeIds,
      columnsById(useStore.getState().tables),
    );
    edgeDataRef.current = allEdges;
    const byNode = new Map<string, EdgeData[]>();
    const byId = new Map<string, EdgeData>();
    for (const e of allEdges) {
      byId.set(e.id, e);
      const src = byNode.get(e.sourceId) ?? [];
      src.push(e);
      byNode.set(e.sourceId, src);
      const tgt = byNode.get(e.targetId) ?? [];
      tgt.push(e);
      byNode.set(e.targetId, tgt);
    }
    edgeIndexByNodeRef.current = byNode;
    edgeByIdRef.current = byId;
    cachedWorkerEdgesRef.current = null;
    cachedWorkerEndpointsRef.current = null;
    edgeDirty.current = true;
    wakeRenderLoop();
    // tables 의존 — 컬럼 nullable 변경 시 optionality(○) 재유도.
  }, [relationships, selectedEdgeIds, selectedNodeIds, tables]);

  // Grid visibility change
  useEffect(() => {
    camDirty.current = true;
    wakeRenderLoop();
  }, [showGrid]);

  // ═══════════════════════════════════════════════════════════════════
  // Event handlers (wheel, pointer, keyboard)
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const setState = useStore.setState;
    const sendWorkerEdgePick = (worldX: number, worldY: number, threshold: number, sx: number, sy: number) => {
      const worker = edgeWorkerRef.current;
      if (!worker || !edgeWorkerReadyRef.current) return;
      const requestId = edgePickSeqRef.current++;
      edgePickInFlightRef.current = true;
      lastHoverPickReqIdRef.current = requestId;
      hoverPickPosRef.current.set(requestId, { x: sx, y: sy, t0: performance.now() });
      worker.postMessage({
        type: 'hitTest',
        payload: {
          requestId,
          worldX,
          worldY,
          threshold,
          sentAt: performance.now(),
        },
      });
    };
    const requestWorkerEdgePick = (worldX: number, worldY: number, threshold: number, sx: number, sy: number) => {
      if (edgePickInFlightRef.current) {
        pendingEdgePickRef.current = { worldX, worldY, threshold, sx, sy };
        return;
      }
      sendWorkerEdgePick(worldX, worldY, threshold, sx, sy);
    };

    // Throttled viewport sync (for minimap during wheel/zoom)
    let vpSyncTimer: ReturnType<typeof setTimeout> | null = null;
    const syncViewport = () => {
      if (vpSyncTimer) return;
      vpSyncTimer = setTimeout(() => {
        vpSyncTimer = null;
        useStore.getState().setViewport({
          x: camRef.current.x,
          y: camRef.current.y,
          zoom: camRef.current.zoom,
        });
      }, 150);
    };

    // ── Double-click a header → inline rename ──
    const onDblClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const rect = el.getBoundingClientRect();
      const wp = screenToWorld(
        camRef.current,
        e.clientX - rect.left,
        e.clientY - rect.top,
        sizeRef.current.w,
        sizeRef.current.h,
      );
      const hit = spatialRef.current.hitTest(wp.x, wp.y);
      if (!hit) return;
      const store = useStore.getState();
      const pos = store.nodePositions[hit.id];
      const table = store.tables[hit.id];
      if (!pos || !table) return;
      if (!isInHeaderBand(pos, wp.x, wp.y)) return;
      e.preventDefault();
      setRenameUi({
        tableId: hit.id,
        value: table.name,
        rect: overlayRectForHeader(camRef.current, pos, sizeRef.current.w, sizeRef.current.h),
      });
    };

    // ── Wheel: zoom (ctrl/meta) or pan (plain scroll) ──
    const onWheel = (e: WheelEvent) => {
      // 카메라가 움직이면 오버레이가 드리프트하므로 rename input 을 커밋·닫는다(blur).
      renameInputRef.current?.blur();
      e.preventDefault();
      const cam = camRef.current;
      const { w, h } = sizeRef.current;
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        // Zoom toward cursor (also handles trackpad pinch)
        const delta = -e.deltaY * ZOOM_SPEED;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * (1 + delta)));
        camRef.current = zoomAtPoint(cam, sx, sy, newZoom, w, h);
      } else {
        // Pan
        camRef.current = {
          ...cam,
          x: cam.x + e.deltaX / cam.zoom,
          y: cam.y + e.deltaY / cam.zoom,
        };
      }
      camDirty.current = true;
      const quality = qualityRef.current;
      interactionSimplifyUntilRef.current = performance.now()
        + (quality === 2 ? 200 : quality === 1 ? INTERACTION_SIMPLIFY_MS : 0);
      wakeRenderLoopRef.current?.();
      syncViewport();
    };

    // ── Pointer down ──
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // left button only
      // 진행 중 인라인 rename 은 새 캔버스 클릭에서 확정한다(blur 비의존).
      commitRenameRef.current();
      el.setPointerCapture(e.pointerId);
      wakeRenderLoopRef.current?.();
      if (hoverEdgeUiRef.current !== null) {
        hoverEdgeUiRef.current = null;
        setHoverEdgeUi(null);
      }

      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wp = screenToWorld(camRef.current, sx, sy, sizeRef.current.w, sizeRef.current.h);
    const store = useStore.getState();
    const ptr = ptrRef.current;
    const nodeHit = spatialRef.current.hitTest(wp.x, wp.y);

      // Relationship create mode: first click(source PK) -> second click(target FK).
      const relMode = store.relationshipCreateMode;
      if (nodeHit && relMode) {
        const sourceTableId = store.relationshipCreateSourceTableId;
        if (!sourceTableId) {
          store.setRelationshipCreateSourceTableId(nodeHit.id);
          setState({ selectedNodeIds: [nodeHit.id], selectedEdgeIds: [] });
          return;
        }
        if (sourceTableId === nodeHit.id) {
          store.setRelationshipCreateSourceTableId(nodeHit.id);
          setState({ selectedNodeIds: [nodeHit.id], selectedEdgeIds: [] });
          return;
        }

        const sourceName = store.tables[sourceTableId]?.name ?? '?';
        const targetName = store.tables[nodeHit.id]?.name ?? '?';
        const res = createRelationship(useStore, sourceTableId, nodeHit.id, relMode);
        store.setRelationshipCreateMode(null);
        if (!res.ok) {
          toast(res.message ?? '관계를 만들 수 없습니다', 'error');
          return;
        }
        setState({ selectedNodeIds: [], selectedEdgeIds: [res.relId!] });
        toast(`${sourceName} → ${targetName} 관계를 만들었습니다`, 'success');
        return;
      }

      // Alt-드래그: 노드에서 시작하면 관계 연결 제스처(드래그-투-커넥트). 다른 테이블에 놓으면 FK 생성.
      if (nodeHit && e.altKey) {
        ptr.down = true;
        ptr.mode = 'connect';
        ptr.connectSourceId = nodeHit.id;
        ptr.moved = false;
        ptr.sx = e.clientX;
        ptr.sy = e.clientY;
        const r = el.getBoundingClientRect();
        const startRenderer = nodeRenderers.current.get(nodeHit.id);
        // 프리뷰 시작점 = 소스 노드 중심(스크린).
        if (startRenderer) {
          const b = startRenderer.getBounds();
          const cw = worldToScreen(camRef.current, (b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, sizeRef.current.w, sizeRef.current.h);
          ptr.connectSX = cw.x;
          ptr.connectSY = cw.y;
        } else {
          ptr.connectSX = e.clientX - r.left;
          ptr.connectSY = e.clientY - r.top;
        }
        setConnectPreview({ x1: ptr.connectSX, y1: ptr.connectSY, x2: e.clientX - r.left, y2: e.clientY - r.top });
        el.style.cursor = 'crosshair';
        setState({ selectedNodeIds: [nodeHit.id], selectedEdgeIds: [] });
        return;
      }

      // Fast path: node interactions are most common and should not pay edge hit-test cost.
      if (nodeHit) {
        ptr.down = true;
        ptr.sx = e.clientX;
        ptr.sy = e.clientY;
        ptr.moved = false;
        ptr.mode = 'drag';
        ptr.nodeId = nodeHit.id;
        const renderer = nodeRenderers.current.get(nodeHit.id);
        if (renderer) {
          const pos = renderer.getPosition();
          ptr.nodeX = pos.x;
          ptr.nodeY = pos.y;
        }

        // Immediate selection feedback on press (no wait for pointerup).
        if (e.shiftKey) {
          const idx = store.selectedNodeIds.indexOf(nodeHit.id);
          if (idx >= 0) {
            const r = nodeRenderers.current.get(nodeHit.id);
            if (r) r.setSelected(false);
            setState({ selectedNodeIds: store.selectedNodeIds.filter(id => id !== nodeHit.id) });
          } else {
            const r = nodeRenderers.current.get(nodeHit.id);
            if (r) r.setSelected(true);
            setState({ selectedNodeIds: [...store.selectedNodeIds, nodeHit.id], selectedEdgeIds: [] });
          }
        } else if (!(store.selectedNodeIds.length === 1 && store.selectedNodeIds[0] === nodeHit.id)) {
          for (const id of store.selectedNodeIds) {
            if (id === nodeHit.id) continue;
            const r = nodeRenderers.current.get(id);
            if (r) r.setSelected(false);
          }
          const r = nodeRenderers.current.get(nodeHit.id);
          if (r) r.setSelected(true);
          setState({ selectedNodeIds: [nodeHit.id], selectedEdgeIds: [] });
        }
        return;
      }

      const useWorkerPick = edgeWorkerReadyRef.current;
      const handleHit = !useWorkerPick
        ? edgeRendererRef.current?.hitTestHandle(wp.x, wp.y)
        : null;
      if (handleHit) {
        if (handleHit.kind === 'bend' && !e.altKey) {
          // Ignore bend editing unless Alt is explicitly held.
        } else {
        ptr.down = true;
        ptr.sx = e.clientX;
        ptr.sy = e.clientY;
        ptr.moved = false;
        ptr.edgeId = handleHit.edgeId;
        ptr.nodeId = null;
        ptr.bendIndex = handleHit.index ?? -1;
        if (handleHit.kind === 'bend') {
          ptr.mode = 'bend';
        } else {
          ptr.mode = 'anchor';
          ptr.anchorKind = handleHit.kind;
        }
        setState({ selectedEdgeIds: [handleHit.edgeId], selectedNodeIds: [] });
        return;
        }
      }

      const edgeHit = useWorkerPick
        ? hoveredEdgeIdRef.current
        : edgeRendererRef.current?.hitTestEdge(wp.x, wp.y);
      if (edgeHit) {
        ptr.down = true;
        ptr.mode = 'none';
        ptr.edgeId = edgeHit;
        ptr.nodeId = null;
        ptr.sx = e.clientX;
        ptr.sy = e.clientY;
        ptr.moved = false;
        if (e.altKey) {
          const rel = store.relationships[edgeHit];
          const nextBends = [...(rel?.bendPoints ?? []), { x: wp.x, y: wp.y }];
          store.updateRelationship(edgeHit, { bendPoints: nextBends });
          ptr.mode = 'bend';
          ptr.bendIndex = nextBends.length - 1;
        }
        setState({ selectedEdgeIds: [edgeHit], selectedNodeIds: [] });
        return;
      }
      ptr.down = true;
      ptr.sx = e.clientX;
      ptr.sy = e.clientY;
      ptr.moved = false;
      ptr.mode = 'pan';
      ptr.nodeId = null;
      ptr.camX = camRef.current.x;
      ptr.camY = camRef.current.y;
    };

    // ── Pointer move ──
    const onPointerMove = (e: PointerEvent) => {
      const ptr = ptrRef.current;
      if (!ptr.down) {
        // 관계 생성 모드 armed 이면 캔버스 커서를 crosshair 로 — 사용자가 "모드 안"임을 캔버스에서 본다.
        if (useStore.getState().relationshipCreateMode) {
          el.style.cursor = 'crosshair';
          return;
        }
        const now = performance.now();
        const hoverInterval = getDynamicHoverHitTestIntervalMs(camRef.current.zoom, edgeDataRef.current.length);
        if (now - lastHoverHitTestAtRef.current < hoverInterval) return;
        lastHoverHitTestAtRef.current = now;

        const rect = el.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const wp = screenToWorld(
          camRef.current,
          sx,
          sy,
          sizeRef.current.w,
          sizeRef.current.h,
        );
        const nodeHit = spatialRef.current.hitTest(wp.x, wp.y);
        if (nodeHit) {
          if (hoveredEdgeIdRef.current !== null) {
            hoveredEdgeIdRef.current = null;
            edgeDirty.current = true;
            wakeRenderLoopRef.current?.();
          }
          if (hoverEdgeUiRef.current !== null) {
            hoverEdgeUiRef.current = null;
            setHoverEdgeUi(null);
          }
          el.style.cursor = 'grab';
          return;
        }

        const hitThreshold = Math.max(4, Math.min(20, 8 / Math.max(0.15, camRef.current.zoom)));
        if (edgeWorkerReadyRef.current) {
          requestWorkerEdgePick(wp.x, wp.y, hitThreshold, sx, sy);
          el.style.cursor = hoveredEdgeIdRef.current ? 'pointer' : 'default';
          return;
        }
        const edgeHit = edgeRendererRef.current?.hitTestEdge(wp.x, wp.y, hitThreshold) ?? null;
        if (edgeHit !== hoveredEdgeIdRef.current) {
          hoveredEdgeIdRef.current = edgeHit;
          edgeDirty.current = true;
          wakeRenderLoopRef.current?.();
        }
        if (edgeHit) {
          const next = { edgeId: edgeHit, x: sx, y: sy };
          const prev = hoverEdgeUiRef.current;
          const nowUi = performance.now();
          const shouldUpdate = !prev
            || prev.edgeId !== next.edgeId
            || Math.abs(prev.x - next.x) > 24
            || Math.abs(prev.y - next.y) > 24
            || nowUi - lastHoverUiUpdateAtRef.current > 120;
          if (shouldUpdate) {
            hoverEdgeUiRef.current = next;
            lastHoverUiUpdateAtRef.current = nowUi;
            setHoverEdgeUi(next);
          }
        } else if (hoverEdgeUiRef.current !== null) {
          hoverEdgeUiRef.current = null;
          setHoverEdgeUi(null);
        }
        el.style.cursor = edgeHit ? 'pointer' : 'default';
        return;
      }

      const dx = e.clientX - ptr.sx;
      const dy = e.clientY - ptr.sy;
      if (Math.abs(dx) > DRAG_START_THRESHOLD_PX || Math.abs(dy) > DRAG_START_THRESHOLD_PX) ptr.moved = true;

      // 연결 제스처: 프리뷰 라인 끝을 커서로 갱신(월드 재계산 없이 스크린 좌표만).
      if (ptr.mode === 'connect') {
        const rect = el.getBoundingClientRect();
        setConnectPreview({ x1: ptr.connectSX, y1: ptr.connectSY, x2: e.clientX - rect.left, y2: e.clientY - rect.top });
        return;
      }

      if (ptr.mode === 'pan') {
        camRef.current = {
          ...camRef.current,
          x: ptr.camX - dx / camRef.current.zoom,
          y: ptr.camY - dy / camRef.current.zoom,
        };
        camDirty.current = true;
        const quality = qualityRef.current;
        interactionSimplifyUntilRef.current = performance.now()
          + (quality === 2 ? 200 : quality === 1 ? INTERACTION_SIMPLIFY_MS : 0);
        wakeRenderLoopRef.current?.();
      } else if (ptr.mode === 'drag' && ptr.nodeId) {
        if (!ptr.moved) return;
        const newX = ptr.nodeX + dx / camRef.current.zoom;
        const newY = ptr.nodeY + dy / camRef.current.zoom;
        const renderer = nodeRenderers.current.get(ptr.nodeId);
        if (renderer) {
          renderer.setPosition(newX, newY);
          const now = performance.now();
          if (now - lastDragEdgeRedrawAtRef.current >= DRAG_EDGE_REDRAW_INTERVAL_MS) {
            edgeDirty.current = true;
            lastDragEdgeRedrawAtRef.current = now;
            wakeRenderLoopRef.current?.();
          }
          const quality = qualityRef.current;
          interactionSimplifyUntilRef.current = now
            + (quality === 2 ? 200 : quality === 1 ? INTERACTION_SIMPLIFY_MS : 0);
        }
      } else if (ptr.mode === 'bend' && ptr.edgeId && ptr.bendIndex >= 0) {
        const world = screenToWorld(
          camRef.current,
          e.clientX - el.getBoundingClientRect().left,
          e.clientY - el.getBoundingClientRect().top,
          sizeRef.current.w,
          sizeRef.current.h,
        );
        const store = useStore.getState();
        const rel = store.relationships[ptr.edgeId];
        if (rel) {
          const bends = [...(rel.bendPoints ?? [])];
          if (bends[ptr.bendIndex]) {
            bends[ptr.bendIndex] = { x: world.x, y: world.y };
            store.updateRelationship(ptr.edgeId, { bendPoints: bends });
          }
        }
        edgeDirty.current = true;
        wakeRenderLoopRef.current?.();
      } else if (ptr.mode === 'anchor' && ptr.edgeId && ptr.anchorKind) {
        const world = screenToWorld(
          camRef.current,
          e.clientX - el.getBoundingClientRect().left,
          e.clientY - el.getBoundingClientRect().top,
          sizeRef.current.w,
          sizeRef.current.h,
        );
        const store = useStore.getState();
        const rel = store.relationships[ptr.edgeId];
        if (rel) {
          const tableId = ptr.anchorKind === 'sourceAnchor' ? rel.sourceTableId : rel.targetTableId;
          const renderer = nodeRenderers.current.get(tableId);
          if (renderer) {
            const anchor = computeAnchorFromWorld(renderer, world.x, world.y);
            if (ptr.anchorKind === 'sourceAnchor') {
              store.updateRelationship(ptr.edgeId, { sourceAnchor: anchor });
            } else {
              store.updateRelationship(ptr.edgeId, { targetAnchor: anchor });
            }
          }
        }
        edgeDirty.current = true;
        wakeRenderLoopRef.current?.();
      }
    };

    const onPointerLeave = () => {
      if (hoveredEdgeIdRef.current !== null) {
        hoveredEdgeIdRef.current = null;
        edgeDirty.current = true;
        wakeRenderLoopRef.current?.();
      }
      if (hoverEdgeUiRef.current !== null) {
        hoverEdgeUiRef.current = null;
        setHoverEdgeUi(null);
      }
      el.style.cursor = 'default';
    };

    // ── Pointer up ──
    const onPointerUp = (e: PointerEvent) => {
      el.releasePointerCapture(e.pointerId);
      const ptr = ptrRef.current;
      if (!ptr.down) return;

      if (ptr.mode === 'connect') {
        // 연결 제스처 종료: 커서 위치의 테이블을 대상으로 FK 관계를 만든다.
        setConnectPreview(null);
        el.style.cursor = 'default';
        const sourceId = ptr.connectSourceId;
        const rect = el.getBoundingClientRect();
        const wp = screenToWorld(camRef.current, e.clientX - rect.left, e.clientY - rect.top, sizeRef.current.w, sizeRef.current.h);
        const dropHit = spatialRef.current.hitTest(wp.x, wp.y);
        if (sourceId && dropHit && dropHit.id !== sourceId) {
          const srcName = useStore.getState().tables[sourceId]?.name ?? '?';
          const tgtName = useStore.getState().tables[dropHit.id]?.name ?? '?';
          const res = createRelationship(useStore, sourceId, dropHit.id, '1:N');
          if (res.ok) {
            setState({ selectedNodeIds: [], selectedEdgeIds: [res.relId!] });
            toast(`${srcName} → ${tgtName} 관계를 만들었습니다`, 'success');
          } else if (res.code !== 'SAME_TABLE') {
            toast(res.message ?? '관계를 만들 수 없습니다', 'error');
          }
        }
        // 빈 공간에 놓거나 같은 테이블이면 조용히 취소(프리뷰만 사라짐).
      } else if (ptr.mode === 'drag' && ptr.nodeId) {
        // Commit position only when an actual drag happened.
        if (ptr.moved) {
          const renderer = nodeRenderers.current.get(ptr.nodeId);
          if (renderer) {
            const pos = renderer.getPosition();
            useStore.getState().setNodePosition(ptr.nodeId, { x: pos.x, y: pos.y });
            const b = renderer.getBounds();
            spatialRef.current.update(ptr.nodeId, b.minX, b.minY, b.maxX, b.maxY);
          }
          edgeDirty.current = true;
          wakeRenderLoopRef.current?.();
        }

        // Selection is applied on pointerdown for instant feedback.
      } else if (ptr.mode === 'pan' && !ptr.moved) {
        // Click on empty space: clear selection
        setState({ selectedNodeIds: [], selectedEdgeIds: [] });
      }

      // Persist viewport only when changed to avoid needless global-state churn on click.
      const s = useStore.getState();
      const vp = s.viewport;
      if (
        Math.abs(vp.x - camRef.current.x) > 0.01 ||
        Math.abs(vp.y - camRef.current.y) > 0.01 ||
        Math.abs(vp.zoom - camRef.current.zoom) > 0.0001
      ) {
        s.setViewport({
          x: camRef.current.x,
          y: camRef.current.y,
          zoom: camRef.current.zoom,
        });
      }

      ptr.down = false;
      ptr.mode = 'none';
      ptr.nodeId = null;
      ptr.edgeId = null;
      ptr.bendIndex = -1;
      ptr.anchorKind = null;
      ptr.connectSourceId = null;
    };

    // ── Keyboard ──
    const onKeyDown = (e: KeyboardEvent) => {
      // Escape 는 범용 취소 — 진행 중 관계 생성 모드를 해제한다(캔버스에서 빠져나갈 유일한 키).
      if (e.key === 'Escape') {
        const store = useStore.getState();
        if (store.relationshipCreateMode) {
          store.setRelationshipCreateMode(null);
          el.style.cursor = 'default'; // armed crosshair 즉시 해제
          toast('관계 생성을 취소했습니다', 'info', 1500);
        }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete when focused on an input
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        const store = useStore.getState();
        for (const edgeId of store.selectedEdgeIds) {
          store.removeRelationship(edgeId);
        }
        for (const nodeId of store.selectedNodeIds) {
          store.removeTable(nodeId);
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerleave', onPointerLeave);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('dblclick', onDblClick);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('dblclick', onDblClick);
      if (vpSyncTimer) clearTimeout(vpSyncTimer);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // Register zoom / fit view functions with store
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    const doFitView = () => {
      const all = nodeRenderers.current;
      if (all.size === 0) return;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const r of all.values()) {
        const b = r.getBounds();
        if (b.minX < minX) minX = b.minX;
        if (b.minY < minY) minY = b.minY;
        if (b.maxX > maxX) maxX = b.maxX;
        if (b.maxY > maxY) maxY = b.maxY;
      }
      const { w, h } = sizeRef.current;
      camRef.current = fitToView({ minX, minY, maxX, maxY }, w, h);
      camDirty.current = true;
      wakeRenderLoop();
      syncViewportToStore();
    };

    const syncViewportToStore = () => {
      useStore.getState().setViewport({
        x: camRef.current.x,
        y: camRef.current.y,
        zoom: camRef.current.zoom,
      });
    };

    const doZoomIn = () => {
      const { w, h } = sizeRef.current;
      const newZoom = Math.min(MAX_ZOOM, camRef.current.zoom * 1.3);
      camRef.current = zoomAtPoint(camRef.current, w / 2, h / 2, newZoom, w, h);
      camDirty.current = true;
      wakeRenderLoop();
      syncViewportToStore();
    };

    const doZoomOut = () => {
      const { w, h } = sizeRef.current;
      const newZoom = Math.max(MIN_ZOOM, camRef.current.zoom / 1.3);
      camRef.current = zoomAtPoint(camRef.current, w / 2, h / 2, newZoom, w, h);
      camDirty.current = true;
      wakeRenderLoop();
      syncViewportToStore();
    };

    const doZoomTo = (zoom: number) => {
      const { w, h } = sizeRef.current;
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
      camRef.current = zoomAtPoint(camRef.current, w / 2, h / 2, next, w, h);
      camDirty.current = true;
      wakeRenderLoop();
      syncViewportToStore();
    };

    const doPanTo = (x: number, y: number) => {
      camRef.current = { ...camRef.current, x, y };
      camDirty.current = true;
      wakeRenderLoop();
      syncViewportToStore();
    };

    const store = useStore.getState();
    store.setFitViewFn(doFitView);
    store.setZoomInFn(doZoomIn);
    store.setZoomOutFn(doZoomOut);
    store.setSetZoomToFn(doZoomTo);
    store.setPanToFn(doPanTo);
    // 캔버스 introspection — get-render-state 가 store 수치가 아닌 캔버스 진실을 보고한다
    // (복원 첫 페인트·잔존 캔버스·이탈 배치 회귀의 관측점).
    store.setRenderStatsFn(() => {
      const round = (r: DOMRect) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
      const canvas = (appRef.current?.canvas as HTMLCanvasElement | undefined) ?? null;
      const el = containerRef.current;
      const root = el?.getRootNode();
      const host = root instanceof ShadowRoot ? (root.host as HTMLElement) : null;
      return {
        rendererCount: nodeRenderers.current.size,
        canvasConnected: canvas?.isConnected ?? false,
        canvasRect: canvas ? round(canvas.getBoundingClientRect()) : null,
        elRect: el ? round(el.getBoundingClientRect()) : null,
        hostRect: host ? round(host.getBoundingClientRect()) : null,
      };
    });

    return () => {
      const s = useStore.getState();
      s.setFitViewFn(null);
      s.setZoomInFn(null);
      s.setZoomOutFn(null);
      s.setSetZoomToFn(null);
      s.setPanToFn(null);
      s.setRenderStatsFn(null);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // Auto-layout via Web Worker
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (autoLayoutTrigger === 0) return;
    const store = useStore.getState();
    const currentTables = store.tables;
    const currentRelationships = store.relationships;
    if (Object.keys(currentTables).length === 0) return;
    store.setAutoLayoutRunning(true);

    const tableList = Object.values(currentTables).map(t => ({
      id: t.id,
      name: t.name,
      columnCount: t.columns.length,
    }));
    const relList = Object.values(currentRelationships).map(r => ({
      sourceTableId: r.sourceTableId,
      targetTableId: r.targetTableId,
    }));

    // Group by name prefix
    const prefixMap = new Map<string, string[]>();
    for (const t of tableList) {
      const parts = t.name.split('_');
      const prefix = parts.length > 1 ? parts[0] : t.name;
      if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
      prefixMap.get(prefix)!.push(t.id);
    }

    const groups: { prefix: string; label: string; tableIds: string[]; color: string }[] = [];
    const otherIds: string[] = [];
    let ci = 0;
    for (const [prefix, ids] of prefixMap) {
      if (ids.length >= 2) {
        groups.push({
          prefix,
          label: prefix.charAt(0).toUpperCase() + prefix.slice(1),
          tableIds: ids,
          color: LAYOUT_COLORS[ci++ % LAYOUT_COLORS.length],
        });
      } else {
        otherIds.push(...ids);
      }
    }
    if (otherIds.length > 0) {
      groups.push({ prefix: '_other', label: 'Other', tableIds: otherIds, color: '#71717a' });
    }

    workerRef.current?.terminate();

    const worker = blobWorker(__ERD_WORKER_LAYOUT__);
    workerRef.current = worker;

    worker.onmessage = (
      e: MessageEvent<{ positions: Record<string, { x: number; y: number }> }>,
    ) => {
      useStore.getState().setNodePositions(e.data.positions);
      // Fit view after layout settles
      requestAnimationFrame(() => {
        useStore.getState().fitViewFn?.();
      });
      useStore.getState().setAutoLayoutRunning(false);
      worker.terminate();
    };

    worker.postMessage({ tables: tableList, relationships: relList, groups, direction: 'TB' });

    return () => {
      useStore.getState().setAutoLayoutRunning(false);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [autoLayoutTrigger]);

  // rename 커밋 훅을 매 렌더 갱신 — DOM input value 를 단일 진실로 읽어(즉시 blur/주입 시
  // React state 가 stale 일 수 있음) 확정하고 오버레이를 닫는다. 진행 중이 아니면 no-op(멱등).
  commitRenameRef.current = () => {
    const ui = renameUi;
    if (!ui) return;
    const name = (renameInputRef.current?.value ?? ui.value).trim();
    const store = useStore.getState();
    if (name && name !== store.tables[ui.tableId]?.name) {
      store.updateTable(ui.tableId, { name });
    }
    setRenameUi(null);
  };

  // 네이티브 'change' 이벤트에 커밋 — 실사용자는 blur/Enter 시점에만 발화(원하는 확정 시점),
  // 값 주입(ui.input.fill)도 change 를 발화하므로 헤드리스 검증에서도 동일 경로가 확정된다.
  useEffect(() => {
    const input = renameInputRef.current;
    if (!renameUi || !input) return;
    const onChange = () => commitRenameRef.current();
    input.addEventListener('change', onChange);
    return () => input.removeEventListener('change', onChange);
  }, [renameUi]);

  // ═══════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════
  return (
    <PixiCanvasProvider value={canvasApi}>
      <CanvasContextMenu>
        <div className="relative h-full w-full">
          <div
            ref={containerRef}
            className="h-full w-full"
            data-node="canvas-root"
            tabIndex={0}
            // 백드롭 = 호스트 --bg 토큰(투명 WebGL 뒤 배경). 캔버스 팔레트와 정확히 같은 토큰이라
            // 라이트/다크가 캔버스와 함께 정합한다(하드코딩 bg-zinc-950 제거 — 라이트에서 안 바뀌던 레거시).
            style={{ outline: 'none', background: 'var(--bg, #09090b)' }}
          />
          {connectPreview && (
            <svg className="pointer-events-none absolute inset-0 z-[70] h-full w-full" data-node="connect-preview">
              <line
                x1={connectPreview.x1}
                y1={connectPreview.y1}
                x2={connectPreview.x2}
                y2={connectPreview.y2}
                stroke="#60a5fa"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
              <circle cx={connectPreview.x2} cy={connectPreview.y2} r={4} fill="#60a5fa" />
            </svg>
          )}
          {relationshipCreateMode && (
            <div
              className="pointer-events-none absolute left-1/2 top-3 z-[85] flex -translate-x-1/2 items-center gap-2 rounded-full border border-blue-400/60 bg-blue-500/95 px-3 py-1 text-[11px] font-medium text-white shadow-lg"
              data-node="relmode-banner"
            >
              <span className="font-semibold">관계 {relationshipCreateMode}</span>
              <span className="opacity-90">
                {relationshipCreateSourceTableId
                  ? `대상 테이블 클릭 (소스: ${tables[relationshipCreateSourceTableId]?.name ?? '?'})`
                  : '소스 테이블을 클릭하세요'}
              </span>
              <span className="opacity-70">· Esc 취소</span>
            </div>
          )}
          {renameUi && (
            <input
              ref={renameInputRef}
              autoFocus
              data-node="rename-input"
              className="absolute z-[90] box-border rounded-t-lg border border-blue-500 bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 px-3 font-mono outline-none"
              style={{
                left: `${renameUi.rect.left}px`,
                top: `${renameUi.rect.top}px`,
                width: `${renameUi.rect.width}px`,
                height: `${renameUi.rect.height}px`,
                fontSize: `${Math.max(9, Math.round(13 * (renameUi.rect.height / 32)))}px`,
              }}
              value={renameUi.value}
              onChange={(e) => setRenameUi((s) => (s ? { ...s, value: e.target.value } : s))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRenameRef.current(); // commit + close
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setRenameUi(null); // cancel without commit
                }
                e.stopPropagation(); // keep canvas keydown (Delete) from firing
              }}
              onBlur={() => commitRenameRef.current()}
              onFocus={(e) => e.currentTarget.select()}
            />
          )}
          {hoverEdgeUi && relationships[hoverEdgeUi.edgeId] && (
            <div
              className="pointer-events-none absolute z-[80] max-w-[420px] rounded border border-gray-300 bg-white/95 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-100 px-2 py-1 text-[11px] shadow-lg"
              style={{
                left: `${hoverEdgeUi.x + 12}px`,
                top: `${hoverEdgeUi.y + 12}px`,
              }}
            >
              {(() => {
                const rel = relationships[hoverEdgeUi.edgeId];
                const srcTable = tables[rel.sourceTableId];
                const tgtTable = tables[rel.targetTableId];
                const srcMap = new Map((srcTable?.columns ?? []).map((c) => [c.id, c.name]));
                const tgtMap = new Map((tgtTable?.columns ?? []).map((c) => [c.id, c.name]));
                const srcCols = (rel.sourceColumnIds ?? []).map((id) => srcMap.get(id) ?? id).join(', ') || '?';
                const tgtCols = (rel.targetColumnIds ?? []).map((id) => tgtMap.get(id) ?? id).join(', ') || '?';
                return `${srcTable?.name ?? '?'} . ${srcCols} -> ${tgtTable?.name ?? '?'} . ${tgtCols}`;
              })()}
            </div>
          )}
        </div>
      </CanvasContextMenu>
    </PixiCanvasProvider>
  );
}
