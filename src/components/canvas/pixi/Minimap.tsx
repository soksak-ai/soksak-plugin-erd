import { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from '@/store';
import { NODE_WIDTH, HEADER_HEIGHT, ROW_HEIGHT } from './constants';
import { computeCanvasPalette } from '@/features/theme/host';
import { toCssHex } from './color';
import { useHostThemeEpoch } from '@/hooks/useTheme';

const MAP_W = 200;
const MAP_H = 140;
const PADDING = 10;
const APPROX_CANVAS_W = 1200;
const APPROX_CANVAS_H = 700;
const DRAG_EPS = 0.5;
const MINIMAP_FRAME_MS = 33;

function getTableHeight(columnCount: number): number {
  return HEADER_HEIGHT + columnCount * ROW_HEIGHT;
}

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tables = useStore(s => s.tables);
  const nodePositions = useStore(s => s.nodePositions);
  const viewport = useStore(s => s.viewport);
  const showMinimap = useStore(s => s.showMinimap);
  const zoomToFn = useStore(s => s.setZoomToFn);
  // 호스트 테마 변경 시 미니맵 재그리기 트리거(2D 컨텍스트라 Pixi 재그리기와 별개).
  const [themeVersion, setThemeVersion] = useState(0);
  useHostThemeEpoch(() => setThemeVersion((v) => v + 1));
  const lastDrawAtRef = useRef(0);
  const drawTimerRef = useRef<number | null>(null);
  const drawRafRef = useRef<number | null>(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    offsetX: 0,
    offsetY: 0,
  });
  const zoomDragRef = useRef({ active: false, pointerId: -1 });

  // Compute world bounds of all nodes
  const getBounds = useCallback(() => {
    const ids = Object.keys(tables);
    if (ids.length === 0) {
      const zoom = Math.max(0.02, viewport.zoom || 1);
      const halfW = APPROX_CANVAS_W / 2 / zoom;
      const halfH = APPROX_CANVAS_H / 2 / zoom;
      const margin = 200;
      return {
        minX: viewport.x - halfW - margin,
        minY: viewport.y - halfH - margin,
        maxX: viewport.x + halfW + margin,
        maxY: viewport.y + halfH + margin,
      };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of ids) {
      const pos = nodePositions[id];
      if (!pos) continue;
      const table = tables[id];
      const h = getTableHeight(table?.columns?.length ?? 0);
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + NODE_WIDTH > maxX) maxX = pos.x + NODE_WIDTH;
      if (pos.y + h > maxY) maxY = pos.y + h;
    }

    if (minX === Infinity) {
      const zoom = Math.max(0.02, viewport.zoom || 1);
      const halfW = APPROX_CANVAS_W / 2 / zoom;
      const halfH = APPROX_CANVAS_H / 2 / zoom;
      const margin = 200;
      return {
        minX: viewport.x - halfW - margin,
        minY: viewport.y - halfH - margin,
        maxX: viewport.x + halfW + margin,
        maxY: viewport.y + halfH + margin,
      };
    }
    // Add margin
    const margin = 200;
    return { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin };
  }, [tables, nodePositions, viewport.x, viewport.y, viewport.zoom]);

  const getMapTransform = useCallback(() => {
    const bounds = getBounds();
    if (!bounds) return null;
    const worldW = bounds.maxX - bounds.minX;
    const worldH = bounds.maxY - bounds.minY;
    if (worldW <= 0 || worldH <= 0) return null;
    const availW = MAP_W - PADDING * 2;
    const availH = MAP_H - PADDING * 2;
    const scale = Math.min(availW / worldW, availH / worldH);
    const offsetX = PADDING + (availW - worldW * scale) / 2;
    const offsetY = PADDING + (availH - worldH * scale) / 2;
    return { bounds, scale, offsetX, offsetY };
  }, [getBounds]);

  const getViewportRect = useCallback(() => {
    const tr = getMapTransform();
    if (!tr || viewport.zoom <= 0) return null;
    const toMapX = (wx: number) => (wx - tr.bounds.minX) * tr.scale + tr.offsetX;
    const toMapY = (wy: number) => (wy - tr.bounds.minY) * tr.scale + tr.offsetY;
    const vpHalfW = APPROX_CANVAS_W / 2 / viewport.zoom;
    const vpHalfH = APPROX_CANVAS_H / 2 / viewport.zoom;
    const availW = MAP_W - PADDING * 2;
    const availH = MAP_H - PADDING * 2;

    const rawX = toMapX(viewport.x - vpHalfW);
    const rawY = toMapY(viewport.y - vpHalfH);
    const rawW = (vpHalfW * 2) * tr.scale;
    const rawH = (vpHalfH * 2) * tr.scale;

    const w = Math.max(8, Math.min(rawW, availW));
    const h = Math.max(8, Math.min(rawH, availH));
    const minX = PADDING;
    const minY = PADDING;
    const maxX = PADDING + availW - w;
    const maxY = PADDING + availH - h;
    const x = Math.max(minX, Math.min(maxX, rawX));
    const y = Math.max(minY, Math.min(maxY, rawY));
    return { x, y, w, h };
  }, [getMapTransform, viewport]);

  const getEffectiveViewportRect = useCallback(() => {
    return getViewportRect() ?? {
      x: PADDING,
      y: PADDING,
      w: MAP_W - PADDING * 2,
      h: MAP_H - PADDING * 2,
    };
  }, [getViewportRect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showMinimap) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 미니맵 색은 호스트 토큰에서 직접 파생(공유 COLORS 갱신 순서에 의존하지 않음 — 레이스 회피).
    const pal = computeCanvasPalette(document.documentElement);
    const cBg = toCssHex(pal.canvas);
    const cNode = toCssHex(pal.edge);
    const cViewport = toCssHex(pal.borderSelected);
    const cBorder = toCssHex(pal.border);

    const drawNow = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = MAP_W * dpr;
      canvas.height = MAP_H * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      // Clear
      ctx.fillStyle = cBg;
      ctx.fillRect(0, 0, MAP_W, MAP_H);

      const tr = getMapTransform();
      if (tr) {
        const toMapX = (wx: number) => (wx - tr.bounds.minX) * tr.scale + tr.offsetX;
        const toMapY = (wy: number) => (wy - tr.bounds.minY) * tr.scale + tr.offsetY;

        // Draw nodes
        for (const id of Object.keys(tables)) {
          const pos = nodePositions[id];
          if (!pos) continue;
          const table = tables[id];
          const h = getTableHeight(table?.columns?.length ?? 0);

          const mx = toMapX(pos.x);
          const my = toMapY(pos.y);
          const mw = Math.max(NODE_WIDTH * tr.scale, 2);
          const mh = Math.max(h * tr.scale, 1);

          ctx.fillStyle = cNode;
          ctx.fillRect(mx, my, mw, mh);
        }

        // Draw viewport rectangle
        const drawRect = getEffectiveViewportRect();
        ctx.strokeStyle = cViewport;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
      }

      // Border
      ctx.strokeStyle = cBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, MAP_W, MAP_H);
      lastDrawAtRef.current = performance.now();
    };

    const scheduleDraw = () => {
      const now = performance.now();
      const elapsed = now - lastDrawAtRef.current;
      if (elapsed >= MINIMAP_FRAME_MS) {
        if (drawRafRef.current != null) cancelAnimationFrame(drawRafRef.current);
        drawRafRef.current = requestAnimationFrame(() => {
          drawRafRef.current = null;
          drawNow();
        });
        return;
      }
      const wait = MINIMAP_FRAME_MS - elapsed;
      if (drawTimerRef.current != null) clearTimeout(drawTimerRef.current);
      drawTimerRef.current = window.setTimeout(() => {
        drawTimerRef.current = null;
        if (drawRafRef.current != null) cancelAnimationFrame(drawRafRef.current);
        drawRafRef.current = requestAnimationFrame(() => {
          drawRafRef.current = null;
          drawNow();
        });
      }, wait);
    };

    scheduleDraw();
    return () => {
      if (drawTimerRef.current != null) {
        clearTimeout(drawTimerRef.current);
        drawTimerRef.current = null;
      }
      if (drawRafRef.current != null) {
        cancelAnimationFrame(drawRafRef.current);
        drawRafRef.current = null;
      }
    };
  }, [tables, nodePositions, viewport, showMinimap, getMapTransform, getEffectiveViewportRect, themeVersion]);

  const panByMapCenter = useCallback((mapCenterX: number, mapCenterY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tr = getMapTransform();
    if (!tr) return;
    const vpRect = getEffectiveViewportRect();
    const minCenterX = PADDING + vpRect.w / 2;
    const maxCenterX = MAP_W - PADDING - vpRect.w / 2;
    const minCenterY = PADDING + vpRect.h / 2;
    const maxCenterY = MAP_H - PADDING - vpRect.h / 2;
    const clampedCenterX = Math.max(minCenterX, Math.min(maxCenterX, mapCenterX));
    const clampedCenterY = Math.max(minCenterY, Math.min(maxCenterY, mapCenterY));
    const worldX = (clampedCenterX - tr.offsetX) / tr.scale + tr.bounds.minX;
    const worldY = (clampedCenterY - tr.offsetY) / tr.scale + tr.bounds.minY;
    const state = useStore.getState();
    state.setViewport({
      x: worldX,
      y: worldY,
      zoom: state.viewport.zoom,
    });
  }, [getMapTransform, getEffectiveViewportRect]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const vpRect = getEffectiveViewportRect();
    const canDragViewport = vpRect.w < (MAP_W - PADDING * 2 - DRAG_EPS)
      && vpRect.h < (MAP_H - PADDING * 2 - DRAG_EPS);
    if (canDragViewport && mx >= vpRect.x && mx <= vpRect.x + vpRect.w && my >= vpRect.y && my <= vpRect.y + vpRect.h) {
      dragRef.current.active = true;
      dragRef.current.moved = false;
      dragRef.current.pointerId = e.pointerId;
      dragRef.current.offsetX = mx - (vpRect.x + vpRect.w / 2);
      dragRef.current.offsetY = my - (vpRect.y + vpRect.h / 2);
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    panByMapCenter(mx, my);
  }, [getEffectiveViewportRect, panByMapCenter]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== e.pointerId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    dragRef.current.moved = true;
    panByMapCenter(mx - dragRef.current.offsetX, my - dragRef.current.offsetY);
  }, [panByMapCenter]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== e.pointerId) return;
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    dragRef.current.active = false;
    dragRef.current.pointerId = -1;
  }, []);

  const zoomPct = Math.round(viewport.zoom * 100);
  const minPct = 2;
  const maxPct = 300;
  const clampedPct = Math.max(minPct, Math.min(maxPct, zoomPct));
  const zoomRatio = ((clampedPct - minPct) / (maxPct - minPct)) * 100;
  const viewportRect = getEffectiveViewportRect();

  const applyZoomFromClientX = useCallback((clientX: number, rect: DOMRect) => {
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = rect.width <= 0 ? 0 : x / rect.width;
    const minZoom = 0.02;
    const maxZoom = 3;
    const nextZoom = minZoom + ratio * (maxZoom - minZoom);
    zoomToFn?.(nextZoom);
  }, [zoomToFn]);

  const handleZoomPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    zoomDragRef.current.active = true;
    zoomDragRef.current.pointerId = e.pointerId;
    el.setPointerCapture(e.pointerId);
    applyZoomFromClientX(e.clientX, el.getBoundingClientRect());
  }, [applyZoomFromClientX]);

  const handleZoomPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!zoomDragRef.current.active || zoomDragRef.current.pointerId !== e.pointerId) return;
    applyZoomFromClientX(e.clientX, e.currentTarget.getBoundingClientRect());
  }, [applyZoomFromClientX]);

  const handleZoomPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!zoomDragRef.current.active || zoomDragRef.current.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    zoomDragRef.current.active = false;
    zoomDragRef.current.pointerId = -1;
  }, []);

  if (!showMinimap) return null;

  const canvasElement = (
    <div className="space-y-1.5">
      <div className="relative mx-auto" style={{ width: MAP_W, height: MAP_H }}>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="rounded border border-gray-300 dark:border-zinc-800 cursor-crosshair"
          style={{ width: MAP_W, height: MAP_H, display: 'block', background: 'var(--bg, #09090b)' }}
        />
        <div
          className="pointer-events-none absolute border border-blue-500/90"
          style={{
            left: viewportRect.x,
            top: viewportRect.y,
            width: viewportRect.w,
            height: viewportRect.h,
          }}
        />
      </div>
      <div className="mx-auto w-[200px]">
        <div className="mb-1 flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-400">
          <span>Zoom</span>
          <span>{zoomPct}%</span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded bg-gray-200 dark:bg-zinc-800 cursor-ew-resize"
          onPointerDown={handleZoomPointerDown}
          onPointerMove={handleZoomPointerMove}
          onPointerUp={handleZoomPointerUp}
        >
          <div
            className="h-full bg-blue-500 transition-[width] duration-100"
            style={{ width: `${zoomRatio}%` }}
          />
        </div>
      </div>
    </div>
  );

  return canvasElement;
}
