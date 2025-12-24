import Shape from './Shape';
import Point from './Point';
import Measurement from '../units/Measurement';
import Angle from '../units/Angle';
import utils from './utils';

export class Arc extends Shape {
  readonly center: Point;
  readonly radius: Measurement;
  readonly start: Angle;
  readonly end: Angle;
  readonly clockwise: boolean;

  constructor(center: Point, radius: Measurement, start: Angle, end: Angle, clockwise = false) {
    super();
    if (radius.compareTo(new Measurement(0)) <= 0) throw new Error('Radius must be positive');
    this.center = center;
    this.radius = radius;
    this.start = start;
    this.end = end;
    this.clockwise = clockwise;
  }

  area(): Measurement {
    // sector area approximation: 0.5 * r^2 * theta
    const r = this.radius.toUnit('mm');
    let theta = Math.abs(this.end.toRadians() - this.start.toRadians());
    if (theta > Math.PI * 2) theta = theta % (2 * Math.PI);
    return new Measurement(0.5 * r * r * theta, 'mm');
  }

  perimeter(): Measurement {
    const r = this.radius.toUnit('mm');
    let theta = Math.abs(this.end.toRadians() - this.start.toRadians());
    if (theta > Math.PI * 2) theta = theta % (2 * Math.PI);
    return new Measurement(r * theta, 'mm');
  }

  translate(dx: Measurement, dy: Measurement): Arc {
    return new Arc(this.center.translate(dx, dy), this.radius, this.start, this.end, this.clockwise);
  }

  rotate(angle: Angle, origin: Point): Arc {
    const center = utils.rotatePoint(this.center, angle, origin);
    return new Arc(center, this.radius, this.start.add(angle), this.end.add(angle), this.clockwise);
  }

  scale(factor: number, origin: Point): Arc {
    const center = utils.scalePoint(this.center, factor, origin);
    return new Arc(center, this.radius.multiply(factor), this.start, this.end, this.clockwise);
  }

  boundingBox() {
    // sample points along arc and compute bbox
    const steps = 32;
    const pts = [];
    const r = this.radius.toUnit('mm');
    const start = this.start.toRadians();
    const end = this.end.toRadians();
    for (let i = 0; i <= steps; i++) {
      const t = start + (end - start) * (i / steps);
      const x = this.center.x.toUnit('mm') + r * Math.cos(t);
      const y = this.center.y.toUnit('mm') + r * Math.sin(t);
      pts.push(new Point(new Measurement(x, 'mm'), new Measurement(y, 'mm')));
    }
    return utils.boundingBoxFromPoints(pts);
  }

  intersects(other: Shape): boolean {
    return utils.bboxIntersects(this.boundingBox(), other.boundingBox());
  }

  contains(point: Point): boolean {
    const d = this.center.distanceTo(point).toUnit('mm');
    const r = this.radius.toUnit('mm');
    if (Math.abs(d - r) > 1e-6) return false;
    // check angle
    const angle = Math.atan2(point.y.toUnit('mm') - this.center.y.toUnit('mm'), point.x.toUnit('mm') - this.center.x.toUnit('mm'));
    const s = this.start.toRadians();
    const e = this.end.toRadians();
    const inRange = (angle >= Math.min(s, e) && angle <= Math.max(s, e));
    return inRange;
  }

  toSvg(): string {
    const r = this.radius.toUnit('px');
    const cx = this.center.x.toUnit('px');
    const cy = this.center.y.toUnit('px');
    const sx = cx + r * Math.cos(this.start.toRadians());
    const sy = cy + r * Math.sin(this.start.toRadians());
    const ex = cx + r * Math.cos(this.end.toRadians());
    const ey = cy + r * Math.sin(this.end.toRadians());
    const largeArc = Math.abs(this.end.toRadians() - this.start.toRadians()) > Math.PI ? 1 : 0;
    const sweep = this.clockwise ? 1 : 0;
    return `<path d="M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} ${sweep} ${ex} ${ey}" fill="none" stroke="black"/>`;
  }

  toCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    const r = this.radius.toUnit('px');
    const cx = this.center.x.toUnit('px');
    const cy = this.center.y.toUnit('px');
    ctx.arc(cx, cy, r, this.start.toRadians(), this.end.toRadians(), this.clockwise);
    ctx.stroke();
  }

  toJson() {
    return {
      type: 'Arc',
      center: { x: this.center.x.toUnit('mm'), y: this.center.y.toUnit('mm') },
      radius: this.radius.toUnit('mm'),
      start: this.start.toRadians(),
      end: this.end.toRadians(),
      clockwise: this.clockwise,
    };
  }

  equals(other: Shape): boolean {
    if (!(other instanceof Arc)) return false;
    return (
      this.center.equals(other.center) &&
      this.radius.equals(other.radius) &&
      this.start.equals(other.start) &&
      this.end.equals(other.end) &&
      this.clockwise === other.clockwise
    );
  }
}

export default Arc;
