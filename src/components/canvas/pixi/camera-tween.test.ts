import { describe, it, expect } from 'vitest';
import { easeInOutCubic, lerpCamera, camerasClose } from './camera-tween';

describe('easeInOutCubic', () => {
  it('pins the endpoints and midpoint', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
  });
  it('clamps outside [0,1]', () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });
  it('is monotonic non-decreasing', () => {
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const v = easeInOutCubic(i / 20);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  it('eases in (slower than linear early)', () => {
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
  });
});

describe('lerpCamera', () => {
  const from = { x: 0, y: 0, zoom: 1 };
  const to = { x: 100, y: -40, zoom: 2 };
  it('t=0 → from, t=1 → to', () => {
    expect(lerpCamera(from, to, 0)).toEqual(from);
    expect(lerpCamera(from, to, 1)).toEqual(to);
  });
  it('t=0.5 → component midpoint', () => {
    expect(lerpCamera(from, to, 0.5)).toEqual({ x: 50, y: -20, zoom: 1.5 });
  });
});

describe('camerasClose', () => {
  it('true within epsilon, false beyond', () => {
    expect(camerasClose({ x: 0, y: 0, zoom: 1 }, { x: 0.001, y: 0, zoom: 1 })).toBe(true);
    expect(camerasClose({ x: 0, y: 0, zoom: 1 }, { x: 1, y: 0, zoom: 1 })).toBe(false);
    expect(camerasClose({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0, zoom: 1.5 })).toBe(false);
  });
});
