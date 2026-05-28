import BezierCurve from './BezierCurve';
import Point from './Point';
import Measurement from '../units/Measurement';

describe('BezierCurve', () => {
  it('perimeter approx, translate, toJson', () => {
    const p0 = new Point(new Measurement(0), new Measurement(0));
    const p1 = new Point(new Measurement(1), new Measurement(2));
    const p2 = new Point(new Measurement(3), new Measurement(2));
    const p3 = new Point(new Measurement(4), new Measurement(0));
    const b = new BezierCurve(p0, p1, p2, p3);
    const len = b.perimeter().toUnit('mm');
    expect(len).toBeGreaterThan(4);
    const moved = b.translate(new Measurement(1), new Measurement(1));
    expect(moved.p0.equals(new Point(new Measurement(1), new Measurement(1)))).toBe(true);
    expect(typeof b.toJson()).toBe('object');
  });
});
