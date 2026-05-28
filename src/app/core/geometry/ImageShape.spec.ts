/**
 * ImageShape.spec.ts
 *
 * Tests construction, geometry, crop model, transforms, and serialization.
 * Uses a simple fake HTMLImageElement — no real image loading needed.
 */

import { ImageShape, CropRect } from './ImageShape';
import Measurement              from '../units/Measurement';
import Point                    from './Point';
import Angle                    from '../units/Angle';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mm(v: number) { return new Measurement(v, 'mm'); }
function px(v: number) { return Measurement.fromPx(v); }
function ptMm(x: number, y: number) { return new Point(mm(x), mm(y)); }
function ptPx(x: number, y: number) { return new Point(px(x), px(y)); }

function fakeImg(w: number, h: number): HTMLImageElement {
  return { naturalWidth: w, naturalHeight: h } as HTMLImageElement;
}

function shape(
  naturalW: number, naturalH: number,
  topLeftXPx = 0,   topLeftYPx = 0,
  crop: CropRect | null = null,
): ImageShape {
  const w = crop ? crop.sw : naturalW;
  const h = crop ? crop.sh : naturalH;
  return new ImageShape(
    fakeImg(naturalW, naturalH),
    'data:test',
    ptPx(topLeftXPx, topLeftYPx),
    px(w),
    px(h),
    crop,
  );
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('ImageShape — construction', () => {

  it('stores src', () => {
    const s = new ImageShape(fakeImg(100, 80), 'my-src', ptMm(0, 0), mm(50), mm(40));
    expect(s.src).toBe('my-src');
  });

  it('stores width and height', () => {
    const s = shape(200, 150, 0, 0);
    expect(s.width.toUnit('px')).toBeCloseTo(200, 3);
    expect(s.height.toUnit('px')).toBeCloseTo(150, 3);
  });

  it('cropRect defaults to null', () => {
    expect(shape(200, 150).cropRect).toBeNull();
  });

  it('stores provided cropRect', () => {
    const crop = { sx: 5, sy: 10, sw: 80, sh: 60 };
    expect(shape(200, 150, 0, 0, crop).cropRect).toEqual(crop);
  });
});

// ── Bounding box ──────────────────────────────────────────────────────────────

describe('ImageShape — getBoundingBox()', () => {

  it('returns a Rectangle with the same topLeft, width, height', () => {
    const s  = shape(200, 150, 30, 40);
    const bb = s.getBoundingBox();
    expect(bb.topLeft.x.toUnit('px')).toBeCloseTo(30, 3);
    expect(bb.topLeft.y.toUnit('px')).toBeCloseTo(40, 3);
    expect(bb.width.toUnit('px')).toBeCloseTo(200, 3);
    expect(bb.height.toUnit('px')).toBeCloseTo(150, 3);
  });

  it('bounding box reflects crop size, not natural size', () => {
    const crop = { sx: 0, sy: 0, sw: 80, sh: 60 };
    const s    = shape(200, 150, 0, 0, crop);
    const bb   = s.getBoundingBox();
    expect(bb.width.toUnit('px')).toBeCloseTo(80,  3);
    expect(bb.height.toUnit('px')).toBeCloseTo(60, 3);
  });
});

// ── containsPoint ─────────────────────────────────────────────────────────────

describe('ImageShape — containsPoint()', () => {

  it('returns true for a point inside', () => {
    const s = shape(200, 150, 0, 0);
    expect(s.containsPoint(ptPx(100, 75))).toBe(true);
  });

  it('returns false for a point outside', () => {
    const s = shape(200, 150, 0, 0);
    expect(s.containsPoint(ptPx(300, 75))).toBe(false);
  });
});

// ── getFullImageOriginPx ──────────────────────────────────────────────────────

describe('ImageShape — getFullImageOriginPx()', () => {

  it('equals topLeft when there is no crop', () => {
    const s = shape(200, 150, 50, 70);
    const o = s.getFullImageOriginPx();
    expect(o.x).toBeCloseTo(50, 3);
    expect(o.y).toBeCloseTo(70, 3);
  });

  it('subtracts cropRect sx/sy from topLeft', () => {
    // topLeft at world-px (60, 80), crop starts at (10, 20) within the image
    // → full image origin at (60−10, 80−20) = (50, 60)
    const crop = { sx: 10, sy: 20, sw: 100, sh: 80 };
    const s    = shape(200, 150, 60, 80, crop);
    const o    = s.getFullImageOriginPx();
    expect(o.x).toBeCloseTo(50, 3);
    expect(o.y).toBeCloseTo(60, 3);
  });
});

// ── withCrop ──────────────────────────────────────────────────────────────────

describe('ImageShape — withCrop()', () => {

  it('returns a new ImageShape (immutable)', () => {
    const orig = shape(200, 150, 0, 0);
    const next = orig.withCrop({ sx: 10, sy: 10, sw: 80, sh: 60 });
    expect(next).not.toBe(orig);
    expect(next).toBeInstanceOf(ImageShape);
  });

  it('new shape has the supplied cropRect', () => {
    const orig = shape(200, 150, 0, 0);
    const crop = { sx: 10, sy: 10, sw: 80, sh: 60 };
    expect(orig.withCrop(crop).cropRect).toEqual(crop);
  });

  it('new shape topLeft tracks crop offset from full image origin', () => {
    // Full image origin at (0, 0), crop at (20, 30)
    // → new topLeft should be world-px (20, 30)
    const orig = shape(200, 150, 0, 0);
    const next = orig.withCrop({ sx: 20, sy: 30, sw: 80, sh: 60 });
    expect(next.topLeft.x.toUnit('px')).toBeCloseTo(20, 3);
    expect(next.topLeft.y.toUnit('px')).toBeCloseTo(30, 3);
  });

  it('new shape width/height equal sw/sh of the crop', () => {
    const orig = shape(200, 150, 0, 0);
    const next = orig.withCrop({ sx: 10, sy: 10, sw: 100, sh: 70 });
    expect(next.width.toUnit('px')).toBeCloseTo(100, 3);
    expect(next.height.toUnit('px')).toBeCloseTo(70, 3);
  });

  it('propagates style to the new shape', () => {
    const orig       = shape(200, 150, 0, 0);
    orig.fillStyle   = 'rgba(0,0,0,0.5)';
    orig.strokeStyle = 'blue';
    const next = orig.withCrop({ sx: 0, sy: 0, sw: 50, sh: 50 });
    expect(next.fillStyle).toBe('rgba(0,0,0,0.5)');
    expect(next.strokeStyle).toBe('blue');
  });

  it('re-applying the same crop is idempotent', () => {
    const crop = { sx: 10, sy: 10, sw: 80, sh: 60 };
    const s1   = shape(200, 150, 10, 10, crop);
    const s2   = s1.withCrop(crop);
    expect(s2.topLeft.x.toUnit('px')).toBeCloseTo(s1.topLeft.x.toUnit('px'), 3);
    expect(s2.topLeft.y.toUnit('px')).toBeCloseTo(s1.topLeft.y.toUnit('px'), 3);
  });
});

// ── translate ─────────────────────────────────────────────────────────────────

describe('ImageShape — translate()', () => {

  it('moves topLeft by dx, dy', () => {
    const s    = shape(200, 150, 50, 60);
    const next = s.translate(px(10), px(-5));
    expect(next.topLeft.x.toUnit('px')).toBeCloseTo(60, 3);
    expect(next.topLeft.y.toUnit('px')).toBeCloseTo(55, 3);
  });

  it('preserves width, height, and cropRect', () => {
    const crop = { sx: 5, sy: 5, sw: 90, sh: 70 };
    const s    = shape(200, 150, 0, 0, crop);
    const next = s.translate(px(10), px(10));
    expect(next.width.toUnit('px')).toBeCloseTo(s.width.toUnit('px'), 3);
    expect(next.height.toUnit('px')).toBeCloseTo(s.height.toUnit('px'), 3);
    expect(next.cropRect).toEqual(crop);
  });

  it('returns a new instance (immutable)', () => {
    const s = shape(100, 100, 0, 0);
    expect(s.translate(px(1), px(1))).not.toBe(s);
  });
});

// ── toJson ────────────────────────────────────────────────────────────────────

describe('ImageShape — toJson()', () => {

  it('type is ImageShape', () => {
    expect(shape(200, 150).toJson().type).toBe('ImageShape');
  });

  it('stores src', () => {
    const s = new ImageShape(fakeImg(100, 80), 'the-src', ptMm(0, 0), mm(50), mm(40));
    expect(s.toJson().src).toBe('the-src');
  });

  it('stores topLeft in mm', () => {
    const s    = new ImageShape(fakeImg(100, 80), '', ptMm(3, 7), mm(50), mm(40));
    const json = s.toJson();
    expect(json.topLeft.x).toBeCloseTo(3, 6);
    expect(json.topLeft.y).toBeCloseTo(7, 6);
  });

  it('stores width and height in mm', () => {
    const s    = new ImageShape(fakeImg(100, 80), '', ptMm(0, 0), mm(60), mm(45));
    const json = s.toJson();
    expect(json.width).toBeCloseTo(60, 6);
    expect(json.height).toBeCloseTo(45, 6);
  });

  it('omits cropRect when null', () => {
    expect(shape(200, 150).toJson().cropRect).toBeUndefined();
  });

  it('includes cropRect when present', () => {
    const crop = { sx: 10, sy: 5, sw: 80, sh: 60 };
    expect(shape(200, 150, 0, 0, crop).toJson().cropRect).toEqual(crop);
  });
});

// ── equals ────────────────────────────────────────────────────────────────────

describe('ImageShape — equals()', () => {

  it('shape equals itself', () => {
    const s = shape(200, 150, 0, 0);
    expect(s.equals(s)).toBe(true);
  });

  it('two shapes with same src/position/size are equal', () => {
    const img = fakeImg(200, 150);
    const s1  = new ImageShape(img, 'src', ptMm(0, 0), mm(50), mm(40));
    const s2  = new ImageShape(img, 'src', ptMm(0, 0), mm(50), mm(40));
    expect(s1.equals(s2)).toBe(true);
  });

  it('shapes with different src are not equal', () => {
    const img = fakeImg(200, 150);
    const s1  = new ImageShape(img, 'src-a', ptMm(0, 0), mm(50), mm(40));
    const s2  = new ImageShape(img, 'src-b', ptMm(0, 0), mm(50), mm(40));
    expect(s1.equals(s2)).toBe(false);
  });

  it('shapes with different cropRects are not equal', () => {
    const img  = fakeImg(200, 150);
    const src  = 'src';
    const tl   = ptMm(0, 0);
    const w    = mm(50); const h = mm(40);
    const s1   = new ImageShape(img, src, tl, w, h, { sx: 0, sy: 0, sw: 50, sh: 40 });
    const s2   = new ImageShape(img, src, tl, w, h, { sx: 5, sy: 5, sw: 50, sh: 40 });
    expect(s1.equals(s2)).toBe(false);
  });
});
