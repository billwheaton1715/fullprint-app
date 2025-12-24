import Shape from './Shape';
import Point from './Point';
import Measurement from '../units/Measurement';
import Angle from '../units/Angle';
import utils from './utils';

export class BezierCurve extends Shape {
  readonly p0: Point;
  readonly p1: Point;
  readonly p2: Point;
  readonly p3: Point;

  constructor(p0: Point, p1: Point, p2: Point, p3: Point) {
    super();
    this.p0 = p0;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
  }

  area(): Measurement {
    return new Measurement(0, 'mm');
  }

  perimeter(): Measurement {
    const pts = utils.sampleCubicBezier(this.p0, this.p1, this.p2, this.p3, 64);
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) len += pts[i].distanceTo(pts[i + 1]).toUnit('mm');
    return new Measurement(len, 'mm');
  }

  translate(dx: Measurement, dy: Measurement): BezierCurve {
    return new BezierCurve(this.p0.translate(dx, dy), this.p1.translate(dx, dy), this.p2.translate(dx, dy), this.p3.translate(dx, dy));
  }

  rotate(angle: Angle, origin: Point): BezierCurve {
    return new BezierCurve(
      utils.rotatePoint(this.p0, angle, origin),
      utils.rotatePoint(this.p1, angle, origin),
      utils.rotatePoint(this.p2, angle, origin),
      utils.rotatePoint(this.p3, angle, origin),
    );
  }

  scale(factor: number, origin: Point): BezierCurve {
    return new BezierCurve(
      utils.scalePoint(this.p0, factor, origin),
      utils.scalePoint(this.p1, factor, origin),
      utils.scalePoint(this.p2, factor, origin),
      utils.scalePoint(this.p3, factor, origin),
    );
  }

  boundingBox() {
    const pts = utils.sampleCubicBezier(this.p0, this.p1, this.p2, this.p3, 32);
    return utils.boundingBoxFromPoints(pts);
  }

  intersects(other: Shape): boolean {
    return utils.bboxIntersects(this.boundingBox(), other.boundingBox());
  }

  contains(point: Point): boolean {
    // curve contains point only if on the curve (approx)
    const pts = utils.sampleCubicBezier(this.p0, this.p1, this.p2, this.p3, 64);
    const eps = 1e-6;
    for (const p of pts) {
      if (p.distanceTo(point).toUnit('mm') < eps) return true;
    }
    return false;
  }

  toSvg(): string {
    const p = (pt: Point) => `${pt.x.toUnit('px')} ${pt.y.toUnit('px')}`;
    return `<path d="M ${p(this.p0)} C ${p(this.p1)} ${p(this.p2)} ${p(this.p3)}" fill="none" stroke="black"/>`;
  }

  toCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(this.p0.x.toUnit('px'), this.p0.y.toUnit('px'));
    ctx.bezierCurveTo(this.p1.x.toUnit('px'), this.p1.y.toUnit('px'), this.p2.x.toUnit('px'), this.p2.y.toUnit('px'), this.p3.x.toUnit('px'), this.p3.y.toUnit('px'));
    ctx.stroke();
  }

  toJson() {
    return {
      type: 'BezierCurve',
      p0: { x: this.p0.x.toUnit('mm'), y: this.p0.y.toUnit('mm') },
      p1: { x: this.p1.x.toUnit('mm'), y: this.p1.y.toUnit('mm') },
      p2: { x: this.p2.x.toUnit('mm'), y: this.p2.y.toUnit('mm') },
      p3: { x: this.p3.x.toUnit('mm'), y: this.p3.y.toUnit('mm') },
    };
  }

  equals(other: Shape): boolean {
    if (!(other instanceof BezierCurve)) return false;
    return this.p0.equals(other.p0) && this.p1.equals(other.p1) && this.p2.equals(other.p2) && this.p3.equals(other.p3);
  }
}

export default BezierCurve;
