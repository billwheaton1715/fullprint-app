import Measurement from '../units/Measurement';
import Unit from '../units/Unit';
import Point from './Point';

describe('Point', () => {
  it('translates correctly and is immutable', () => {
    const x = new Measurement(10, Unit.MM);
    const y = new Measurement(20, Unit.MM);
    const p = new Point(x, y);

    const dx = new Measurement(5, Unit.MM);
    const dy = new Measurement(2, Unit.MM);

    const p2 = p.translate(dx, dy);

    expect(p2.equals(new Point(new Measurement(15, Unit.MM), new Measurement(22, Unit.MM)))).toBe(true);
    // original unchanged
    expect(p.equals(new Point(x, y))).toBe(true);
  });

  it('equality works for identical coordinates', () => {
    const a = new Point(new Measurement(0, Unit.MM), new Measurement(0, Unit.MM));
    const b = new Point(new Measurement(0, Unit.MM), new Measurement(0, Unit.MM));
    expect(a.equals(b)).toBe(true);
  });
});
import { Point } from './Point';

describe('Point', () => {
  it('represents x/y coordinates', () => {
    const p: Point = { x: 10, y: 20 };

    expect(p.x).toBe(10);
    expect(p.y).toBe(20);
  });
});
