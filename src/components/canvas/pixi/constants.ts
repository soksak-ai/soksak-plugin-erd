// Shared constants for PixiJS ERD canvas

export const NODE_WIDTH = 240;
export const HEADER_HEIGHT = 32;
export const ROW_HEIGHT = 24;
export const PADDING_X = 12;
export const PORT_RADIUS = 4;

// LOD zoom thresholds
export const LOD_FULL = 0.5;      // zoom >= 0.5: full detail
export const LOD_SKELETON = 0.15; // 0.15 <= zoom < 0.5: header + bars
// zoom < 0.15: colored dot only

// Dark theme colors
export const COLORS = {
  bg: 0x18181b,
  headerBg: 0x27272a,
  headerBgSelected: 0x1e3a5f,
  border: 0x3f3f46,
  borderSelected: 0x3b82f6,
  text: 0xf4f4f5,
  textDim: 0x71717a,
  pkColor: 0xf59e0b,
  fkColor: 0x60a5fa,
  uqColor: 0xc084fc,
  separator: 0x3f3f46,
  edge: 0x52525b,
  edgeSelected: 0x3b82f6,
  canvas: 0x09090b,
  grid: 0x1a1a1e,
} as const;

export const FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

// LOD constants (const object instead of enum for erasableSyntaxOnly)
export const LOD = {
  DOT: 0,
  SKELETON: 1,
  FULL: 2,
} as const;
export type LOD = (typeof LOD)[keyof typeof LOD];

export function getLOD(zoom: number): LOD {
  if (zoom >= LOD_FULL) return LOD.FULL;
  if (zoom >= LOD_SKELETON) return LOD.SKELETON;
  return LOD.DOT;
}
