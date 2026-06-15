import dagre from '@dagrejs/dagre';

interface WorkerInput {
  tables: { id: string; name: string; columnCount: number }[];
  relationships: { sourceTableId: string; targetTableId: string }[];
  groups: { prefix: string; label: string; tableIds: string[]; color: string }[];
  direction: string;
}

interface LayerResult {
  id: string;
  name: string;
  color: string;
  bounds: { x: number; y: number; w: number; h: number };
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { tables, relationships, groups, direction } = e.data;
  const nodeWidth = 240;
  const GROUP_PADDING = 60;
  const GROUP_GAP = 100;

  const positions: Record<string, { x: number; y: number }> = {};
  const layers: LayerResult[] = [];
  const tableMap = new Map(tables.map(t => [t.id, t]));

  if (groups.length <= 1) {
    // Flat layout
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: direction, nodesep: 80, ranksep: 120, marginx: 50, marginy: 50 });

    for (const t of tables) {
      g.setNode(t.id, { width: nodeWidth, height: 32 + t.columnCount * 26 + 8 });
    }
    for (const r of relationships) {
      g.setEdge(r.sourceTableId, r.targetTableId);
    }
    dagre.layout(g);

    for (const nodeId of g.nodes()) {
      const node = g.node(nodeId);
      if (node) {
        positions[nodeId] = { x: node.x - (node.width ?? nodeWidth) / 2, y: node.y - (node.height ?? 200) / 2 };
      }
    }
  } else {
    // Grouped layout
    const groupsPerRow = Math.ceil(Math.sqrt(groups.length));
    let groupX = 0, groupY = 0, maxHeightInRow = 0;

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const groupTableSet = new Set(group.tableIds);

      const g = new dagre.graphlib.Graph();
      g.setDefaultEdgeLabel(() => ({}));
      g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80, marginx: GROUP_PADDING, marginy: GROUP_PADDING });

      for (const tid of group.tableIds) {
        const t = tableMap.get(tid);
        if (!t) continue;
        g.setNode(tid, { width: nodeWidth, height: 32 + t.columnCount * 26 + 8 });
      }

      for (const r of relationships) {
        if (groupTableSet.has(r.sourceTableId) && groupTableSet.has(r.targetTableId)) {
          g.setEdge(r.sourceTableId, r.targetTableId);
        }
      }

      dagre.layout(g);

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const nodeId of g.nodes()) {
        const node = g.node(nodeId);
        if (!node) continue;
        const x = node.x - (node.width ?? nodeWidth) / 2;
        const y = node.y - (node.height ?? 200) / 2;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + (node.width ?? nodeWidth));
        maxY = Math.max(maxY, y + (node.height ?? 200));
      }

      const groupWidth = (maxX - minX) + GROUP_PADDING * 2;
      const groupHeight = (maxY - minY) + GROUP_PADDING * 2 + 30;

      for (const nodeId of g.nodes()) {
        const node = g.node(nodeId);
        if (!node) continue;
        positions[nodeId] = {
          x: groupX + (node.x - minX) + GROUP_PADDING,
          y: groupY + (node.y - minY) + GROUP_PADDING + 30,
        };
      }

      layers.push({
        id: `layer-${i}`,
        name: group.label,
        color: group.color,
        bounds: { x: groupX, y: groupY, w: groupWidth, h: groupHeight },
      });

      maxHeightInRow = Math.max(maxHeightInRow, groupHeight);
      if ((i + 1) % groupsPerRow === 0) {
        groupX = 0;
        groupY += maxHeightInRow + GROUP_GAP;
        maxHeightInRow = 0;
      } else {
        groupX += groupWidth + GROUP_GAP;
      }
    }
  }

  self.postMessage({ positions, layers });
};
