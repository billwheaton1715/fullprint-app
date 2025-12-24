import Measurement from '../units/Measurement';
import Unit from '../units/Unit';
import Point from './Point';
import Line from './Line';

describe('Line', () => {
  it('throws when start and end are identical', () => {
    const p = new Point(new Measurement(0, Unit.MM), new Measurement(0, Unit.MM));
    expect(() => new Line(p, p)).toThrow();
  });

  it('computes length correctly (3-4-5 triangle)', () => {
    const a = new Point(new Measurement(0, Unit.MM), new Measurement(0, Unit.MM));
    const b = new Point(new Measurement(3, Unit.MM), new Measurement(4, Unit.MM));
    const line = new Line(a, b);

    const len = line.length();
    expect(len.as(Unit.MM)).toBeCloseTo(5);
  });

  it('equality checks start and end', () => {
    const a = new Point(new Measurement(0, Unit.MM), new Measurement(0, Unit.MM));
    const b = new Point(new Measurement(1, Unit.MM), new Measurement(1, Unit.MM));
    const l1 = new Line(a, b);
    const l2 = new Line(a, b);
    expect(l1.equals(l2)).toBe(true);
  });
});
