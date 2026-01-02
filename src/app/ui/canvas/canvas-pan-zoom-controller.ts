import { CanvasViewport } from './canvas-viewport';

export class CanvasPanZoomController {
  private isPanning = false;
  private lastClientX = 0;
  private lastClientY = 0;

  constructor(private readonly viewport: CanvasViewport) {}

  /** Middle button down starts pan */
  pointerDown(e: PointerEvent): boolean {
    if (e.button !== 1) return false;
    this.isPanning = true;
    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
    return true;
  }

  /** Move while panning */
  pointerMove(e: PointerEvent): boolean {
    if (!this.isPanning) return false;

    const dx = e.clientX - this.lastClientX;
    const dy = e.clientY - this.lastClientY;

    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;

    //if (dx === 0 && dy === 0) return false;

    this.viewport.panBy(dx, dy);
    return true;
  }

  /** Any pointer up ends pan (or you can gate on button if you prefer) */
  pointerUp(_e: PointerEvent): boolean {
    if (!this.isPanning) return false;
    this.isPanning = false;
    return false;
  }

  /** Wheel zoom at screen anchor */
  wheel(e: WheelEvent, sx: number, sy: number): boolean {
    // your existing delta policy
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.viewport.zoomAt(delta, sx, sy);
    return true;
  }

  getIsPanning() {
    return this.isPanning;
  }
}
