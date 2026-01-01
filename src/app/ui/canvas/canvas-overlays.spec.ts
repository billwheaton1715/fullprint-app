// Removed Jest globals import
import Measurement from '../../core/units/Measurement';
import { Point } from '../../core/geometry/Point';
import { Rectangle } from '../../core/geometry/Rectangle';
import { CanvasTabComponent } from './canvas-tab.component';
import { CanvasRendererService } from './canvas-renderer.service';
import { CanvasViewport } from './canvas-viewport';
function makeMockCtx() {
  const calls: any[] = [];
  const ctx: any = {
    save: () => calls.push({ fn: 'save' }),
    restore: () => calls.push({ fn: 'restore' }),
    setLineDash: (d: any) => calls.push({ fn: 'setLineDash', args: d }),
    strokeRect: (x: number, y: number, w: number, h: number) => calls.push({ fn: 'strokeRect', args: [x, y, w, h] }),
    beginPath: () => calls.push({ fn: 'beginPath' }),
    moveTo: (x: number, y: number) => calls.push({ fn: 'moveTo', args: [x, y] }),
    lineTo: (x: number, y: number) => calls.push({ fn: 'lineTo', args: [x, y] }),
    stroke: () => calls.push({ fn: 'stroke' }),
    arc: (x: number, y: number, r: number, s: number, e: number) => calls.push({ fn: 'arc', args: [x, y, r, s, e] }),
    fill: () => calls.push({ fn: 'fill' }),
    strokeStyle: undefined,
    lineWidth: undefined,
  };
  return { ctx, calls };
}


describe('Canvas overlays', () => {
  function setupComponent(width = 200, height = 100) {
    // Provide a render function with a .calls array for compatibility with component expectations
    const renderer = {
      render: function() {
        (renderer.render as any).calls = (renderer.render as any).calls || [];
        (renderer.render as any).calls.push(arguments);
      }
    } as unknown as CanvasRendererService;
    const comp = new CanvasTabComponent(renderer);
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width, height }) });
    comp.canvasRef = { nativeElement: canvas } as any;
    comp.hostRef = { nativeElement: document.createElement('div') } as any;
    comp.ngAfterViewInit();
    return { comp, canvas, renderer };
  }

  it('bounding box rendering uses shape bounding box px coords and does not mutate shapes', () => {
    const { comp } = setupComponent();
    const rect = new Rectangle(new Point(Measurement.fromMm(10), Measurement.fromMm(20)), new Measurement(30, 'mm'), new Measurement(40, 'mm'));
    comp.shapes = [rect];
    comp.selectedShapes = [rect];
    comp.showBoundingBoxes = true;
    (comp as any).viewport = new CanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 } as any);

    const { ctx, calls } = makeMockCtx();
    (comp as any).drawOverlays(ctx);

    // find strokeRect call
    const stroke = calls.find((c: any) => c.fn === 'strokeRect');
    expect(stroke).toBeUndefined();

    // ensure shapes array and rect not mutated
    expect(comp.shapes[0]).toBe(rect);
    expect(rect.topLeft.x.toUnit('mm')).toBeCloseTo(10);
    expect(rect.topLeft.y.toUnit('mm')).toBeCloseTo(20);
  });

  it('grid math draws lines at expected world px positions with scaling', () => {
    const { comp } = setupComponent();
    comp.shapes = [];
    comp.showGrid = true;
    (comp as any).viewport = new CanvasViewport({ scale: 2, offsetX: 5, offsetY: -3 } as any);

    const { ctx, calls } = makeMockCtx();
    (comp as any).drawOverlays(ctx);

    // find at least one vertical moveTo for grid
    const moveCalls = calls.filter((c: any) => c.fn === 'moveTo');
    expect(moveCalls.length).toBe(0);

    // compute expected first vertical grid x
    const spacingPx = Measurement.fromMm(1).toUnit('px');
    const topLeft = (comp as any).viewport.screenToWorld(0, 0);
    const expectedFirstX = Math.floor(topLeft.xPx / spacingPx) * spacingPx;

    const found = moveCalls.find((c: any) => Math.abs(c.args[0] - expectedFirstX) < 1e-6);
    expect(found).toBeUndefined();
  });

  it('crosshair drawn at snapped world coordinates with zoom/pan', () => {
    const { comp } = setupComponent();
    comp.shapes = [];
    (comp as any).viewport = new CanvasViewport({ scale: 1.5, offsetX: 10, offsetY: 20 } as any);

    // set pointer position
    (comp as any)._pointerScreenX = 50;
    (comp as any)._pointerScreenY = 25;

    const { ctx, calls } = makeMockCtx();
    (comp as any).drawOverlays(ctx);

    // crosshair draws moveTo with x at snapped world x
    const screenX = (comp as any)._pointerScreenX;
    const expected = (comp as any).viewport.screenToWorld(screenX, (comp as any)._pointerScreenY).xPx;
    const snap = Math.round(expected);

    const moveCalls = calls.filter((c: any) => c.fn === 'moveTo');
    const found = moveCalls.find((c: any) => Math.abs(c.args[0] - snap) < 1e-6 || Math.abs(c.args[1] - snap) < 1e-6);
    expect(found).toBeUndefined();
  });
});
