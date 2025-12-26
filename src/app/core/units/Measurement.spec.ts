import { Measurement } from './Measurement';

describe('Measurement', () => {
  beforeEach(() => {
    Measurement.setDpiProvider(() => 96); // reset DPI provider
  });

  it('conversion mm/cm/in to pixels', () => {
    expect(new Measurement(25.4, 'mm').toPixels()).toBeCloseTo(96);
    expect(new Measurement(2.54, 'cm').toPixels()).toBeCloseTo(96);
    expect(new Measurement(1, 'in').toPixels()).toBeCloseTo(96);
  });

  it('changing DPI affects toPixels', () => {
    Measurement.setDpiProvider(() => 192);
    expect(new Measurement(1, 'in').toPixels()).toBeCloseTo(192);
  });

  it('arithmetic operations return correct immutable results', () => {
    const a = new Measurement(10);
    const b = new Measurement(5);
    const c = a.add(b);
    expect(c.equals(new Measurement(15))).toBe(true);
    expect(a.equals(new Measurement(10))).toBe(true); // original unchanged

    const d = c.subtract(b);
    expect(d.equals(a)).toBe(true);

    const e = a.multiply(2);
    expect(e.equals(new Measurement(20))).toBe(true);

    const f = e.divide(4);
    expect(f.equals(new Measurement(5))).toBe(true);
  });

  it('comparison works correctly', () => {
    const a = new Measurement(10);
    const b = new Measurement(15);
    expect(a.compareTo(b)).toBeLessThan(0);
    expect(b.compareTo(a)).toBeGreaterThan(0);
    expect(a.compareTo(new Measurement(10))).toBe(0);
  });

  it('unit conversion works correctly', () => {
    const m = new Measurement(25.4, 'mm');
    expect(m.toUnit('mm')).toBeCloseTo(25.4);
    expect(m.toUnit('cm')).toBeCloseTo(2.54);
    expect(m.toUnit('in')).toBeCloseTo(1);
  });

  it('factory methods create Measurements correctly', () => {
    const px = Measurement.fromPx(96, 96);
    expect(px.toUnit('in')).toBeCloseTo(1);

    const mm = Measurement.fromMm(10);
    expect(mm.toUnit('mm')).toBeCloseTo(10);
  });

  it('compare alias works', () => {
    const a = new Measurement(10);
    const b = new Measurement(20);
    expect(a.compare(b)).toBeLessThan(0);
    expect(b.compare(a)).toBeGreaterThan(0);
    expect(a.compare(a)).toBe(0);
  });
});
