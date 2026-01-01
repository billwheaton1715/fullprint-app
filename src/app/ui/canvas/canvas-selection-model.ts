import Shape from '../../core/geometry/Shape';

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
}
