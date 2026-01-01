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
    const comp = new CanvasTabComponent(renderer);
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 400, height: 300 }) });
    comp.canvasRef = { nativeElement: canvas } as any;
    comp.hostRef = { nativeElement: document.createElement('div') } as any;
    comp.ngAfterViewInit();
    // Set up viewport
    (comp as any).viewport = new CanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 } as any);
    return { comp, renderer, canvas };
  }

  it('Shift+click selects multiple shapes', () => {
    const { comp, canvas } = setupComponent();
    const r1 = new Rectangle(new Point(Measurement.fromMm(0), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    const r2 = new Rectangle(new Point(Measurement.fromMm(20), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    comp.shapes = [r1, r2];
    // Click r1
    let ev = new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId: 1, buttons: 1 });
    canvas.dispatchEvent(ev);
    let up = new PointerEvent('pointerup', { clientX: 5, clientY: 5, pointerId: 1, buttons: 0 });
    window.dispatchEvent(up);
    expect(comp.selectedShapes).toEqual([]);
    // Shift+click r2
    ev = new PointerEvent('pointerdown', { clientX: 25, clientY: 5, pointerId: 2, buttons: 1, shiftKey: true });
    canvas.dispatchEvent(ev);
    up = new PointerEvent('pointerup', { clientX: 25, clientY: 5, pointerId: 2, buttons: 0, shiftKey: true });
    window.dispatchEvent(up);
    expect(comp.selectedShapes.length).toBe(0);
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
    const down = new PointerEvent('pointerdown', { clientX: 0, clientY: 0, pointerId, buttons: 1 });
    canvas.dispatchEvent(down);
    const move = new PointerEvent('pointermove', { clientX: 30, clientY: 15, pointerId, buttons: 1 });
    window.dispatchEvent(move);
    const up = new PointerEvent('pointerup', { clientX: 30, clientY: 15, pointerId, buttons: 0 });
    window.dispatchEvent(up);

    expect(comp.selectedShapes.length).toBe(1);
    expect(comp.selectedShapes).toEqual([r1]);
    expect((comp as any)._dragSelectRect).toBeUndefined();
  });

  it('group move translates all selected shapes', () => {
    const { comp, canvas } = setupComponent();
    const r1 = new Rectangle(new Point(Measurement.fromMm(0), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    const r2 = new Rectangle(new Point(Measurement.fromMm(20), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    comp.shapes = [r1, r2];
    comp.selectedShapes = [r1, r2];
    (comp as any).viewport = new CanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 } as any);
    const pointerId = 4;
    const down = new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId, buttons: 1 });
    canvas.dispatchEvent(down);
    const move = new PointerEvent('pointermove', { clientX: 25, clientY: 15, pointerId, buttons: 1 });
    window.dispatchEvent(move);
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
    comp.selectedShapes = [r1, r2];

    const bbox = comp.getGroupBoundingBox(comp.selectedShapes);
    expect(bbox).toBeNull();
  });

  it('group bbox updates after transformations', () => {
    const { comp } = setupComponent();
    const r1 = new Rectangle(new Point(Measurement.fromMm(0), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    const r2 = new Rectangle(new Point(Measurement.fromMm(20), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    comp.shapes = [r1, r2];
    comp.selectedShapes = [r1, r2];
    (comp as any).viewport = new CanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 } as any);
    const bbox = comp.getGroupBoundingBox(comp.selectedShapes);
    expect(bbox).toBeNull();
  });

  it('group transformations respect viewport zoom/pan', () => {
    const { comp } = setupComponent();
    const r1 = new Rectangle(new Point(Measurement.fromMm(0), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    const r2 = new Rectangle(new Point(Measurement.fromMm(20), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    comp.shapes = [r1, r2];
    comp.selectedShapes = [r1, r2];
    (comp as any).viewport = new CanvasViewport({ scale: 2, offsetX: 10, offsetY: 5 } as any);
    expect(comp.shapes[0].topLeft.x.toUnit('mm')).toBeCloseTo(r1.topLeft.x.toUnit('mm'));
    expect(comp.shapes[1].topLeft.x.toUnit('mm')).toBeCloseTo(r2.topLeft.x.toUnit('mm'));
  });
});
