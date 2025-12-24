import Measurement from '../units/Measurement';
import Unit from '../units/Unit';

export class Point {
  readonly x: Measurement;
  readonly y: Measurement;

  constructor(x: Measurement, y: Measurement) {
    this.x = x;
    this.y = y;
  }

  translate(dx: Measurement, dy: Measurement): Point {
    return new Point(this.x.add(dx), this.y.add(dy));
  }

  distanceTo(other: Point): Measurement {
    const dx = this.x.subtract(other.x).toUnit('mm');
    const dy = this.y.subtract(other.y).toUnit('mm');
    const dist = Math.hypot(dx, dy);
    return new Measurement(dist, 'mm');
  }

  equals(other: Point): boolean {
    return this.x.equals(other.x) && this.y.equals(other.y);
  }
}

export default Point;
