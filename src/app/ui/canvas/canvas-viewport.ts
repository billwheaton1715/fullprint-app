export class CanvasViewport {
  scale = 1;
  offsetX = 0;
  offsetY = 0;

  constructor(init?: Partial<CanvasViewport>) {
    if (init) Object.assign(this, init);
  }

  setScale(s: number) {
    this.scale = s;
  }

  setOffset(x: number, y: number) {
    this.offsetX = x;
    this.offsetY = y;
  }

  /**
   * Zoom centered on screen coordinates (sx, sy).
   * factor > 1 zooms in, factor < 1 zooms out.
   */
  zoomAt(factor: number, sx: number, sy: number) {
    // offsets are in screen pixel coordinates
    // newOffset = oldOffset * factor + screen * (1 - factor)
    this.offsetX = this.offsetX * factor + sx * (1 - factor);
    this.offsetY = this.offsetY * factor + sy * (1 - factor);
    this.scale = this.scale * factor;
  }

  panBy(dx: number, dy: number) {
    this.offsetX += dx;
    this.offsetY += dy;
  }

  applyToContext(ctx: CanvasRenderingContext2D, dpr: number = 1) {
    // Set full transform including devicePixelRatio to map world->device pixels
    ctx.setTransform(this.scale * dpr, 0, 0, this.scale * dpr, this.offsetX * dpr, this.offsetY * dpr);
  }
}
