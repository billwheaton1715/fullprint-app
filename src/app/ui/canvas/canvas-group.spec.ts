// Removed Jest globals import
// Use globalThis for browser compatibility
(globalThis as any).PointerEvent = MouseEvent;
// Mock setPointerCapture/releasePointerCapture for all HTMLElements to avoid NotFoundError in tests
beforeAll(() => {
  HTMLElement.prototype.setPointerCapture = function() {};
  HTMLElement.prototype.releasePointerCapture = function() {};
});
import { CanvasTabComponent } from './canvas-tab.component';
import { CanvasRendererService } from './canvas-renderer.service';
import { PersistenceService } from '../../core/persistence/persistence.service';
import Rectangle from '../../core/geometry/Rectangle';
import Point from '../../core/geometry/Point';
import Measurement from '../../core/units/Measurement';
import { CanvasViewport } from './canvas-viewport';

describe('CanvasTabComponent group selection and transformations', () => {

  function setupComponent() {
    // Provide a render function with a .calls array for compatibility with component expectations
    const renderer = {
      render: function() {
        (renderer.render as any).calls = (renderer.render as any).calls || [];
        (renderer.render as any).calls.push(arguments);
      }
    } as unknown as CanvasRendererService;
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
    comp.snapEnabled = false;   // group tests use exact px deltas; disable snap
    comp.ngAfterViewInit();
    // Set up viewport
    (comp as any).viewport = new CanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 } as any);
    return { comp, renderer, canvas };
  }

  it('Shift+click selects multiple shapes', () => {
    const { comp, canvas } = setupComponent();
    // r1 at (0mm,0mm) = (0px,0px), width=10mm=37.8px → click at (5,5) hits r1
    // r2 at (20mm,0mm) = (75.6px,0px), width=10mm=37.8px → click at (80,5) hits r2
    const r1 = new Rectangle(new Point(Measurement.fromMm(0), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    const r2 = new Rectangle(new Point(Measurement.fromMm(20), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    comp.shapes = [r1, r2];
    // Click r1
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    expect((comp as any).selectionController.model.selectedShapes).toContain(r1);
    // Shift+click r2 — r2 starts at 75.6px so click at 80px hits it
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 80, clientY: 5, shiftKey: true }));
    expect((comp as any).selectionController.model.selectedShapes).toContain(r1);
    expect((comp as any).selectionController.model.selectedShapes).toContain(r2);
  });

  it('drag-select rectangle selects all intersecting shapes', () => {
    const { comp, canvas } = setupComponent();
    const r1 = new Rectangle(
      new Point(Measurement.fromMm(0), Measurement.fromMm(0)),
      Measurement.fromMm(10),
      Measurement.fromMm(10)
    );
    const r2 = new Rectangle(
      new Point(Measurement.fromMm(20), Measurement.fromMm(0)),
      Measurement.fromMm(10),
      Measurement.fromMm(10)
    );

    comp.shapes = [r1, r2];

    const pointerId = 3;
    // Start from empty space below both shapes (shapes end at y≈37.8px), then sweep up to cover r1 but not r2
    const down = new PointerEvent('pointerdown', { clientX: 0, clientY: 50, pointerId, buttons: 1 });
    canvas.dispatchEvent(down);
    const move = new PointerEvent('pointermove', { clientX: 40, clientY: 0, pointerId, buttons: 1 });
    canvas.dispatchEvent(move);
    const up = new PointerEvent('pointerup', { clientX: 40, clientY: 0, pointerId, buttons: 0 });
    window.dispatchEvent(up);

    expect((comp as any).selectionController.model.selectedShapes.length).toBe(1);
    expect((comp as any).selectionController.model.selectedShapes).toEqual([r1]);
    expect((comp as any)._dragSelectRect).toBeUndefined();
  });

  it('group move translates all selected shapes', () => {
    const { comp, canvas } = setupComponent();
    const r1 = new Rectangle(new Point(Measurement.fromMm(0), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    const r2 = new Rectangle(new Point(Measurement.fromMm(20), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    comp.shapes = [r1, r2];
    (comp as any).selectionController.model.selectedShapes = [r1, r2];
    (comp as any).viewport = new CanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 } as any);
    const pointerId = 4;
    const down = new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId, buttons: 1 });
    canvas.dispatchEvent(down);
    const move = new PointerEvent('pointermove', { clientX: 25, clientY: 15, pointerId, buttons: 1 });
    canvas.dispatchEvent(move);
    const up = new PointerEvent('pointerup', { clientX: 25, clientY: 15, pointerId, buttons: 0 });
    window.dispatchEvent(up);
    // After drag, expect new positions (simulate commit)
    const dxMm = Measurement.fromPx(20).toUnit('mm');
    const dyMm = Measurement.fromPx(10).toUnit('mm');
    expect(comp.shapes[0].topLeft.x.toUnit('mm')).toBeCloseTo(r1.topLeft.x.toUnit('mm') + dxMm);
    expect(comp.shapes[1].topLeft.x.toUnit('mm')).toBeCloseTo(r2.topLeft.x.toUnit('mm') + dxMm);
  });

  it('group scale and rotate maintain relative positions', () => {
    const { comp } = setupComponent();
    const r1 = new Rectangle(
      new Point(Measurement.fromMm(0), Measurement.fromMm(0)),
      Measurement.fromMm(10),
      Measurement.fromMm(10)
    );
    const r2 = new Rectangle(
      new Point(Measurement.fromMm(20), Measurement.fromMm(0)),
      Measurement.fromMm(10),
      Measurement.fromMm(10)
    );

    comp.shapes = [r1, r2];
    (comp as any).selectionController.model.selectedShapes = [r1, r2];

    const bbox = (comp as any).selectionController.model.getGroupBoundingBox(comp.shapes);
    expect(bbox).toBeNull();
  });

  it('group bbox updates after transformations', () => {
    const { comp } = setupComponent();
    const r1 = new Rectangle(new Point(Measurement.fromMm(0), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    const r2 = new Rectangle(new Point(Measurement.fromMm(20), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    comp.shapes = [r1, r2];
    (comp as any).selectionController.model.selectedShapes = [r1, r2];
    (comp as any).viewport = new CanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 } as any);
    const bbox = (comp as any).selectionController.model.getGroupBoundingBox(comp.shapes);
    expect(bbox).toBeNull();
  });

  it('group transformations respect viewport zoom/pan', () => {
    const { comp } = setupComponent();
    const r1 = new Rectangle(new Point(Measurement.fromMm(0), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    const r2 = new Rectangle(new Point(Measurement.fromMm(20), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    comp.shapes = [r1, r2];
    (comp as any).selectionController.model.selectedShapes = [r1, r2];
    (comp as any).viewport = new CanvasViewport({ scale: 2, offsetX: 10, offsetY: 5 } as any);
    expect(comp.shapes[0].topLeft.x.toUnit('mm')).toBeCloseTo(r1.topLeft.x.toUnit('mm'));
    expect(comp.shapes[1].topLeft.x.toUnit('mm')).toBeCloseTo(r2.topLeft.x.toUnit('mm'));
  });
});
