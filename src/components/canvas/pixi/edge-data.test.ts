// Edge-data selection-propagation contract.
import { describe, it, expect } from 'vitest';
import { buildEdgeData, type RelationshipLike } from './edge-data';

const rels: Record<string, RelationshipLike> = {
  r1: { id: 'r1', sourceTableId: 'users', targetTableId: 'orders', type: '1:N' },
  r2: { id: 'r2', sourceTableId: 'orders', targetTableId: 'items', type: '1:N' },
  r3: { id: 'r3', sourceTableId: 'a', targetTableId: 'b', type: '1:1' },
};

describe('buildEdgeData', () => {
  it('marks the directly-selected edge', () => {
    const edges = buildEdgeData(rels, ['r2'], []);
    expect(edges.find((e) => e.id === 'r2')!.selected).toBe(true);
    expect(edges.find((e) => e.id === 'r1')!.selected).toBe(false);
  });

  it('marks edges touching a selected node as related (not selected)', () => {
    const edges = buildEdgeData(rels, [], ['orders']);
    const r1 = edges.find((e) => e.id === 'r1')!;
    const r2 = edges.find((e) => e.id === 'r2')!;
    const r3 = edges.find((e) => e.id === 'r3')!;
    expect(r1.related).toBe(true); // orders is target of r1
    expect(r2.related).toBe(true); // orders is source of r2
    expect(r3.related).toBe(false); // untouched
    expect(r1.selected).toBe(false); // related is distinct from selected
  });

  it('a node selection relates both its incoming and outgoing edges', () => {
    const edges = buildEdgeData(rels, [], ['users']);
    expect(edges.find((e) => e.id === 'r1')!.related).toBe(true);
    expect(edges.find((e) => e.id === 'r2')!.related).toBe(false);
  });

  it('no selection → nothing selected or related', () => {
    const edges = buildEdgeData(rels, [], []);
    expect(edges.every((e) => !e.selected && !e.related)).toBe(true);
  });

  it('selected edge and related node can both apply', () => {
    const edges = buildEdgeData(rels, ['r1'], ['orders']);
    const r1 = edges.find((e) => e.id === 'r1')!;
    expect(r1.selected).toBe(true);
    expect(r1.related).toBe(true);
  });
});
