import { Injectable } from '@angular/core';
import { CanvasViewport } from './canvas-viewport';

@Injectable({ providedIn: 'root' })
export class CanvasRendererService {
  render(element: HTMLCanvasElement, shapes: any[], viewport?: CanvasViewport, options?: { background?: string }, overlays?: (ctx: CanvasRenderingContext2D) => void) {
    if (!element) return;
    const ctx = element.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = element.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    // set canvas backing store size
    element.width = Math.round(width * dpr);
    element.height = Math.round(height * dpr);
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;

    // clear entire backing store
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, element.width, element.height);

    if (options?.background) {
      ctx.save();
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, element.width, element.height);
      ctx.restore();
    }

    if (viewport) {
      ctx.save();
      viewport.applyToContext(ctx, dpr);
    }

    for (const s of shapes || []) {
      try {
        if (s && typeof s.toCanvas === 'function') {
          s.toCanvas(ctx);
        } else if (s && s.type) {
          // best-effort: if serialized, try a simple draw hint
          ctx.save();
          ctx.strokeStyle = '#333';
          ctx.strokeRect(0,0,0,0);
          ctx.restore();
        }
      } catch (e) {
        // swallow rendering errors for robustness
        // console.error('render error', e);
      }
    }

    // --- DEBUG: Draw two hardcoded rectangles (render-only, not data-driven) ---
    // ctx.save();
    // ctx.strokeStyle = '#444';
    // ctx.lineWidth = 2;
    // ctx.strokeRect(100, 100, 120, 80); // Rectangle A
    // ctx.strokeRect(260, 140, 120, 80); // Rectangle B
    // ctx.restore();
    // --- END DEBUG RECTANGLES ---

      // call overlay callback while transform still applied
      if (overlays) overlays(ctx);

    if (viewport) ctx.restore();
  }
}
