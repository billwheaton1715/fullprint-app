import Shape from '../../core/geometry/Shape';
import { CanvasInteractionController } from './canvas-interaction-controller';
import { CanvasHitTestController } from './canvas-hit-test-controller';

export class CanvasMarqueeController {
  constructor(
    private readonly interaction: CanvasInteractionController,
    private readonly hitTest: CanvasHitTestController
  ) {}

  /** Returns true if it started a drag-select interaction */
  pointerDown(hit: Shape | null, worldX: number, worldY: number, shift: boolean): boolean {
    // only start marquee on empty space
    if (hit) return false;

    // assumes your interaction.pointerDown already created activeInteraction with wx0/wy0/etc
    // If not, we can create it here instead.
    const a = this.interaction.activeInteraction;
    return !!a && a.type === 'drag-select';
  }

  /** Returns true if it updated preview indices / rect and needs render */
  pointerMove(shapes: Shape[], worldX: number, worldY: number): boolean {
    const a = this.interaction.activeInteraction;
    if (!a || a.type !== 'drag-select') return false;

    // respect threshold logic that lives in interaction controller
    // (interaction.pointerMove should have been called before this)
    // so only render once it’s “real”
    if (!this.interaction.didDrag) return false;

    a.wx1 = worldX;
    a.wy1 = worldY;

    const x0 = Math.min(a.wx0, a.wx1);
    const y0 = Math.min(a.wy0, a.wy1);
    const x1 = Math.max(a.wx0, a.wx1);
    const y1 = Math.max(a.wy0, a.wy1);

    this.interaction.previewSelectedIndices =
      this.hitTest.hitTestIntersectingRectIndices(shapes, x0, y0, x1, y1);

    return true;
  }

  /** Commit is handled by caller (selectionController), but we provide the selected shapes */
  computeSelected(shapes: Shape[]): Shape[] | null {
    const a = this.interaction.activeInteraction;
    if (!a || a.type !== 'drag-select') return null;

    const x0 = Math.min(a.wx0, a.wx1);
    const y0 = Math.min(a.wy0, a.wy1);
    const x1 = Math.max(a.wx0, a.wx1);
    const y1 = Math.max(a.wy0, a.wy1);

    return this.hitTest.hitTestIntersectingRect(shapes, x0, y0, x1, y1);
  }

  /** For overlay renderer */
  getDragRect(): { x0: number; y0: number; x1: number; y1: number } | null {
    const a = this.interaction.activeInteraction;
    if (!a || a.type !== 'drag-select') return null;
    return { x0: a.wx0, y0: a.wy0, x1: a.wx1, y1: a.wy1 };
  }

  clearPreview() {
    this.interaction.previewSelectedIndices = null;
  }
}
