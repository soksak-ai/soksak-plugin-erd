import { describe, it, expect } from 'vitest';
import { parseHexColor, mixColor, tintHeader } from './color';

describe('parseHexColor', () => {
  it('parses #rrggbb, rrggbb, and #rgb', () => {
    expect(parseHexColor('#18181b')).toBe(0x18181b);
    expect(parseHexColor('18181b')).toBe(0x18181b);
    expect(parseHexColor('#fff')).toBe(0xffffff);
    expect(parseHexColor('#3b82f6')).toBe(0x3b82f6);
  });
  it('returns null for empty/invalid input', () => {
    expect(parseHexColor(undefined)).toBeNull();
    expect(parseHexColor(null)).toBeNull();
    expect(parseHexColor('')).toBeNull();
    expect(parseHexColor('#12')).toBeNull();
    expect(parseHexColor('rgb(1,2,3)')).toBeNull();
    expect(parseHexColor('#gggggg')).toBeNull();
  });
});

describe('mixColor', () => {
  it('t=0 → a, t=1 → b', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
  });
  it('t=0.5 is the per-channel midpoint', () => {
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColor(0x204060, 0x60a0e0, 0.5)).toBe(0x4070a0);
  });
  it('clamps t outside [0,1]', () => {
    expect(mixColor(0x000000, 0xffffff, -1)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 2)).toBe(0xffffff);
  });
});

describe('tintHeader', () => {
  it('no/invalid color → base unchanged', () => {
    expect(tintHeader(0x27272a, undefined)).toBe(0x27272a);
    expect(tintHeader(0x27272a, null)).toBe(0x27272a);
    expect(tintHeader(0x27272a, 'not-a-color')).toBe(0x27272a);
  });
  it('tints the base toward the table color by the given strength', () => {
    const base = 0x27272a;
    const tinted = tintHeader(base, '#ff0000', 0.12);
    expect(tinted).not.toBe(base);
    // 12% toward red raises the red channel, keeps it a subtle tint (not fully red).
    expect((tinted >> 16) & 0xff).toBeGreaterThan((base >> 16) & 0xff);
    expect((tinted >> 16) & 0xff).toBeLessThan(0xff);
  });
  it('default strength is subtle (~12%)', () => {
    expect(tintHeader(0x000000, '#ffffff')).toBe(mixColor(0x000000, 0xffffff, 0.12));
  });
});
