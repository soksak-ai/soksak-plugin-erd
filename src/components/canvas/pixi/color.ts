// Shared color math for the Pixi canvas — parse CSS hex to a numeric color, mix two numeric
// colors, and derive a table's tinted header. Kept pure and dependency-free so it is unit
// tested headlessly and reused by any renderer that blends the theme palette with per-object
// colors (table highlight tint, and later the theme-token palette).

// '#rgb' / '#rrggbb' (with or without '#') → 0xRRGGBB. Returns null for anything unparseable
// so callers fall back to their base color instead of rendering a garbage tint.
export function parseHexColor(input: string | undefined | null): number | null {
  if (!input) return null;
  let s = input.trim();
  if (s.startsWith('#')) s = s.slice(1);
  if (s.length === 3) {
    s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  }
  if (s.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return parseInt(s, 16);
}

// Linear per-channel blend: t=0 → a, t=1 → b. t is clamped to [0,1].
export function mixColor(a: number, b: number, t: number): number {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * k);
  const g = Math.round(ag + (bg - ag) * k);
  const bl = Math.round(ab + (bb - ab) * k);
  return (r << 16) | (g << 8) | bl;
}

// Header fill for a table: the base header background tinted toward the table's highlight
// color by `strength` (default ~12%). No/invalid color → the base background unchanged.
export function tintHeader(base: number, tableColor: string | undefined | null, strength = 0.12): number {
  const c = parseHexColor(tableColor);
  if (c == null) return base;
  return mixColor(base, c, strength);
}
