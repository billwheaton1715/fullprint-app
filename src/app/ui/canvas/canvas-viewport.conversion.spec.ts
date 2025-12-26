// ...existing code...
import { CanvasViewport } from './canvas-viewport';

describe('CanvasViewport conversions', () => {
  it('worldToScreen and screenToWorld are inverses (simple)', () => {
    const v = new CanvasViewport({ scale: 2, offsetX: 10, offsetY: -5 } as any);
    const wx = 50; const wy = 20; // world px
    const screen = v.worldToScreen(wx, wy);
    const back = v.screenToWorld(screen.xPx, screen.yPx);
    expect(back.xPx).toBeCloseTo(wx);
    expect(back.yPx).toBeCloseTo(wy);
  });
});
