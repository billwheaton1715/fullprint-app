// Jasmine/Karma: No need to import globals
import { CanvasTabComponent } from './canvas-tab.component';
import { CanvasRendererService } from './canvas-renderer.service';
import { Rectangle } from '../../core/geometry/Rectangle';
import { Point } from '../../core/geometry/Point';
import Measurement from '../../core/units/Measurement';
import Circle from '../../core/geometry/Circle';
import Polygon from '../../core/geometry/Polygon';

describe('CanvasTabComponent (modern event & geometry)', () => {
  let comp: CanvasTabComponent;
  let renderer: CanvasRendererService;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    renderer = { render: function() { (renderer.render as any).calls = (renderer.render as any).calls || []; (renderer.render as any).calls.push(arguments); } } as unknown as CanvasRendererService;
    comp = new CanvasTabComponent(renderer);
    canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 200, height: 100 }), writable: true });
    comp.canvasRef = { nativeElement: canvas } as any;
    comp.shapes = [];
    comp.ngAfterViewInit();
  });

  afterEach(() => {
    if (typeof comp.ngOnDestroy === 'function') comp.ngOnDestroy();
  });

  it('zooms viewport on wheel event', () => {
    const before = (comp as any).viewport.scale;
    const ev = new WheelEvent('wheel', { deltaY: -120, clientX: 100, clientY: 50, bubbles: true });
    canvas.dispatchEvent(ev);
    const after = (comp as any).viewport.scale;
    expect(after).toBeGreaterThan(before);
    expect((renderer.render as any).calls.length).toBeGreaterThanOrEqual(1);
  });

  it('pans viewport with pointer drag', () => {
    const v = (comp as any).viewport;
    expect(v.offsetX).toBe(0);
    expect(v.offsetY).toBe(0);
    const pointerId = 10;
    const down = new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 1, pointerId, buttons: 1 });
    canvas.dispatchEvent(down);
    const move = new PointerEvent('pointermove', { clientX: 30, clientY: 25, pointerId, buttons: 1 });
    window.dispatchEvent(move);
    const up = new PointerEvent('pointerup', { clientX: 30, clientY: 25, pointerId, buttons: 0 });
    window.dispatchEvent(up);
    expect(v.offsetX).not.toBe(0);
    expect(v.offsetY).not.toBe(0);
    expect((renderer.render as any).calls.length).toBeGreaterThanOrEqual(2);
  });

  it('selects a shape on click', () => {
    // Add a rectangle at (20,20)-(60,60)
    const rect = new Rectangle(new Point(Measurement.fromPx(20), Measurement.fromPx(20)), Measurement.fromPx(40), Measurement.fromPx(40));
    comp.shapes = [rect];
    comp.ngOnChanges({ shapes: { currentValue: comp.shapes, previousValue: [], firstChange: true, isFirstChange: () => true } });
    // Click inside the rectangle
    const click = new MouseEvent('click', { clientX: 40, clientY: 40 });
    canvas.dispatchEvent(click);
    expect(comp.selectedShapes.length).toBe(1);
    expect(comp.selectedShapes[0]).toBe(rect);
  });

  it('toggles selection with shift+click', () => {
    const rect = new Rectangle(new Point(Measurement.fromPx(10), Measurement.fromPx(10)), Measurement.fromPx(30), Measurement.fromPx(30));
    const circ = new Circle(new Point(Measurement.fromPx(80), Measurement.fromPx(80)), Measurement.fromPx(15));
    comp.shapes = [rect, circ];
    comp.ngOnChanges({ shapes: { currentValue: comp.shapes, previousValue: [], firstChange: true, isFirstChange: () => true } });
    // Select rect
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 20, clientY: 20 }));
    expect(comp.selectedShapes).toEqual([rect]);
    // Shift+click circ
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 80, clientY: 80, shiftKey: true }));
    expect(comp.selectedShapes).toContain(rect);
    expect(comp.selectedShapes).toContain(circ);
    // Shift+click rect again to deselect
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 20, clientY: 20, shiftKey: true }));
    expect(comp.selectedShapes).toEqual([circ]);
  });

  it('drag-selects multiple shapes', () => {
    const rect = new Rectangle(new Point(Measurement.fromPx(10), Measurement.fromPx(10)), Measurement.fromPx(30), Measurement.fromPx(30));
    const circ = new Circle(new Point(Measurement.fromPx(80), Measurement.fromPx(80)), Measurement.fromPx(15));
    comp.shapes = [rect, circ];
    comp.ngOnChanges({ shapes: { currentValue: comp.shapes, previousValue: [], firstChange: true, isFirstChange: () => true } });
    const pointerId = 11;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, clientY: 0, pointerId, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 120, clientY: 100, pointerId, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 120, clientY: 100, pointerId, buttons: 0 }));
    expect(comp.selectedShapes).toContain(rect);
    expect(comp.selectedShapes).toContain(circ);
    expect((comp as any)._dragSelectRect).toBeNull();
  });

  it('moves selected shape with drag', () => {
    const rect = new Rectangle(new Point(Measurement.fromPx(10), Measurement.fromPx(10)), Measurement.fromPx(30), Measurement.fromPx(30));
    comp.shapes = [rect];
    comp.selectedShapes = [rect];
    comp.ngOnChanges({ shapes: { currentValue: comp.shapes, previousValue: [], firstChange: true, isFirstChange: () => true } });
    // Start drag on rect
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 20, clientY: 20, button: 0 }));
    // Move by 40px right, 10px down
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 60, clientY: 30 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 60, clientY: 30 }));
    // The selectedShapes array should contain the new, moved shape instance (not the original reference)
    expect(comp.selectedShapes.length).toBe(1);
    const selected = comp.selectedShapes[0];
    expect(selected.topLeft.x.toUnit('px')).toBeCloseTo(50, 1); // 10 + 40
    expect(selected.topLeft.y.toUnit('px')).toBeCloseTo(20, 1); // 10 + 10
  });

  it('getGroupBoundingBox returns correct bbox for selection', () => {
    const rect = new Rectangle(new Point(Measurement.fromPx(10), Measurement.fromPx(10)), Measurement.fromPx(30), Measurement.fromPx(30));
    const circ = new Circle(new Point(Measurement.fromPx(80), Measurement.fromPx(80)), Measurement.fromPx(15));
    comp.shapes = [rect, circ];
    comp.selectedShapes = [rect, circ];
    const bbox = comp.getGroupBoundingBox();
    expect(bbox).not.toBeNull();
    if (bbox) {
      expect(bbox.topLeft.x.toUnit('px')).toBeLessThanOrEqual(10);
      expect(bbox.topLeft.y.toUnit('px')).toBeLessThanOrEqual(10);
      expect(bbox.width.toUnit('px')).toBeGreaterThanOrEqual(85); // covers both shapes
      expect(bbox.height.toUnit('px')).toBeGreaterThanOrEqual(85);
    }
  });

  it('renders overlays (grid, bbox, selection)', () => {
    comp.showGrid = true;
    comp.showBoundingBoxes = true;
    const rect = new Rectangle(new Point(Measurement.fromPx(10), Measurement.fromPx(10)), Measurement.fromPx(30), Measurement.fromPx(30));
    comp.shapes = [rect];
    comp.selectedShapes = [rect];
    // Should not throw
    expect(() => comp.drawOverlays(canvas.getContext('2d')!)).not.toThrow();
  });
});
