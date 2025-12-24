import Polygon from './Polygon';
import Point from './Point';
import Measurement from '../units/Measurement';

describe('Polygon', () => {
  test('square area and perimeter', () => {
    const pts = [
      new Point(new Measurement(0), new Measurement(0)),
      new Point(new Measurement(1), new Measurement(0)),
      new Point(new Measurement(1), new Measurement(1)),
      new Point(new Measurement(0), new Measurement(1)),
    ];
    const poly = new Polygon(pts);
    expect(poly.area().toUnit('mm')).toBeCloseTo(1);
    expect(poly.perimeter().toUnit('mm')).toBeCloseTo(4);

    const moved = poly.translate(new Measurement(2), new Measurement(3));
    expect(moved.points[0].equals(new Point(new Measurement(2), new Measurement(3)))).toBe(true);
    expect(poly.equals(moved)).toBe(false);
    expect(poly.equals(poly)).toBe(true);
  });
});
