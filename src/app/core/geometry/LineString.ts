import Shape from './Shape';
import Point from './Point';
import Measurement from '../units/Measurement';
import Angle from '../units/Angle';
import utils from './utils';

export class LineString extends Shape {
    // Canonical API wrappers for compatibility
    override getBoundingBox() {
      return this.boundingBox();
    }

    override containsPoint(point: Point): boolean {
      return this.contains(point);
    }

    override intersectsRect(rect: any): boolean {
      if (typeof rect.intersects === 'function') {
        return this.intersects(rect);
      }
      return utils.bboxIntersects(this.getBoundingBox(), rect);
    }
  readonly points: Point[];

  constructor(points: Point[]) {
    super();
    if (!points || points.length < 2) throw new Error('LineString requires >= 2 points');
    this.points = points.slice();
  }

  area(): Measurement {
    return new Measurement(0, 'mm');
  }

  perimeter(): Measurement {
    let peri = 0;
    for (let i = 0; i < this.points.length - 1; i++) {
      peri += this.points[i].distanceTo(this.points[i + 1]).toUnit('mm');
    }
    return new Measurement(peri, 'mm');
  }

  translate(dx: Measurement, dy: Measurement): LineString {
    return new LineString(this.points.map(p => utils.translatePoint(p, dx, dy)));
  }

  rotate(angle: Angle, origin: Point): LineString {
    return new LineString(this.points.map(p => utils.rotatePoint(p, angle, origin)));
  }

  scale(factor: number, origin: Point): LineString {
    return new LineString(this.points.map(p => utils.scalePoint(p, factor, origin)));
  }

  boundingBox() {
    return utils.boundingBoxFromPoints(this.points);
  }

  intersects(other: Shape): boolean {
    return utils.bboxIntersects(this.getBoundingBox(), other.getBoundingBox());
  }

  contains(point: Point): boolean {
    // LineString contains a point only if it lies on any segment (approx)
    const eps = 1e-6;
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const d1 = a.distanceTo(point).toUnit('mm');
      const d2 = b.distanceTo(point).toUnit('mm');
      const d = a.distanceTo(b).toUnit('mm');
      if (Math.abs(d - (d1 + d2)) < eps) return true;
    }
    return false;
  }

  toSvg(): string {
    const d = this.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toUnit('px')} ${p.y.toUnit('px')}`).join(' ');
    return `<path d="${d}" fill="none" stroke="black"/>`;
  }

  toCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(this.points[0].x.toUnit('px'), this.points[0].y.toUnit('px'));
    for (let i = 1; i < this.points.length; i++) ctx.lineTo(this.points[i].x.toUnit('px'), this.points[i].y.toUnit('px'));
    ctx.stroke();
  }

  toJson() {
    return { type: 'LineString', points: this.points.map(p => ({ x: p.x.toUnit('mm'), y: p.y.toUnit('mm') })) };
  }

  equals(other: Shape): boolean {
    if (!(other instanceof LineString)) return false;
    if (other.points.length !== this.points.length) return false;
    for (let i = 0; i < this.points.length; i++) if (!this.points[i].equals(other.points[i])) return false;
    return true;
  }
}

export default LineString;
