import LineString from './LineString';
import Point from './Point';
import Measurement from '../units/Measurement';

describe('LineString', () => {
  test('perimeter, translate, rotate, scale, toJson', () => {
    const pts = [
      new Point(new Measurement(0), new Measurement(0)),
      new Point(new Measurement(3), new Measurement(0)),
      new Point(new Measurement(3), new Measurement(4)),
    ];
    const ls = new LineString(pts);
    expect(ls.perimeter().toUnit('mm')).toBeCloseTo(7);
    const moved = ls.translate(new Measurement(1), new Measurement(1));
    expect(moved.points[0].equals(new Point(new Measurement(1), new Measurement(1)))).toBe(true);
    expect(typeof ls.toJson()).toBe('object');
  });
});
