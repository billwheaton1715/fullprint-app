import Shape from './Shape';
import Measurement from '../units/Measurement';
import Point from './Point';
import Angle from '../units/Angle';
import utils from './utils';
import Rectangle from './Rectangle';

export class Circle extends Shape {
  readonly center: Point;
  readonly radius: Measurement;

  constructor(center: Point, radius: Measurement) {
    super();
    if (radius.compareTo(new Measurement(0)) <= 0) {
      throw new Error('Radius must be positive');
    }
    this.center = center;
    this.radius = radius;
  }

  area(): Measurement {
    const rMm = this.radius.toUnit('mm');
    return new Measurement(Math.PI * Math.pow(rMm, 2), 'mm');
  }

  perimeter(): Measurement {
    const rMm = this.radius.toUnit('mm');
    return new Measurement(2 * Math.PI * rMm, 'mm');
  }

  translate(dx: Measurement, dy: Measurement): Circle {
    return new Circle(this.center.translate(dx, dy), this.radius);
  }

  rotate(angle: Angle, origin: Point): Circle {
    return new Circle(utils.rotatePoint(this.center, angle, origin), this.radius);
  }

  scale(factor: number, origin: Point): Circle {
    return new Circle(utils.scalePoint(this.center, factor, origin), this.radius.multiply(factor));
  }

  boundingBox(): Rectangle {
    const r = this.radius.toUnit('mm');
    return new Rectangle(
      new Point(new Measurement(this.center.x.toUnit('mm') - r, 'mm'), new Measurement(this.center.y.toUnit('mm') - r, 'mm')),
      new Measurement(2 * r, 'mm'),
      new Measurement(2 * r, 'mm')
    );
  }

  intersects(other: Shape): boolean {
    return utils.bboxIntersects(this.boundingBox(), other.boundingBox());
  }

  contains(point: Point): boolean {
    const d = this.center.distanceTo(point).toUnit('mm');
    const r = this.radius.toUnit('mm');
    return d <= r;
  }

  toSvg(): string {
    const r = this.radius.toUnit('px');
    const cx = this.center.x.toUnit('px');
    const cy = this.center.y.toUnit('px');
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="black"/>`;
  }

  toCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(this.center.x.toUnit('px'), this.center.y.toUnit('px'), this.radius.toUnit('px'), 0, 2 * Math.PI);
    ctx.stroke();
  }

  toJson() {
    return { type: 'Circle', center: { x: this.center.x.toUnit('mm'), y: this.center.y.toUnit('mm') }, radius: this.radius.toUnit('mm') };
  }

  equals(other: Shape): boolean {
    if (!(other instanceof Circle)) return false;
    return this.center.equals(other.center) && this.radius.equals(other.radius);
  }
}

export default Circle;
