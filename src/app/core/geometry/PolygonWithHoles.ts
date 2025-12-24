import Shape from './Shape';
import Polygon from './Polygon';
import Point from './Point';
import Measurement from '../units/Measurement';
import Angle from '../units/Angle';
import utils from './utils';

export class PolygonWithHoles extends Shape {
  readonly outer: Polygon;
  readonly holes: Polygon[];

  constructor(outer: Polygon, holes: Polygon[] = []) {
    super();
    this.outer = outer;
    this.holes = holes.slice();
  }

  area(): Measurement {
    let area = this.outer.area().toUnit('mm');
    for (const h of this.holes) area -= h.area().toUnit('mm');
    return new Measurement(area, 'mm');
  }

  perimeter(): Measurement {
    let peri = this.outer.perimeter().toUnit('mm');
    for (const h of this.holes) peri += h.perimeter().toUnit('mm');
    return new Measurement(peri, 'mm');
  }

  translate(dx: Measurement, dy: Measurement): PolygonWithHoles {
    return new PolygonWithHoles(this.outer.translate(dx, dy) as Polygon, this.holes.map(h => h.translate(dx, dy) as Polygon));
  }

  rotate(angle: Angle, origin: Point): PolygonWithHoles {
    return new PolygonWithHoles(this.outer.rotate(angle, origin) as Polygon, this.holes.map(h => h.rotate(angle, origin) as Polygon));
  }

  scale(factor: number, origin: Point): PolygonWithHoles {
    return new PolygonWithHoles(this.outer.scale(factor, origin) as Polygon, this.holes.map(h => h.scale(factor, origin) as Polygon));
  }

  boundingBox() {
    return this.outer.boundingBox();
  }

  intersects(other: Shape): boolean {
    return utils.bboxIntersects(this.boundingBox(), other.boundingBox());
  }

  contains(point: Point): boolean {
    if (!this.outer.contains(point)) return false;
    for (const h of this.holes) if (h.contains(point)) return false;
    return true;
  }

  toSvg(): string {
    const outerPath = this.outer.toSvg();
    const holesPath = this.holes.map(h => h.toSvg()).join('');
    return `<g>${outerPath}${holesPath}</g>`;
  }

  toCanvas(ctx: CanvasRenderingContext2D): void {
    this.outer.toCanvas(ctx);
    for (const h of this.holes) h.toCanvas(ctx);
  }

  toJson() {
    return { type: 'PolygonWithHoles', outer: this.outer.toJson(), holes: this.holes.map(h => h.toJson()) };
  }

  equals(other: Shape): boolean {
    if (!(other instanceof PolygonWithHoles)) return false;
    if (!this.outer.equals(other.outer)) return false;
    if (this.holes.length !== other.holes.length) return false;
    for (let i = 0; i < this.holes.length; i++) if (!this.holes[i].equals(other.holes[i])) return false;
    return true;
  }
}

export default PolygonWithHoles;
