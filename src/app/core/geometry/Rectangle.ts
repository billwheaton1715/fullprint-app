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

  /**
   * Returns this rectangle as its own bounding box.
   */
  public override getBoundingBox() {
    return this;
  }

  /**
   * Returns true if the given point is inside this rectangle (inclusive, world coordinates).
   */
  public override containsPoint(point: Point): boolean {
    const x = point.x.toUnit('mm');
    const y = point.y.toUnit('mm');
    const tlx = this.topLeft.x.toUnit('mm');
    const tly = this.topLeft.y.toUnit('mm');
    const w = this.width.toUnit('mm');
    const h = this.height.toUnit('mm');
    return x >= tlx && x <= tlx + w && y >= tly && y <= tly + h;
  }

  /**
   * Returns true if this rectangle intersects the given rectangle (AABB, world coordinates).
   */
  public override intersectsRect(rect: Rectangle): boolean {
    const a = this;
    const b = rect;
    const ax0 = a.topLeft.x.toUnit('mm');
    const ay0 = a.topLeft.y.toUnit('mm');
    const ax1 = ax0 + a.width.toUnit('mm');
    const ay1 = ay0 + a.height.toUnit('mm');
    const bx0 = b.topLeft.x.toUnit('mm');
    const by0 = b.topLeft.y.toUnit('mm');
    const bx1 = bx0 + b.width.toUnit('mm');
    const by1 = by0 + b.height.toUnit('mm');
    return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
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
