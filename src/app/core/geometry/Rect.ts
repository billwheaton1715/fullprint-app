import { Point } from './Point';

export class Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;

  constructor(x: number, y: number, width: number, height: number) {
    if (width < 0 || height < 0) {
      throw new Error('Rect width and height must be non-negative');
    }

    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  get left(): number {
    return this.x;
  }

  get right(): number {
    return this.x + this.width;
  }

  get top(): number {
    return this.y;
  }

  get bottom(): number {
    return this.y + this.height;
  }

  contains(point: Point): boolean {
    return (
      point.x >= this.left &&
      point.x <= this.right &&
      point.y >= this.top &&
      point.y <= this.bottom
    );
  }
}
