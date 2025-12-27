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
    if (!(dx instanceof Object && 'valueMm' in dx) || !(dy instanceof Object && 'valueMm' in dy)) {
      throw new Error(`[Point.translate] dx and dy must be Measurement instances. Got: dx=${JSON.stringify(dx)}, dy=${JSON.stringify(dy)}`);
    }
    const newX = this.x.add(dx);
    const newY = this.y.add(dy);
    return new Point(newX, newY);
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
