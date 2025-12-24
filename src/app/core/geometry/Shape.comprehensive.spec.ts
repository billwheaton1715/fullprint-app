import Point from './Point';
import Measurement from '../units/Measurement';
import Angle from '../units/Angle';
import Circle from './Circle';
import Rectangle from './Rectangle';
import Triangle from './Triangle';
import Polygon from './Polygon';
import PolygonWithHoles from './PolygonWithHoles';
import Line from './Line';
import LineString from './LineString';
import Arc from './Arc';
import BezierCurve from './BezierCurve';
import Ellipse from './Ellipse';

describe('Shape Comprehensive Test Suite', () => {
  // ===== POINT TESTS =====
  describe('Point', () => {
    test('construction with Measurement values', () => {
      const p = new Point(new Measurement(5, 'mm'), new Measurement(10, 'mm'));
      expect(p.x.toUnit('mm')).toBe(5);
      expect(p.y.toUnit('mm')).toBe(10);
    });

    test('translate returns new instance (immutability)', () => {
      const p1 = new Point(new Measurement(0), new Measurement(0));
      const p2 = p1.translate(new Measurement(5), new Measurement(3));
      expect(p1.x.toUnit('mm')).toBe(0);
      expect(p1.y.toUnit('mm')).toBe(0);
      expect(p2.x.toUnit('mm')).toBeCloseTo(5);
      expect(p2.y.toUnit('mm')).toBeCloseTo(3);
    });

    test('distanceTo calculates Euclidean distance', () => {
      const p1 = new Point(new Measurement(0), new Measurement(0));
      const p2 = new Point(new Measurement(3), new Measurement(4));
      const dist = p1.distanceTo(p2);
      expect(dist.toUnit('mm')).toBeCloseTo(5);
    });

    test('distanceTo respects DPI conversions', () => {
      const p1 = new Point(new Measurement(0, 'mm'), new Measurement(0, 'mm'));
      const p2 = new Point(new Measurement(25.4, 'mm'), new Measurement(0, 'mm'));
      const dist = p1.distanceTo(p2);
      expect(dist.toUnit('mm')).toBeCloseTo(25.4);
    });

    test('equals checks point equality', () => {
      const p1 = new Point(new Measurement(5), new Measurement(10));
      const p2 = new Point(new Measurement(5), new Measurement(10));
      const p3 = new Point(new Measurement(5), new Measurement(11));
      expect(p1.equals(p2)).toBe(true);
      expect(p1.equals(p3)).toBe(false);
    });
  });

  // ===== LINE TESTS =====
  describe('Line', () => {
    test('construction with different start and end', () => {
      const line = new Line(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(3), new Measurement(4))
      );
      expect(line.length().toUnit('mm')).toBeCloseTo(5);
    });

    test('throws on zero-length line', () => {
      expect(() => {
        new Line(
          new Point(new Measurement(5), new Measurement(5)),
          new Point(new Measurement(5), new Measurement(5))
        );
      }).toThrow();
    });

    test('length calculation is correct', () => {
      const line = new Line(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(5), new Measurement(0))
      );
      expect(line.length().toUnit('mm')).toBeCloseTo(5);
    });
  });

  // ===== LINESTRING TESTS =====
  describe('LineString', () => {
    test('construction requires >= 2 points', () => {
      const pts = [
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(1)),
      ];
      const ls = new LineString(pts);
      expect(ls.points.length).toBe(2);
    });

    test('throws on < 2 points', () => {
      expect(() => {
        new LineString([new Point(new Measurement(0), new Measurement(0))]);
      }).toThrow();
    });

    test('perimeter sums segment lengths', () => {
      const pts = [
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(3), new Measurement(0)),
        new Point(new Measurement(3), new Measurement(4)),
      ];
      const ls = new LineString(pts);
      expect(ls.perimeter().toUnit('mm')).toBeCloseTo(7);
    });

    test('area is zero for LineString', () => {
      const pts = [
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(3), new Measurement(0)),
        new Point(new Measurement(3), new Measurement(4)),
      ];
      const ls = new LineString(pts);
      expect(ls.area().toUnit('mm')).toBeCloseTo(0);
    });

    test('translate returns new instance', () => {
      const pts = [
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(1)),
      ];
      const ls1 = new LineString(pts);
      const ls2 = ls1.translate(new Measurement(5), new Measurement(3));
      expect(ls1.points[0].x.toUnit('mm')).toBeCloseTo(0);
      expect(ls2.points[0].x.toUnit('mm')).toBeCloseTo(5);
    });

    test('rotate applies angle transformation', () => {
      const pts = [
        new Point(new Measurement(1), new Measurement(0)),
        new Point(new Measurement(0), new Measurement(1)),
      ];
      const ls = new LineString(pts);
      const rotated = ls.rotate(new Angle(Math.PI / 2, 'rad'), new Point(new Measurement(0), new Measurement(0)));
      expect(rotated.points[0].x.toUnit('mm')).toBeCloseTo(0, 4);
      expect(rotated.points[0].y.toUnit('mm')).toBeCloseTo(1, 4);
    });

    test('scale expands points from origin', () => {
      const pts = [
        new Point(new Measurement(1), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(2)),
      ];
      const ls = new LineString(pts);
      const scaled = ls.scale(2, new Point(new Measurement(0), new Measurement(0)));
      expect(scaled.points[0].x.toUnit('mm')).toBeCloseTo(2);
      expect(scaled.points[1].x.toUnit('mm')).toBeCloseTo(4);
    });

    test('boundingBox contains all points', () => {
      const pts = [
        new Point(new Measurement(1), new Measurement(2)),
        new Point(new Measurement(5), new Measurement(3)),
      ];
      const ls = new LineString(pts);
      const bbox = ls.boundingBox();
      expect(bbox.topLeft.x.toUnit('mm')).toBeCloseTo(1);
      expect(bbox.topLeft.y.toUnit('mm')).toBeCloseTo(2);
      expect(bbox.width.toUnit('mm')).toBeCloseTo(4);
    });

    test('contains checks point on segment', () => {
      const pts = [
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(0)),
      ];
      const ls = new LineString(pts);
      expect(ls.contains(new Point(new Measurement(2), new Measurement(0)))).toBe(true);
      expect(ls.contains(new Point(new Measurement(2), new Measurement(1)))).toBe(false);
    });

    test('toSvg generates path string', () => {
      const pts = [
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(10), new Measurement(10)),
      ];
      const ls = new LineString(pts);
      const svg = ls.toSvg();
      expect(svg).toContain('path');
      expect(svg).toContain('d=');
    });

    test('toJson serializes shape', () => {
      const pts = [
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(1)),
      ];
      const ls = new LineString(pts);
      const json = ls.toJson();
      expect(json.type).toBe('LineString');
      expect(json.points.length).toBe(2);
    });

    test('equals compares LineStrings', () => {
      const pts1 = [
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(1)),
      ];
      const pts2 = [
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(1)),
      ];
      const ls1 = new LineString(pts1);
      const ls2 = new LineString(pts2);
      expect(ls1.equals(ls2)).toBe(true);
    });
  });

  // ===== CIRCLE TESTS =====
  describe('Circle', () => {
    test('construction with center and radius', () => {
      const c = new Circle(new Point(new Measurement(0), new Measurement(0)), new Measurement(5));
      expect(c.radius.toUnit('mm')).toBe(5);
    });

    test('throws on non-positive radius', () => {
      expect(() => {
        new Circle(new Point(new Measurement(0), new Measurement(0)), new Measurement(-5));
      }).toThrow();
      expect(() => {
        new Circle(new Point(new Measurement(0), new Measurement(0)), new Measurement(0));
      }).toThrow();
    });

    test('area calculation is correct', () => {
      const c = new Circle(new Point(new Measurement(0), new Measurement(0)), new Measurement(1));
      expect(c.area().toUnit('mm')).toBeCloseTo(Math.PI);
    });

    test('perimeter calculation is correct', () => {
      const c = new Circle(new Point(new Measurement(0), new Measurement(0)), new Measurement(1));
      expect(c.perimeter().toUnit('mm')).toBeCloseTo(2 * Math.PI);
    });

    test('translate moves center', () => {
      const c1 = new Circle(new Point(new Measurement(0), new Measurement(0)), new Measurement(5));
      const c2 = c1.translate(new Measurement(3), new Measurement(4));
      expect(c2.center.x.toUnit('mm')).toBeCloseTo(3);
      expect(c2.center.y.toUnit('mm')).toBeCloseTo(4);
      expect(c2.radius.toUnit('mm')).toBeCloseTo(5);
    });

    test('rotate moves center around origin', () => {
      const c = new Circle(new Point(new Measurement(1), new Measurement(0)), new Measurement(5));
      const rotated = c.rotate(new Angle(Math.PI / 2, 'rad'), new Point(new Measurement(0), new Measurement(0)));
      expect(rotated.center.x.toUnit('mm')).toBeCloseTo(0, 4);
      expect(rotated.center.y.toUnit('mm')).toBeCloseTo(1, 4);
    });

    test('scale increases radius', () => {
      const c = new Circle(new Point(new Measurement(0), new Measurement(0)), new Measurement(1));
      const scaled = c.scale(3, new Point(new Measurement(0), new Measurement(0)));
      expect(scaled.radius.toUnit('mm')).toBeCloseTo(3);
    });

    test('boundingBox encompasses circle', () => {
      const c = new Circle(new Point(new Measurement(0), new Measurement(0)), new Measurement(5));
      const bbox = c.boundingBox();
      expect(bbox.width.toUnit('mm')).toBeCloseTo(10);
      expect(bbox.height.toUnit('mm')).toBeCloseTo(10);
    });

    test('contains point inside circle', () => {
      const c = new Circle(new Point(new Measurement(0), new Measurement(0)), new Measurement(5));
      expect(c.contains(new Point(new Measurement(0), new Measurement(0)))).toBe(true);
      expect(c.contains(new Point(new Measurement(3), new Measurement(0)))).toBe(true);
      expect(c.contains(new Point(new Measurement(6), new Measurement(0)))).toBe(false);
    });

    test('toSvg generates circle element', () => {
      const c = new Circle(new Point(new Measurement(0), new Measurement(0)), new Measurement(5));
      const svg = c.toSvg();
      expect(svg).toContain('circle');
      expect(svg).toContain('cx=');
      expect(svg).toContain('cy=');
      expect(svg).toContain('r=');
    });

    test('toJson serializes shape', () => {
      const c = new Circle(new Point(new Measurement(5), new Measurement(10)), new Measurement(7));
      const json = c.toJson();
      expect(json.type).toBe('Circle');
      expect(json.center.x).toBe(5);
      expect(json.radius).toBe(7);
    });
  });

  // ===== RECTANGLE TESTS =====
  describe('Rectangle', () => {
    test('construction with topLeft, width, height', () => {
      const r = new Rectangle(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(10),
        new Measurement(5)
      );
      expect(r.width.toUnit('mm')).toBe(10);
      expect(r.height.toUnit('mm')).toBe(5);
    });

    test('throws on non-positive dimensions', () => {
      expect(() => {
        new Rectangle(new Point(new Measurement(0), new Measurement(0)), new Measurement(-5), new Measurement(5));
      }).toThrow();
    });

    test('area calculation is correct', () => {
      const r = new Rectangle(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(4),
        new Measurement(3)
      );
      expect(r.area().toUnit('mm')).toBeCloseTo(12);
    });

    test('perimeter calculation is correct', () => {
      const r = new Rectangle(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(4),
        new Measurement(3)
      );
      expect(r.perimeter().toUnit('mm')).toBeCloseTo(14);
    });

    test('contains point inside rectangle', () => {
      const r = new Rectangle(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(10),
        new Measurement(10)
      );
      expect(r.contains(new Point(new Measurement(5), new Measurement(5)))).toBe(true);
      expect(r.contains(new Point(new Measurement(11), new Measurement(5)))).toBe(false);
    });

    test('boundingBox returns self', () => {
      const r = new Rectangle(
        new Point(new Measurement(1), new Measurement(2)),
        new Measurement(5),
        new Measurement(3)
      );
      const bbox = r.boundingBox();
      expect(bbox).toBe(r);
    });

    test('toSvg generates rect element', () => {
      const r = new Rectangle(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(10),
        new Measurement(5)
      );
      const svg = r.toSvg();
      expect(svg).toContain('rect');
      expect(svg).toContain('x=');
      expect(svg).toContain('width=');
    });
  });

  // ===== TRIANGLE TESTS =====
  describe('Triangle', () => {
    test('construction with three non-collinear points', () => {
      const t = new Triangle(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(0)),
        new Point(new Measurement(0), new Measurement(3))
      );
      expect(t.area().toUnit('mm')).toBeCloseTo(6);
    });

    test('throws on collinear points', () => {
      expect(() => {
        new Triangle(
          new Point(new Measurement(0), new Measurement(0)),
          new Point(new Measurement(1), new Measurement(1)),
          new Point(new Measurement(2), new Measurement(2))
        );
      }).toThrow();
    });

    test('perimeter sums side lengths', () => {
      const t = new Triangle(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(3), new Measurement(0)),
        new Point(new Measurement(0), new Measurement(4))
      );
      expect(t.perimeter().toUnit('mm')).toBeCloseTo(12);
    });

    test('translate moves all vertices', () => {
      const t1 = new Triangle(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(0)),
        new Point(new Measurement(0), new Measurement(1))
      );
      const t2 = t1.translate(new Measurement(5), new Measurement(3));
      expect(t2.a.x.toUnit('mm')).toBeCloseTo(5);
      expect(t2.a.y.toUnit('mm')).toBeCloseTo(3);
    });

    test('rotate applies angle around origin', () => {
      const t = new Triangle(
        new Point(new Measurement(1), new Measurement(0)),
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(1))
      );
      const rotated = t.rotate(new Angle(Math.PI / 2, 'rad'), new Point(new Measurement(0), new Measurement(0)));
      expect(rotated.a.x.toUnit('mm')).toBeCloseTo(0, 4);
      expect(rotated.a.y.toUnit('mm')).toBeCloseTo(1, 4);
    });

    test('scale expands from origin', () => {
      const t = new Triangle(
        new Point(new Measurement(1), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(1)),
        new Point(new Measurement(1), new Measurement(2))
      );
      const scaled = t.scale(2, new Point(new Measurement(0), new Measurement(0)));
      expect(scaled.a.x.toUnit('mm')).toBeCloseTo(2);
      expect(scaled.a.y.toUnit('mm')).toBeCloseTo(2);
    });

    test('contains point inside triangle', () => {
      const t = new Triangle(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(0)),
        new Point(new Measurement(2), new Measurement(3))
      );
      expect(t.contains(new Point(new Measurement(2), new Measurement(1)))).toBe(true);
      expect(t.contains(new Point(new Measurement(0), new Measurement(4)))).toBe(false);
    });

    test('toJson serializes vertices', () => {
      const t = new Triangle(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(0)),
        new Point(new Measurement(0), new Measurement(1))
      );
      const json = t.toJson();
      expect(json.type).toBe('Triangle');
      expect(json.a).toBeDefined();
      expect(json.b).toBeDefined();
      expect(json.c).toBeDefined();
    });
  });

  // ===== POLYGON TESTS =====
  describe('Polygon', () => {
    test('construction requires >= 3 points', () => {
      const pts = [
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(1)),
      ];
      const p = new Polygon(pts);
      expect(p.points.length).toBe(3);
    });

    test('throws on < 3 points', () => {
      expect(() => {
        new Polygon([
          new Point(new Measurement(0), new Measurement(0)),
          new Point(new Measurement(1), new Measurement(1)),
        ]);
      }).toThrow();
    });

    test('area calculation using shoelace formula', () => {
      const pts = [
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(4)),
        new Point(new Measurement(0), new Measurement(4)),
      ];
      const p = new Polygon(pts);
      expect(p.area().toUnit('mm')).toBeCloseTo(16);
    });

    test('perimeter sums all side lengths', () => {
      const pts = [
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(3), new Measurement(0)),
        new Point(new Measurement(0), new Measurement(4)),
      ];
      const p = new Polygon(pts);
      expect(p.perimeter().toUnit('mm')).toBeCloseTo(12);
    });

    test('contains point inside polygon', () => {
      const pts = [
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(4)),
        new Point(new Measurement(0), new Measurement(4)),
      ];
      const p = new Polygon(pts);
      expect(p.contains(new Point(new Measurement(2), new Measurement(2)))).toBe(true);
      expect(p.contains(new Point(new Measurement(5), new Measurement(2)))).toBe(false);
    });

    test('toJson serializes all points', () => {
      const pts = [
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(1)),
      ];
      const p = new Polygon(pts);
      const json = p.toJson();
      expect(json.type).toBe('Polygon');
      expect(json.points.length).toBe(3);
    });
  });

  // ===== POLYGON WITH HOLES TESTS =====
  describe('PolygonWithHoles', () => {
    test('construction with outer polygon and holes', () => {
      const outer = new Polygon([
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(4)),
        new Point(new Measurement(0), new Measurement(4)),
      ]);
      const hole = new Polygon([
        new Point(new Measurement(1), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(2)),
        new Point(new Measurement(1), new Measurement(2)),
      ]);
      const p = new PolygonWithHoles(outer, [hole]);
      expect(p.outer).toBe(outer);
      expect(p.holes.length).toBe(1);
    });

    test('area subtracts hole area', () => {
      const outer = new Polygon([
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(4)),
        new Point(new Measurement(0), new Measurement(4)),
      ]);
      const hole = new Polygon([
        new Point(new Measurement(1), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(2)),
        new Point(new Measurement(1), new Measurement(2)),
      ]);
      const p = new PolygonWithHoles(outer, [hole]);
      expect(p.area().toUnit('mm')).toBeCloseTo(15);
    });

    test('contains excludes points in holes', () => {
      const outer = new Polygon([
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(4)),
        new Point(new Measurement(0), new Measurement(4)),
      ]);
      const hole = new Polygon([
        new Point(new Measurement(1), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(2)),
        new Point(new Measurement(1), new Measurement(2)),
      ]);
      const p = new PolygonWithHoles(outer, [hole]);
      expect(p.contains(new Point(new Measurement(0.5), new Measurement(0.5)))).toBe(true);
      expect(p.contains(new Point(new Measurement(1.5), new Measurement(1.5)))).toBe(false);
    });

    test('translate moves outer and all holes', () => {
      const outer = new Polygon([
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(4)),
        new Point(new Measurement(0), new Measurement(4)),
      ]);
      const hole = new Polygon([
        new Point(new Measurement(1), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(2)),
        new Point(new Measurement(1), new Measurement(2)),
      ]);
      const p1 = new PolygonWithHoles(outer, [hole]);
      const p2 = p1.translate(new Measurement(5), new Measurement(3));
      expect(p2.outer.points[0].x.toUnit('mm')).toBeCloseTo(5);
      expect(p2.holes[0].points[0].x.toUnit('mm')).toBeCloseTo(6);
    });

    test('toJson includes outer and holes', () => {
      const outer = new Polygon([
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(4)),
      ]);
      const hole = new Polygon([
        new Point(new Measurement(1), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(2)),
      ]);
      const p = new PolygonWithHoles(outer, [hole]);
      const json = p.toJson();
      expect(json.type).toBe('PolygonWithHoles');
      expect(json.outer).toBeDefined();
      expect(json.holes.length).toBe(1);
    });
  });

  // ===== ARC TESTS =====
  describe('Arc', () => {
    test('construction with center, radius, start and end angles', () => {
      const arc = new Arc(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(5),
        new Angle(0, 'rad'),
        new Angle(Math.PI / 2, 'rad')
      );
      expect(arc.radius.toUnit('mm')).toBe(5);
    });

    test('throws on non-positive radius', () => {
      expect(() => {
        new Arc(
          new Point(new Measurement(0), new Measurement(0)),
          new Measurement(-5),
          new Angle(0, 'rad'),
          new Angle(Math.PI / 2, 'rad')
        );
      }).toThrow();
    });

    test('area calculation for quarter circle', () => {
      const arc = new Arc(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(10),
        new Angle(0, 'rad'),
        new Angle(Math.PI / 2, 'rad')
      );
      expect(arc.area().toUnit('mm')).toBeCloseTo(0.5 * 10 * 10 * (Math.PI / 2));
    });

    test('perimeter is arc length', () => {
      const arc = new Arc(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(10),
        new Angle(0, 'rad'),
        new Angle(Math.PI / 2, 'rad')
      );
      expect(arc.perimeter().toUnit('mm')).toBeCloseTo(10 * (Math.PI / 2));
    });

    test('translate moves center', () => {
      const arc1 = new Arc(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(5),
        new Angle(0, 'rad'),
        new Angle(Math.PI / 2, 'rad')
      );
      const arc2 = arc1.translate(new Measurement(3), new Measurement(4));
      expect(arc2.center.x.toUnit('mm')).toBeCloseTo(3);
      expect(arc2.center.y.toUnit('mm')).toBeCloseTo(4);
    });

    test('rotate rotates center and angles', () => {
      const arc = new Arc(
        new Point(new Measurement(5), new Measurement(0)),
        new Measurement(5),
        new Angle(0, 'rad'),
        new Angle(Math.PI / 2, 'rad')
      );
      const rotated = arc.rotate(new Angle(Math.PI / 2, 'rad'), new Point(new Measurement(0), new Measurement(0)));
      expect(rotated.center.x.toUnit('mm')).toBeCloseTo(0, 4);
      expect(rotated.center.y.toUnit('mm')).toBeCloseTo(5, 4);
    });

    test('scale increases radius', () => {
      const arc = new Arc(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(5),
        new Angle(0, 'rad'),
        new Angle(Math.PI / 2, 'rad')
      );
      const scaled = arc.scale(2, new Point(new Measurement(0), new Measurement(0)));
      expect(scaled.radius.toUnit('mm')).toBeCloseTo(10);
    });

    test('boundingBox encompasses arc', () => {
      const arc = new Arc(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(5),
        new Angle(0, 'rad'),
        new Angle(Math.PI / 2, 'rad')
      );
      const bbox = arc.boundingBox();
      expect(bbox.width.toUnit('mm')).toBeGreaterThan(0);
    });

    test('toSvg generates arc path', () => {
      const arc = new Arc(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(5),
        new Angle(0, 'rad'),
        new Angle(Math.PI / 2, 'rad')
      );
      const svg = arc.toSvg();
      expect(svg).toContain('path');
      expect(svg).toContain('A');
    });

    test('toJson serializes arc properties', () => {
      const arc = new Arc(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(5),
        new Angle(0, 'rad'),
        new Angle(Math.PI / 2, 'rad')
      );
      const json = arc.toJson();
      expect(json.type).toBe('Arc');
      expect(json.center).toBeDefined();
      expect(json.radius).toBe(5);
    });
  });

  // ===== BEZIER CURVE TESTS =====
  describe('BezierCurve', () => {
    test('construction with 4 control points', () => {
      const b = new BezierCurve(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(2)),
        new Point(new Measurement(3), new Measurement(2)),
        new Point(new Measurement(4), new Measurement(0))
      );
      expect(b.p0).toBeDefined();
      expect(b.p3).toBeDefined();
    });

    test('area is zero for curve', () => {
      const b = new BezierCurve(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(2)),
        new Point(new Measurement(3), new Measurement(2)),
        new Point(new Measurement(4), new Measurement(0))
      );
      expect(b.area().toUnit('mm')).toBeCloseTo(0);
    });

    test('perimeter approximates curve length', () => {
      const b = new BezierCurve(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(2)),
        new Point(new Measurement(3), new Measurement(2)),
        new Point(new Measurement(4), new Measurement(0))
      );
      const len = b.perimeter().toUnit('mm');
      expect(len).toBeGreaterThan(4);
    });

    test('translate moves all control points', () => {
      const b1 = new BezierCurve(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(2)),
        new Point(new Measurement(3), new Measurement(2)),
        new Point(new Measurement(4), new Measurement(0))
      );
      const b2 = b1.translate(new Measurement(5), new Measurement(3));
      expect(b2.p0.x.toUnit('mm')).toBeCloseTo(5);
      expect(b2.p3.x.toUnit('mm')).toBeCloseTo(9);
    });

    test('rotate applies angle to all control points', () => {
      const b = new BezierCurve(
        new Point(new Measurement(1), new Measurement(0)),
        new Point(new Measurement(2), new Measurement(0)),
        new Point(new Measurement(3), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(0))
      );
      const rotated = b.rotate(new Angle(Math.PI / 2, 'rad'), new Point(new Measurement(0), new Measurement(0)));
      expect(rotated.p0.y.toUnit('mm')).toBeCloseTo(1, 4);
    });

    test('scale expands all control points', () => {
      const b = new BezierCurve(
        new Point(new Measurement(1), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(2)),
        new Point(new Measurement(3), new Measurement(3)),
        new Point(new Measurement(4), new Measurement(4))
      );
      const scaled = b.scale(2, new Point(new Measurement(0), new Measurement(0)));
      expect(scaled.p0.x.toUnit('mm')).toBeCloseTo(2);
      expect(scaled.p3.x.toUnit('mm')).toBeCloseTo(8);
    });

    test('boundingBox encompasses curve samples', () => {
      const b = new BezierCurve(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(5), new Measurement(10)),
        new Point(new Measurement(5), new Measurement(10)),
        new Point(new Measurement(10), new Measurement(0))
      );
      const bbox = b.boundingBox();
      expect(bbox.width.toUnit('mm')).toBeGreaterThan(0);
    });

    test('contains checks if point is on curve', () => {
      const b = new BezierCurve(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(1)),
        new Point(new Measurement(1), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(0))
      );
      expect(b.contains(new Point(new Measurement(0), new Measurement(0)))).toBe(true);
    });

    test('toSvg generates Bezier path', () => {
      const b = new BezierCurve(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(2)),
        new Point(new Measurement(3), new Measurement(2)),
        new Point(new Measurement(4), new Measurement(0))
      );
      const svg = b.toSvg();
      expect(svg).toContain('path');
      expect(svg).toContain('C');
    });

    test('toJson serializes control points', () => {
      const b = new BezierCurve(
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(1), new Measurement(2)),
        new Point(new Measurement(3), new Measurement(2)),
        new Point(new Measurement(4), new Measurement(0))
      );
      const json = b.toJson();
      expect(json.type).toBe('BezierCurve');
      expect(json.p0).toBeDefined();
      expect(json.p3).toBeDefined();
    });
  });

  // ===== ELLIPSE TESTS =====
  describe('Ellipse', () => {
    test('construction with center and radii', () => {
      const e = new Ellipse(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(5),
        new Measurement(3)
      );
      expect(e.radiusX.toUnit('mm')).toBe(5);
      expect(e.radiusY.toUnit('mm')).toBe(3);
    });

    test('throws on non-positive radius', () => {
      expect(() => {
        new Ellipse(
          new Point(new Measurement(0), new Measurement(0)),
          new Measurement(-5),
          new Measurement(3)
        );
      }).toThrow();
    });

    test('area calculation is correct', () => {
      const e = new Ellipse(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(5),
        new Measurement(3)
      );
      expect(e.area().toUnit('mm')).toBeCloseTo(Math.PI * 5 * 3);
    });

    test('translate moves center', () => {
      const e1 = new Ellipse(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(5),
        new Measurement(3)
      );
      const e2 = e1.translate(new Measurement(2), new Measurement(4));
      expect(e2.center.x.toUnit('mm')).toBeCloseTo(2);
      expect(e2.center.y.toUnit('mm')).toBeCloseTo(4);
    });

    test('scale increases radii', () => {
      const e = new Ellipse(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(5),
        new Measurement(3)
      );
      const scaled = e.scale(2, new Point(new Measurement(0), new Measurement(0)));
      expect(scaled.radiusX.toUnit('mm')).toBeCloseTo(10);
      expect(scaled.radiusY.toUnit('mm')).toBeCloseTo(6);
    });

    test('contains point inside ellipse', () => {
      const e = new Ellipse(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(5),
        new Measurement(3)
      );
      expect(e.contains(new Point(new Measurement(0), new Measurement(0)))).toBe(true);
      expect(e.contains(new Point(new Measurement(2), new Measurement(1)))).toBe(true);
      expect(e.contains(new Point(new Measurement(6), new Measurement(0)))).toBe(false);
    });

    test('toSvg generates ellipse element', () => {
      const e = new Ellipse(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(5),
        new Measurement(3)
      );
      const svg = e.toSvg();
      expect(svg).toContain('ellipse');
      expect(svg).toContain('rx=');
      expect(svg).toContain('ry=');
    });

    test('toJson serializes ellipse properties', () => {
      const e = new Ellipse(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(5),
        new Measurement(3)
      );
      const json = e.toJson();
      expect(json.type).toBe('Ellipse');
      expect(json.radiusX).toBe(5);
      expect(json.radiusY).toBe(3);
    });
  });

  // ===== INTERACTION & COMPOSITION TESTS =====
  describe('Shape Interactions and Composition', () => {
    test('circle and rectangle intersection via bbox', () => {
      const c = new Circle(new Point(new Measurement(0), new Measurement(0)), new Measurement(5));
      const r = new Rectangle(
        new Point(new Measurement(3), new Measurement(3)),
        new Measurement(2),
        new Measurement(2)
      );
      expect(c.intersects(r)).toBe(true);
    });

    test('polygon and polygon intersection', () => {
      const p1 = new Polygon([
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(0)),
        new Point(new Measurement(4), new Measurement(4)),
        new Point(new Measurement(0), new Measurement(4)),
      ]);
      const p2 = new Polygon([
        new Point(new Measurement(2), new Measurement(2)),
        new Point(new Measurement(6), new Measurement(2)),
        new Point(new Measurement(6), new Measurement(6)),
        new Point(new Measurement(2), new Measurement(6)),
      ]);
      expect(p1.intersects(p2)).toBe(true);
    });

    test('chain transformations preserve immutability', () => {
      const c1 = new Circle(
        new Point(new Measurement(0), new Measurement(0)),
        new Measurement(5)
      );
      const c2 = c1.translate(new Measurement(10), new Measurement(0));
      const c3 = c2.scale(2, new Point(new Measurement(10), new Measurement(0)));
      const c4 = c3.rotate(new Angle(Math.PI / 4, 'rad'), new Point(new Measurement(10), new Measurement(0)));

      expect(c1.center.x.toUnit('mm')).toBeCloseTo(0);
      expect(c1.radius.toUnit('mm')).toBeCloseTo(5);
      expect(c2.center.x.toUnit('mm')).toBeCloseTo(10);
      expect(c3.radius.toUnit('mm')).toBeCloseTo(10);
    });

    test('multiple holes in polygon with holes', () => {
      const outer = new Polygon([
        new Point(new Measurement(0), new Measurement(0)),
        new Point(new Measurement(10), new Measurement(0)),
        new Point(new Measurement(10), new Measurement(10)),
        new Point(new Measurement(0), new Measurement(10)),
      ]);
      const hole1 = new Polygon([
        new Point(new Measurement(1), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(1)),
        new Point(new Measurement(2), new Measurement(2)),
        new Point(new Measurement(1), new Measurement(2)),
      ]);
      const hole2 = new Polygon([
        new Point(new Measurement(7), new Measurement(7)),
        new Point(new Measurement(8), new Measurement(7)),
        new Point(new Measurement(8), new Measurement(8)),
        new Point(new Measurement(7), new Measurement(8)),
      ]);
      const p = new PolygonWithHoles(outer, [hole1, hole2]);
      expect(p.area().toUnit('mm')).toBeCloseTo(100 - 1 - 1);
      expect(p.contains(new Point(new Measurement(5), new Measurement(5)))).toBe(true);
      expect(p.contains(new Point(new Measurement(1.5), new Measurement(1.5)))).toBe(false);
    });
  });

  // ===== DPI / MEASUREMENT HANDLING TESTS =====
  describe('DPI and Measurement Handling', () => {
    test('Measurement conversions preserve values', () => {
      const m = new Measurement(25.4, 'mm');
      expect(m.toUnit('mm')).toBeCloseTo(25.4);
    });

    test('shapes maintain dimensions through unit conversions', () => {
      const c = new Circle(
        new Point(new Measurement(10, 'mm'), new Measurement(10, 'mm')),
        new Measurement(5, 'mm')
      );
      expect(c.radius.toUnit('mm')).toBeCloseTo(5);
    });

    test('distance calculations respect Measurement units', () => {
      const p1 = new Point(new Measurement(0, 'mm'), new Measurement(0, 'mm'));
      const p2 = new Point(new Measurement(10, 'mm'), new Measurement(0, 'mm'));
      expect(p1.distanceTo(p2).toUnit('mm')).toBeCloseTo(10);
    });
  });
});
