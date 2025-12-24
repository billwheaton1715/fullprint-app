import Measurement from '../units/Measurement';
import Point from './Point';
import Angle from '../units/Angle';

export abstract class Shape {
  abstract area(): Measurement;
  abstract perimeter(): Measurement;
  abstract translate(dx: Measurement, dy: Measurement): Shape;
  abstract rotate(angle: Angle, origin: Point): Shape;
  abstract scale(factor: number, origin: Point): Shape;
  abstract boundingBox(): import('./Rectangle').Rectangle;
  abstract intersects(other: Shape): boolean;
  abstract contains(point: Point): boolean;
  abstract toSvg(): string;
  abstract toCanvas(ctx: CanvasRenderingContext2D): void;
  abstract toJson(): any;
  abstract equals(other: Shape): boolean;
}

export default Shape;
