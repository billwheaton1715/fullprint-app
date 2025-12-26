import { Rect } from './Rect';
import Point from './Point';
import Measurement from '../units/Measurement';
import Unit from '../units/Unit';

describe('Rect', () => {
  it('constructs with valid dimensions', () => {
    const r = new Rect(10, 20, 100, 50);

    expect(r.left).toBe(10);
    expect(r.top).toBe(20);
    expect(r.right).toBe(110);
    expect(r.bottom).toBe(70);
  });

  it('throws on negative dimensions', () => {
    expect(() => new Rect(0, 0, -1, 10)).toThrow();
    expect(() => new Rect(0, 0, 10, -1)).toThrow();
  });

  it('detects point containment', () => {
    const r = new Rect(0, 0, 10, 10);

    // Use Point instances for type safety
    expect(r.contains(new Point(new Measurement(5, Unit.MM), new Measurement(5, Unit.MM)))).toBe(true);
    expect(r.contains(new Point(new Measurement(-1, Unit.MM), new Measurement(5, Unit.MM)))).toBe(false);
    expect(r.contains(new Point(new Measurement(5, Unit.MM), new Measurement(11, Unit.MM)))).toBe(false);
  });
});
