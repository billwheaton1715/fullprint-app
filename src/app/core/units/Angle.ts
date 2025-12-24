// Simple Angle value object supporting degrees and radians
export class Angle {
  private readonly radians: number;

  constructor(value: number, unit: 'rad' | 'deg' = 'rad') {
    if (!Number.isFinite(value) || Number.isNaN(value)) throw new Error('Angle must be finite');
    this.radians = unit === 'deg' ? (value * Math.PI) / 180 : value;
  }

  toRadians(): number {
    return this.radians;
  }

  toDegrees(): number {
    return (this.radians * 180) / Math.PI;
  }

  add(other: Angle): Angle {
    return new Angle(this.radians + other.radians, 'rad');
  }

  subtract(other: Angle): Angle {
    return new Angle(this.radians - other.radians, 'rad');
  }

  multiply(factor: number): Angle {
    return new Angle(this.radians * factor, 'rad');
  }

  equals(other: Angle): boolean {
    return Math.abs(this.radians - other.radians) < 1e-9;
  }
}

export default Angle;
