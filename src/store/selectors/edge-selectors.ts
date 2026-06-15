import type { StoreState } from '../index';
import { useStore } from '../index';
import { useShallow } from 'zustand/react/shallow';

export interface ERDEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  selected: boolean;
  data: {
    relationshipId: string;
    type: string;
    label?: string;
  };
}

export const selectEdges = (state: StoreState): ERDEdge[] => {
  return Object.values(state.relationships).map((rel) => ({
    id: rel.id,
    source: rel.sourceTableId,
    target: rel.targetTableId,
    type: 'relationship',
    selected: state.selectedEdgeIds.includes(rel.id),
    data: {
      relationshipId: rel.id,
      type: rel.type,
      label: rel.name,
    },
  }));
};

export const useEdges = () => useStore(useShallow(selectEdges));
