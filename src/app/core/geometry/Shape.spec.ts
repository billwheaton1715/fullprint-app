import Circle from './Circle';
import Rectangle from './Rectangle';
import Point from './Point';
import Measurement from '../units/Measurement';

describe('Shapes', () => {
  test('Circle area, perimeter, translate, equals', () => {
    const c = new Circle(new Point(new Measurement(0), new Measurement(0)), new Measurement(10));
    expect(c.area().toUnit('mm')).toBeCloseTo(Math.PI * 100);
    expect(c.perimeter().toUnit('mm')).toBeCloseTo(2 * Math.PI * 10);

    const moved = c.translate(new Measurement(5), new Measurement(5));
    expect(moved.center.equals(new Point(new Measurement(5), new Measurement(5)))).toBe(true);

    expect(c.equals(moved)).toBe(false);
    expect(c.equals(c)).toBe(true);
  });

  test('Rectangle area, perimeter, translate, equals', () => {
    const r = new Rectangle(new Point(new Measurement(0), new Measurement(0)), new Measurement(5), new Measurement(10));
    expect(r.area().toUnit('mm')).toBeCloseTo(50);
    expect(r.perimeter().toUnit('mm')).toBeCloseTo(30);

    const moved = r.translate(new Measurement(2), new Measurement(3));
    expect(moved.topLeft.equals(new Point(new Measurement(2), new Measurement(3)))).toBe(true);

    expect(r.equals(moved)).toBe(false);
    expect(r.equals(r)).toBe(true);
  });
});
