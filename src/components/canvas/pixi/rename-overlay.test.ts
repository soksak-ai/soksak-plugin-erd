// Inline-rename overlay geometry contract.
import { describe, it, expect } from 'vitest';
import { overlayRectForHeader, isInHeaderBand } from './rename-overlay';
import { NODE_WIDTH, HEADER_HEIGHT } from './constants';

describe('overlayRectForHeader', () => {
  const W = 800;
  const H = 600;

  it('at zoom 1, a node centered under the camera maps to a header rect of node size', () => {
    const cam = { x: 100, y: 50, zoom: 1 };
    // node top-left at the camera center → screen center
    const r = overlayRectForHeader(cam, { x: 100, y: 50 }, W, H);
    expect(r.left).toBe(W / 2);
    expect(r.top).toBe(H / 2);
    expect(r.width).toBe(NODE_WIDTH);
    expect(r.height).toBe(HEADER_HEIGHT);
  });

  it('scales the rect by zoom', () => {
    const cam = { x: 0, y: 0, zoom: 2 };
    const r = overlayRectForHeader(cam, { x: 0, y: 0 }, W, H);
    expect(r.width).toBe(NODE_WIDTH * 2);
    expect(r.height).toBe(HEADER_HEIGHT * 2);
    // node at camera center stays centered regardless of zoom
    expect(r.left).toBe(W / 2);
    expect(r.top).toBe(H / 2);
  });

  it('offsets left/top by the world delta times zoom', () => {
    const cam = { x: 0, y: 0, zoom: 0.5 };
    const r = overlayRectForHeader(cam, { x: 40, y: 20 }, W, H);
    expect(r.left).toBe(W / 2 + 40 * 0.5);
    expect(r.top).toBe(H / 2 + 20 * 0.5);
    expect(r.width).toBe(NODE_WIDTH * 0.5);
  });
});

describe('isInHeaderBand', () => {
  const node = { x: 100, y: 100 };

  it('accepts a point inside the header strip', () => {
    expect(isInHeaderBand(node, 100 + NODE_WIDTH / 2, 100 + HEADER_HEIGHT / 2)).toBe(true);
    expect(isInHeaderBand(node, 100, 100)).toBe(true); // top-left corner
    expect(isInHeaderBand(node, 100 + NODE_WIDTH, 100 + HEADER_HEIGHT)).toBe(true); // bottom-right corner
  });

  it('rejects a point below the header (a column row)', () => {
    expect(isInHeaderBand(node, 100 + NODE_WIDTH / 2, 100 + HEADER_HEIGHT + 1)).toBe(false);
  });

  it('rejects a point outside the node horizontally', () => {
    expect(isInHeaderBand(node, 100 - 1, 100 + 5)).toBe(false);
    expect(isInHeaderBand(node, 100 + NODE_WIDTH + 1, 100 + 5)).toBe(false);
  });
});
