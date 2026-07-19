import { describe, it, expect } from 'vitest';
import { cardinalityLabels } from './cardinality';

describe('cardinalityLabels', () => {
  it('1:N — one side 1, many side N', () => {
    expect(cardinalityLabels('1:N', false)).toEqual({ source: '1', target: 'N' });
  });
  it('1:N optional — one side 0..1', () => {
    expect(cardinalityLabels('1:N', true)).toEqual({ source: '0..1', target: 'N' });
  });
  it('1:1 — both one; optionality on the source side', () => {
    expect(cardinalityLabels('1:1', false)).toEqual({ source: '1', target: '1' });
    expect(cardinalityLabels('1:1', true)).toEqual({ source: '0..1', target: '1' });
  });
  it('N:M — many-to-many reads as N / M', () => {
    expect(cardinalityLabels('N:M', false)).toEqual({ source: 'N', target: 'M' });
    // junction optionality is not derived, so it stays N / M
    expect(cardinalityLabels('N:M', true)).toEqual({ source: 'N', target: 'M' });
  });
});
