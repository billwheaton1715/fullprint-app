import { Shape } from '../../core/geometry/Shape';
import { Point } from '../../core/geometry/Point'; 
import { Measurement } from '../../core/units/Measurement';
export class CanvasHitTestController {
  hitTestTopmost(shapes: Shape[], worldX: number, worldY: number): Shape | null {
    const p = new Point(Measurement.fromPx(worldX), Measurement.fromPx(worldY));
    return [...shapes].reverse().find(s => (s as any).containsPoint?.(p)) ?? null;
  }
}
