import Arc from './Arc';
import Point from './Point';
import Measurement from '../units/Measurement';
import Angle from '../units/Angle';

describe('Arc', () => {
  it('area, perimeter, translate, rotate, toJson', () => {
    const a = new Arc(new Point(new Measurement(0), new Measurement(0)), new Measurement(10), new Angle(0, 'rad'), new Angle(Math.PI / 2, 'rad'));
    expect(a.area().toUnit('mm')).toBeCloseTo(0.5 * 10 * 10 * (Math.PI / 2));
    expect(a.perimeter().toUnit('mm')).toBeCloseTo(10 * (Math.PI / 2));
    const moved = a.translate(new Measurement(2), new Measurement(3));
    expect(moved.center.equals(new Point(new Measurement(2), new Measurement(3)))).toBe(true);
    const rotated = a.rotate(new Angle(Math.PI / 2, 'rad'), new Point(new Measurement(0), new Measurement(0)));
    expect(typeof rotated.toJson()).toBe('object');
  });
});
