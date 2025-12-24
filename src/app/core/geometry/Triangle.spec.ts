import Triangle from './Triangle';
import Point from './Point';
import Measurement from '../units/Measurement';

describe('Triangle', () => {
  test('area, perimeter, translate, equals', () => {
    const a = new Point(new Measurement(0), new Measurement(0));
    const b = new Point(new Measurement(3), new Measurement(0));
    const c = new Point(new Measurement(0), new Measurement(4));
    const t = new Triangle(a, b, c);
    expect(t.area().toUnit('mm')).toBeCloseTo(6);
    expect(t.perimeter().toUnit('mm')).toBeCloseTo(12);

    const moved = t.translate(new Measurement(1), new Measurement(1));
    expect(moved.a.equals(new Point(new Measurement(1), new Measurement(1)))).toBe(true);
    expect(t.equals(moved)).toBe(false);
    expect(t.equals(t)).toBe(true);
  });
});
