// Camera easing for programmatic moves (fit / zoom-to / pan-to). User gestures (wheel, drag) stay
// instant — this is only for camera changes the app initiates, so they read as motion rather than
// a jump. Pure and unit tested; the rAF driver lives in PixiERDCanvas.
import type { Camera } from './camera';

// Standard ease-in-out cubic, clamped to [0,1]. Slow-fast-slow: no abrupt start or stop.
export function easeInOutCubic(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// Component-wise linear interpolation of two cameras.
export function lerpCamera(from: Camera, to: Camera, t: number): Camera {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    zoom: from.zoom + (to.zoom - from.zoom) * t,
  };
}

// Whether two cameras are close enough to skip animating (avoids a 1-frame no-op tween).
export function camerasClose(a: Camera, b: Camera): boolean {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01 && Math.abs(a.zoom - b.zoom) < 0.0001;
}
