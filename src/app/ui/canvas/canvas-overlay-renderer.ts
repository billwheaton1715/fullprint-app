import Shape from '../../core/geometry/Shape';
import Measurement from '../../core/units/Measurement';
import { Point } from '../../core/geometry/Point';
import { Rectangle } from '../../core/geometry/Rectangle';
import { CanvasViewport } from './canvas-viewport';

export type DragSelectRect = { x0: number; y0: number; x1: number; y1: number } | null;

export interface CanvasOverlayState {
  viewport: CanvasViewport;

  // What we're drawing overlays against (preview or committed shapes)
  shapesForOverlay: Shape[];

  // Indices into shapesForOverlay that are "selected" (your existing model)
  selectedIndices: number[];

  // Optional hover shape
  hoveredShape: Shape | null;

  // Pointer screen coords (for crosshairs)
  pointerScreen: { sx: number; sy: number } | null;

  // Flags
  showGrid: boolean;
  showBoundingBoxes: boolean;

  // Drag-select marquee rect in WORLD coords (px), since overlays render under viewport transform
  dragSelectRect: DragSelectRect;

  groupBoundingBox?: Rectangle | null;
}

export class CanvasOverlayRenderer {
  draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: CanvasOverlayState) {
    const { viewport, shapesForOverlay } = state;
    const { topLeft, bottomRight } = viewport.getVisibleWorldRect(canvas);

    // Grid
    if (state.showGrid) {
      const spacingPx = Measurement.fromMm(1).toUnit('px');
      const startX = Math.floor(topLeft.xPx / spacingPx) * spacingPx;
      const endX = Math.ceil(bottomRight.xPx / spacingPx) * spacingPx;
      const startY = Math.floor(topLeft.yPx / spacingPx) * spacingPx;
      const endY = Math.ceil(bottomRight.yPx / spacingPx) * spacingPx;

      ctx.save();
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 1 / (viewport.getScale() || 1);

      for (let x = startX; x <= endX; x += spacingPx) {
        ctx.beginPath();
        ctx.moveTo(x, topLeft.yPx - spacingPx);
        ctx.lineTo(x, bottomRight.yPx + spacingPx);
        ctx.stroke();
      }
      for (let y = startY; y <= endY; y += spacingPx) {
        ctx.beginPath();
        ctx.moveTo(topLeft.xPx - spacingPx, y);
        ctx.lineTo(bottomRight.xPx + spacingPx, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Bounding boxes
    if (state.showBoundingBoxes) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1 / (viewport.getScale() || 1);
      for (const s of shapesForOverlay || []) {
        try {
          if (s && typeof (s as any).getBoundingBox === 'function') {
            const bb = (s as any).getBoundingBox();
            ctx.strokeRect(
              bb.topLeft.x.toUnit('px'),
              bb.topLeft.y.toUnit('px'),
              bb.width.toUnit('px'),
              bb.height.toUnit('px')
            );
          }
        } catch {}
      }
      ctx.restore();
    }

    // Selection outlines + handles
    if (shapesForOverlay && shapesForOverlay.length) {
      const groupBox = state.groupBoundingBox;

      if (groupBox) {
        ctx.save();
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = '#0078D7';
        ctx.lineWidth = 2 / (viewport.getScale() || 1);

        const x = groupBox.topLeft.x.toUnit('px');
        const y = groupBox.topLeft.y.toUnit('px');
        const w = groupBox.width.toUnit('px');
        const h = groupBox.height.toUnit('px');

        ctx.strokeRect(x, y, w, h);

        const handles = [
          new Point(Measurement.fromPx(x), Measurement.fromPx(y)),
          new Point(Measurement.fromPx(x + w / 2), Measurement.fromPx(y)),
          new Point(Measurement.fromPx(x + w), Measurement.fromPx(y)),
          new Point(Measurement.fromPx(x + w), Measurement.fromPx(y + h / 2)),
          new Point(Measurement.fromPx(x + w), Measurement.fromPx(y + h)),
          new Point(Measurement.fromPx(x + w / 2), Measurement.fromPx(y + h)),
          new Point(Measurement.fromPx(x), Measurement.fromPx(y + h)),
          new Point(Measurement.fromPx(x), Measurement.fromPx(y + h / 2))
        ];

        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#0078D7';
        for (const pt of handles) {
          ctx.beginPath();
          ctx.arc(pt.x.toUnit('px'), pt.y.toUnit('px'), 6, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }

        const rotHandle = new Point(Measurement.fromPx(x + w / 2), Measurement.fromPx(y - 24));
        ctx.beginPath();
        ctx.arc(rotHandle.x.toUnit('px'), rotHandle.y.toUnit('px'), 7, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffe';
        ctx.strokeStyle = '#f80';
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }

      // Per-shape selected outlines (your red outline)
      ctx.save();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2 / (viewport.getScale() || 1);

      state.selectedIndices.forEach(i => {
        const s = shapesForOverlay[i];
        if (!s) return;
        try { (s as any).toCanvas(ctx); } catch {}
      });

      ctx.restore();
    }

    // Hover outline (only when not selected)
    const isHoveringSelectable =
      state.hoveredShape &&
      (!state.selectedIndices.length || !shapesForOverlay || !state.selectedIndices
        .map(i => shapesForOverlay[i])
        .includes(state.hoveredShape));

    if (isHoveringSelectable && state.hoveredShape) {
      ctx.save();
      ctx.strokeStyle = '#00aaff';
      ctx.lineWidth = 1 / (viewport.getScale() || 1);
      try { (state.hoveredShape as any).toCanvas(ctx); } catch {}
      ctx.restore();
    }

    // Drag-select marquee
    if (state.dragSelectRect) {
      const r = state.dragSelectRect;
      ctx.save();
      ctx.strokeStyle = '#0078D7';
      ctx.setLineDash([4, 2]);
      ctx.lineWidth = 1.5 / (viewport.getScale() || 1);
      const x0 = Math.min(r.x0, r.x1);
      const y0 = Math.min(r.y0, r.y1);
      const x1 = Math.max(r.x0, r.x1);
      const y1 = Math.max(r.y0, r.y1);

      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

      ctx.restore();
    }

    // Crosshair
    if (state.pointerScreen) {
      const world = viewport.screenToWorld(state.pointerScreen.sx, state.pointerScreen.sy);
      const wx = world.xPx;
      const wy = world.yPx;

      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1 / (viewport.getScale() || 1);

      const snapX = Math.round(wx);
      const snapY = Math.round(wy);

      ctx.beginPath();
      ctx.moveTo(snapX, topLeft ? topLeft.yPx - 10000 : -10000);
      ctx.lineTo(snapX, bottomRight ? bottomRight.yPx + 10000 : 10000);
      ctx.moveTo(topLeft ? topLeft.xPx - 10000 : -10000, snapY);
      ctx.lineTo(bottomRight ? bottomRight.xPx + 10000 : 10000, snapY);
      ctx.stroke();

      ctx.restore();
    }
  }


}
