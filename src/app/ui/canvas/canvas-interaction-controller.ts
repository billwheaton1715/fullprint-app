import Shape from '../../core/geometry/Shape';
import Measurement from '../../core/units/Measurement';

export type DragInteraction =
  | { type: 'drag-shape'; original: Shape; startWorldX: number; startWorldY: number }
  | { type: 'drag-select'; wx0: number; wy0: number; wx1: number; wy1: number; shift: boolean };


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


    this.activeInteraction = {
      type: 'drag-select',
      wx0: ctx.worldX,
      wy0: ctx.worldY,
      wx1: ctx.worldX,
      wy1: ctx.worldY,
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
