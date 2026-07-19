// Crow's foot notation markers for ERD relationship lines.
// Draws "one" (||) and "many" (crow's foot) markers at edge endpoints.

import type { Graphics } from 'pixi.js';
import type { RelationType } from '@/types/schema';

// Marker dimensions
const ONE_WIDTH = 8;   // perpendicular bar half-width
const ONE_GAP = 4;     // gap between the two bars in "one" marker
const MANY_WIDTH = 10; // crow's foot prong half-width
const MANY_LENGTH = 12; // how far back the prongs extend

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const OPTIONAL_RADIUS = 4.5; // ○ (zero) marker radius for optional participation

/**
 * Draw the "one" marker oriented along `angle` (pointing away from the table).
 * - mandatory (exactly one): two short perpendicular bars (||).
 * - optional (zero or one): one bar nearer the table + a ○ further out (○|).
 */
function drawOneMarker(
  g: Graphics,
  x: number,
  y: number,
  angle: number,
  color: number,
  lineWidth: number,
  optional = false,
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Perpendicular direction
  const px = -sin;
  const py = cos;

  const bar = (offset: number) => {
    const cx = x + cos * offset;
    const cy = y + sin * offset;
    g.moveTo(cx + px * ONE_WIDTH, cy + py * ONE_WIDTH);
    g.lineTo(cx - px * ONE_WIDTH, cy - py * ONE_WIDTH);
  };

  if (optional) {
    // 0..1 — a single bar near the table, then a hollow circle further out (the "zero").
    bar(-ONE_GAP);
    g.stroke({ color, width: lineWidth });
    const oc = ONE_GAP + OPTIONAL_RADIUS + 1;
    g.circle(x + cos * oc, y + sin * oc, OPTIONAL_RADIUS).stroke({ color, width: lineWidth });
  } else {
    // 1..1 — two bars.
    bar(-ONE_GAP);
    bar(ONE_GAP);
    g.stroke({ color, width: lineWidth });
  }
}

/**
 * Draw the "many" marker: three lines fanning out (crow's foot).
 * The center line continues along the edge direction, and the two outer
 * prongs splay out perpendicular at the endpoint.
 */
function drawManyMarker(
  g: Graphics,
  x: number,
  y: number,
  angle: number,
  color: number,
  lineWidth: number,
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Perpendicular direction
  const px = -sin;
  const py = cos;

  // The "base" of the crow's foot (where the three prongs converge)
  // is offset back along the edge direction
  const baseX = x + cos * MANY_LENGTH;
  const baseY = y + sin * MANY_LENGTH;

  // Center prong: straight from base to tip
  g.moveTo(baseX, baseY);
  g.lineTo(x, y);

  // Upper prong
  g.moveTo(baseX, baseY);
  g.lineTo(x + px * MANY_WIDTH, y + py * MANY_WIDTH);

  // Lower prong
  g.moveTo(baseX, baseY);
  g.lineTo(x - px * MANY_WIDTH, y - py * MANY_WIDTH);

  g.stroke({ color, width: lineWidth });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Draw the source-side marker at a given point.
 *
 * - `1:1` and `1:N`: source is the "one" side (||)
 * - `N:M`: source is the "many" side (crow's foot)
 *
 * @param g     - PixiJS Graphics object to draw into (already part of a batch)
 * @param x     - endpoint X in world space
 * @param y     - endpoint Y in world space
 * @param angle - edge direction angle (radians), pointing away from the table
 * @param type  - relationship type
 * @param color - marker color (defaults to COLORS.edge)
 * @param lineWidth - stroke width (defaults to 1.5)
 */
export function drawSourceMarker(
  g: Graphics,
  x: number,
  y: number,
  angle: number,
  type: RelationType,
  color = 0x52525b,
  lineWidth = 1.5,
  optional = false,
): void {
  if (type === 'N:M') {
    drawManyMarker(g, x, y, angle, color, lineWidth);
  } else {
    // 1:1 and 1:N: source side is "one" — carries the optional (○) marker when the FK is nullable.
    drawOneMarker(g, x, y, angle, color, lineWidth, optional);
  }
}

/**
 * Draw the target-side marker at a given point.
 *
 * - `1:1`: target is the "one" side (||)
 * - `1:N` and `N:M`: target is the "many" side (crow's foot)
 *
 * @param g     - PixiJS Graphics object to draw into (already part of a batch)
 * @param x     - endpoint X in world space
 * @param y     - endpoint Y in world space
 * @param angle - edge direction angle (radians), pointing away from the table
 * @param type  - relationship type
 * @param color - marker color (defaults to COLORS.edge)
 * @param lineWidth - stroke width (defaults to 1.5)
 */
export function drawTargetMarker(
  g: Graphics,
  x: number,
  y: number,
  angle: number,
  type: RelationType,
  color = 0x52525b,
  lineWidth = 1.5,
): void {
  if (type === '1:1') {
    drawOneMarker(g, x, y, angle, color, lineWidth);
  } else {
    // 1:N and N:M: target side is "many"
    drawManyMarker(g, x, y, angle, color, lineWidth);
  }
}
