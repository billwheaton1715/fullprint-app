import Polygon from './Polygon';
import PolygonWithHoles from './PolygonWithHoles';
import Point from './Point';
import Measurement from '../units/Measurement';

describe('PolygonWithHoles', () => {
  it('area subtracts holes and contains works', () => {
    const outerPts = [
      new Point(new Measurement(0), new Measurement(0)),
      new Point(new Measurement(4), new Measurement(0)),
      new Point(new Measurement(4), new Measurement(4)),
      new Point(new Measurement(0), new Measurement(4)),
    ];
    const holePts = [
      new Point(new Measurement(1), new Measurement(1)),
      new Point(new Measurement(2), new Measurement(1)),
      new Point(new Measurement(2), new Measurement(2)),
      new Point(new Measurement(1), new Measurement(2)),
    ];
    const outer = new Polygon(outerPts);
    const hole = new Polygon(holePts);
    const p = new PolygonWithHoles(outer, [hole]);
    expect(p.area().toUnit('mm')).toBeCloseTo(16 - 1);
    expect(p.contains(new Point(new Measurement(0.5), new Measurement(0.5)))).toBe(true);
    expect(p.contains(new Point(new Measurement(1.5), new Measurement(1.5)))).toBe(false);
  });
});
