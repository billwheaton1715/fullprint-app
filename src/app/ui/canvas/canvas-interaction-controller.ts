import Shape from '../../core/geometry/Shape';
import Measurement from '../../core/units/Measurement';

export type DragInteraction =
  | { type: 'drag-shape'; original: Shape; startWorldX: number; startWorldY: number }
  | { type: 'drag-select'; x0: number; y0: number; x1: number; y1: number; shift: boolean };

export interface PointerDownContext {
  sx: number;
  sy: number;
  worldX: number; // world.xPx
  worldY: number; // world.yPx
  button: number;
  shiftKey: boolean;
  pointerId: number;
  hit: Shape | null;
}

export interface PointerMoveContext {
  sx: number;
  sy: number;
  clientX: number;
  clientY: number;
}

export interface PointerUpContext {
  pointerId: number;
}

export interface ClickContext {
  shiftKey: boolean;
  hit: Shape | null;
}

export type InteractionUpdate =
  | { kind: 'none' }
  | { kind: 'render' };

export class CanvasInteractionController {
  // state moved out of the component
  activeInteraction: DragInteraction | null = null;

  didDrag = false;
  suppressNextClickSelection = false;

  // drag threshold
  downScreenX: number | null = null;
  downScreenY: number | null = null;
  dragThresholdPx = 4;

  // drag-shape commit info (still useful even if component commits)
  lastDragDx: Measurement | null = null;
  lastDragDy: Measurement | null = null;

  // preview selection indices (for drag-select)
  previewSelectedIndices: number[] | null = null;

  clearPreview() {
    this.previewSelectedIndices = null;
  } 

  pointerDown(ctx: PointerDownContext): InteractionUpdate {
    // record down coords for thresholding
    this.downScreenX = ctx.sx;
    this.downScreenY = ctx.sy;

    // Left button interactions only here; panning can remain component-owned for now
    if (ctx.button !== 0) return { kind: 'none' };

    if (ctx.hit) {
      // The component will handle selection semantics for now.
      // Controller just establishes drag-shape as the active interaction.
      this.activeInteraction = {
        type: 'drag-shape',
        original: ctx.hit,
        startWorldX: ctx.worldX,
        startWorldY: ctx.worldY
      };
      this.lastDragDx = null;
      this.lastDragDy = null;
      return { kind: 'none' };
    }

    // Empty space starts drag-select
    this.activeInteraction = {
      type: 'drag-select',
      x0: ctx.sx,
      y0: ctx.sy,
      x1: ctx.sx,
      y1: ctx.sy,
      shift: ctx.shiftKey
    };
    this.previewSelectedIndices = null;
    return { kind: 'none' };
  }

  pointerMove(ctx: PointerMoveContext): { kind: 'none' | 'drag-select' | 'drag-shape'; isPastThreshold: boolean } {
    if (!this.activeInteraction) return { kind: 'none', isPastThreshold: false };

    const dx0 = this.downScreenX == null ? 0 : (ctx.sx - this.downScreenX);
    const dy0 = this.downScreenY == null ? 0 : (ctx.sy - this.downScreenY);
    const isPastThreshold = (dx0 * dx0 + dy0 * dy0) >= (this.dragThresholdPx * this.dragThresholdPx);

    if (this.activeInteraction.type === 'drag-select') {
      // update marquee coords regardless; caller may choose to render only after threshold
      this.activeInteraction.x1 = ctx.sx;
      this.activeInteraction.y1 = ctx.sy;
      return { kind: 'drag-select', isPastThreshold };
    }

    return { kind: 'drag-shape', isPastThreshold };
  }

  pointerUp(_ctx: PointerUpContext): InteractionUpdate {
    // end drag states
    this.activeInteraction = null;
    this.previewSelectedIndices = null;

    // clear down coords
    this.downScreenX = null;
    this.downScreenY = null;

    return { kind: 'none' };
  }

  clickShouldBeSuppressed(): boolean {
    if (this.didDrag) {
      this.didDrag = false;
      return true;
    }
    if (this.suppressNextClickSelection) {
      this.suppressNextClickSelection = false;
      return true;
    }
    return false;
  }

  markDidDrag() {
    this.didDrag = true;
  }

  setSuppressNextClickSelection() {
    this.suppressNextClickSelection = true;
  }
}
