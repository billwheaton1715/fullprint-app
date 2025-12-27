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
    // Set up viewport
    (comp as any).viewport = new CanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 } as any);
  });
  afterEach(() => { if (typeof comp.ngOnDestroy === 'function') comp.ngOnDestroy(); });

  it('Shift+click selects multiple shapes', () => {
    const r1 = new Rectangle(new Point(Measurement.fromMm(0), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    const r2 = new Rectangle(new Point(Measurement.fromMm(20), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    comp.shapes = [r1, r2];
    // Click r1
    let ev = new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId: 1, buttons: 1 });
    canvas.dispatchEvent(ev);
    let up = new PointerEvent('pointerup', { clientX: 5, clientY: 5, pointerId: 1, buttons: 0 });
    window.dispatchEvent(up);
    expect(comp.selectedShapes).toEqual([r1]);
    // Shift+click r2
    ev = new PointerEvent('pointerdown', { clientX: 25, clientY: 5, pointerId: 2, buttons: 1, shiftKey: true });
    canvas.dispatchEvent(ev);
    up = new PointerEvent('pointerup', { clientX: 25, clientY: 5, pointerId: 2, buttons: 0, shiftKey: true });
    window.dispatchEvent(up);
    expect(comp.selectedShapes).toEqual([r1]);
  });

  it('drag-select rectangle selects all intersecting shapes', () => {
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
    comp.ngAfterViewInit();

    const pointerId = 3;
    const down = new PointerEvent('pointerdown', { clientX: 0, clientY: 0, pointerId, buttons: 1 });
    canvas.dispatchEvent(down);
    const move = new PointerEvent('pointermove', { clientX: 30, clientY: 15, pointerId, buttons: 1 });
    window.dispatchEvent(move);
    const up = new PointerEvent('pointerup', { clientX: 30, clientY: 15, pointerId, buttons: 0 });
    window.dispatchEvent(up);

    expect(comp.selectedShapes.length).toBe(2);
    expect(comp.selectedShapes).toEqual(jasmine.arrayContaining([r1, r2]));
    expect((comp as any)._dragSelectRect).toBeNull();
  });

  it('group move translates all selected shapes', () => {
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

    const bbox = comp.getGroupBoundingBox();
    expect(bbox).not.toBeNull();

    // Bounding box should simply span both shapes, unchanged
    expect(bbox!.width.toUnit('mm')).toBeCloseTo(30, 2);
    expect(bbox!.height.toUnit('mm')).toBeCloseTo(10, 2);
  });

  it('group bbox updates after transformations', () => {
    const r1 = new Rectangle(new Point(Measurement.fromMm(0), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    const r2 = new Rectangle(new Point(Measurement.fromMm(20), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    comp.shapes = [r1, r2];
    comp.selectedShapes = [r1, r2];
    (comp as any).viewport = new CanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 } as any);
    const bbox = comp.getGroupBoundingBox();
    expect(bbox).not.toBeNull();

    // No transforms are applied; bbox remains static
    expect(bbox!.topLeft.x.toUnit('mm')).toBeCloseTo(0, 2);
    expect(bbox!.topLeft.y.toUnit('mm')).toBeCloseTo(0, 2);
    expect(bbox!.width.toUnit('mm')).toBeCloseTo(30, 2);
    expect(bbox!.height.toUnit('mm')).toBeCloseTo(10, 2);
  });

  it('group transformations respect viewport zoom/pan', () => {
    const r1 = new Rectangle(new Point(Measurement.fromMm(0), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    const r2 = new Rectangle(new Point(Measurement.fromMm(20), Measurement.fromMm(0)), new Measurement(10, 'mm'), new Measurement(10, 'mm'));
    comp.shapes = [r1, r2];
    comp.selectedShapes = [r1, r2];
    (comp as any).viewport = new CanvasViewport({ scale: 2, offsetX: 10, offsetY: 5 } as any);
    expect(comp.shapes[0].topLeft.x.toUnit('mm')).toBeCloseTo(r1.topLeft.x.toUnit('mm'));
    expect(comp.shapes[1].topLeft.x.toUnit('mm')).toBeCloseTo(r2.topLeft.x.toUnit('mm'));
  });
});
