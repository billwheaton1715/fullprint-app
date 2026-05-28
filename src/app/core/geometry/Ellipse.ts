import Shape from './Shape';
import Measurement from '../units/Measurement';
import Point from './Point';
import Angle from '../units/Angle';
import utils from './utils';
import Rectangle from './Rectangle';

export class Ellipse extends Shape {
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
  readonly center: Point;
  readonly radiusX: Measurement; // semi-major
  readonly radiusY: Measurement; // semi-minor

  constructor(center: Point, radiusX: Measurement, radiusY: Measurement) {
    super();
    if (radiusX.compareTo(new Measurement(0)) <= 0 || radiusY.compareTo(new Measurement(0)) <= 0) {
      throw new Error('Radii must be positive');
    }
    this.center = center;
    this.radiusX = radiusX;
    this.radiusY = radiusY;
  }

  area(): Measurement {
    const a = this.radiusX.toUnit('mm');
    const b = this.radiusY.toUnit('mm');
    return new Measurement(Math.PI * a * b, 'mm');
  }

  perimeter(): Measurement {
    // Ramanujan approximation
    const a = this.radiusX.toUnit('mm');
    const b = this.radiusY.toUnit('mm');
    const h = Math.pow((a - b), 2) / Math.pow((a + b), 2);
    const peri = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
    return new Measurement(peri, 'mm');
  }

  translate(dx: Measurement, dy: Measurement): Ellipse {
    return new Ellipse(this.center.translate(dx, dy), this.radiusX, this.radiusY);
  }

  rotate(angle: Angle, origin: Point): Ellipse {
    return new Ellipse(utils.rotatePoint(this.center, angle, origin), this.radiusX, this.radiusY);
  }

  scale(factor: number, origin: Point): Ellipse {
    return new Ellipse(utils.scalePoint(this.center, factor, origin), this.radiusX.multiply(factor), this.radiusY.multiply(factor));
  }

  boundingBox(): Rectangle {
    const rx = this.radiusX.toUnit('mm');
    const ry = this.radiusY.toUnit('mm');
    return new Rectangle(
      new Point(new Measurement(this.center.x.toUnit('mm') - rx, 'mm'), new Measurement(this.center.y.toUnit('mm') - ry, 'mm')),
      new Measurement(2 * rx, 'mm'),
      new Measurement(2 * ry, 'mm')
    );
  }

  intersects(other: Shape): boolean {
    return utils.bboxIntersects(this.getBoundingBox(), other.getBoundingBox());
  }

  contains(point: Point): boolean {
    const dx = point.x.subtract(this.center.x).toUnit('mm');
    const dy = point.y.subtract(this.center.y).toUnit('mm');
    const rx = this.radiusX.toUnit('mm');
    const ry = this.radiusY.toUnit('mm');
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
  }

  toSvg(): string {
    const cx = this.center.x.toUnit('px');
    const cy = this.center.y.toUnit('px');
    const rx = this.radiusX.toUnit('px');
    const ry = this.radiusY.toUnit('px');
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="black"/>`;
  }

  toCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.ellipse(this.center.x.toUnit('px'), this.center.y.toUnit('px'), this.radiusX.toUnit('px'), this.radiusY.toUnit('px'), 0, 0, 2 * Math.PI);
    ctx.stroke();
  }

  toJson() {
    return { type: 'Ellipse', center: { x: this.center.x.toUnit('mm'), y: this.center.y.toUnit('mm') }, radiusX: this.radiusX.toUnit('mm'), radiusY: this.radiusY.toUnit('mm') };
  }

  equals(other: Shape): boolean {
    if (!(other instanceof Ellipse)) return false;
    return (
      this.center.equals(other.center) &&
      this.radiusX.equals(other.radiusX) &&
      this.radiusY.equals(other.radiusY)
    );
  }
}

export default Ellipse;
