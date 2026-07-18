// Inline-rename overlay geometry — pure math, no Pixi/React/DOM imports.
//
// The table header is GPU-drawn on the Pixi canvas, so renaming in place needs a
// DOM <input> positioned exactly over that header band. These functions map a
// node's world-space box to the canvas-container-local pixel rect the input must
// occupy, and answer whether a world-space point falls in the header band (the
// only region that opens the rename input on double-click).
import type { Camera } from './camera';
import { worldToScreen } from './camera';
import { NODE_WIDTH, HEADER_HEIGHT } from './constants';

export interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Node position (world top-left) → the container-local px rect covering its header,
// scaled by zoom so the input visually matches the drawn header at any zoom.
export function overlayRectForHeader(
  camera: Camera,
  node: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
): OverlayRect {
  const topLeft = worldToScreen(camera, node.x, node.y, canvasWidth, canvasHeight);
  return {
    left: topLeft.x,
    top: topLeft.y,
    width: NODE_WIDTH * camera.zoom,
    height: HEADER_HEIGHT * camera.zoom,
  };
}

// Is a world-space point inside a node's header band (the top HEADER_HEIGHT strip)?
// Double-click there opens rename; double-click on a column row does not.
export function isInHeaderBand(
  node: { x: number; y: number },
  worldX: number,
  worldY: number,
): boolean {
  return (
    worldX >= node.x &&
    worldX <= node.x + NODE_WIDTH &&
    worldY >= node.y &&
    worldY <= node.y + HEADER_HEIGHT
  );
}
