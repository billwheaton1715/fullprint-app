import Shape from './Shape';
import { Rectangle } from './Rectangle';
import Measurement from '../units/Measurement';
import Point from './Point';
import Angle from '../units/Angle';
import utils from './utils';

/** Axis-aligned source rectangle in image natural-pixel coordinates. */
export interface CropRect {
  sx: number;  // source x (natural px)
  sy: number;  // source y (natural px)
  sw: number;  // source width (natural px)
  sh: number;  // source height (natural px)
}

/**
 * A raster image placed on the canvas at a given position and size.
 *
 * Crop model (non-destructive):
 *   - cropRect stores the source region in image-natural pixels.
 *   - topLeft / width / height always describe the VISIBLE (cropped) area in
 *     world-space, so the bounding box matches exactly what is drawn.
 *   - The full image origin in world px is recoverable as:
 *       fullOriginX = topLeft.x.toUnit('px') − (cropRect?.sx ?? 0)
 *       fullOriginY = topLeft.y.toUnit('px') − (cropRect?.sy ?? 0)
 *     (valid because images are imported at 1 world-px : 1 natural-px).
 *
 * V1 limitations:
 *   - Rotation moves topLeft only; image stays axis-aligned.
 *   - Scale factor assumed 1 (images imported at natural pixel size).
 */
export class ImageShape extends Shape {
  private readonly _topLeft: Point;
  readonly width: Measurement;
  readonly height: Measurement;
  readonly cropRect: CropRect | null;

  constructor(
    readonly image: HTMLImageElement,
    readonly src: string,
    topLeft: Point,
    width: Measurement,
    height: Measurement,
    cropRect: CropRect | null = null
  ) {
    super();
    this._topLeft = topLeft;
    this.width    = width;
    this.height   = height;
    this.cropRect = cropRect;
  }

  override get topLeft(): Point { return this._topLeft; }

  // ── Geometry ───────────────────────────────────────────────────────────────

  area(): Measurement {
    return new Measurement(
      this.width.toUnit('mm') * this.height.toUnit('mm'),
      'mm'
    );
  }

  perimeter(): Measurement {
    return this.width.add(this.height).multiply(2);
  }

  override getBoundingBox(): Rectangle {
    return new Rectangle(this._topLeft, this.width, this.height);
  }

  override containsPoint(point: Point): boolean {
    const x   = point.x.toUnit('mm');
    const y   = point.y.toUnit('mm');
    const tlx = this._topLeft.x.toUnit('mm');
    const tly = this._topLeft.y.toUnit('mm');
    const w   = this.width.toUnit('mm');
    const h   = this.height.toUnit('mm');
    return x >= tlx && x <= tlx + w && y >= tly && y <= tly + h;
  }

  override intersectsRect(rect: Rectangle): boolean {
    return this.getBoundingBox().intersectsRect(rect);
  }

  // ── Non-destructive crop ──────────────────────────────────────────────────

  /**
   * Return a new ImageShape that shows `newCrop` (in image-natural pixels).
   * topLeft is recalculated so the shape's world position matches the new
   * top-left corner of the crop region.
   */
  withCrop(newCrop: CropRect): ImageShape {
    // Recover the full image origin in world px.
    const fullOriginX = this._topLeft.x.toUnit('px') - (this.cropRect?.sx ?? 0);
    const fullOriginY = this._topLeft.y.toUnit('px') - (this.cropRect?.sy ?? 0);

    const newTopLeft = new Point(
      Measurement.fromPx(fullOriginX + newCrop.sx),
      Measurement.fromPx(fullOriginY + newCrop.sy)
    );
    const result = new ImageShape(
      this.image, this.src,
      newTopLeft,
      Measurement.fromPx(newCrop.sw),
      Measurement.fromPx(newCrop.sh),
      newCrop
    );
    this.copyStyleTo(result);
    return result;
  }

  /**
   * Return the world-space position of the full (uncropped) image origin.
   * Used by the crop editor to display the full image bounds.
   */
  getFullImageOriginPx(): { x: number; y: number } {
    return {
      x: this._topLeft.x.toUnit('px') - (this.cropRect?.sx ?? 0),
      y: this._topLeft.y.toUnit('px') - (this.cropRect?.sy ?? 0),
    };
  }

  // ── Transforms ────────────────────────────────────────────────────────────

  translate(dx: Measurement, dy: Measurement): ImageShape {
    const result = new ImageShape(
      this.image, this.src,
      this._topLeft.translate(dx, dy),
      this.width, this.height,
      this.cropRect
    );
    this.copyStyleTo(result);
    return result;
  }

  rotate(angle: Angle, origin: Point): ImageShape {
    // V1: rotate bounding-box top-left only; image stays axis-aligned.
    const newTl = utils.rotatePoint(this._topLeft, angle, origin);
    const result = new ImageShape(
      this.image, this.src,
      newTl, this.width, this.height,
      this.cropRect
    );
    this.copyStyleTo(result);
    return result;
  }

  scale(factor: number, origin: Point): ImageShape {
    const newTl = utils.scalePoint(this._topLeft, factor, origin);
    const result = new ImageShape(
      this.image, this.src,
      newTl,
      this.width.multiply(factor),
      this.height.multiply(factor),
      this.cropRect
    );
    this.copyStyleTo(result);
    return result;
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  toCanvas(ctx: CanvasRenderingContext2D): void {
    const x = this._topLeft.x.toUnit('px');
    const y = this._topLeft.y.toUnit('px');
    const w = this.width.toUnit('px');
    const h = this.height.toUnit('px');
    ctx.save();
    if (this.cropRect) {
      const { sx, sy, sw, sh } = this.cropRect;
      ctx.drawImage(this.image, sx, sy, sw, sh, x, y, w, h);
    } else {
      ctx.drawImage(this.image, x, y, w, h);
    }
    ctx.restore();
  }

  toSvg(): string {
    const x = this._topLeft.x.toUnit('px');
    const y = this._topLeft.y.toUnit('px');
    const w = this.width.toUnit('px');
    const h = this.height.toUnit('px');
    return `<image href="${this.src}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  }

  toJson(): any {
    return {
      type: 'ImageShape',
      src: this.src,
      topLeft: {
        x: this._topLeft.x.toUnit('mm'),
        y: this._topLeft.y.toUnit('mm'),
      },
      width:  this.width.toUnit('mm'),
      height: this.height.toUnit('mm'),
      cropRect: this.cropRect ?? undefined,
    };
  }

  equals(other: Shape): boolean {
    if (!(other instanceof ImageShape)) return false;
    const sameCrop =
      this.cropRect === other.cropRect ||
      (!!this.cropRect && !!other.cropRect &&
        this.cropRect.sx === other.cropRect.sx &&
        this.cropRect.sy === other.cropRect.sy &&
        this.cropRect.sw === other.cropRect.sw &&
        this.cropRect.sh === other.cropRect.sh);
    return (
      this.src === other.src &&
      this._topLeft.equals(other._topLeft) &&
      this.width.equals(other.width) &&
      this.height.equals(other.height) &&
      sameCrop
    );
  }
}

export default ImageShape;
