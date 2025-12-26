import Measurement from '../units/Measurement';
import Point from './Point';
import Angle from '../units/Angle';

export abstract class Shape {
  abstract area(): Measurement;
  abstract perimeter(): Measurement;
  abstract translate(dx: Measurement, dy: Measurement): Shape;
  abstract rotate(angle: Angle, origin: Point): Shape;
  abstract scale(factor: number, origin: Point): Shape;
  /**
   * Returns the axis-aligned bounding box of this shape in world coordinates (AABB).
   * Canonical: calls boundingBox() if present.
   */
  public getBoundingBox(): import('./Rectangle').Rectangle {
    // @ts-ignore
    return typeof this.boundingBox === 'function' ? this.boundingBox() : undefined;
  }

  /**
   * Returns true if the given world-space point is inside this shape.
   * Canonical: calls contains() if present.
   */
  public containsPoint(point: Point): boolean {
    // @ts-ignore
    return typeof this.contains === 'function' ? this.contains(point) : false;
  }

  /**
   * Returns true if this shape's bounding box intersects the given axis-aligned world rectangle.
   * Canonical: calls intersects() if present, else AABB bbox intersection.
   */
  public intersectsRect(rect: import('./Rectangle').Rectangle): boolean {
    // @ts-ignore
    if (typeof this.intersects === 'function') return this.intersects(rect);
    const bbox = this.getBoundingBox();
    return bbox.intersectsRect(rect);
  }
  abstract toSvg(): string;
  abstract toCanvas(ctx: CanvasRenderingContext2D): void;
  abstract toJson(): any;
  abstract equals(other: Shape): boolean;
}

export default Shape;
