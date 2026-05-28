/**
 * CanvasSnapController
 *
 * Computes snapped drag deltas and snap guide lines.
 *
 * Two snap modes:
 *   Grid  — snaps to a regular mm grid (default 5 mm)
 *   Edges — snaps leading/center/trailing edges of the dragged group
 *           to matching edges of every non-dragged shape
 *
 * Usage:
 *   const result = snapController.snapDelta(targets, allShapes, dx, dy, scale, opts);
 *   // result.dx / result.dy are the adjusted deltas
 *   // result.guides are lines to draw as visual feedback
 */

import Shape from '../../core/geometry/Shape';
import Measurement from '../../core/units/Measurement';

// ── Public types ──────────────────────────────────────────────────────────────

/** A single axis-aligned snap guide line in world-px coordinates. */
export interface SnapGuide {
  /** 'x' = vertical line at this world-px x; 'y' = horizontal line at this world-px y. */
  axis: 'x' | 'y';
  worldCoord: number;
}

export interface SnapOptions {
  /** Master switch — if false the input deltas are returned unchanged. */
  snapEnabled: boolean;
  snapToGrid: boolean;
  snapToEdges: boolean;
  /** Screen pixels within which a snap fires. Default 8. */
  snapThresholdPx?: number;
  /** Grid line spacing in mm. Default 5. */
  gridSpacingMm?: number;
}

export interface SnapResult {
  /** Adjusted delta x in world-px. */
  dx: number;
  /** Adjusted delta y in world-px. */
  dy: number;
  /** Guide lines to draw over the canvas during the drag. */
  guides: SnapGuide[];
}

// ── Bounding-box helper ───────────────────────────────────────────────────────

interface BBox {
  left:   number;
  right:  number;
  top:    number;
  bottom: number;
  centerX: number;
  centerY: number;
}

function bboxOf(shape: Shape): BBox | null {
  try {
    const bb = shape.getBoundingBox();
    const left   = bb.topLeft.x.toUnit('px');
    const top    = bb.topLeft.y.toUnit('px');
    const right  = left  + bb.width.toUnit('px');
    const bottom = top   + bb.height.toUnit('px');
    return { left, right, top, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
  } catch {
    return null;
  }
}

/** Union bounding box of a set of shapes. */
function groupBBox(shapes: Shape[]): BBox | null {
  let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
  let any = false;
  for (const s of shapes) {
    const b = bboxOf(s);
    if (!b) continue;
    any = true;
    if (b.left   < minLeft)   minLeft   = b.left;
    if (b.top    < minTop)    minTop    = b.top;
    if (b.right  > maxRight)  maxRight  = b.right;
    if (b.bottom > maxBottom) maxBottom = b.bottom;
  }
  if (!any) return null;
  return {
    left: minLeft, right: maxRight, top: minTop, bottom: maxBottom,
    centerX: (minLeft + maxRight) / 2,
    centerY: (minTop  + maxBottom) / 2,
  };
}

// ── Controller ────────────────────────────────────────────────────────────────

export class CanvasSnapController {

  /**
   * Given a proposed drag delta (dx, dy in world-px), return a snapped delta
   * and any guide lines to draw.
   *
   * @param targets        Shapes being dragged (at their ORIGINAL positions before any delta)
   * @param allShapes      All shapes on the canvas
   * @param dx             Proposed world-px delta x
   * @param dy             Proposed world-px delta y
   * @param viewportScale  Current viewport scale (screen-px / world-px)
   * @param opts           Snap options
   */
  snapDelta(
    targets:       Shape[],
    allShapes:     Shape[],
    dx:            number,
    dy:            number,
    viewportScale: number,
    opts:          SnapOptions,
  ): SnapResult {
    if (!opts.snapEnabled || targets.length === 0) {
      return { dx, dy, guides: [] };
    }

    const thresholdScreen = opts.snapThresholdPx ?? 8;
    const thresholdWorld  = thresholdScreen / (viewportScale || 1);
    const gridMm          = opts.gridSpacingMm  ?? 5;
    const gridPx          = Measurement.fromMm(gridMm).toUnit('px');

    // Shapes NOT being dragged — candidates for edge snap.
    const targetSet = new Set(targets);
    const others    = allShapes.filter(s => !targetSet.has(s));

    // Bounding box of the dragged group at its PROPOSED position.
    const origBBox = groupBBox(targets);
    if (!origBBox) return { dx, dy, guides: [] };

    const proposed: BBox = {
      left:    origBBox.left    + dx,
      right:   origBBox.right   + dx,
      centerX: origBBox.centerX + dx,
      top:     origBBox.top     + dy,
      bottom:  origBBox.bottom  + dy,
      centerY: origBBox.centerY + dy,
    };

    // ── Collect snap candidates ──────────────────────────────────────────────

    // adjX / adjY = the adjustment to apply on top of dx / dy
    let bestAdjX: number | null = null;
    let bestAdjY: number | null = null;
    let bestDistX = thresholdWorld;
    let bestDistY = thresholdWorld;
    const guides: SnapGuide[] = [];

    const trySnapX = (proposedEdge: number, snapTo: number) => {
      const dist = Math.abs(proposedEdge - snapTo);
      if (dist <= bestDistX) {
        bestDistX = dist;
        bestAdjX  = snapTo - proposedEdge;
        // Guide will be added after we have the winner.
      }
    };

    const trySnapY = (proposedEdge: number, snapTo: number) => {
      const dist = Math.abs(proposedEdge - snapTo);
      if (dist <= bestDistY) {
        bestDistY = dist;
        bestAdjY  = snapTo - proposedEdge;
      }
    };

    // ── Grid snap ────────────────────────────────────────────────────────────
    if (opts.snapToGrid && gridPx > 0) {
      // Try snapping each of the three horizontal edge candidates to the grid.
      for (const edge of [proposed.left, proposed.centerX, proposed.right]) {
        const nearestGrid = Math.round(edge / gridPx) * gridPx;
        trySnapX(edge, nearestGrid);
      }
      for (const edge of [proposed.top, proposed.centerY, proposed.bottom]) {
        const nearestGrid = Math.round(edge / gridPx) * gridPx;
        trySnapY(edge, nearestGrid);
      }
    }

    // ── Edge snap ────────────────────────────────────────────────────────────
    if (opts.snapToEdges) {
      const targetEdgesX = [proposed.left, proposed.centerX, proposed.right];
      const targetEdgesY = [proposed.top,  proposed.centerY, proposed.bottom];

      for (const other of others) {
        const ob = bboxOf(other);
        if (!ob) continue;
        const otherEdgesX = [ob.left, ob.centerX, ob.right];
        const otherEdgesY = [ob.top,  ob.centerY, ob.bottom];

        for (const te of targetEdgesX) {
          for (const oe of otherEdgesX) {
            trySnapX(te, oe);
          }
        }
        for (const te of targetEdgesY) {
          for (const oe of otherEdgesY) {
            trySnapY(te, oe);
          }
        }
      }
    }

    // ── Build final deltas and collect guides ────────────────────────────────
    const finalDx = bestAdjX !== null ? dx + bestAdjX : dx;
    const finalDy = bestAdjY !== null ? dy + bestAdjY : dy;

    if (bestAdjX !== null) {
      // The snapped position of the group
      const snappedLeft    = proposed.left    + bestAdjX;
      const snappedCenterX = proposed.centerX + bestAdjX;
      const snappedRight   = proposed.right   + bestAdjX;
      // Emit a guide at whichever of our three edges landed on a snap
      const gridPxLocal = gridPx;
      if (opts.snapToGrid) {
        for (const edge of [snappedLeft, snappedCenterX, snappedRight]) {
          if (Math.abs(edge - Math.round(edge / gridPxLocal) * gridPxLocal) < 0.5) {
            guides.push({ axis: 'x', worldCoord: edge });
          }
        }
      }
      if (opts.snapToEdges) {
        for (const other of others) {
          const ob = bboxOf(other);
          if (!ob) continue;
          for (const oe of [ob.left, ob.centerX, ob.right]) {
            if (
              Math.abs(snappedLeft    - oe) < 0.5 ||
              Math.abs(snappedCenterX - oe) < 0.5 ||
              Math.abs(snappedRight   - oe) < 0.5
            ) {
              guides.push({ axis: 'x', worldCoord: oe });
            }
          }
        }
      }
    }

    if (bestAdjY !== null) {
      const snappedTop     = proposed.top     + bestAdjY;
      const snappedCenterY = proposed.centerY + bestAdjY;
      const snappedBottom  = proposed.bottom  + bestAdjY;
      const gridPxLocal = gridPx;
      if (opts.snapToGrid) {
        for (const edge of [snappedTop, snappedCenterY, snappedBottom]) {
          if (Math.abs(edge - Math.round(edge / gridPxLocal) * gridPxLocal) < 0.5) {
            guides.push({ axis: 'y', worldCoord: edge });
          }
        }
      }
      if (opts.snapToEdges) {
        for (const other of others) {
          const ob = bboxOf(other);
          if (!ob) continue;
          for (const oe of [ob.top, ob.centerY, ob.bottom]) {
            if (
              Math.abs(snappedTop     - oe) < 0.5 ||
              Math.abs(snappedCenterY - oe) < 0.5 ||
              Math.abs(snappedBottom  - oe) < 0.5
            ) {
              guides.push({ axis: 'y', worldCoord: oe });
            }
          }
        }
      }
    }

    // Deduplicate guides by axis + coord (within 0.1 px).
    const seen = new Set<string>();
    const dedupedGuides = guides.filter(g => {
      const key = `${g.axis}:${Math.round(g.worldCoord * 10)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { dx: finalDx, dy: finalDy, guides: dedupedGuides };
  }
}
