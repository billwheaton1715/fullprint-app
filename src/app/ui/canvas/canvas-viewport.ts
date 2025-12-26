export class CanvasViewport {
  /**
   * Get the current scale (zoom factor).
   */
  getScale(): number {
    return this.scale;
  }

  /**
   * Get the current horizontal offset.
   */
  getOffsetX(): number {
    return this.offsetX;
  }

  /**
   * Get the current vertical offset.
   */
  getOffsetY(): number {
    return this.offsetY;
  }
    /**
     * Convert a MouseEvent or PointerEvent to screen coordinates relative to the canvas.
     */
    getScreenCoordsFromEvent(e: MouseEvent | PointerEvent, canvas: HTMLCanvasElement): { sx: number, sy: number } {
      const rect = canvas.getBoundingClientRect();
      return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
    }

    /**
     * Convert a screen rectangle (sx0, sy0, sx1, sy1) to a world rectangle in px.
     */
    screenRectToWorldRect(sx0: number, sy0: number, sx1: number, sy1: number) {
      const tl = this.screenToWorld(sx0, sy0);
      const br = this.screenToWorld(sx1, sy1);
      return { xMin: Math.min(tl.xPx, br.xPx), xMax: Math.max(tl.xPx, br.xPx), yMin: Math.min(tl.yPx, br.yPx), yMax: Math.max(tl.yPx, br.yPx) };
    }

    /**
     * Get the world rectangle (in px) for the visible canvas area.
     */
    getVisibleWorldRect(canvas: HTMLCanvasElement) {
      const rect = canvas.getBoundingClientRect();
      return {
        topLeft: this.screenToWorld(0, 0),
        bottomRight: this.screenToWorld(rect.width, rect.height)
      };
    }
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

  /**
   * Convert screen (CSS) coordinates to world `Measurement` coordinates.
   * Returns an object with Measurements in mm.
   */
  screenToWorld(sx: number, sy: number) {
    const worldPxX = (sx - this.offsetX) / this.scale;
    const worldPxY = (sy - this.offsetY) / this.scale;
    // Measurements expect pixels -> convert px to Measurement
    // Use Measurement.fromPx when creating Points elsewhere; here we return raw px pair
    return { xPx: worldPxX, yPx: worldPxY };
  }

  /**
   * Convert a world point expressed in pixels (px) to screen CSS pixels.
   */
  worldToScreen(wxPx: number, wyPx: number) {
    const sx = wxPx * this.scale + this.offsetX;
    const sy = wyPx * this.scale + this.offsetY;
    return { xPx: sx, yPx: sy };
  }
}
