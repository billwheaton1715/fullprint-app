import { CanvasTabComponent } from './canvas-tab.component';
import { CanvasRendererService } from './canvas-renderer.service';
import { CanvasViewport } from './canvas-viewport';

describe('CanvasTabComponent interaction', () => {
  let comp: CanvasTabComponent;
  let renderer: CanvasRendererService;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    renderer = { render: jest.fn() } as unknown as CanvasRendererService;
    comp = new CanvasTabComponent(renderer);
    canvas = document.createElement('canvas');
    // give canvas a non-zero size for bounding rect math
    Object.defineProperty(canvas, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 200, height: 100 }), writable: true });
    comp.canvasRef = { nativeElement: canvas } as any;
    comp.shapes = [];
    comp.ngAfterViewInit();
  });

  afterEach(() => {
    comp.ngOnDestroy();
  });

  test('wheel zoom updates viewport scale and calls render', () => {
    const beforeScale = (comp as any).viewport.scale;
    const ev = new WheelEvent('wheel', { deltaY: -100, clientX: 50, clientY: 25, bubbles: true });
    canvas.dispatchEvent(ev);
    const afterScale = (comp as any).viewport.scale;
    expect(afterScale).toBeGreaterThan(beforeScale);
    expect((renderer.render as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  test('pointer drag pans viewport and calls render', () => {
    const v = (comp as any).viewport as CanvasViewport;
    expect(v.offsetX).toBe(0);
    expect(v.offsetY).toBe(0);

    // pointerdown at (10,10)
    const down = new MouseEvent('pointerdown', { clientX: 10, clientY: 10 });
    canvas.dispatchEvent(down);

    // move to (30,25)
    const move = new MouseEvent('pointermove', { clientX: 30, clientY: 25, bubbles: true });
    window.dispatchEvent(move);

    // release
    const up = new MouseEvent('pointerup', { clientX: 30, clientY: 25 });
    window.dispatchEvent(up);

    expect(v.offsetX).toBe(20);
    expect(v.offsetY).toBe(15);
    expect((renderer.render as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
