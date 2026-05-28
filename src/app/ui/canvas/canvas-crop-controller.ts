import { ImageShape, CropRect } from '../../core/geometry/ImageShape';

export type CropHandleId =
  | 'nw' | 'n' | 'ne'
  | 'e'  | 'se'| 's'
  | 'sw' | 'w' | 'move';

export interface CropHandle {
  id: CropHandleId;
  x: number;   // world px
  y: number;   // world px
}

/**
 * Manages the non-destructive crop editing interaction.
 *
 * Coordinate system: all world-space values are in world-pixels (same units
 * as CanvasViewport.screenToWorld).  Because images are imported at 1:1 scale
 * (1 world-px = 1 natural image pixel), cropRect values (sx/sy/sw/sh) can be
 * used directly as world-px offsets from the full image origin.
 *
 * Usage:
 *   enter(shape)       → activate crop mode for an ImageShape
 *   pointerDown(x,y,s) → returns which part was hit
 *   pointerMove(x,y)   → updates liveRect while dragging
 *   pointerUp()        → ends drag (liveRect stays as-is)
 *   getLiveCrop()      → CropRect to commit
 *   exit()             → deactivate
 */
export class CanvasCropController {
  private _active    = false;
  private _target:   ImageShape | null = null;
  private _liveRect: CropRect   | null = null;

  // Full image origin in world px (constant while editing a given shape)
  private _fullOriginX = 0;
  private _fullOriginY = 0;

  // Drag state
  private _dragHandle:    CropHandleId | null = null;
  private _dragStartPx:   { x: number; y: number } | null = null;
  private _dragStartRect: CropRect | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  get isActive(): boolean       { return this._active; }
  get target():   ImageShape | null { return this._target; }
  get liveRect(): CropRect   | null { return this._liveRect; }

  enter(shape: ImageShape): void {
    const origin = shape.getFullImageOriginPx();
    this._target      = shape;
    this._active      = true;
    this._fullOriginX = origin.x;
    this._fullOriginY = origin.y;

    // Initialise live rect to current crop, or full image if not yet cropped.
    this._liveRect = shape.cropRect
      ? { ...shape.cropRect }
      : { sx: 0, sy: 0, sw: shape.image.naturalWidth, sh: shape.image.naturalHeight };

    this._dragHandle    = null;
    this._dragStartPx   = null;
    this._dragStartRect = null;
  }

  exit(): void {
    this._active        = false;
    this._target        = null;
    this._liveRect      = null;
    this._dragHandle    = null;
    this._dragStartPx   = null;
    this._dragStartRect = null;
  }

  // ── World-space geometry helpers ──────────────────────────────────────────

  /** World-px rect of the full (uncropped) image. */
  getFullImageWorldRect(): { x: number; y: number; w: number; h: number } {
    const img = this._target!.image;
    return { x: this._fullOriginX, y: this._fullOriginY,
             w: img.naturalWidth,  h: img.naturalHeight };
  }

  /** World-px rect of the current live crop. */
  getLiveCropWorldRect(): { x: number; y: number; w: number; h: number } {
    const r = this._liveRect!;
    return { x: this._fullOriginX + r.sx, y: this._fullOriginY + r.sy,
             w: r.sw, h: r.sh };
  }

  /** 8 resize handles for the live crop rect, in world px. */
  getHandles(): CropHandle[] {
    const { x, y, w, h } = this.getLiveCropWorldRect();
    return [
      { id: 'nw', x,           y           },
      { id: 'n',  x: x + w/2,  y           },
      { id: 'ne', x: x + w,    y           },
      { id: 'e',  x: x + w,    y: y + h/2  },
      { id: 'se', x: x + w,    y: y + h    },
      { id: 's',  x: x + w/2,  y: y + h    },
      { id: 'sw', x,           y: y + h    },
      { id: 'w',  x,           y: y + h/2  },
    ];
  }

  // ── Pointer interaction ────────────────────────────────────────────────────

  /**
   * Returns 'handle' | 'move' | 'none'.
   * Call before forwarding the event to the normal interaction system.
   */
  pointerDown(worldX: number, worldY: number, viewportScale: number): 'handle' | 'move' | 'none' {
    const hitHandle = this._hitTestHandle(worldX, worldY, viewportScale);
    if (hitHandle) {
      this._dragHandle    = hitHandle;
      this._dragStartPx   = { x: worldX, y: worldY };
      this._dragStartRect = { ...this._liveRect! };
      return 'handle';
    }
    if (this._hitTestInside(worldX, worldY)) {
      this._dragHandle    = 'move';
      this._dragStartPx   = { x: worldX, y: worldY };
      this._dragStartRect = { ...this._liveRect! };
      return 'move';
    }
    return 'none';
  }

  pointerMove(worldX: number, worldY: number): void {
    if (!this._dragHandle || !this._dragStartPx || !this._dragStartRect) return;

    const img  = this._target!.image;
    const maxW = img.naturalWidth;
    const maxH = img.naturalHeight;
    const dx   = worldX - this._dragStartPx.x;
    const dy   = worldY - this._dragStartPx.y;
    const r    = { ...this._dragStartRect };

    if (this._dragHandle === 'move') {
      r.sx = Math.round(Math.max(0, Math.min(maxW - r.sw, r.sx + dx)));
      r.sy = Math.round(Math.max(0, Math.min(maxH - r.sh, r.sy + dy)));
    } else {
      const id = this._dragHandle;

      if (id.includes('w')) {
        const rawSx = r.sx + dx;
        const newSx = Math.round(Math.max(0, Math.min(r.sx + r.sw - 1, rawSx)));
        r.sw = r.sw + r.sx - newSx;
        r.sx = newSx;
      }
      if (id.includes('e')) {
        r.sw = Math.round(Math.max(1, Math.min(maxW - r.sx, r.sw + dx)));
      }
      if (id.includes('n')) {
        const rawSy = r.sy + dy;
        const newSy = Math.round(Math.max(0, Math.min(r.sy + r.sh - 1, rawSy)));
        r.sh = r.sh + r.sy - newSy;
        r.sy = newSy;
      }
      if (id.includes('s')) {
        r.sh = Math.round(Math.max(1, Math.min(maxH - r.sy, r.sh + dy)));
      }
    }
    this._liveRect = r;
  }

  pointerUp(): void {
    this._dragHandle    = null;
    this._dragStartPx   = null;
    this._dragStartRect = null;
  }

  /** The crop rect to pass to CropImageCommand on commit. */
  getLiveCrop(): CropRect {
    return { ...this._liveRect! };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _hitTestHandle(worldX: number, worldY: number, scale: number): CropHandleId | null {
    const radius = 10 / scale;   // 10 screen-px hit area
    for (const h of this.getHandles()) {
      const dx = worldX - h.x;
      const dy = worldY - h.y;
      if (dx * dx + dy * dy <= radius * radius) return h.id;
    }
    return null;
  }

  private _hitTestInside(worldX: number, worldY: number): boolean {
    const { x, y, w, h } = this.getLiveCropWorldRect();
    return worldX >= x && worldX <= x + w && worldY >= y && worldY <= y + h;
  }
}
