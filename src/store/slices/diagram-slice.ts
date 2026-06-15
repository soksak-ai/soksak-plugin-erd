import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import type { NodePosition, Viewport } from '@/types/diagram';

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export interface DiagramSlice {
  // State
  nodePositions: Record<string, NodePosition>;
  collapsedNodes: Record<string, boolean>;
  viewport: Viewport;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];

  // Actions
  setNodePosition: (nodeId: string, position: NodePosition) => void;
  setNodePositions: (positions: Record<string, NodePosition>) => void;
  toggleNodeCollapsed: (nodeId: string) => void;
  setAllCollapsed: (collapsed: boolean) => void;
  setViewport: (viewport: Viewport) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setSelectedEdgeIds: (ids: string[]) => void;
  clearSelection: () => void;

  // Project actions
  loadDiagramState: (data: { nodePositions: Record<string, NodePosition>; collapsedNodes: Record<string, boolean>; viewport: Viewport }) => void;
  resetDiagram: () => void;
}

export const createDiagramSlice: StateCreator<StoreState, [['zustand/immer', never]], [], DiagramSlice> = (set) => ({
  nodePositions: {},
  collapsedNodes: {},
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeIds: [],
  selectedEdgeIds: [],

  setNodePosition: (nodeId, position) => {
    set((state) => {
      state.nodePositions[nodeId] = position;
    });
  },

  setNodePositions: (positions) => {
    set((state) => {
      Object.assign(state.nodePositions, positions);
    });
  },

  toggleNodeCollapsed: (nodeId) => {
    set((state) => {
      state.collapsedNodes[nodeId] = !state.collapsedNodes[nodeId];
    });
  },

  setAllCollapsed: (collapsed) => {
    set((state) => {
      const tableIds = Object.keys(state.tables);
      if (collapsed) {
        for (const id of tableIds) {
          state.collapsedNodes[id] = true;
        }
      } else {
        state.collapsedNodes = {};
      }
    });
  },

  setViewport: (viewport) => {
    set((state) => {
      state.viewport = viewport;
    });
  },

  setSelectedNodeIds: (ids) => {
    set((state) => {
      const sameNodes = sameStringArray(state.selectedNodeIds, ids);
      const shouldClearEdges = ids.length > 0 && state.selectedEdgeIds.length > 0;
      if (sameNodes && !shouldClearEdges) return;
      state.selectedNodeIds = ids;
      if (shouldClearEdges) {
        state.selectedEdgeIds = [];
      }
    });
  },

  setSelectedEdgeIds: (ids) => {
    set((state) => {
      const sameEdges = sameStringArray(state.selectedEdgeIds, ids);
      const shouldClearNodes = ids.length > 0 && state.selectedNodeIds.length > 0;
      if (sameEdges && !shouldClearNodes) return;
      state.selectedEdgeIds = ids;
      if (shouldClearNodes) {
        state.selectedNodeIds = [];
      }
    });
  },

  clearSelection: () => {
    set((state) => {
      if (state.selectedNodeIds.length === 0 && state.selectedEdgeIds.length === 0) return;
      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
    });
  },

  loadDiagramState: (data) => {
    set((state) => {
      state.nodePositions = data.nodePositions;
      state.collapsedNodes = data.collapsedNodes;
      state.viewport = data.viewport;
      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
    });
  },

  resetDiagram: () => {
    set((state) => {
      state.nodePositions = {};
      state.collapsedNodes = {};
      state.viewport = { x: 0, y: 0, zoom: 1 };
      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
    });
  },
});
