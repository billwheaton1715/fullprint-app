import Measurement from '../units/Measurement';
import Point from './Point';
import Rectangle from './Rectangle';
import Angle from '../units/Angle';

export function rotatePoint(p: Point, angle: Angle, origin: Point): Point {
  const theta = angle.toRadians();
  const ox = origin.x.toUnit('mm');
  const oy = origin.y.toUnit('mm');
  const px = p.x.toUnit('mm');
  const py = p.y.toUnit('mm');
  const x = Math.cos(theta) * (px - ox) - Math.sin(theta) * (py - oy) + ox;
  const y = Math.sin(theta) * (px - ox) + Math.cos(theta) * (py - oy) + oy;
  return new Point(new Measurement(x, 'mm'), new Measurement(y, 'mm'));
}

export function scalePoint(p: Point, factor: number, origin: Point): Point {
  const ox = origin.x.toUnit('mm');
  const oy = origin.y.toUnit('mm');
  const px = p.x.toUnit('mm');
  const py = p.y.toUnit('mm');
  const x = ox + (px - ox) * factor;
  const y = oy + (py - oy) * factor;
  return new Point(new Measurement(x, 'mm'), new Measurement(y, 'mm'));
}

export function translatePoint(p: Point, dx: Measurement, dy: Measurement): Point {
  return p.translate(dx, dy);
}

export function boundingBoxFromPoints(points: Point[]): Rectangle {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    const x = p.x.toUnit('mm');
    const y = p.y.toUnit('mm');
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return new Rectangle(new Point(new Measurement(minX, 'mm'), new Measurement(minY, 'mm')),
    new Measurement(maxX - minX, 'mm'), new Measurement(maxY - minY, 'mm'));
}

export function bboxIntersects(a: Rectangle, b: Rectangle): boolean {
  const ax1 = a.topLeft.x.toUnit('mm');
  const ay1 = a.topLeft.y.toUnit('mm');
  const ax2 = ax1 + a.width.toUnit('mm');
  const ay2 = ay1 + a.height.toUnit('mm');

  const bx1 = b.topLeft.x.toUnit('mm');
  const by1 = b.topLeft.y.toUnit('mm');
  const bx2 = bx1 + b.width.toUnit('mm');
  const by2 = by1 + b.height.toUnit('mm');

  return !(bx1 > ax2 || bx2 < ax1 || by1 > ay2 || by2 < ay1);
}

export function pointInPolygon(point: Point, pts: Point[]): boolean {
  // ray casting
  const x = point.x.toUnit('mm');
  const y = point.y.toUnit('mm');
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x.toUnit('mm'), yi = pts[i].y.toUnit('mm');
    const xj = pts[j].x.toUnit('mm'), yj = pts[j].y.toUnit('mm');
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + Number.EPSILON) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function sampleCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, steps = 16): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.pow(1 - t, 3) * p0.x.toUnit('mm') + 3 * Math.pow(1 - t, 2) * t * p1.x.toUnit('mm') + 3 * (1 - t) * Math.pow(t, 2) * p2.x.toUnit('mm') + Math.pow(t, 3) * p3.x.toUnit('mm');
    const y = Math.pow(1 - t, 3) * p0.y.toUnit('mm') + 3 * Math.pow(1 - t, 2) * t * p1.y.toUnit('mm') + 3 * (1 - t) * Math.pow(t, 2) * p2.y.toUnit('mm') + Math.pow(t, 3) * p3.y.toUnit('mm');
    pts.push(new Point(new Measurement(x, 'mm'), new Measurement(y, 'mm')));
  }
  return pts;
}

export function sampleQuadraticBezier(p0: Point, p1: Point, p2: Point, steps = 16): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.pow(1 - t, 2) * p0.x.toUnit('mm') + 2 * (1 - t) * t * p1.x.toUnit('mm') + Math.pow(t, 2) * p2.x.toUnit('mm');
    const y = Math.pow(1 - t, 2) * p0.y.toUnit('mm') + 2 * (1 - t) * t * p1.y.toUnit('mm') + Math.pow(t, 2) * p2.y.toUnit('mm');
    pts.push(new Point(new Measurement(x, 'mm'), new Measurement(y, 'mm')));
  }
  return pts;
}

export default {
  rotatePoint,
  scalePoint,
  translatePoint,
  boundingBoxFromPoints,
  bboxIntersects,
  pointInPolygon,
  sampleCubicBezier,
  sampleQuadraticBezier,
};
