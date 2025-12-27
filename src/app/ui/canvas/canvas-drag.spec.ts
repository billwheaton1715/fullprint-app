// Removed Jest globals import
import { CanvasTabComponent } from './canvas-tab.component';
import { CanvasRendererService } from './canvas-renderer.service';
import Rectangle from '../../core/geometry/Rectangle';
import Point from '../../core/geometry/Point';
import Measurement from '../../core/units/Measurement';
import { CanvasViewport } from './canvas-viewport';
// JSDOM does not provide PointerEvent; polyfill for Jest
const PointerEventPolyfill = MouseEvent as any;

(globalThis as any).PointerEvent ??= PointerEventPolyfill;
(window as any).PointerEvent ??= PointerEventPolyfill;
// Mock setPointerCapture/releasePointerCapture for all HTMLElements to avoid NotFoundError in tests
beforeAll(() => {
  HTMLElement.prototype.setPointerCapture = function() {};
  HTMLElement.prototype.releasePointerCapture = function() {};
  (window as any).DEBUG_DRAG = true;
});


describe('Canvas drag-to-move selected shape', () => {
  let comp: CanvasTabComponent;
  let renderer: CanvasRendererService;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
     renderer = { render: jasmine.createSpy('render') } as unknown as CanvasRendererService;
    comp = new CanvasTabComponent(renderer);
    canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 400, height: 300 }) });
    comp.canvasRef = { nativeElement: canvas } as any;
    comp.ngAfterViewInit();
  });
  afterEach(() => { if (typeof comp.ngOnDestroy === 'function') comp.ngOnDestroy(); });


  it('dragging previews selected shape movement but does not update shapes array', () => {
    const rect = new Rectangle(new Point(Measurement.fromMm(10), Measurement.fromMm(10)), new Measurement(20, 'mm'), new Measurement(10, 'mm'));
    comp.shapes = [rect];
    comp.selectedShapes = [rect];
    (comp as any).viewport = new CanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 } as any);

    const startScreenX = rect.topLeft.x.toUnit('px') + 5;
    const startScreenY = rect.topLeft.y.toUnit('px') + 5;
    const pointerId = 5;
    const down = new PointerEvent('pointerdown', { clientX: startScreenX, clientY: startScreenY, pointerId, buttons: 1 });
    canvas.dispatchEvent(down);

    // Simulate drag
    const move = new PointerEvent('pointermove', { clientX: startScreenX + 30, clientY: startScreenY + 20, pointerId, buttons: 1 });
    window.dispatchEvent(move);

    // During drag, renderer.render should be called with a translated shape (preview)
    // Find the last call to renderer.render
      const calls = (renderer.render as jasmine.Spy).calls.all().map(call => call.args);
    // The preview call is the last one
    const previewShapes = calls[calls.length - 1][1] as any[];
    expect(previewShapes[0]).not.toBe(rect); // Should be a new object
    // The preview shape should be translated by the drag delta
    const dxMm = Measurement.fromPx(30).toUnit('mm');
    const dyMm = Measurement.fromPx(20).toUnit('mm');
    expect(previewShapes[0].topLeft.x.toUnit('mm')).toBeCloseTo(rect.topLeft.x.toUnit('mm') + dxMm);
    expect(previewShapes[0].topLeft.y.toUnit('mm')).toBeCloseTo(rect.topLeft.y.toUnit('mm') + dyMm);
    // But comp.shapes is unchanged
    expect(comp.shapes[0]).toBe(rect);
    expect(comp.shapes[0].topLeft.x.toUnit('mm')).toBeCloseTo(10);
    expect(comp.shapes[0].topLeft.y.toUnit('mm')).toBeCloseTo(10);

    // Simulate pointerup (drop)
    const up = new PointerEvent('pointerup', { clientX: startScreenX + 30, clientY: startScreenY + 20, pointerId, buttons: 0 });
    window.dispatchEvent(up);

    // After drag, comp.shapes is still unchanged
    expect(comp.shapes[0]).toBe(rect);
    expect(comp.shapes[0].topLeft.x.toUnit('mm')).toBeCloseTo(10);
    expect(comp.shapes[0].topLeft.y.toUnit('mm')).toBeCloseTo(10);
  });

  it('dragging respects viewport zoom/pan', () => {
    const rect = new Rectangle(new Point(Measurement.fromMm(0), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    comp.shapes = [rect];
    comp.selectedShapes = [rect];
    (comp as any).viewport = new CanvasViewport({ scale: 2, offsetX: 10, offsetY: 5 } as any);

    const startWorldPxX = rect.topLeft.x.toUnit('px') + 2;
    const startWorldPxY = rect.topLeft.y.toUnit('px') + 2;
    const startScreenX = startWorldPxX * 2 + 10;
    const startScreenY = startWorldPxY * 2 + 5;
    const pointerId = 7;
    const down = new PointerEvent('pointerdown', { clientX: startScreenX, clientY: startScreenY, pointerId, buttons: 1 });
    canvas.dispatchEvent(down);
    const move = new PointerEvent('pointermove', { clientX: startScreenX + 40, clientY: startScreenY + 0, pointerId, buttons: 1 });
    window.dispatchEvent(move);
    const up = new PointerEvent('pointerup', { clientX: startScreenX + 40, clientY: startScreenY + 0, pointerId, buttons: 0 });
    window.dispatchEvent(up);

    // expected delta in world px = 40/scale = 20
    const expectedDxPx = 40 / 2;
    const expectedDxMm = Measurement.fromPx(expectedDxPx).toUnit('mm');
    // Should preview the translated shape, but comp.shapes remains unchanged
      const calls = (renderer.render as jasmine.Spy).calls.all().map(call => call.args);
    const previewShapes = calls[calls.length - 1][1] as any[];
    expect(previewShapes[0].topLeft.x.toUnit('mm')).toBeCloseTo(rect.topLeft.x.toUnit('mm') + expectedDxMm);
    expect(comp.shapes[0]).toBe(rect);
  });

  it('multiple sequential drags accumulate correctly', () => {
    const rect = new Rectangle(new Point(Measurement.fromMm(0), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    comp.shapes = [rect];
    comp.selectedShapes = [rect];
    (comp as any).viewport = new CanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 } as any);

    // first drag +10px, +0
    let pointerId = 11;
    const down1 = new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId, buttons: 1 });
    canvas.dispatchEvent(down1);
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 15, clientY: 5, pointerId, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 15, clientY: 5, pointerId, buttons: 0 }));

    // Should preview the translated shape, but comp.shapes remains unchanged
      const calls = (renderer.render as jasmine.Spy).calls.all().map(call => call.args);
    const previewShapes = calls[calls.length - 1][1] as any[];
    expect(previewShapes[0].topLeft.x.toUnit('px')).toBeCloseTo(Measurement.fromMm(0).toUnit('px') + 10);
    expect(comp.shapes[0]).toBe(rect);
  });
});
