// Host theme adoption contract — the canvas palette must be composed from host tokens, follow
// light vs dark, and degrade to the dark default per-token when the host omits a token.
import { describe, it, expect } from 'vitest';
import { resolveHostMode, computePaletteFromTokens } from './host';
import { DEFAULT_COLORS } from '@/components/canvas/pixi/constants';

function reader(tokens: Record<string, string>) {
  return (name: string): string | undefined => tokens[name];
}

describe('resolveHostMode', () => {
  it('reads data-theme-mode when present', () => {
    const light = { dataset: { themeMode: 'light' } } as unknown as HTMLElement;
    const dark = { dataset: { themeMode: 'dark' } } as unknown as HTMLElement;
    expect(resolveHostMode(light)).toBe('light');
    expect(resolveHostMode(dark)).toBe('dark');
  });
  it('falls back (never throws) when the mode is absent/unknown', () => {
    const bare = { dataset: {} } as unknown as HTMLElement;
    expect(['light', 'dark']).toContain(resolveHostMode(bare));
  });
});

describe('computePaletteFromTokens', () => {
  it('composes the canvas palette from host tokens (light)', () => {
    const p = computePaletteFromTokens(
      reader({
        bg: '#ffffff',
        card: '#f4f4f5',
        inset: '#e4e4e7',
        fg: '#18181b',
        fg3: '#71717a',
        bd: '#d4d4d8',
        acc: '#2563eb',
        accbg: '#dbeafe',
      }),
    );
    expect(p.canvas).toBe(0xffffff); // backdrop = --bg
    expect(p.bg).toBe(0xf4f4f5); // node body = --card
    expect(p.headerBg).toBe(0xe4e4e7); // header = --inset
    expect(p.text).toBe(0x18181b); // --fg
    expect(p.border).toBe(0xd4d4d8); // --bd
    expect(p.borderSelected).toBe(0x2563eb); // --acc
    expect(p.headerBgSelected).toBe(0xdbeafe); // --accbg
  });
  it('handles the rgb() form that getComputedStyle returns', () => {
    const p = computePaletteFromTokens(reader({ fg: 'rgb(24, 24, 27)', bg: 'rgb(255 255 255)' }));
    expect(p.text).toBe(0x18181b);
    expect(p.canvas).toBe(0xffffff);
  });
  it('keeps the dark default for any token the host omits', () => {
    const p = computePaletteFromTokens(reader({})); // empty host
    expect(p.bg).toBe(DEFAULT_COLORS.bg);
    expect(p.text).toBe(DEFAULT_COLORS.text);
    expect(p.canvas).toBe(DEFAULT_COLORS.canvas);
  });
  it('never themes the semantic badge colors', () => {
    const p = computePaletteFromTokens(reader({ bg: '#ffffff', fg: '#000000', acc: '#ff00ff' }));
    expect(p.pkColor).toBe(DEFAULT_COLORS.pkColor);
    expect(p.fkColor).toBe(DEFAULT_COLORS.fkColor);
    expect(p.uqColor).toBe(DEFAULT_COLORS.uqColor);
  });
});
