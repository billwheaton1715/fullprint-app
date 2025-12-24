import Unit from './Unit';

// Canonical conversion: 1 inch = 25.4 millimeters
const MM_PER_INCH = 25.4;

export class Measurement {
  private readonly valueMm: number; // stored internally as mm
  // DPI is provided via a runtime provider. Default provider returns 96.
  private static dpiProvider: () => number = () => 96;

  // Accept either our `Unit` enum or string literals for compatibility
  constructor(value: number, unit: Unit | 'mm' | 'cm' | 'in' = Unit.MM) {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new Error('Measurement value must be a finite number');
    }

    // Normalize unit to string
    const u = (unit as unknown) as string;

    switch (u) {
      case Unit.MM:
      case 'mm':
        this.valueMm = value;
        break;
      case 'cm':
        this.valueMm = value * 10;
        break;
      case Unit.INCH:
      case 'in':
        this.valueMm = value * MM_PER_INCH;
        break;
      case Unit.PX:
      case 'px':
        // interpret provided value as pixels at current dpi
        this.valueMm = (value / Measurement.getDpi()) * MM_PER_INCH;
        break;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }
  }

  // Arithmetic methods
  add(other: Measurement): Measurement {
    return new Measurement(this.valueMm + other.valueMm, 'mm');
  }

  subtract(other: Measurement): Measurement {
    return new Measurement(this.valueMm - other.valueMm, 'mm');
  }

  multiply(factor: number): Measurement {
    return new Measurement(this.valueMm * factor, 'mm');
  }

  divide(factor: number): Measurement {
    if (factor === 0) throw new Error('Cannot divide by zero');
    return new Measurement(this.valueMm / factor, 'mm');
  }

  // Comparison methods
  equals(other: Measurement): boolean {
    return Math.abs(this.valueMm - other.valueMm) < 1e-9;
  }

  compareTo(other: Measurement): number {
    return this.valueMm - other.valueMm;
  }

  // Alias for compareTo
  compare(other: Measurement): number {
    return this.compareTo(other);
  }

  // Static factories
  static fromPx(px: number, dpi?: number): Measurement {
    const useDpi = dpi ?? Measurement.getDpi();
    return new Measurement((px / useDpi) * MM_PER_INCH, 'mm');
  }

  static fromMm(mm: number): Measurement {
    return new Measurement(mm, 'mm');
  }

  // Conversion to pixels
  toPixels(dpi?: number): number {
    const useDpi = dpi ?? Measurement.getDpi();
    return (this.valueMm * useDpi) / MM_PER_INCH;
  }

  // Conversion to different units
  toUnit(unit: 'mm' | 'cm' | 'in' | 'px', dpi?: number): number {
    const useDpi = dpi ?? Measurement.getDpi();
    switch (unit) {
      case 'mm':
        return this.valueMm;
      case 'cm':
        return this.valueMm / 10;
      case 'in':
        return this.valueMm / MM_PER_INCH;
      case 'px':
        return (this.valueMm * useDpi) / MM_PER_INCH;
    }
  }

  toString(): string {
    return `${this.valueMm.toFixed(2)} mm`;
  }

  // Backwards-compat helpers used by existing code
  as(unit: Unit | 'mm' | 'cm' | 'in', dpi?: number): number {
    // allow Unit enum values
    const u = (unit as unknown) as string;
    if (u === Unit.PX || u === 'px') {
      return this.toPixels(dpi ?? Measurement.getDpi());
    }
    if (u === Unit.MM || u === 'mm') return this.toUnit('mm');
    if (u === Unit.INCH || u === 'in') return this.toUnit('in');
    if (u === 'cm') return this.toUnit('cm');
    throw new Error(`Unknown unit: ${unit}`);
  }

  // DPI provider API
  static setDpiProvider(provider: () => number) {
    if (typeof provider !== 'function') throw new Error('DPI provider must be a function');
    this.dpiProvider = provider;
  }

  static getDpi(): number {
    return this.dpiProvider();
  }
}

export default Measurement;
