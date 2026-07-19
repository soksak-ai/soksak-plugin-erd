import { describe, it, expect } from 'vitest';
import { rowIndexAtLocalY } from './table-node';
import { HEADER_HEIGHT, ROW_HEIGHT } from './constants';

describe('rowIndexAtLocalY', () => {
  const COLS = 3;
  it('returns null inside the header band', () => {
    expect(rowIndexAtLocalY(0, COLS)).toBeNull();
    expect(rowIndexAtLocalY(HEADER_HEIGHT - 1, COLS)).toBeNull();
  });
  it('maps each row band to its 0-based index', () => {
    expect(rowIndexAtLocalY(HEADER_HEIGHT, COLS)).toBe(0);
    expect(rowIndexAtLocalY(HEADER_HEIGHT + ROW_HEIGHT - 1, COLS)).toBe(0);
    expect(rowIndexAtLocalY(HEADER_HEIGHT + ROW_HEIGHT, COLS)).toBe(1);
    expect(rowIndexAtLocalY(HEADER_HEIGHT + 2 * ROW_HEIGHT, COLS)).toBe(2);
  });
  it('returns null past the last row', () => {
    expect(rowIndexAtLocalY(HEADER_HEIGHT + COLS * ROW_HEIGHT, COLS)).toBeNull();
    expect(rowIndexAtLocalY(HEADER_HEIGHT + 100 * ROW_HEIGHT, COLS)).toBeNull();
  });
  it('a table with no columns has no rows', () => {
    expect(rowIndexAtLocalY(HEADER_HEIGHT + 5, 0)).toBeNull();
  });
});
