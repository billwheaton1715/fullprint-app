import Shape from './Shape';
import Measurement from '../units/Measurement';
import Point from './Point';
import Angle from '../units/Angle';
import utils from './utils';

export class Rectangle extends Shape {
  readonly topLeft: Point;
  readonly width: Measurement;
  readonly height: Measurement;

  constructor(topLeft: Point, width: Measurement, height: Measurement) {
    super();
    if (width.compareTo(new Measurement(0)) <= 0 || height.compareTo(new Measurement(0)) <= 0) {
      throw new Error('Width and height must be positive');
    }
    this.topLeft = topLeft;
    this.width = width;
    this.height = height;
  }

  area(): Measurement {
    // Represent area numerically in mm (value = area in mm^2)
    const w = this.width.toUnit('mm');
    const h = this.height.toUnit('mm');
    return new Measurement(w * h, 'mm');
  }

  perimeter(): Measurement {
    return this.width.add(this.height).multiply(2);
  }

  translate(dx: Measurement, dy: Measurement): Rectangle {
    return new Rectangle(this.topLeft.translate(dx, dy), this.width, this.height);
  }

  rotate(angle: Angle, origin: Point): Rectangle {
    // Rotate the four corners, then find new bounding box
    const tl = this.topLeft;
    const tr = new Point(tl.x.add(this.width), tl.y);
    const bl = new Point(tl.x, tl.y.add(this.height));
    const br = new Point(tl.x.add(this.width), tl.y.add(this.height));
    const corners = [tl, tr, bl, br].map(p => utils.rotatePoint(p, angle, origin));
    return utils.boundingBoxFromPoints(corners) as Rectangle;
  }

  scale(factor: number, origin: Point): Rectangle {
    const newTl = utils.scalePoint(this.topLeft, factor, origin);
    return new Rectangle(newTl, this.width.multiply(factor), this.height.multiply(factor));
  }

  boundingBox() {
    return this;
  }

  intersects(other: Shape): boolean {
    return utils.bboxIntersects(this, other.boundingBox());
  }

  contains(point: Point): boolean {
    const x = point.x.toUnit('mm');
    const y = point.y.toUnit('mm');
    const tlx = this.topLeft.x.toUnit('mm');
    const tly = this.topLeft.y.toUnit('mm');
    const w = this.width.toUnit('mm');
    const h = this.height.toUnit('mm');
    return x >= tlx && x <= tlx + w && y >= tly && y <= tly + h;
  }

  toSvg(): string {
    const x = this.topLeft.x.toUnit('px');
    const y = this.topLeft.y.toUnit('px');
    const w = this.width.toUnit('px');
    const h = this.height.toUnit('px');
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="black"/>`;
  }

  toCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.strokeRect(this.topLeft.x.toUnit('px'), this.topLeft.y.toUnit('px'), this.width.toUnit('px'), this.height.toUnit('px'));
  }

  toJson() {
    return { type: 'Rectangle', topLeft: { x: this.topLeft.x.toUnit('mm'), y: this.topLeft.y.toUnit('mm') }, width: this.width.toUnit('mm'), height: this.height.toUnit('mm') };
  }

  equals(other: Shape): boolean {
    if (!(other instanceof Rectangle)) return false;
    return (
      this.topLeft.equals(other.topLeft) &&
      this.width.equals(other.width) &&
      this.height.equals(other.height)
    );
  }
}

export default Rectangle;
