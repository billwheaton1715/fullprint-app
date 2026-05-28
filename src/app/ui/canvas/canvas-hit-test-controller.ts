import { Shape } from '../../core/geometry/Shape';
import { Point } from '../../core/geometry/Point'; 
import { Measurement } from '../../core/units/Measurement';
export class CanvasHitTestController {
  hitTestTopmost(shapes: Shape[], worldX: number, worldY: number): Shape | null {
    const p = new Point(Measurement.fromPx(worldX), Measurement.fromPx(worldY));
    return [...shapes].reverse().find(s => (s as any).containsPoint?.(p)) ?? null;
  }

  /** Returns all shapes intersecting a world-rect (px). */
  hitTestIntersectingRect(
    shapes: Shape[],
    x0: number, y0: number, x1: number, y1: number
  ): Shape[] {
    const minX = Math.min(x0, x1);
    const minY = Math.min(y0, y1);
    const maxX = Math.max(x0, x1);
    const maxY = Math.max(y0, y1);

    return shapes.filter(s => {
      const bb = (s as any).getBoundingBox?.();
      if (!bb) return false;

      const bx0 = bb.topLeft.x.toUnit('px');
      const by0 = bb.topLeft.y.toUnit('px');
      const bx1 = bx0 + bb.width.toUnit('px');
      const by1 = by0 + bb.height.toUnit('px');

      return !(bx1 < minX || bx0 > maxX || by1 < minY || by0 > maxY);
    });
  }

  /** Returns indices intersecting a world-rect (px). */
  hitTestIntersectingRectIndices(
    shapes: Shape[],
    x0: number, y0: number, x1: number, y1: number
  ): number[] {
    const hits = this.hitTestIntersectingRect(shapes, x0, y0, x1, y1);
    return hits.map(s => shapes.indexOf(s)).filter(i => i !== -1);
  }  
}
