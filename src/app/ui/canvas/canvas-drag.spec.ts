// Removed Jest globals import
import { CanvasTabComponent } from './canvas-tab.component';
import { CanvasRendererService } from './canvas-renderer.service';
import { PersistenceService } from '../../core/persistence/persistence.service';
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

  function setupComponent(initialShapes?: any[]) {
    const renderer    = { render: jasmine.createSpy('render') } as unknown as CanvasRendererService;
    const persistence = {
      saveStatus: 'idle', lastSaveError: null, currentFileName: null,
      scheduleSave: () => {}, flushNow: () => {},
      loadFromIndexedDB: () => Promise.resolve(null),
      serializeShapes: (s: any[]) => s.map((x: any) => (x as any).toJson?.() ?? x),
      deserializeShapes: () => Promise.resolve([]),
    } as unknown as PersistenceService;
    const notifications = { error: () => {}, warn: () => {}, info: () => {}, success: () => {} } as any;
    const cdr           = { markForCheck: () => {} } as any;
    const comp = new CanvasTabComponent(renderer, persistence, notifications, cdr);
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 400, height: 300 }) });
    comp.canvasRef = { nativeElement: canvas } as any;
    comp.hostRef = { nativeElement: document.createElement('div') } as any;
    if (initialShapes) comp.shapes = initialShapes;
    comp.snapEnabled = false;   // drag tests use exact px deltas; disable snap
    comp.ngAfterViewInit();
    return { comp, renderer, canvas };
  }


  it('dragging previews selected shape movement but does not update shapes array', () => {
    // Create rect first so we can pass it to setupComponent, suppressing the TEMP DEBUG block
    const rect = new Rectangle(new Point(Measurement.fromMm(10), Measurement.fromMm(10)), new Measurement(20, 'mm'), new Measurement(10, 'mm'));
    const { comp, canvas } = setupComponent([rect]);
    (comp as any).selectionController.model.selectedShapes = [rect];
    (comp as any).viewport = new CanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 } as any);

    const startScreenX = rect.topLeft.x.toUnit('px') + 5;
    const startScreenY = rect.topLeft.y.toUnit('px') + 5;
    const pointerId = 5;
    const down = new PointerEvent('pointerdown', { clientX: startScreenX, clientY: startScreenY, pointerId, buttons: 1 });
    canvas.dispatchEvent(down);

    // Simulate drag
    const dxPx = 30;
    const dyPx = 20;
    const move = new PointerEvent('pointermove', { clientX: startScreenX + dxPx, clientY: startScreenY + dyPx, pointerId, buttons: 1 });
    canvas.dispatchEvent(move);

    // _previewShapes is set synchronously by invalidate() before RAF fires — check it directly
    const previewShapes = (comp as any)._previewShapes as any[];
    const expectedDxMm = Measurement.fromPx(dxPx).toUnit('mm');
    const expectedDyMm = Measurement.fromPx(dyPx).toUnit('mm');
    expect(previewShapes[0].topLeft.x.toUnit('mm')).toBeCloseTo(rect.topLeft.x.toUnit('mm') + expectedDxMm, 2);
    expect(previewShapes[0].topLeft.y.toUnit('mm')).toBeCloseTo(rect.topLeft.y.toUnit('mm') + expectedDyMm, 2);
    // The actual shapes array should not be mutated during drag
    expect(comp.shapes[0].topLeft.x.toUnit('mm')).toBeCloseTo(10, 1);
    expect(comp.shapes[0].topLeft.y.toUnit('mm')).toBeCloseTo(10, 1);
  });

  it('multiple sequential drags accumulate correctly', () => {
    // Create rect first so we can pass it to setupComponent, suppressing the TEMP DEBUG block
    const rect = new Rectangle(new Point(Measurement.fromMm(0), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    const { comp, canvas } = setupComponent([rect]);
    (comp as any).selectionController.model.selectedShapes = [rect];
    (comp as any).viewport = new CanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 } as any);

    // First drag: move by (10, 0)
    let pointerId = 11;
    const down1 = new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId, buttons: 1 });
    canvas.dispatchEvent(down1);
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 15, clientY: 5, pointerId, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 15, clientY: 5, pointerId, buttons: 0 }));

    // After first drag, compute new screen position for shape
    const shapeAfterFirstDrag = comp.shapes[0];
    const newScreenX = shapeAfterFirstDrag.topLeft.x.toUnit('px') + 5;
    const newScreenY = shapeAfterFirstDrag.topLeft.y.toUnit('px') + 5;

    // Second drag: move by (10, 0) again
    pointerId = 12;
    const down2 = new PointerEvent('pointerdown', { clientX: newScreenX, clientY: newScreenY, pointerId, buttons: 1 });
    canvas.dispatchEvent(down2);
    // Move by +10px from the new anchor
    const move2 = new PointerEvent('pointermove', { clientX: newScreenX + 10, clientY: newScreenY, pointerId, buttons: 1 });
    canvas.dispatchEvent(move2);
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: newScreenX + 10, clientY: newScreenY, pointerId, buttons: 0 }));

    // Each drag commits synchronously; two drags of 10px each → shape ends at 20px from origin
    const expectedDxMm = Measurement.fromPx(20).toUnit('mm');
    expect(comp.shapes[0].topLeft.x.toUnit('mm')).toBeCloseTo(expectedDxMm, 2);
  });
});
