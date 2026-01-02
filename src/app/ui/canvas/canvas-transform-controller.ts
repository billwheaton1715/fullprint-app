import Measurement from '../../core/units/Measurement';
import Shape from '../../core/geometry/Shape';
import { CanvasSelectionController } from './canvas-selection-controller';

export type DragTransformState = {
  original: Shape;
  startWorldX: number;
  startWorldY: number;
};

export class CanvasTransformController {
  lastDx: Measurement | null = null;
  lastDy: Measurement | null = null;
 /** compute/store last delta for commit */
  updateDragDelta(startWorldX: number, startWorldY: number, worldX: number, worldY: number) {
    this.lastDx = Measurement.fromPx(worldX - startWorldX);
    this.lastDy = Measurement.fromPx(worldY - startWorldY);
    return { dx: this.lastDx, dy: this.lastDy };
  }

  clearDelta() {
    this.lastDx = null;
    this.lastDy = null;
  }

  /** preview-only translate: returns a NEW shapes array, does not touch selection */
  previewTranslate(allShapes: Shape[], targets: Shape[], dx: Measurement, dy: Measurement): Shape[] {
    if (!targets.length) return allShapes;
    const set = new Set(targets);
    return allShapes.map(s => (set.has(s) ? s.translate(dx, dy) : s));
  }

  /**
   * Commit translate:
   * - returns newShapes
   * - remaps selection to the new instances
   */
  commitTranslate(
    allShapes: Shape[],
    targets: Shape[],
    selection: CanvasSelectionController
  ): Shape[] {
    if (!targets.length) return allShapes;
    if (!this.lastDx || !this.lastDy) return allShapes;

    const set = new Set(targets);
    const newShapes = allShapes.map(s => (set.has(s) ? s.translate(this.lastDx!, this.lastDy!) : s));

    // build old->new mapping only for transformed shapes
    const oldToNew = new Map<Shape, Shape>();
    for (let i = 0; i < allShapes.length; i++) {
      const oldS = allShapes[i];
      if (set.has(oldS)) oldToNew.set(oldS, newShapes[i]);
    }

    selection.remapAfterShapeReplacement(oldToNew, newShapes);

    return newShapes;
  }
  /**
   * Compute dx/dy (world px delta) from the drag start to current world.
   * Stores lastDx/lastDy so pointerUp can commit the same delta.
   */
  computeDragDelta(
    drag: DragTransformState,
    currentWorldX: number,
    currentWorldY: number
  ): { dx: Measurement; dy: Measurement } {
    const dx = Measurement.fromPx(currentWorldX - drag.startWorldX);
    const dy = Measurement.fromPx(currentWorldY - drag.startWorldY);
    this.lastDx = dx;
    this.lastDy = dy;
    return { dx, dy };
  }

  clearLastDelta() {
    this.lastDx = null;
    this.lastDy = null;
  }

  

 
}
