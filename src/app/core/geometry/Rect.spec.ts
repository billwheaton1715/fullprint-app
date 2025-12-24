import { Rect } from './Rect';

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

    expect(r.contains({ x: 5, y: 5 })).toBe(true);
    expect(r.contains({ x: -1, y: 5 })).toBe(false);
    expect(r.contains({ x: 5, y: 11 })).toBe(false);
  });
});
