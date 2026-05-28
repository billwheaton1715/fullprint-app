import Shape from '../../core/geometry/Shape';
import { CanvasInteractionController } from './canvas-interaction-controller';
import { CanvasHitTestController } from './canvas-hit-test-controller';

export class CanvasMarqueeController {
  constructor(
    private readonly interaction: CanvasInteractionController,
    private readonly hitTest: CanvasHitTestController
  ) {}

  /** Called after interaction.pointerMove() says kind==='drag-select' and past threshold */
  updatePreview(shapes: Shape[], worldX: number, worldY: number): boolean {
    const a = this.interaction.activeInteraction;
    if (!a || a.type !== 'drag-select') return false;

    // update rect end
    a.wx1 = worldX;
    a.wy1 = worldY;

    const x0 = Math.min(a.wx0, a.wx1);
    const y0 = Math.min(a.wy0, a.wy1);
    const x1 = Math.max(a.wx0, a.wx1);
    const y1 = Math.max(a.wy0, a.wy1);

    const next = this.hitTest.hitTestIntersectingRectIndices(shapes, x0, y0, x1, y1);

    // avoid redraw if nothing changed
    const prev = this.interaction.previewSelectedIndices;
    const same =
      prev?.length === next.length && prev.every((v, i) => v === next[i]);

    if (!same) this.interaction.previewSelectedIndices = next;
    return !same;
  }

  /** Called on pointerUp to get final selected shapes */
  computeSelected(shapes: Shape[]): Shape[] {
    const a = this.interaction.activeInteraction;
    if (!a || a.type !== 'drag-select') return [];

    const x0 = Math.min(a.wx0, a.wx1);
    const y0 = Math.min(a.wy0, a.wy1);
    const x1 = Math.max(a.wx0, a.wx1);
    const y1 = Math.max(a.wy0, a.wy1);

    return this.hitTest.hitTestIntersectingRect(shapes, x0, y0, x1, y1);
  }

  getDragRect(): { x0: number; y0: number; x1: number; y1: number } | null {
    const a = this.interaction.activeInteraction;
    if (!a || a.type !== 'drag-select') return null;
    return { x0: a.wx0, y0: a.wy0, x1: a.wx1, y1: a.wy1 };
  }

  clearPreview() {
    this.interaction.previewSelectedIndices = null;
  }

  /** helper: are we currently doing marquee? */
  isActive(): boolean {
    return this.interaction.activeInteraction?.type === 'drag-select';
  }

  /** helper: shift state belongs to interaction */
  getShift(): boolean {
    const a = this.interaction.activeInteraction;
    return !!a && a.type === 'drag-select' ? a.shift : false;
  }
}
