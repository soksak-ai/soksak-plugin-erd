// Edge renderer for ERD relationship lines.
// Draws all edges as bezier curves with crow's foot notation markers
// using a single PixiJS Graphics object for performance.

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { RelationType } from '@/types/schema';
import { COLORS, LOD, FONT_FAMILY } from './constants';
import { drawSourceMarker, drawTargetMarker } from './erd-markers-pixi';
import { cardinalityLabels } from '@/features/relationship/cardinality';

export type NotationStyle = 'crowsfoot' | 'numeric';

// Shared style for numeric-notation endpoint labels; per-label color comes from `.tint`.
const CARDINALITY_STYLE = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: 'bold', fill: 0xffffff });
const LABEL_ALONG = 15; // offset from the endpoint along the edge (world px)
const LABEL_PERP = 9; // perpendicular offset so the label clears the line

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface EdgeData {
  id: string;
  sourceId: string;  // source table ID
  targetId: string;  // target table ID
  type: RelationType;
  selected: boolean;
  // "one" 측 참여가 선택적(FK nullable 데이터 유도) — one 측 마커에 ○(0..1)를 그린다.
  optional?: boolean;
  // 선택된 테이블(노드)에 연결된 엣지 — 직접 선택은 아니나 강조 대상(선택 전파).
  related?: boolean;
  hovered?: boolean;
  lineStyle?: 'dashed' | 'solid';
  sourceAnchor?: { side: PortSide; offset: number };
  targetAnchor?: { side: PortSide; offset: number };
  bendPoints?: Array<{ x: number; y: number }>;
}

export interface NodeEndpoint {
  x: number;      // table center X
  y: number;      // table center Y
  width: number;  // table width
  height: number; // table height
}

type PortSide = 'left' | 'right' | 'top' | 'bottom';
type HandleKind = 'bend' | 'sourceAnchor' | 'targetAnchor';
type RoutingMode = 'direct' | 'ortho_short';

export interface EdgeHandleHit {
  edgeId: string;
  kind: HandleKind;
  index?: number;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getPort(node: NodeEndpoint, side: PortSide, offset = 0.5): { x: number; y: number } {
  const o = Math.max(0, Math.min(1, offset));
  switch (side) {
    case 'left':
      return { x: node.x - node.width / 2, y: node.y - node.height / 2 + node.height * o };
    case 'right':
      return { x: node.x + node.width / 2, y: node.y - node.height / 2 + node.height * o };
    case 'top':
      return { x: node.x - node.width / 2 + node.width * o, y: node.y - node.height / 2 };
    case 'bottom':
      return { x: node.x - node.width / 2 + node.width * o, y: node.y + node.height / 2 };
  }
}

function choosePortSides(source: NodeEndpoint, target: NodeEndpoint): { source: PortSide; target: PortSide } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { source: 'right', target: 'left' }
      : { source: 'left', target: 'right' };
  }
  return dy >= 0
    ? { source: 'bottom', target: 'top' }
    : { source: 'top', target: 'bottom' };
}

function portDirection(side: PortSide): { x: number; y: number } {
  switch (side) {
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
    case 'top': return { x: 0, y: -1 };
    case 'bottom': return { x: 0, y: 1 };
  }
}

function portAngle(side: PortSide): number {
  switch (side) {
    case 'right': return 0;
    case 'left': return Math.PI;
    case 'top': return -Math.PI / 2;
    case 'bottom': return Math.PI / 2;
  }
}

const ENDPOINT_CAP_LEN = 7;
const HEAVY_EDGE_THRESHOLD = 1200;
const ORTHO_LANE_GAP = 8;
const ORTHO_LANE_MAX_SHIFT = 36;
const PARALLEL_EDGE_GAP = 8;
const PARALLEL_EDGE_MAX_SHIFT = 40;

// ---------------------------------------------------------------------------
// EdgeRenderer
// ---------------------------------------------------------------------------

export class EdgeRenderer {
  readonly container: Container;

  /** Graphics bucket pool keyed by style to minimize stroke() calls. */
  private readonly gfxBuckets = new Map<string, Graphics>();
  private readonly activeBucketKeys = new Set<string>();
  private readonly markerGfx: Graphics;
  /** Numeric-notation endpoint labels (pooled Text, reused across redraws). */
  private readonly labelLayer: Container;
  private readonly labelPool: Text[] = [];
  private labelUsed = 0;

  /** Current LOD level. */
  private lod: LOD = LOD.FULL;
  private interactionSimplified = false;
  private routingMode: RoutingMode = 'direct';
  private notation: NotationStyle = 'crowsfoot';
  private handles: EdgeHandleHit[] = [];
  private edgePolylines = new Map<string, Array<{ x: number; y: number }>>();

  constructor() {
    this.container = new Container();
    this.markerGfx = new Graphics();
    this.container.addChild(this.markerGfx);
    this.labelLayer = new Container();
    this.container.addChild(this.labelLayer);
  }

  // Acquire a pooled label Text (creating lazily), positioned/tinted by the caller.
  private acquireLabel(): Text {
    let t = this.labelPool[this.labelUsed];
    if (!t) {
      t = new Text({ text: '', style: CARDINALITY_STYLE });
      t.anchor.set(0.5, 0.5);
      this.labelLayer.addChild(t);
      this.labelPool[this.labelUsed] = t;
    }
    this.labelUsed++;
    return t;
  }

  // Place a cardinality label near an endpoint: offset along the edge (away from the table) and
  // perpendicular so it clears the line. `label` empty → nothing drawn.
  private placeLabel(x: number, y: number, angle: number, label: string, color: number): void {
    if (!label) return;
    const t = this.acquireLabel();
    t.text = label;
    t.tint = color;
    t.position.set(
      x + Math.cos(angle) * LABEL_ALONG - Math.sin(angle) * LABEL_PERP,
      y + Math.sin(angle) * LABEL_ALONG + Math.cos(angle) * LABEL_PERP,
    );
    t.visible = true;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Update all edges at once.
   *
   * Called when relationships change, nodes move, or the viewport updates.
   * Clears and redraws all edges every call -- this is intentional:
   * one Graphics object with batch drawing is faster than managing
   * individual Graphics per edge.
   */
  updateEdges(
    edges: EdgeData[],
    nodePositions: Map<string, NodeEndpoint>,
  ): void {
    this.markerGfx.clear();
    this.activeBucketKeys.clear();
    for (const [, gfx] of this.gfxBuckets) gfx.clear();
    this.handles = [];
    this.edgePolylines.clear();
    this.labelUsed = 0;

    const forceSimple = edges.length >= HEAVY_EDGE_THRESHOLD;
    const isFull = this.lod === LOD.FULL && !forceSimple;
    const isDot = this.lod === LOD.DOT;
    const simplify = this.interactionSimplified || forceSimple;
    const laneShifts = this.computeLaneShifts(edges, nodePositions);
    const pairShifts = this.computePairShifts(edges);

    for (const edge of edges) {
      const sourceNode = nodePositions.get(edge.sourceId);
      const targetNode = nodePositions.get(edge.targetId);
      if (!sourceNode || !targetNode) continue;

      const autoSides = choosePortSides(sourceNode, targetNode);
      const sourceSide = edge.sourceAnchor?.side ?? autoSides.source;
      const targetSide = edge.targetAnchor?.side ?? autoSides.target;
      const sourceOffset = edge.sourceAnchor?.offset ?? 0.5;
      const targetOffset = edge.targetAnchor?.offset ?? 0.5;
      const src = getPort(sourceNode, sourceSide, sourceOffset);
      const tgt = getPort(targetNode, targetSide, targetOffset);
      if (!edge.sourceAnchor) this.applyLaneShift(src, sourceNode, sourceSide, laneShifts.get(`${edge.id}|source`) ?? 0);
      if (!edge.targetAnchor) this.applyLaneShift(tgt, targetNode, targetSide, laneShifts.get(`${edge.id}|target`) ?? 0);
      const bends = edge.bendPoints ?? [];

      if (isDot) {
        // DOT LOD: straight line, thin, semi-transparent
        const color = edge.selected ? COLORS.edgeSelected : (edge.related ? 0x60a5fa : 0x3f3f46);
        const bucket = this.getBucket(color, 0.5, 0.5);
        bucket
          .moveTo(src.x, src.y)
          .lineTo(tgt.x, tgt.y);
        continue;
      }

      const isSelected = edge.selected;
      const isRelated = edge.related === true && !isSelected;
      const isHovered = edge.hovered === true;
      const isDashed = (edge.lineStyle ?? 'dashed') === 'dashed';
      const color = isSelected ? COLORS.edgeSelected : COLORS.edge;
      // 선택 전파 강조 위계: selected(1.5, 파랑) > related(1.35, 밝은 파랑) > hover(1.35, 연파랑) > 기본(1, 회색).
      const lineWidth = isSelected ? 1.5 : (isRelated || isHovered ? 1.35 : 1);
      const lineColor = isSelected ? color : (isRelated ? 0x60a5fa : (isHovered ? 0x93c5fd : 0x4b5563));

      const srcDir = portDirection(sourceSide);
      const tgtDir = portDirection(targetSide);
      let autoPolyline = this.routingMode === 'ortho_short'
        ? this.buildOrthoPolyline(src, tgt, sourceSide, targetSide)
        : [src, tgt];
      const pairShift = pairShifts.get(edge.id) ?? 0;
      if (Math.abs(pairShift) > 0.01) {
        autoPolyline = this.routingMode === 'ortho_short'
          ? this.offsetOrthoInnerPoints(autoPolyline, sourceSide, pairShift)
          : this.buildOffsetDirectPolyline(src, tgt, pairShift);
      }
      const polyline = bends.length > 0 ? [src, ...bends, tgt] : autoPolyline;

      // Default path: solid polyline (cheap and stable).
      // Selected path keeps detailed style to preserve editability/readability.
      if (!isSelected || simplify || !isFull) {
        this.edgePolylines.set(edge.id, polyline);
        const bucket = this.getBucket(
          lineColor,
          simplify ? 0.85 : lineWidth,
          simplify ? 0.75 : 0.95,
        );
        for (let i = 0; i < polyline.length - 1; i++) {
          const a = polyline[i];
          const b = polyline[i + 1];
          if (isDashed) {
            this.addDashedSegments(bucket, a.x, a.y, b.x, b.y, 6, 3);
          } else {
            bucket.moveTo(a.x, a.y).lineTo(b.x, b.y);
          }
        }
      } else if (bends.length > 0) {
        this.edgePolylines.set(edge.id, polyline);
        const bucket = this.getBucket(lineColor, lineWidth, 1);
        for (let i = 0; i < polyline.length - 1; i++) {
          const a = polyline[i];
          const b = polyline[i + 1];
          if (isDashed) {
            this.addDashedSegments(bucket, a.x, a.y, b.x, b.y, 6, 3);
          } else {
            bucket.moveTo(a.x, a.y).lineTo(b.x, b.y);
          }
        }
      } else {
        // Keep geometry identical between normal/selected states.
        // Draw through the same polyline used by hit-testing.
        this.edgePolylines.set(edge.id, polyline);
        const bucket = this.getBucket(lineColor, lineWidth, 1);
        for (let i = 0; i < polyline.length - 1; i++) {
          const a = polyline[i];
          const b = polyline[i + 1];
          if (isDashed) {
            this.addDashedSegments(bucket, a.x, a.y, b.x, b.y, 6, 3);
          } else {
            bucket.moveTo(a.x, a.y).lineTo(b.x, b.y);
          }
        }
      }

      // Ensure dashed patterns visually connect to endpoint markers.
      if (isFull && !simplify) {
        this.drawEndpointCap(src.x, src.y, srcDir.x, srcDir.y, lineColor, lineWidth);
        this.drawEndpointCap(tgt.x, tgt.y, tgtDir.x, tgtDir.y, lineColor, lineWidth);
      }

      // Endpoint notation (FULL LOD): crow's foot glyphs or numeric cardinality labels.
      if (isFull && !simplify) {
        const srcAngle = portAngle(sourceSide);
        const tgtAngle = portAngle(targetSide);
        if (this.notation === 'numeric') {
          const c = cardinalityLabels(edge.type, edge.optional ?? false);
          this.placeLabel(src.x, src.y, srcAngle, c.source, lineColor);
          this.placeLabel(tgt.x, tgt.y, tgtAngle, c.target, lineColor);
        } else {
          drawSourceMarker(this.markerGfx, src.x, src.y, srcAngle, edge.type, lineColor, lineWidth, edge.optional);
          drawTargetMarker(this.markerGfx, tgt.x, tgt.y, tgtAngle, edge.type, lineColor, lineWidth);
        }
      }

      if (edge.selected && !isDot) {
        this.drawHandle(src.x, src.y, '#22d3ee');
        this.handles.push({ edgeId: edge.id, kind: 'sourceAnchor', x: src.x, y: src.y });
        this.drawHandle(tgt.x, tgt.y, '#22d3ee');
        this.handles.push({ edgeId: edge.id, kind: 'targetAnchor', x: tgt.x, y: tgt.y });
      }
    }

    // Hide pooled labels left over from a denser frame / crow's foot mode.
    for (let i = this.labelUsed; i < this.labelPool.length; i++) this.labelPool[i].visible = false;

    // One stroke per style bucket drastically reduces CPU/GPU command overhead.
    for (const key of this.activeBucketKeys) {
      const gfx = this.gfxBuckets.get(key);
      if (!gfx) continue;
      const [colorStr, widthStr, alphaStr] = key.split('|');
      gfx.stroke({
        color: Number(colorStr),
        width: Number(widthStr),
        alpha: Number(alphaStr),
      });
    }
  }

  /**
   * Set the Level-of-Detail rendering mode.
   *
   * - `LOD.FULL`: dashed lines with crow's foot markers
   * - `LOD.SKELETON`: solid thin lines, no markers
   * - `LOD.DOT`: hide all edges
   */
  setLOD(lod: LOD): void {
    this.lod = lod;
    // Always visible — DOT mode draws thin straight lines
  }

  setInteractionSimplified(enabled: boolean): void {
    this.interactionSimplified = enabled;
  }

  setRoutingMode(mode: RoutingMode): void {
    this.routingMode = mode;
  }

  setNotation(notation: NotationStyle): void {
    this.notation = notation;
  }

  hitTestHandle(worldX: number, worldY: number, radius = 10): EdgeHandleHit | null {
    const r2 = radius * radius;
    for (let i = this.handles.length - 1; i >= 0; i--) {
      const h = this.handles[i];
      const dx = worldX - h.x;
      const dy = worldY - h.y;
      if (dx * dx + dy * dy <= r2) return h;
    }
    return null;
  }

  hitTestEdge(worldX: number, worldY: number, threshold = 8): string | null {
    let best: { id: string; d: number } | null = null;
    for (const [id, polyline] of this.edgePolylines) {
      for (let i = 0; i < polyline.length - 1; i++) {
        const d = distancePointToSegment(worldX, worldY, polyline[i], polyline[i + 1]);
        if (d <= threshold && (!best || d < best.d)) {
          best = { id, d };
        }
      }
    }
    return best?.id ?? null;
  }

  /** Clean up all GPU resources. */
  destroy(): void {
    this.markerGfx.destroy();
    for (const [, gfx] of this.gfxBuckets) gfx.destroy();
    this.gfxBuckets.clear();
    this.container.destroy({ children: true });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private drawEndpointCap(
    x: number,
    y: number,
    dx: number,
    dy: number,
    color: number,
    width: number,
  ): void {
    const bucket = this.getBucket(color, width, 1);
    bucket
      .moveTo(x, y)
      .lineTo(x + dx * ENDPOINT_CAP_LEN, y + dy * ENDPOINT_CAP_LEN);
  }

  private buildOrthoPolyline(
    src: { x: number; y: number },
    tgt: { x: number; y: number },
    sourceSide: PortSide,
    targetSide: PortSide,
  ): Array<{ x: number; y: number }> {
    const eps = 0.01;
    if (Math.abs(src.x - tgt.x) < eps || Math.abs(src.y - tgt.y) < eps) {
      return [src, tgt];
    }
    const stub = 18;
    const sDir = portDirection(sourceSide);
    const tDir = portDirection(targetSide);
    const sStub = { x: src.x + sDir.x * stub, y: src.y + sDir.y * stub };
    const tStub = { x: tgt.x + tDir.x * stub, y: tgt.y + tDir.y * stub };

    const points: Array<{ x: number; y: number }> = [src, sStub];
    if (Math.abs(sStub.x - tStub.x) < eps || Math.abs(sStub.y - tStub.y) < eps) {
      points.push(tStub);
    } else {
      const bendA = { x: tStub.x, y: sStub.y };
      const bendB = { x: sStub.x, y: tStub.y };
      const sourceHorizontal = sourceSide === 'left' || sourceSide === 'right';
      points.push(sourceHorizontal ? bendA : bendB);
      points.push(tStub);
    }
    points.push(tgt);

    return this.compactPolyline(points);
  }

  private compactPolyline(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    const eps = 0.01;
    const deduped: Array<{ x: number; y: number }> = [];
    for (const p of points) {
      const prev = deduped[deduped.length - 1];
      if (!prev || Math.abs(prev.x - p.x) > eps || Math.abs(prev.y - p.y) > eps) {
        deduped.push(p);
      }
    }
    if (deduped.length <= 2) return deduped;
    const compact: Array<{ x: number; y: number }> = [deduped[0]];
    for (let i = 1; i < deduped.length - 1; i++) {
      const a = compact[compact.length - 1];
      const b = deduped[i];
      const c = deduped[i + 1];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const bcx = c.x - b.x;
      const bcy = c.y - b.y;
      const collinear = Math.abs(abx * bcy - aby * bcx) < eps;
      if (!collinear) compact.push(b);
    }
    compact.push(deduped[deduped.length - 1]);
    return compact;
  }

  private computeLaneShifts(
    edges: EdgeData[],
    nodePositions: Map<string, NodeEndpoint>,
  ): Map<string, number> {
    const groups = new Map<string, Array<{ edgeId: string; endKind: 'source' | 'target'; sortKey: number }>>();
    for (const edge of edges) {
      const sourceNode = nodePositions.get(edge.sourceId);
      const targetNode = nodePositions.get(edge.targetId);
      if (!sourceNode || !targetNode) continue;
      const autoSides = choosePortSides(sourceNode, targetNode);
      const sourceSide = edge.sourceAnchor?.side ?? autoSides.source;
      const targetSide = edge.targetAnchor?.side ?? autoSides.target;

      if (!edge.sourceAnchor) {
        const gk = `${edge.sourceId}|${sourceSide}`;
        const sortKey = sourceSide === 'left' || sourceSide === 'right' ? targetNode.y : targetNode.x;
        const arr = groups.get(gk) ?? [];
        arr.push({ edgeId: edge.id, endKind: 'source', sortKey });
        groups.set(gk, arr);
      }
      if (!edge.targetAnchor) {
        const gk = `${edge.targetId}|${targetSide}`;
        const sortKey = targetSide === 'left' || targetSide === 'right' ? sourceNode.y : sourceNode.x;
        const arr = groups.get(gk) ?? [];
        arr.push({ edgeId: edge.id, endKind: 'target', sortKey });
        groups.set(gk, arr);
      }
    }

    const result = new Map<string, number>();
    for (const [, arr] of groups) {
      arr.sort((a, b) => a.sortKey - b.sortKey || a.edgeId.localeCompare(b.edgeId));
      const center = (arr.length - 1) / 2;
      for (let i = 0; i < arr.length; i++) {
        const lane = i - center;
        result.set(`${arr[i].edgeId}|${arr[i].endKind}`, lane * ORTHO_LANE_GAP);
      }
    }
    return result;
  }

  private computePairShifts(edges: EdgeData[]): Map<string, number> {
    const groups = new Map<string, string[]>();
    for (const edge of edges) {
      // Spread only edges that share exact endpoints (source/target pair).
      const key = `${edge.sourceId}|${edge.targetId}`;
      const arr = groups.get(key) ?? [];
      arr.push(edge.id);
      groups.set(key, arr);
    }

    const result = new Map<string, number>();
    for (const ids of groups.values()) {
      if (ids.length <= 1) continue;
      ids.sort((a, b) => a.localeCompare(b));
      const center = (ids.length - 1) / 2;
      for (let i = 0; i < ids.length; i++) {
        const raw = (i - center) * PARALLEL_EDGE_GAP;
        const shift = Math.max(-PARALLEL_EDGE_MAX_SHIFT, Math.min(PARALLEL_EDGE_MAX_SHIFT, raw));
        result.set(ids[i], shift);
      }
    }
    return result;
  }

  private buildOffsetDirectPolyline(
    src: { x: number; y: number },
    tgt: { x: number; y: number },
    shift: number,
  ): Array<{ x: number; y: number }> {
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return [src, tgt];
    const nx = -dy / len;
    const ny = dx / len;
    const mid = {
      x: (src.x + tgt.x) * 0.5 + nx * shift,
      y: (src.y + tgt.y) * 0.5 + ny * shift,
    };
    return [src, mid, tgt];
  }

  private offsetOrthoInnerPoints(
    polyline: Array<{ x: number; y: number }>,
    sourceSide: PortSide,
    shift: number,
  ): Array<{ x: number; y: number }> {
    if (polyline.length <= 2) return polyline;
    const out = polyline.map((p) => ({ x: p.x, y: p.y }));
    const adjustY = sourceSide === 'left' || sourceSide === 'right';
    for (let i = 1; i < out.length - 1; i++) {
      if (adjustY) out[i].y += shift;
      else out[i].x += shift;
    }
    return this.compactPolyline(out);
  }

  private applyLaneShift(
    point: { x: number; y: number },
    node: NodeEndpoint,
    side: PortSide,
    shift: number,
  ): void {
    if (Math.abs(shift) < 0.01) return;
    if (side === 'left' || side === 'right') {
      const maxShift = Math.min(ORTHO_LANE_MAX_SHIFT, node.height / 2 - 8);
      point.y += Math.max(-maxShift, Math.min(maxShift, shift));
      return;
    }
    const maxShift = Math.min(ORTHO_LANE_MAX_SHIFT, node.width / 2 - 8);
    point.x += Math.max(-maxShift, Math.min(maxShift, shift));
  }

  private addDashedSegments(
    gfx: Graphics,
    x1: number, y1: number,
    x2: number, y2: number,
    dashLen: number, gapLen: number,
  ): void {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return;
    const dx = (x2 - x1) / len;
    const dy = (y2 - y1) / len;
    let t = 0;
    while (t < len) {
      const a = t;
      const b = Math.min(t + dashLen, len);
      gfx
        .moveTo(x1 + dx * a, y1 + dy * a)
        .lineTo(x1 + dx * b, y1 + dy * b);
      t += dashLen + gapLen;
    }
  }

  private drawHandle(x: number, y: number, color: string): void {
    this.markerGfx
      .circle(x, y, 4)
      .fill(color)
      .circle(x, y, 5.5)
      .stroke({ color: 0x0f172a, width: 1 });
  }

  private getBucket(color: number, width: number, alpha: number): Graphics {
    const key = `${color}|${width}|${alpha}`;
    this.activeBucketKeys.add(key);
    let gfx = this.gfxBuckets.get(key);
    if (!gfx) {
      gfx = new Graphics();
      this.gfxBuckets.set(key, gfx);
      this.container.addChildAt(gfx, 0);
    }
    return gfx;
  }
}

function distancePointToSegment(
  px: number,
  py: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = px - a.x;
  const wy = py - a.y;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - a.x, py - a.y);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - b.x, py - b.y);
  const t = c1 / c2;
  const cx = a.x + t * vx;
  const cy = a.y + t * vy;
  return Math.hypot(px - cx, py - cy);
}
