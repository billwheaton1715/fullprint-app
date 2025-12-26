import Shape from './Shape';
import Measurement from '../units/Measurement';
import Point from './Point';
import Angle from '../units/Angle';
import utils from './utils';

export class Polygon extends Shape {
  readonly points: Point[];

  constructor(points: Point[]) {
    super();
    if (!points || points.length < 3) throw new Error('Polygon requires >= 3 points');
    this.points = points.slice();
  }

  area(): Measurement {
    // Shoelace formula
    let sum = 0;
    const n = this.points.length;
    for (let i = 0; i < n; i++) {
      const p1 = this.points[i];
      const p2 = this.points[(i + 1) % n];
      sum += p1.x.toUnit('mm') * p2.y.toUnit('mm') - p2.x.toUnit('mm') * p1.y.toUnit('mm');
    }
    return new Measurement(Math.abs(sum) / 2, 'mm');
  }

  perimeter(): Measurement {
    let peri = 0;
    const n = this.points.length;
    for (let i = 0; i < n; i++) {
      peri += this.points[i].distanceTo(this.points[(i + 1) % n]).toUnit('mm');
    }
    return new Measurement(peri, 'mm');
  }

  translate(dx: Measurement, dy: Measurement): Polygon {
    return new Polygon(this.points.map(p => p.translate(dx, dy)));
  }

  rotate(angle: Angle, origin: Point): Polygon {
    return new Polygon(this.points.map(p => utils.rotatePoint(p, angle, origin)));
  }

  scale(factor: number, origin: Point): Polygon {
    return new Polygon(this.points.map(p => utils.scalePoint(p, factor, origin)));
  }

  /**
   * Returns the axis-aligned bounding box of this polygon in world coordinates.
   */
  public override getBoundingBox() {
    return utils.boundingBoxFromPoints(this.points);
  }

  /**
   * Returns true if the given point is inside this polygon (world coordinates).
   */
  public override containsPoint(point: Point): boolean {
    return utils.pointInPolygon(point, this.points);
  }

  /**
   * Returns true if this polygon's bounding box intersects the given rectangle (AABB, world coordinates).
   */
  public override intersectsRect(rect: import('./Rectangle').Rectangle): boolean {
    return this.getBoundingBox().intersectsRect(rect);
  }

  // Legacy wrappers for compatibility
  public boundingBox() {
    return this.getBoundingBox();
  }
  public contains(point: Point): boolean {
    return this.containsPoint(point);
  }
  public intersects(other: Shape): boolean {
    // Use bounding box intersection for legacy
    return this.getBoundingBox().intersectsRect(other.getBoundingBox());
  }

  toSvg(): string {
    const d = this.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toUnit('px')} ${p.y.toUnit('px')}`).join(' ') + ' Z';
    return `<path d="${d}" fill="none" stroke="black"/>`;
  }

  toCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(this.points[0].x.toUnit('px'), this.points[0].y.toUnit('px'));
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x.toUnit('px'), this.points[i].y.toUnit('px'));
    }
    ctx.closePath();
    ctx.stroke();
  }

  toJson() {
    return { type: 'Polygon', points: this.points.map(p => ({ x: p.x.toUnit('mm'), y: p.y.toUnit('mm') })) };
  }

  equals(other: Shape): boolean {
    if (!(other instanceof Polygon)) return false;
    if (other.points.length !== this.points.length) return false;
    for (let i = 0; i < this.points.length; i++) {
      if (!this.points[i].equals(other.points[i])) return false;
    }
    return true;
  }
}

export default Polygon;
