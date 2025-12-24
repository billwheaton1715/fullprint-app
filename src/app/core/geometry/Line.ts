import Point from './Point';
import Measurement from '../units/Measurement';
import Unit from '../units/Unit';

export class Line {
  readonly start: Point;
  readonly end: Point;

  constructor(start: Point, end: Point) {
    if (start.equals(end)) {
      throw new Error('Line start and end must be different points');
    }
    this.start = start;
    this.end = end;
  }

  length(): Measurement {
    const dx = this.end.x.subtract(this.start.x);
    const dy = this.end.y.subtract(this.start.y);
    const dxMm = dx.toUnit('mm');
    const dyMm = dy.toUnit('mm');
    const distMm = Math.hypot(dxMm, dyMm);
    return new Measurement(distMm, 'mm');
  }

  equals(other: Line): boolean {
    return this.start.equals(other.start) && this.end.equals(other.end);
  }
}

export default Line;
