import Shape from './Shape';
import Measurement from '../units/Measurement';
import Point from './Point';
import Angle from '../units/Angle';
import utils from './utils';

export class Triangle extends Shape {
  readonly a: Point;
  readonly b: Point;
  readonly c: Point;

  constructor(a: Point, b: Point, c: Point) {
    super();
    // simple non-collinear check using area
    const areaVal = Triangle.computeAreaValue(a, b, c);
    if (Math.abs(areaVal) === 0) {
      throw new Error('Points must not be collinear');
    }
    this.a = a;
    this.b = b;
    this.c = c;
  }

  static computeAreaValue(a: Point, b: Point, c: Point): number {
    const ax = a.x.toUnit('mm');
    const ay = a.y.toUnit('mm');
    const bx = b.x.toUnit('mm');
    const by = b.y.toUnit('mm');
    const cx = c.x.toUnit('mm');
    const cy = c.y.toUnit('mm');
    return 0.5 * ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay));
  }

  area(): Measurement {
    const areaAbs = Math.abs(Triangle.computeAreaValue(this.a, this.b, this.c));
    return new Measurement(areaAbs, 'mm');
  }

  perimeter(): Measurement {
    const ab = this.a.distanceTo(this.b).toUnit('mm');
    const bc = this.b.distanceTo(this.c).toUnit('mm');
    const ca = this.c.distanceTo(this.a).toUnit('mm');
    return new Measurement(ab + bc + ca, 'mm');
  }

  translate(dx: Measurement, dy: Measurement): Triangle {
    return new Triangle(this.a.translate(dx, dy), this.b.translate(dx, dy), this.c.translate(dx, dy));
  }

  rotate(angle: Angle, origin: Point): Triangle {
    return new Triangle(
      utils.rotatePoint(this.a, angle, origin),
      utils.rotatePoint(this.b, angle, origin),
      utils.rotatePoint(this.c, angle, origin)
    );
  }

  scale(factor: number, origin: Point): Triangle {
    return new Triangle(
      utils.scalePoint(this.a, factor, origin),
      utils.scalePoint(this.b, factor, origin),
      utils.scalePoint(this.c, factor, origin)
    );
  }

  boundingBox() {
    return utils.boundingBoxFromPoints([this.a, this.b, this.c]);
  }

  intersects(other: Shape): boolean {
    return utils.bboxIntersects(this.boundingBox(), other.boundingBox());
  }

  contains(point: Point): boolean {
    return utils.pointInPolygon(point, [this.a, this.b, this.c]);
  }

  toSvg(): string {
    const d = `M ${this.a.x.toUnit('px')} ${this.a.y.toUnit('px')} L ${this.b.x.toUnit('px')} ${this.b.y.toUnit('px')} L ${this.c.x.toUnit('px')} ${this.c.y.toUnit('px')} Z`;
    return `<path d="${d}" fill="none" stroke="black"/>`;
  }

  toCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(this.a.x.toUnit('px'), this.a.y.toUnit('px'));
    ctx.lineTo(this.b.x.toUnit('px'), this.b.y.toUnit('px'));
    ctx.lineTo(this.c.x.toUnit('px'), this.c.y.toUnit('px'));
    ctx.closePath();
    ctx.stroke();
  }

  toJson() {
    return { type: 'Triangle', a: { x: this.a.x.toUnit('mm'), y: this.a.y.toUnit('mm') }, b: { x: this.b.x.toUnit('mm'), y: this.b.y.toUnit('mm') }, c: { x: this.c.x.toUnit('mm'), y: this.c.y.toUnit('mm') } };
  }

  equals(other: Shape): boolean {
    if (!(other instanceof Triangle)) return false;
    return this.a.equals(other.a) && this.b.equals(other.b) && this.c.equals(other.c);
  }
}

export default Triangle;
