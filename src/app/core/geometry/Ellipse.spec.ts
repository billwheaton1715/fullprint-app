import Ellipse from './Ellipse';
import Point from './Point';
import Measurement from '../units/Measurement';

describe('Ellipse', () => {
  it('area, perimeter, translate, equals', () => {
    const e = new Ellipse(new Point(new Measurement(0), new Measurement(0)), new Measurement(5), new Measurement(3));
    expect(e.area().toUnit('mm')).toBeCloseTo(Math.PI * 5 * 3);
    const peri = e.perimeter().toUnit('mm');
    expect(peri).toBeGreaterThan(0);

    const moved = e.translate(new Measurement(2), new Measurement(1));
    expect(moved.center.equals(new Point(new Measurement(2), new Measurement(1)))).toBe(true);
    expect(e.equals(moved)).toBe(false);
    expect(e.equals(e)).toBe(true);
  });
});
