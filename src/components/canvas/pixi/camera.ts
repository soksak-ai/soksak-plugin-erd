// Camera / viewport math for an infinite canvas.
// Pure utility -- no PixiJS or React imports.

/** Camera state: world-space center point + zoom level. */
export interface Camera {
  /** World X coordinate of the viewport center */
  x: number;
  /** World Y coordinate of the viewport center */
  y: number;
  /** Zoom factor (1 = 100%, 2 = 200%, 0.5 = 50%) */
  zoom: number;
}

// ---------------------------------------------------------------------------
// Coordinate transforms
// ---------------------------------------------------------------------------

/**
 * Convert a screen-space point to a world-space point.
 *
 * The transform is:
 *   worldX = (screenX - canvasWidth/2) / zoom + camera.x
 *   worldY = (screenY - canvasHeight/2) / zoom + camera.y
 */
export function screenToWorld(
  camera: Camera,
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (screenX - canvasWidth / 2) / camera.zoom + camera.x,
    y: (screenY - canvasHeight / 2) / camera.zoom + camera.y,
  };
}

/**
 * Convert a world-space point to a screen-space point.
 *
 * The transform is the inverse of {@link screenToWorld}:
 *   screenX = (worldX - camera.x) * zoom + canvasWidth/2
 *   screenY = (worldY - camera.y) * zoom + canvasHeight/2
 */
export function worldToScreen(
  camera: Camera,
  worldX: number,
  worldY: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (worldX - camera.x) * camera.zoom + canvasWidth / 2,
    y: (worldY - camera.y) * camera.zoom + canvasHeight / 2,
  };
}

// ---------------------------------------------------------------------------
// Viewport bounds
// ---------------------------------------------------------------------------

/**
 * Return the axis-aligned bounding box in world space that is currently
 * visible on screen.
 */
export function getViewportBounds(
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const halfW = canvasWidth / 2 / camera.zoom;
  const halfH = canvasHeight / 2 / camera.zoom;
  return {
    minX: camera.x - halfW,
    minY: camera.y - halfH,
    maxX: camera.x + halfW,
    maxY: camera.y + halfH,
  };
}

// ---------------------------------------------------------------------------
// Zoom helpers
// ---------------------------------------------------------------------------

/**
 * Zoom the camera toward (or away from) a screen-space point.
 *
 * This keeps the world point under the cursor stationary on screen, which is
 * the expected behaviour for scroll-wheel / pinch-to-zoom interactions.
 *
 * Algorithm:
 *  1. Convert the screen point to world space under the *current* camera.
 *  2. Build a new camera with the desired zoom.
 *  3. Adjust the camera center so that the same world point still maps to the
 *     same screen point under the new zoom.
 */
export function zoomAtPoint(
  camera: Camera,
  screenX: number,
  screenY: number,
  newZoom: number,
  canvasWidth: number,
  canvasHeight: number,
): Camera {
  // World point under the cursor before zoom
  const worldPoint = screenToWorld(camera, screenX, screenY, canvasWidth, canvasHeight);

  // After changing zoom, the world point under (screenX, screenY) would be:
  //   newWorldX = (screenX - canvasWidth/2) / newZoom + newCameraX
  // We want newWorldX === worldPoint.x, so:
  //   newCameraX = worldPoint.x - (screenX - canvasWidth/2) / newZoom
  return {
    x: worldPoint.x - (screenX - canvasWidth / 2) / newZoom,
    y: worldPoint.y - (screenY - canvasHeight / 2) / newZoom,
    zoom: newZoom,
  };
}

// ---------------------------------------------------------------------------
// Apply camera to a PixiJS-like container
// ---------------------------------------------------------------------------

/**
 * Generic container interface -- avoids importing PixiJS.
 * Any object with `position.set()` and `scale.set()` qualifies.
 */
interface Transformable {
  position: { set(x: number, y: number): void };
  scale: { set(x: number, y?: number): void };
}

/**
 * Apply the camera transform to a PixiJS `Container` (or any object matching
 * the {@link Transformable} interface).
 *
 * The resulting transform is:
 *   container.position = (canvasWidth/2 - camera.x * zoom, canvasHeight/2 - camera.y * zoom)
 *   container.scale    = (zoom, zoom)
 */
export function applyCameraToContainer(
  camera: Camera,
  container: Transformable,
  canvasWidth: number,
  canvasHeight: number,
): void {
  container.position.set(
    canvasWidth / 2 - camera.x * camera.zoom,
    canvasHeight / 2 - camera.y * camera.zoom,
  );
  container.scale.set(camera.zoom);
}

// ---------------------------------------------------------------------------
// Fit-to-view
// ---------------------------------------------------------------------------

/**
 * Compute a camera that fits the given world-space bounds within the canvas,
 * with optional padding (in screen pixels, default 40).
 *
 * If the bounds are degenerate (zero width or height) the camera centers on
 * the bounds midpoint at zoom 1.
 */
export function fitToView(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  canvasWidth: number,
  canvasHeight: number,
  padding = 40,
): Camera {
  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxY - bounds.minY;

  const cx = bounds.minX + worldW / 2;
  const cy = bounds.minY + worldH / 2;

  if (worldW <= 0 && worldH <= 0) {
    return { x: cx, y: cy, zoom: 1 };
  }

  const availableW = Math.max(canvasWidth - padding * 2, 1);
  const availableH = Math.max(canvasHeight - padding * 2, 1);

  const zoom = Math.min(
    availableW / Math.max(worldW, 1),
    availableH / Math.max(worldH, 1),
    1, // never zoom in beyond 100% on fitView
  );

  return { x: cx, y: cy, zoom: Math.max(zoom, 0.02) };
}
