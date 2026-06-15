type PortSide = 'left' | 'right' | 'top' | 'bottom';
type RoutingMode = 'direct' | 'ortho_short';
type LOD = 'full' | 'skeleton' | 'dot';

interface EdgeDataLike {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  selected: boolean;
  hovered?: boolean;
  lineStyle?: 'dashed' | 'solid';
  sourceAnchor?: { side: PortSide; offset: number };
  targetAnchor?: { side: PortSide; offset: number };
  bendPoints?: Array<{ x: number; y: number }>;
}

interface EndpointLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CameraLike {
  x: number;
  y: number;
  zoom: number;
}

type InitMessage = {
  type: 'init';
  payload: {
    canvas: OffscreenCanvas;
    dpr: number;
  };
};

type UpdateMessage = {
  type: 'update';
  payload: {
    width: number;
    height: number;
    dpr: number;
    camera: CameraLike;
    routingMode: RoutingMode;
    lod: LOD;
    edges: EdgeDataLike[];
    endpoints: Array<[string, EndpointLike]>;
  };
};

type HitTestMessage = {
  type: 'hitTest';
  payload: {
    requestId: number;
    worldX: number;
    worldY: number;
    threshold: number;
    sentAt?: number;
  };
};

type WorkerMessage = InitMessage | UpdateMessage | HitTestMessage;

interface HitTestResult {
  type: 'hitTestResult';
  payload: {
    requestId: number;
    edgeId: string | null;
    hitTestMs: number;
    sentAt?: number;
  };
}

interface PerfResult {
  type: 'perf';
  payload: {
    avgDrawMs: number;
    edges: number;
    segments: number;
  };
}

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let dpr = 1;
let edgePolylines = new Map<string, Array<{ x: number; y: number }>>();
const ORTHO_LANE_GAP = 8;
const ORTHO_LANE_MAX_SHIFT = 36;
const PARALLEL_EDGE_GAP = 8;
const PARALLEL_EDGE_MAX_SHIFT = 40;
const ENDPOINT_CAP_LEN = 7;
const MARKER_SIZE = 7;
let perfFrames = 0;
let perfDrawAcc = 0;
let perfEdges = 0;
let perfSegments = 0;
let hitSegments: Array<{ id: string; ax: number; ay: number; bx: number; by: number; minX: number; minY: number; maxX: number; maxY: number }> = [];

function getPort(node: EndpointLike, side: PortSide, offset = 0.5): { x: number; y: number } {
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

function choosePortSides(source: EndpointLike, target: EndpointLike): { source: PortSide; target: PortSide } {
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

function buildOrthoPolyline(
  src: { x: number; y: number },
  tgt: { x: number; y: number },
  sourceSide: PortSide,
  targetSide: PortSide,
): Array<{ x: number; y: number }> {
  const eps = 0.01;
  if (Math.abs(src.x - tgt.x) < eps || Math.abs(src.y - tgt.y) < eps) return [src, tgt];

  const stub = 18;
  const sStub = sourceSide === 'left'
    ? { x: src.x - stub, y: src.y }
    : sourceSide === 'right'
      ? { x: src.x + stub, y: src.y }
      : sourceSide === 'top'
        ? { x: src.x, y: src.y - stub }
        : { x: src.x, y: src.y + stub };
  const tStub = targetSide === 'left'
    ? { x: tgt.x - stub, y: tgt.y }
    : targetSide === 'right'
      ? { x: tgt.x + stub, y: tgt.y }
      : targetSide === 'top'
        ? { x: tgt.x, y: tgt.y - stub }
        : { x: tgt.x, y: tgt.y + stub };
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
  return compactPolyline(points);
}

function worldToScreen(p: { x: number; y: number }, cam: CameraLike, w: number, h: number) {
  return {
    x: (p.x - cam.x) * cam.zoom + w / 2,
    y: (p.y - cam.y) * cam.zoom + h / 2,
  };
}

function drawDashedLine(
  c2d: OffscreenCanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
) {
  c2d.setLineDash([6, 3]);
  c2d.beginPath();
  c2d.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) c2d.lineTo(points[i].x, points[i].y);
  c2d.stroke();
  c2d.setLineDash([]);
}

function compactPolyline(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const eps = 0.01;
  const deduped: Array<{ x: number; y: number }> = [];
  for (const p of points) {
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.abs(prev.x - p.x) > eps || Math.abs(prev.y - p.y) > eps) {
      deduped.push(p);
    }
  }
  if (deduped.length <= 2) return deduped;
  const out: Array<{ x: number; y: number }> = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const a = out[out.length - 1];
    const b = deduped[i];
    const c = deduped[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const bcx = c.x - b.x;
    const bcy = c.y - b.y;
    const collinear = Math.abs(abx * bcy - aby * bcx) < eps;
    if (!collinear) out.push(b);
  }
  out.push(deduped[deduped.length - 1]);
  return out;
}

function computeLaneShifts(
  edges: EdgeDataLike[],
  endpoints: Map<string, EndpointLike>,
): Map<string, number> {
  const groups = new Map<string, Array<{ edgeId: string; endKind: 'source' | 'target'; sortKey: number }>>();
  for (const edge of edges) {
    const sourceNode = endpoints.get(edge.sourceId);
    const targetNode = endpoints.get(edge.targetId);
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
  for (const arr of groups.values()) {
    arr.sort((a, b) => a.sortKey - b.sortKey || a.edgeId.localeCompare(b.edgeId));
    const center = (arr.length - 1) / 2;
    for (let i = 0; i < arr.length; i++) {
      result.set(`${arr[i].edgeId}|${arr[i].endKind}`, (i - center) * ORTHO_LANE_GAP);
    }
  }
  return result;
}

function computePairShifts(edges: EdgeDataLike[]): Map<string, number> {
  const groups = new Map<string, string[]>();
  for (const edge of edges) {
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
      result.set(ids[i], Math.max(-PARALLEL_EDGE_MAX_SHIFT, Math.min(PARALLEL_EDGE_MAX_SHIFT, raw)));
    }
  }
  return result;
}

function applyLaneShift(
  point: { x: number; y: number },
  node: EndpointLike,
  side: PortSide,
  shift: number,
) {
  if (Math.abs(shift) < 0.01) return;
  if (side === 'left' || side === 'right') {
    const maxShift = Math.min(ORTHO_LANE_MAX_SHIFT, node.height / 2 - 8);
    point.y += Math.max(-maxShift, Math.min(maxShift, shift));
    return;
  }
  const maxShift = Math.min(ORTHO_LANE_MAX_SHIFT, node.width / 2 - 8);
  point.x += Math.max(-maxShift, Math.min(maxShift, shift));
}

function buildOffsetDirectPolyline(
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

function offsetOrthoInnerPoints(
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
  return compactPolyline(out);
}

function drawEndpointCap(
  c2d: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
) {
  c2d.beginPath();
  c2d.moveTo(x, y);
  c2d.lineTo(x + dx * ENDPOINT_CAP_LEN, y + dy * ENDPOINT_CAP_LEN);
  c2d.stroke();
}

function drawBarMarker(
  c2d: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
) {
  const nx = -dy;
  const ny = dx;
  c2d.beginPath();
  c2d.moveTo(x - nx * MARKER_SIZE * 0.7, y - ny * MARKER_SIZE * 0.7);
  c2d.lineTo(x + nx * MARKER_SIZE * 0.7, y + ny * MARKER_SIZE * 0.7);
  c2d.stroke();
}

function drawCrowFootMarker(
  c2d: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
) {
  const nx = -dy;
  const ny = dx;
  const tx = x + dx * MARKER_SIZE;
  const ty = y + dy * MARKER_SIZE;
  c2d.beginPath();
  c2d.moveTo(x, y);
  c2d.lineTo(tx + nx * MARKER_SIZE * 0.8, ty + ny * MARKER_SIZE * 0.8);
  c2d.moveTo(x, y);
  c2d.lineTo(tx - nx * MARKER_SIZE * 0.8, ty - ny * MARKER_SIZE * 0.8);
  c2d.moveTo(x, y);
  c2d.lineTo(tx, ty);
  c2d.stroke();
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

function redraw(payload: UpdateMessage['payload']) {
  if (!ctx || !canvas) return;
  const t0 = performance.now();
  const { width, height, camera, edges, endpoints: endpointEntries, routingMode, lod } = payload;
  if (payload.dpr && Math.abs(payload.dpr - dpr) > 0.01) dpr = payload.dpr;

  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  edgePolylines = new Map();
  hitSegments = [];
  const endpointMap = new Map(endpointEntries);
  const isDot = lod === 'dot';
  const laneShifts = computeLaneShifts(edges, endpointMap);
  const pairShifts = computePairShifts(edges);
  let segmentCount = 0;

  for (const edge of edges) {
    const sourceNode = endpointMap.get(edge.sourceId);
    const targetNode = endpointMap.get(edge.targetId);
    if (!sourceNode || !targetNode) continue;

    const autoSides = choosePortSides(sourceNode, targetNode);
    const sourceSide = edge.sourceAnchor?.side ?? autoSides.source;
    const targetSide = edge.targetAnchor?.side ?? autoSides.target;
    const sourceOffset = edge.sourceAnchor?.offset ?? 0.5;
    const targetOffset = edge.targetAnchor?.offset ?? 0.5;
    const src = getPort(sourceNode, sourceSide, sourceOffset);
    const tgt = getPort(targetNode, targetSide, targetOffset);
    if (!edge.sourceAnchor) applyLaneShift(src, sourceNode, sourceSide, laneShifts.get(`${edge.id}|source`) ?? 0);
    if (!edge.targetAnchor) applyLaneShift(tgt, targetNode, targetSide, laneShifts.get(`${edge.id}|target`) ?? 0);
    const bends = edge.bendPoints ?? [];
    let autoPolyline = routingMode === 'ortho_short'
      ? buildOrthoPolyline(src, tgt, sourceSide, targetSide)
      : [src, tgt];
    const pairShift = pairShifts.get(edge.id) ?? 0;
    if (Math.abs(pairShift) > 0.01) {
      autoPolyline = routingMode === 'ortho_short'
        ? offsetOrthoInnerPoints(autoPolyline, sourceSide, pairShift)
        : buildOffsetDirectPolyline(src, tgt, pairShift);
    }
    const polyline = bends.length > 0 ? [src, ...bends, tgt] : autoPolyline;
    edgePolylines.set(edge.id, polyline);

    const stroke = isDot
      ? { color: edge.selected ? '#3b82f6' : '#3f3f46', width: 0.5, alpha: 0.45 }
      : edge.selected
        ? { color: '#3b82f6', width: 1.5, alpha: 1 }
        : edge.hovered
          ? { color: '#93c5fd', width: 1.35, alpha: 0.95 }
          : { color: '#4b5563', width: 1, alpha: 0.9 };

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.globalAlpha = stroke.alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const screenPolyline = polyline.map((p) => worldToScreen(p, camera, width, height));

    for (let i = 0; i < polyline.length - 1; i++) {
      segmentCount++;
      const a = polyline[i];
      const b = polyline[i + 1];
      hitSegments.push({
        id: edge.id,
        ax: a.x,
        ay: a.y,
        bx: b.x,
        by: b.y,
        minX: Math.min(a.x, b.x),
        minY: Math.min(a.y, b.y),
        maxX: Math.max(a.x, b.x),
        maxY: Math.max(a.y, b.y),
      });
    }
    if ((edge.lineStyle ?? 'dashed') === 'dashed' && !isDot) {
      drawDashedLine(ctx, screenPolyline);
    } else {
      ctx.beginPath();
      ctx.moveTo(screenPolyline[0].x, screenPolyline[0].y);
      for (let i = 1; i < screenPolyline.length; i++) ctx.lineTo(screenPolyline[i].x, screenPolyline[i].y);
      ctx.stroke();
    }

    if (lod === 'full' && screenPolyline.length >= 2) {
      const s0 = screenPolyline[0];
      const s1 = screenPolyline[1];
      const t0 = screenPolyline[screenPolyline.length - 2];
      const t1 = screenPolyline[screenPolyline.length - 1];
      const sLen = Math.hypot(s1.x - s0.x, s1.y - s0.y) || 1;
      const tLen = Math.hypot(t1.x - t0.x, t1.y - t0.y) || 1;
      const sdx = (s1.x - s0.x) / sLen;
      const sdy = (s1.y - s0.y) / sLen;
      const tdx = (t1.x - t0.x) / tLen;
      const tdy = (t1.y - t0.y) / tLen;
      drawEndpointCap(ctx, s0.x, s0.y, sdx, sdy);
      drawEndpointCap(ctx, t1.x, t1.y, -tdx, -tdy);

      const type = edge.type || '1:N';
      const [srcCard, tgtCard] = type.split(':');
      if (srcCard === '1') drawBarMarker(ctx, s0.x, s0.y, -sdx, -sdy);
      else drawCrowFootMarker(ctx, s0.x, s0.y, -sdx, -sdy);
      if (tgtCard === '1') drawBarMarker(ctx, t1.x, t1.y, tdx, tdy);
      else drawCrowFootMarker(ctx, t1.x, t1.y, tdx, tdy);
    }
  }

  ctx.globalAlpha = 1;
  perfFrames++;
  perfDrawAcc += performance.now() - t0;
  perfEdges = edges.length;
  perfSegments = segmentCount;
  if (perfFrames >= 30) {
    const msg: PerfResult = {
      type: 'perf',
      payload: {
        avgDrawMs: perfDrawAcc / perfFrames,
        edges: perfEdges,
        segments: perfSegments,
      },
    };
    self.postMessage(msg);
    perfFrames = 0;
    perfDrawAcc = 0;
  }
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    canvas = msg.payload.canvas;
    dpr = msg.payload.dpr || 1;
    ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    return;
  }
  if (msg.type === 'update') {
    redraw(msg.payload);
    return;
  }
  if (msg.type === 'hitTest') {
    const ht0 = performance.now();
    let best: { id: string; d: number } | null = null;
    const px = msg.payload.worldX;
    const py = msg.payload.worldY;
    const th = msg.payload.threshold;
    for (const seg of hitSegments) {
      if (px < seg.minX - th || px > seg.maxX + th || py < seg.minY - th || py > seg.maxY + th) continue;
      const d = distancePointToSegment(px, py, { x: seg.ax, y: seg.ay }, { x: seg.bx, y: seg.by });
      if (d <= th && (!best || d < best.d)) best = { id: seg.id, d };
    }
    const result: HitTestResult = {
      type: 'hitTestResult',
      payload: {
        requestId: msg.payload.requestId,
        edgeId: best?.id ?? null,
        hitTestMs: performance.now() - ht0,
        sentAt: msg.payload.sentAt,
      },
    };
    self.postMessage(result);
  }
};
