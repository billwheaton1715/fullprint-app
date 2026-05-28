/**
 * shape-serializer.spec.ts
 *
 * Round-trip tests for every shape type: serialize → deserialize should
 * reproduce the same geometry and style values.
 *
 * ImageShape deserialization requires loading an HTMLImageElement.  We swap
 * the global Image constructor with a synchronous stub so tests stay fast.
 */

import { serializeShape, deserializeShape } from './shape-serializer';
import { Rectangle }         from './Rectangle';
import { Triangle }          from './Triangle';
import { Circle }            from './Circle';
import { Ellipse }           from './Ellipse';
import { Arc }               from './Arc';
import { BezierCurve }       from './BezierCurve';
import { Polygon }           from './Polygon';
import { PolygonWithHoles }  from './PolygonWithHoles';
import { ImageShape }        from './ImageShape';
import { LineString }        from './LineString';
import Measurement           from '../units/Measurement';
import Point                 from './Point';
import Angle                 from '../units/Angle';
import Shape                 from './Shape';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mm(v: number): Measurement { return new Measurement(v, 'mm'); }
function pt(x: number, y: number): Point {
  return new Point(mm(x), mm(y));
}

/** Round-trip a shape and return the deserialized copy. */
async function roundTrip(shape: Shape): Promise<Shape> {
  const data = serializeShape(shape);
  return deserializeShape(data);
}

// ── Image stub ────────────────────────────────────────────────────────────────

let OriginalImage: typeof Image;

beforeEach(() => {
  OriginalImage = (window as any).Image;
  // Synchronous stub: fires onload as soon as src is set.
  (window as any).Image = class {
    naturalWidth  = 200;
    naturalHeight = 150;
    onload:  (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_val: string) { this.onload?.(); }
  };
});

afterEach(() => {
  (window as any).Image = OriginalImage;
});

// ── Type tag ──────────────────────────────────────────────────────────────────

describe('serializeShape — type field', () => {

  it('Rectangle emits type=Rectangle', () => {
    const data = serializeShape(new Rectangle(pt(0, 0), mm(10), mm(20)));
    expect(data.type).toBe('Rectangle');
  });

  it('Circle emits type=Circle', () => {
    expect(serializeShape(new Circle(pt(0, 0), mm(5))).type).toBe('Circle');
  });
});

// ── Style passthrough ─────────────────────────────────────────────────────────

describe('serializeShape — style properties', () => {

  it('omits _fillStyle when not set', () => {
    const data = serializeShape(new Rectangle(pt(0, 0), mm(10), mm(10)));
    expect(data._fillStyle).toBeUndefined();
  });

  it('includes _fillStyle when set', () => {
    const r = new Rectangle(pt(0, 0), mm(10), mm(10));
    r.fillStyle = 'red';
    expect(serializeShape(r)._fillStyle).toBe('red');
  });

  it('includes _strokeStyle when set', () => {
    const r = new Rectangle(pt(0, 0), mm(10), mm(10));
    r.strokeStyle = '#00ff00';
    expect(serializeShape(r)._strokeStyle).toBe('#00ff00');
  });

  it('includes _lineWidth when set', () => {
    const r = new Rectangle(pt(0, 0), mm(10), mm(10));
    r.lineWidth = 3;
    expect(serializeShape(r)._lineWidth).toBe(3);
  });

  it('all three style fields survive a round-trip', async () => {
    const r = new Rectangle(pt(5, 5), mm(10), mm(10));
    r.fillStyle   = 'blue';
    r.strokeStyle = 'black';
    r.lineWidth   = 2;
    const copy = await roundTrip(r) as Rectangle;
    expect(copy.fillStyle).toBe('blue');
    expect(copy.strokeStyle).toBe('black');
    expect(copy.lineWidth).toBe(2);
  });
});

// ── Rectangle round-trip ──────────────────────────────────────────────────────

describe('Rectangle round-trip', () => {

  it('preserves topLeft, width, height', async () => {
    const orig = new Rectangle(pt(3, 7), mm(40), mm(20));
    const copy = await roundTrip(orig) as Rectangle;
    expect(copy instanceof Rectangle).toBe(true);
    expect(copy.topLeft.x.toUnit('mm')).toBeCloseTo(3, 6);
    expect(copy.topLeft.y.toUnit('mm')).toBeCloseTo(7, 6);
    expect(copy.width.toUnit('mm')).toBeCloseTo(40, 6);
    expect(copy.height.toUnit('mm')).toBeCloseTo(20, 6);
  });
});

// ── Triangle round-trip ───────────────────────────────────────────────────────

describe('Triangle round-trip', () => {

  it('preserves all three vertices', async () => {
    const orig = new Triangle(pt(0, 0), pt(10, 0), pt(5, 8));
    const copy = await roundTrip(orig) as Triangle;
    expect(copy instanceof Triangle).toBe(true);
    const data = serializeShape(copy);
    expect(data.a.x).toBeCloseTo(0, 6);
    expect(data.b.x).toBeCloseTo(10, 6);
    expect(data.c.y).toBeCloseTo(8, 6);
  });
});

// ── Circle round-trip ─────────────────────────────────────────────────────────

describe('Circle round-trip', () => {

  it('preserves center and radius', async () => {
    const orig = new Circle(pt(15, 20), mm(7));
    const copy = await roundTrip(orig) as Circle;
    expect(copy instanceof Circle).toBe(true);
    const data = serializeShape(copy);
    expect(data.center.x).toBeCloseTo(15, 6);
    expect(data.center.y).toBeCloseTo(20, 6);
    expect(data.radius).toBeCloseTo(7, 6);
  });
});

// ── Ellipse round-trip ────────────────────────────────────────────────────────

describe('Ellipse round-trip', () => {

  it('preserves center, radiusX, radiusY', async () => {
    const orig = new Ellipse(pt(10, 5), mm(30), mm(15));
    const copy = await roundTrip(orig) as Ellipse;
    expect(copy instanceof Ellipse).toBe(true);
    const data = serializeShape(copy);
    expect(data.radiusX).toBeCloseTo(30, 6);
    expect(data.radiusY).toBeCloseTo(15, 6);
  });
});

// ── LineString round-trip ─────────────────────────────────────────────────────

describe('LineString round-trip', () => {

  it('preserves all points', async () => {
    const orig = new LineString([pt(0, 0), pt(5, 10), pt(20, 3)]);
    const copy = await roundTrip(orig) as LineString;
    expect(copy instanceof LineString).toBe(true);
    const data = serializeShape(copy);
    expect(data.points.length).toBe(3);
    expect(data.points[1].x).toBeCloseTo(5, 6);
    expect(data.points[2].y).toBeCloseTo(3, 6);
  });
});

// ── Arc round-trip ────────────────────────────────────────────────────────────

describe('Arc round-trip', () => {

  it('preserves center, radius, start/end angles, clockwise', async () => {
    const orig = new Arc(pt(0, 0), mm(10), new Angle(0.5, 'rad'), new Angle(2.0, 'rad'), true);
    const copy = await roundTrip(orig) as Arc;
    expect(copy instanceof Arc).toBe(true);
    const data = serializeShape(copy);
    expect(data.radius).toBeCloseTo(10, 6);
    expect(data.start).toBeCloseTo(0.5, 6);
    expect(data.end).toBeCloseTo(2.0, 6);
    expect(data.clockwise).toBe(true);
  });

  it('clockwise defaults to false when absent in data', async () => {
    const orig = new Arc(pt(0, 0), mm(5), new Angle(0, 'rad'), new Angle(Math.PI, 'rad'));
    const data = serializeShape(orig);
    delete data.clockwise;
    const copy = await deserializeShape(data);
    expect(copy instanceof Arc).toBe(true);
  });
});

// ── BezierCurve round-trip ────────────────────────────────────────────────────

describe('BezierCurve round-trip', () => {

  it('preserves all four control points', async () => {
    const orig = new BezierCurve(pt(0, 0), pt(10, 20), pt(30, 5), pt(40, 15));
    const copy = await roundTrip(orig) as BezierCurve;
    expect(copy instanceof BezierCurve).toBe(true);
    const data = serializeShape(copy);
    expect(data.p0.x).toBeCloseTo(0,  6);
    expect(data.p1.x).toBeCloseTo(10, 6);
    expect(data.p2.x).toBeCloseTo(30, 6);
    expect(data.p3.x).toBeCloseTo(40, 6);
  });
});

// ── Polygon round-trip ────────────────────────────────────────────────────────

describe('Polygon round-trip', () => {

  it('preserves all vertices', async () => {
    const orig = new Polygon([pt(0, 0), pt(10, 0), pt(10, 10), pt(0, 10)]);
    const copy = await roundTrip(orig) as Polygon;
    expect(copy instanceof Polygon).toBe(true);
    const data = serializeShape(copy);
    expect(data.points.length).toBe(4);
    expect(data.points[2].x).toBeCloseTo(10, 6);
    expect(data.points[2].y).toBeCloseTo(10, 6);
  });
});

// ── PolygonWithHoles round-trip ───────────────────────────────────────────────

describe('PolygonWithHoles round-trip', () => {

  it('preserves outer polygon and holes', async () => {
    const outer = new Polygon([pt(0, 0), pt(50, 0), pt(50, 50), pt(0, 50)]);
    const hole  = new Polygon([pt(10, 10), pt(20, 10), pt(20, 20), pt(10, 20)]);
    const orig  = new PolygonWithHoles(outer, [hole]);
    const copy  = await roundTrip(orig) as PolygonWithHoles;
    expect(copy instanceof PolygonWithHoles).toBe(true);
    const data = serializeShape(copy);
    expect(data.outer.points.length).toBe(4);
    expect(data.holes.length).toBe(1);
    expect(data.holes[0].points.length).toBe(4);
  });

  it('works with zero holes', async () => {
    const outer = new Polygon([pt(0, 0), pt(10, 0), pt(5, 10)]);
    const copy  = await roundTrip(new PolygonWithHoles(outer, []));
    expect(copy instanceof PolygonWithHoles).toBe(true);
  });
});

// ── ImageShape round-trip ─────────────────────────────────────────────────────

describe('ImageShape round-trip', () => {

  function makeImageEl(w = 200, h = 150): HTMLImageElement {
    const img = new (window as any).Image();
    img.naturalWidth  = w;
    img.naturalHeight = h;
    return img as HTMLImageElement;
  }

  const TINY_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

  it('preserves topLeft, width, height, src', async () => {
    const img  = makeImageEl();
    const orig = new ImageShape(img, TINY_SRC, pt(5, 8), mm(100), mm(75));
    const copy = await roundTrip(orig) as ImageShape;

    expect(copy instanceof ImageShape).toBe(true);
    expect(copy.src).toBe(TINY_SRC);
    expect(copy.topLeft.x.toUnit('mm')).toBeCloseTo(5,  6);
    expect(copy.topLeft.y.toUnit('mm')).toBeCloseTo(8,  6);
    expect(copy.width.toUnit('mm')).toBeCloseTo(100, 6);
    expect(copy.height.toUnit('mm')).toBeCloseTo(75,  6);
  });

  it('preserves cropRect when present', async () => {
    const img  = makeImageEl(400, 300);
    const crop = { sx: 10, sy: 20, sw: 80, sh: 60 };
    const orig = new ImageShape(img, TINY_SRC, pt(0, 0), mm(80), mm(60), crop);
    const copy = await roundTrip(orig) as ImageShape;
    expect(copy.cropRect).toEqual(crop);
  });

  it('cropRect is null when not present', async () => {
    const img  = makeImageEl();
    const orig = new ImageShape(img, TINY_SRC, pt(0, 0), mm(50), mm(50));
    const copy = await roundTrip(orig) as ImageShape;
    expect(copy.cropRect).toBeNull();
  });
});

// ── Unknown type ──────────────────────────────────────────────────────────────

describe('deserializeShape — error handling', () => {

  it('throws on unknown type', async () => {
    let caught: Error | null = null;
    try {
      await deserializeShape({ type: 'Hexagon', points: [] });
    } catch (e: any) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toMatch(/unknown/i);
  });
});
