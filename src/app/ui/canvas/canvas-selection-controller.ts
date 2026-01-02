import Shape from '../../core/geometry/Shape';
import { CanvasSelectionModel } from './canvas-selection-model';
import { Rectangle } from '../../core/geometry/Rectangle';

export class CanvasSelectionController {
constructor(private readonly model: CanvasSelectionModel) {}

  /** Pointer down on a shape */
  pointerDownOnShape(hit: Shape, shift: boolean) {
    // SHIFT down on a shape is immediate toggle (you’re using this already)
    if (shift) {
      this.model.apply({ type: 'toggle', shapes: [hit] });
      return;
    }

    // non-shift pointer-down on shape: ensure selected-for-drag
    if (!this.model.isSelected(hit)) {
      this.model.apply({ type: 'replace', shapes: [hit] });
    }
  }
  

  /** Pointer down on empty canvas */
  pointerDownOnEmpty(shift: boolean) {
    // click empty clears unless shift
    if (!shift) this.model.apply({ type: 'replace', shapes: [] });
  }

  /** Click on shape */
  clickOnShape(hit: Shape, shift: boolean) {
    this.model.apply({ 
      type: shift ? 'toggle' : 'replace', 
      shapes: [hit] 
    });
  }


  /** Commit marquee selection */
  commitMarquee(selected: Shape[], shift: boolean) {
    this.model.apply({ type: shift ? 'add' : 'replace', shapes: selected });
  }


  remapAfterShapeReplacement(oldToNew: Map<Shape, Shape>, allShapes: Shape[]) {
    this.model.remapAfterShapeReplacement(oldToNew, allShapes);
  }
  /** Accessors */
  getSelectedShapes(): Shape[] {
    return [...this.model.selectedShapes];
  }

  syncIndices(allShapes: Shape[]) {
    this.model.syncIndices(allShapes);
  }

  isSelected(shape: Shape): boolean {
    return this.model.isSelected(shape);
  }

  

  /**
   * Drag targets rule:
   * - if original is selected AND multiple are selected => drag the whole selected set
   * - else => drag only original
   */
  getDragTargets(original: Shape): Shape[] {
    const selected = this.model.selectedShapes;
    if (selected.length > 1 && this.model.isSelected(original)) return selected;
    return [original];
  }

  getSelectedIndices(): number[] {
    return [...this.model.selectedIndices];
  }


  /**
   * Group box for a given overlay list + indices.
   * This avoids CanvasTab needing to call selection.getGroupBoundingBox directly.
   *
   * This assumes your CanvasSelectionModel has:
   *   getGroupBoundingBoxFor(shapesForOverlay: Shape[], indices: number[]): Rectangle | null
   * If it doesn’t yet, I’ll show the tiny model change below.
   */
  getGroupBoundingBoxFor(shapesForOverlay: Shape[], indices: number[]): Rectangle | null {
    return this.model.getGroupBoundingBoxFor(shapesForOverlay, indices);
  }
  /** Marquee preview: get indices of shapes within given world px rect */
  previewMarqueeIndices(shapes: Shape[], x0: number, y0: number, x1: number, y1: number): number[] {
    // x0..y1 are WORLD px bounds
    const hits: number[] = [];

    for (let i = 0; i < shapes.length; i++) {
      const s = shapes[i];
      const bb = (s as any).getBoundingBox?.();
      if (!bb) continue;

      const bx0 = bb.topLeft.x.toUnit('px');
      const by0 = bb.topLeft.y.toUnit('px');
      const bx1 = bx0 + bb.width.toUnit('px');
      const by1 = by0 + bb.height.toUnit('px');

      const intersects = !(bx1 < x0 || bx0 > x1 || by1 < y0 || by0 > y1);
      if (intersects) hits.push(i);
    }

    return hits;
  }

  getShapesByIndices(allShapes: Shape[], indices: number[]): Shape[] {
    return indices.map(i => allShapes[i]).filter(Boolean) as Shape[];
  }

}
