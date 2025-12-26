// ...existing code...
import { CanvasViewport } from './canvas-viewport';

describe('CanvasViewport', () => {
  it('should pan by the given offsets', () => {
    const viewport = new CanvasViewport();
    expect(viewport.offsetX).toBe(0);
    expect(viewport.offsetY).toBe(0);
    viewport.panBy(15, -7);
    expect(viewport.offsetX).toBe(15);
    expect(viewport.offsetY).toBe(-7);
  });

  it('should zoom at a given screen point and update offset correctly', () => {
    const viewport = new CanvasViewport();
    viewport.setOffset(0, 0);
    viewport.setScale(1);
    viewport.zoomAt(2, 50, 25);
    expect(viewport.scale).toBeCloseTo(2);
    expect(viewport.offsetX).toBeCloseTo(-50);
    expect(viewport.offsetY).toBeCloseTo(-25);
  });

  it('should preserve math when zooming then panning', () => {
    const viewport = new CanvasViewport();
    viewport.setOffset(10, 20);
    viewport.setScale(1);
    viewport.zoomAt(2, 5, 5);
    // offsetX: 10*2 + 5*(1-2) = 20 - 5 = 15
    expect(viewport.offsetX).toBeCloseTo(15);
    expect(viewport.scale).toBeCloseTo(2);
    viewport.panBy(3, -2);
    expect(viewport.offsetX).toBeCloseTo(18);
    // offsetY: 20*2 + 5*(1-2) = 40 - 5 = 35, then +(-2) = 33
    expect(viewport.offsetY).toBeCloseTo(33);
  });

  it('should convert between screen and world coordinates', () => {
    const viewport = new CanvasViewport();
    viewport.setOffset(10, 20);
    viewport.setScale(2);

    // worldToScreen
    const { xPx: sx, yPx: sy } = viewport.worldToScreen(5, 7);
    expect(sx).toBeCloseTo(5 * 2 + 10);
    expect(sy).toBeCloseTo(7 * 2 + 20);

    // screenToWorld
    const { xPx: wx, yPx: wy } = viewport.screenToWorld(30, 34);
    expect(wx).toBeCloseTo((30 - 10) / 2);
    expect(wy).toBeCloseTo((34 - 20) / 2);
  });
});
