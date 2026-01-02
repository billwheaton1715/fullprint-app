import Shape from '../../core/geometry/Shape';
import { Rectangle } from '../../core/geometry/Rectangle';
import { Point } from '../../core/geometry/Point';
import Measurement from '../../core/units/Measurement';

export type SelectionOperation =
  | { type: 'replace'; shapes: Shape[] }
  | { type: 'add'; shapes: Shape[] }
  | { type: 'toggle'; shapes: Shape[] };

export class CanvasSelectionModel {
  selectedShapes: Shape[] = [];
  selectedIndices: number[] = [];

  /**
   * Apply an operation to selectedShapes.
   * This does NOT automatically rebuild indices; call syncIndices(...) after selection changes.
   */
  apply(op: SelectionOperation) {
    switch (op.type) {
      case 'replace':
        this.selectedShapes = op.shapes.slice();
        break;

      case 'add':
        for (const s of op.shapes) {
          if (!this.selectedShapes.includes(s)) this.selectedShapes.push(s);
        }
        break;

      case 'toggle':
        for (const s of op.shapes) {
          const idx = this.selectedShapes.indexOf(s);
          if (idx >= 0) this.selectedShapes.splice(idx, 1);
          else this.selectedShapes.push(s);
        }
        break;
    }
  }

  /**
   * Recompute selectedIndices against the provided shapes array.
   */
  syncIndices(shapes: Shape[]) {
    this.selectedIndices = this.selectedShapes
      .map(s => shapes.indexOf(s))
      .filter(i => i !== -1);
  }

  /**
   * After shapes are replaced with new instances (e.g. transform commit),
   * remap the selection to the new instances.
   */
  remapAfterShapeReplacement(oldToNew: Map<Shape, Shape>, shapes: Shape[]) {
    this.selectedShapes = this.selectedShapes
      .map(s => oldToNew.get(s) ?? s)
      .filter(s => shapes.includes(s));
    this.syncIndices(shapes);
  }

  /**
   * Convenience helpers.
   */
  includes(shape: Shape) {
    return this.selectedShapes.includes(shape);
  }

  /** Selection as concrete shapes, based on current indices. */
  public getSelectedShapes(allShapes: Shape[]): Shape[] {
    return (this.selectedIndices ?? [])
      .map(i => allShapes[i])
      .filter(Boolean);
  }

   /** Compute a world-space bounding box for an explicit set of shapes. */
  private computeGroupBoundingBox(shapes: Shape[]): Rectangle | null {
    if (!shapes.length) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const s of shapes) {
      const bb = (s as any).getBoundingBox?.();
      if (!bb) continue;

      const x = bb.topLeft.x.toUnit('px');
      const y = bb.topLeft.y.toUnit('px');
      const w = bb.width.toUnit('px');
      const h = bb.height.toUnit('px');

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    if (minX === Infinity) return null;

    return new Rectangle(
      new Point(Measurement.fromPx(minX), Measurement.fromPx(minY)),
      Measurement.fromPx(maxX - minX),
      Measurement.fromPx(maxY - minY)
    );
  }

  /** World-space group bounding box of the CURRENT selection (uses selectedIndices). */
  public getGroupBoundingBox(allShapes: Shape[]): Rectangle | null {
    const shapes = this.getSelectedShapes(allShapes);
    return this.computeGroupBoundingBox(shapes);
  }

  /** World-space group box for an arbitrary overlay list + indices. */
  public getGroupBoundingBoxFor(shapesForOverlay: Shape[], indices: number[]): Rectangle | null {
    const selected = indices.map(i => shapesForOverlay[i]).filter(Boolean) as Shape[];
    return this.computeGroupBoundingBox(selected);
  }

  
  isSelected(shape: Shape): boolean {
    return this.includes(shape);
  }
}
