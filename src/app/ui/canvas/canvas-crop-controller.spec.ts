/**
 * canvas-crop-controller.spec.ts
 *
 * Tests the geometry and pointer-interaction logic of CanvasCropController.
 * Uses a stub ImageShape with a fake HTMLImageElement so no real images are
 * needed.
 */

import { CanvasCropController } from './canvas-crop-controller';
import { ImageShape, CropRect } from '../../core/geometry/ImageShape';
import Measurement              from '../../core/units/Measurement';
import Point                    from '../../core/geometry/Point';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mm(v: number) { return new Measurement(v, 'mm'); }
function pt(x: number, y: number) { return new Point(mm(x), mm(y)); }

/** Build a fake HTMLImageElement (no real loading required). */
function fakeImg(w: number, h: number): HTMLImageElement {
  return { naturalWidth: w, naturalHeight: h } as HTMLImageElement;
}

/**
 * Build an ImageShape at world-px position (px, py) with natural image size.
 * For simplicity we set width/height (the displayed/visible size) equal to the
 * full natural size.  Position is stored as mm so we convert via fromPx.
 */
function makeShape(
  naturalW: number, naturalH: number,
  topLeftXPx = 0,   topLeftYPx = 0,
  cropRect: CropRect | null = null,
): ImageShape {
  const img = fakeImg(naturalW, naturalH);
  const w   = cropRect ? cropRect.sw : naturalW;
  const h   = cropRect ? cropRect.sh : naturalH;
  return new ImageShape(
    img,
    'data:image/gif;base64,test',
    new Point(Measurement.fromPx(topLeftXPx), Measurement.fromPx(topLeftYPx)),
    Measurement.fromPx(w),
    Measurement.fromPx(h),
    cropRect,
  );
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

describe('CanvasCropController — lifecycle', () => {

  it('is inactive initially', () => {
    expect(new CanvasCropController().isActive).toBe(false);
  });

  it('target is null initially', () => {
    expect(new CanvasCropController().target).toBeNull();
  });

  it('enter() activates the controller', () => {
    const ctrl  = new CanvasCropController();
    const shape = makeShape(200, 150);
    ctrl.enter(shape);
    expect(ctrl.isActive).toBe(true);
    expect(ctrl.target).toBe(shape);
  });

  it('exit() deactivates the controller', () => {
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(200, 150));
    ctrl.exit();
    expect(ctrl.isActive).toBe(false);
    expect(ctrl.target).toBeNull();
    expect(ctrl.liveRect).toBeNull();
  });

  it('enter() initialises liveRect to full image when no cropRect', () => {
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(200, 150));
    expect(ctrl.liveRect).toEqual({ sx: 0, sy: 0, sw: 200, sh: 150 });
  });

  it('enter() initialises liveRect from existing cropRect', () => {
    const crop  = { sx: 10, sy: 20, sw: 80, sh: 60 };
    const ctrl  = new CanvasCropController();
    ctrl.enter(makeShape(200, 150, 10, 20, crop));
    expect(ctrl.liveRect).toEqual(crop);
  });
});

// ── World-space geometry ──────────────────────────────────────────────────────

describe('CanvasCropController — world-space rects', () => {

  it('getFullImageWorldRect returns correct origin for uncropped shape', () => {
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(200, 150, 50, 75));
    const r = ctrl.getFullImageWorldRect();
    expect(r.x).toBeCloseTo(50,  1);
    expect(r.y).toBeCloseTo(75,  1);
    expect(r.w).toBe(200);
    expect(r.h).toBe(150);
  });

  it('getFullImageWorldRect accounts for cropRect offset', () => {
    // Shape placed at world-px 60,80 with crop { sx:10, sy:20, ... }
    // Full image origin = 60-10=50, 80-20=60
    const crop  = { sx: 10, sy: 20, sw: 100, sh: 80 };
    const ctrl  = new CanvasCropController();
    ctrl.enter(makeShape(200, 150, 60, 80, crop));
    const r = ctrl.getFullImageWorldRect();
    expect(r.x).toBeCloseTo(50, 1);
    expect(r.y).toBeCloseTo(60, 1);
  });

  it('getLiveCropWorldRect reflects liveRect in world space', () => {
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(200, 150, 0, 0));
    // liveRect is { sx:0, sy:0, sw:200, sh:150 } after enter
    const r = ctrl.getLiveCropWorldRect();
    expect(r.x).toBeCloseTo(0, 1);
    expect(r.y).toBeCloseTo(0, 1);
    expect(r.w).toBe(200);
    expect(r.h).toBe(150);
  });
});

// ── Handles ───────────────────────────────────────────────────────────────────

describe('CanvasCropController — getHandles()', () => {

  it('returns 8 handles', () => {
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(200, 150, 10, 20));
    expect(ctrl.getHandles().length).toBe(8);
  });

  it('handle ids cover all 8 positions', () => {
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(200, 150));
    const ids = ctrl.getHandles().map(h => h.id);
    (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const)
      .forEach(id => expect(ids).toContain(id));
  });

  it('nw handle is at top-left of crop rect', () => {
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(200, 150, 30, 40));   // image at (30,40)
    const nw = ctrl.getHandles().find(h => h.id === 'nw')!;
    expect(nw.x).toBeCloseTo(30, 1);
    expect(nw.y).toBeCloseTo(40, 1);
  });

  it('se handle is at bottom-right of crop rect', () => {
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(200, 150, 30, 40));   // image ends at (230, 190)
    const se = ctrl.getHandles().find(h => h.id === 'se')!;
    expect(se.x).toBeCloseTo(230, 1);
    expect(se.y).toBeCloseTo(190, 1);
  });
});

// ── Pointer interaction ───────────────────────────────────────────────────────

describe('CanvasCropController — pointerDown()', () => {

  it('returns "none" when click is outside crop rect and handles', () => {
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(200, 150, 0, 0));
    // Far outside
    expect(ctrl.pointerDown(500, 500, 1)).toBe('none');
  });

  it('returns "move" when click is inside the crop rect', () => {
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(200, 150, 0, 0));
    // Centre of the crop rect
    expect(ctrl.pointerDown(100, 75, 1)).toBe('move');
  });

  it('returns "handle" when click is on a corner handle', () => {
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(200, 150, 0, 0));
    // NW handle is at (0,0); scale=1 → hit radius = 10 px
    expect(ctrl.pointerDown(0, 0, 1)).toBe('handle');
  });

  it('hit radius scales with viewport scale', () => {
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(200, 150, 0, 0));
    // At scale=2 the hit radius in world-px is 10/2 = 5 px.
    // A point 8 px from nw should miss at scale=2 but hit at scale=1.
    expect(ctrl.pointerDown(8, 0, 2)).toBe('move');   // 8 > 5, misses handle, inside rect
    expect(ctrl.pointerDown(8, 0, 1)).toBe('handle'); // 8 < 10, hits nw handle
  });
});

// ── Resize via handles ────────────────────────────────────────────────────────

describe('CanvasCropController — pointerMove() resize', () => {

  /**
   * Drag a named handle by (dx, dy) and return the resulting crop.
   *
   * We use a 400×300 natural image with an initial crop of
   * { sx:100, sy:75, sw:200, sh:150 } so every handle has room to
   * move both inward AND outward before hitting the image boundary.
   * Handle positions are looked up dynamically after enter() so the
   * test never hard-codes world-px coordinates.
   */
  function dragHandle(
    handleId: 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw',
    dx: number, dy: number,
  ): CropRect {
    const initialCrop: CropRect = { sx: 100, sy: 75, sw: 200, sh: 150 };
    // Place the shape so its top-left world-px matches the crop offset.
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(400, 300, initialCrop.sx, initialCrop.sy, initialCrop));
    const handle = ctrl.getHandles().find(h => h.id === handleId)!;
    ctrl.pointerDown(handle.x, handle.y, 1);
    ctrl.pointerMove(handle.x + dx, handle.y + dy);
    ctrl.pointerUp();
    return ctrl.getLiveCrop();
  }

  it('dragging "e" handle right increases width', () => {
    const crop = dragHandle('e', 50, 0);
    expect(crop.sw).toBeGreaterThan(200);
  });

  it('dragging "s" handle down increases height', () => {
    const crop = dragHandle('s', 0, 50);
    expect(crop.sh).toBeGreaterThan(150);
  });

  it('dragging "w" handle right decreases width and increases sx', () => {
    const crop = dragHandle('w', 20, 0);
    expect(crop.sx).toBeGreaterThan(100);
    expect(crop.sw).toBeLessThan(200);
  });

  it('dragging "n" handle down decreases height and increases sy', () => {
    const crop = dragHandle('n', 0, 20);
    expect(crop.sy).toBeGreaterThan(75);
    expect(crop.sh).toBeLessThan(150);
  });

  it('east edge is clamped to image width', () => {
    const crop = dragHandle('e', 9999, 0);
    expect(crop.sx + crop.sw).toBeLessThanOrEqual(400);
  });

  it('south edge is clamped to image height', () => {
    const crop = dragHandle('s', 0, 9999);
    expect(crop.sy + crop.sh).toBeLessThanOrEqual(300);
  });

  it('width never goes below 1', () => {
    // Drag west handle past the east edge
    const crop = dragHandle('w', 9999, 0);
    expect(crop.sw).toBeGreaterThanOrEqual(1);
  });

  it('height never goes below 1', () => {
    const crop = dragHandle('n', 0, 9999);
    expect(crop.sh).toBeGreaterThanOrEqual(1);
  });
});

// ── Move handle ───────────────────────────────────────────────────────────────

describe('CanvasCropController — pointerMove() move', () => {

  it('dragging inside the rect translates sx/sy', () => {
    // Use a pre-cropped shape so there is room to move in both directions.
    // Image: 400×300.  Crop: { sx:100, sy:75, sw:200, sh:150 }.
    // Shape's world-px topLeft = (100, 75).  Centre of crop = (200, 150).
    const initialCrop: CropRect = { sx: 100, sy: 75, sw: 200, sh: 150 };
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(400, 300, initialCrop.sx, initialCrop.sy, initialCrop));
    const cx = initialCrop.sx + initialCrop.sw / 2;   // 200
    const cy = initialCrop.sy + initialCrop.sh / 2;   // 150
    ctrl.pointerDown(cx, cy, 1);    // "move" hit
    ctrl.pointerMove(cx + 10, cy + 10);
    const crop = ctrl.getLiveCrop();
    expect(crop.sx).toBeCloseTo(110, 0);
    expect(crop.sy).toBeCloseTo(85,  0);
  });

  it('move is clamped so crop stays within image bounds', () => {
    const initialCrop: CropRect = { sx: 100, sy: 75, sw: 200, sh: 150 };
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(400, 300, initialCrop.sx, initialCrop.sy, initialCrop));
    const cx = initialCrop.sx + initialCrop.sw / 2;
    const cy = initialCrop.sy + initialCrop.sh / 2;
    ctrl.pointerDown(cx, cy, 1);
    ctrl.pointerMove(cx + 9999, cy + 9999);
    const crop = ctrl.getLiveCrop();
    expect(crop.sx + crop.sw).toBeLessThanOrEqual(400);
    expect(crop.sy + crop.sh).toBeLessThanOrEqual(300);
  });

  it('sx/sy never go below 0', () => {
    const initialCrop: CropRect = { sx: 100, sy: 75, sw: 200, sh: 150 };
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(400, 300, initialCrop.sx, initialCrop.sy, initialCrop));
    const cx = initialCrop.sx + initialCrop.sw / 2;
    const cy = initialCrop.sy + initialCrop.sh / 2;
    ctrl.pointerDown(cx, cy, 1);
    ctrl.pointerMove(cx - 9999, cy - 9999);
    const crop = ctrl.getLiveCrop();
    expect(crop.sx).toBeGreaterThanOrEqual(0);
    expect(crop.sy).toBeGreaterThanOrEqual(0);
  });
});

// ── pointerUp ────────────────────────────────────────────────────────────────

describe('CanvasCropController — pointerUp()', () => {

  it('liveRect stays unchanged after pointerUp', () => {
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(200, 150, 0, 0));
    ctrl.pointerDown(100, 75, 1);
    ctrl.pointerMove(110, 85);
    const before = { ...ctrl.liveRect! };
    ctrl.pointerUp();
    expect(ctrl.liveRect).toEqual(before);
  });

  it('pointerMove after pointerUp has no effect', () => {
    const ctrl = new CanvasCropController();
    ctrl.enter(makeShape(200, 150, 0, 0));
    ctrl.pointerDown(100, 75, 1);
    ctrl.pointerMove(110, 85);
    ctrl.pointerUp();
    const after = { ...ctrl.liveRect! };
    ctrl.pointerMove(200, 200);   // should do nothing
    expect(ctrl.liveRect).toEqual(after);
  });
});
