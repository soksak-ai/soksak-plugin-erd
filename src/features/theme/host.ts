// Host theme adoption — the plugin owns no theme. The host publishes color tokens as CSS custom
// properties on document.documentElement (--bg, --card, --side, --inset, --fg, --fg2, --fg3, --bd,
// --acc, --accbg, …), the effective mode as data-theme-mode, and a single change signal,
// data-theme-epoch. This module reads those (never writes the host root) and composes the Pixi
// canvas palette from them. Chrome mode follows the same source via useHostThemeSync.
import { DEFAULT_COLORS, type CanvasPalette } from '@/components/canvas/pixi/constants';
import { parseCssColor, mixColor } from '@/components/canvas/pixi/color';

export type ThemeMode = 'light' | 'dark';

// Effective light/dark from the host root. Falls back to the OS preference, then dark, when the
// host has not stamped data-theme-mode yet (pre-first-paint or a bare embedder).
export function resolveHostMode(root: HTMLElement): ThemeMode {
  const m = root.dataset.themeMode;
  if (m === 'light' || m === 'dark') return m;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

// Compose the canvas palette from a token reader. Pure — the reader returns the resolved CSS value
// for a host token name (without '--'), or undefined. Any token missing/unparseable keeps the dark
// default for that field, so an incomplete host theme degrades gracefully instead of rendering
// garbage. Semantic badge colors (pk/fk/uq) are never themed.
export function computePaletteFromTokens(read: (token: string) => string | undefined): CanvasPalette {
  const d = DEFAULT_COLORS;
  const t = (name: string): number | null => parseCssColor(read(name));
  const bg = t('bg');
  const card = t('card');
  const side = t('side');
  const inset = t('inset');
  const fg = t('fg');
  const fg2 = t('fg2');
  const fg3 = t('fg3');
  const bd = t('bd');
  const acc = t('acc');
  const accbg = t('accbg');
  return {
    bg: card ?? d.bg, // node body = card surface
    headerBg: inset ?? side ?? d.headerBg,
    headerBgSelected:
      accbg ?? (acc != null && card != null ? mixColor(card, acc, 0.35) : d.headerBgSelected),
    border: bd ?? d.border,
    borderSelected: acc ?? d.borderSelected,
    text: fg ?? d.text,
    textDim: fg3 ?? fg2 ?? d.textDim,
    pkColor: d.pkColor, // semantic — fixed across themes
    fkColor: d.fkColor,
    uqColor: d.uqColor,
    separator: bd ?? d.separator,
    edge: fg3 ?? bd ?? d.edge,
    edgeSelected: acc ?? d.edgeSelected,
    canvas: bg ?? d.canvas, // canvas backdrop = app background
    grid: bg != null && bd != null ? mixColor(bg, bd, 0.5) : d.grid,
  };
}

// Read the live host tokens off a root element and compose the palette.
export function computeCanvasPalette(root: HTMLElement): CanvasPalette {
  const cs = getComputedStyle(root);
  return computePaletteFromTokens((name) => cs.getPropertyValue(`--${name}`).trim() || undefined);
}
