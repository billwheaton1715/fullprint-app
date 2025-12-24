import { CanvasViewport } from './canvas-viewport';

describe('CanvasViewport', () => {
  test('panBy updates offsets', () => {
    const v = new CanvasViewport();
    expect(v.offsetX).toBe(0);
    expect(v.offsetY).toBe(0);
    v.panBy(10, 5);
    expect(v.offsetX).toBe(10);
    expect(v.offsetY).toBe(5);
  });

  test('zoomAt centers on cursor', () => {
    const v = new CanvasViewport();
    v.setOffset(0, 0);
    v.setScale(1);
    // zoom in by factor 2 at screen point (100,50)
    v.zoomAt(2, 100, 50);
    expect(v.scale).toBeCloseTo(2);
    // offset should become -100, -50 per formula
    expect(v.offsetX).toBeCloseTo(-100);
    expect(v.offsetY).toBeCloseTo(-50);
  });

  test('zoom then pan preserves math', () => {
    const v = new CanvasViewport();
    v.setOffset(10, 20);
    v.setScale(1);
    v.zoomAt(2, 5, 5);
    // new offset: old*2 + screen*(1-2) = 20 + 5*(-1) = 15
    expect(v.offsetX).toBeCloseTo(15);
    expect(v.scale).toBeCloseTo(2);
    v.panBy(3, -2);
    expect(v.offsetX).toBeCloseTo(18);
    // oldY*2 + 5*(1-2) = 40 -5 = 35 then + (-2) = 33
    expect(v.offsetY).toBeCloseTo(33);
  });
});
