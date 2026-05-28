/**
 * shape-serializer.ts
 *
 * Converts Shape objects to/from plain JSON-safe objects so they can be
 * stored in IndexedDB or written to .fpp project files.
 *
 * serializeShape  — wraps shape.toJson() and appends style fields.
 * deserializeShape — async factory that dispatches on data.type; handles
 *                    the ImageShape case by loading an HTMLImageElement from
 *                    the embedded data-URL.
 */

import Shape from './Shape';
import { Rectangle }          from './Rectangle';
import { Triangle }           from './Triangle';
import { Circle }             from './Circle';
import { Ellipse }            from './Ellipse';
import { Arc }                from './Arc';
import { BezierCurve }        from './BezierCurve';
import { Polygon }            from './Polygon';
import { PolygonWithHoles }   from './PolygonWithHoles';
import { ImageShape, CropRect } from './ImageShape';
import { LineString }         from './LineString';
import Measurement            from '../units/Measurement';
import Point                  from './Point';
import Angle                  from '../units/Angle';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a Point from millimetre values. */
function pt(x: number, y: number): Point {
  return new Point(new Measurement(x, 'mm'), new Measurement(y, 'mm'));
}

/** Build a Measurement in millimetres. */
function mm(v: number): Measurement {
  return new Measurement(v, 'mm');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Serialise one shape to a plain object.
 * Calls shape.toJson() and overlays the three Style properties that the
 * base Shape class holds but existing toJson() implementations omit.
 */
export function serializeShape(shape: Shape): any {
  const json = (shape as any).toJson();
  if (shape.fillStyle   != null) json._fillStyle   = shape.fillStyle;
  if (shape.strokeStyle != null) json._strokeStyle = shape.strokeStyle;
  if (shape.lineWidth   != null) json._lineWidth   = shape.lineWidth;
  return json;
}

/**
 * Deserialise one shape from a plain object.
 * Async because ImageShape deserialization loads an HTMLImageElement.
 */
export async function deserializeShape(data: any): Promise<Shape> {
  let shape: Shape;

  switch (data.type) {

    case 'Rectangle':
      shape = new Rectangle(
        pt(data.topLeft.x, data.topLeft.y),
        mm(data.width),
        mm(data.height),
      );
      break;

    case 'Triangle':
      shape = new Triangle(
        pt(data.a.x, data.a.y),
        pt(data.b.x, data.b.y),
        pt(data.c.x, data.c.y),
      );
      break;

    case 'Circle':
      shape = new Circle(
        pt(data.center.x, data.center.y),
        mm(data.radius),
      );
      break;

    case 'Ellipse':
      shape = new Ellipse(
        pt(data.center.x, data.center.y),
        mm(data.radiusX),
        mm(data.radiusY),
      );
      break;

    case 'LineString':
      shape = new LineString(
        (data.points as any[]).map((p: any) => pt(p.x, p.y)),
      );
      break;

    case 'Arc':
      shape = new Arc(
        pt(data.center.x, data.center.y),
        mm(data.radius),
        new Angle(data.start, 'rad'),
        new Angle(data.end,   'rad'),
        data.clockwise ?? false,
      );
      break;

    case 'BezierCurve':
      shape = new BezierCurve(
        pt(data.p0.x, data.p0.y),
        pt(data.p1.x, data.p1.y),
        pt(data.p2.x, data.p2.y),
        pt(data.p3.x, data.p3.y),
      );
      break;

    case 'Polygon':
      shape = new Polygon(
        (data.points as any[]).map((p: any) => pt(p.x, p.y)),
      );
      break;

    case 'PolygonWithHoles': {
      const outer = new Polygon(
        (data.outer.points as any[]).map((p: any) => pt(p.x, p.y)),
      );
      const holes = (data.holes as any[]).map((h: any) =>
        new Polygon((h.points as any[]).map((p: any) => pt(p.x, p.y)))
      );
      shape = new PolygonWithHoles(outer, holes);
      break;
    }

    case 'ImageShape': {
      const img = await _loadImageEl(data.src);
      const cropRect: CropRect | null = data.cropRect ?? null;
      shape = new ImageShape(
        img,
        data.src,
        pt(data.topLeft.x, data.topLeft.y),
        mm(data.width),
        mm(data.height),
        cropRect,
      );
      break;
    }

    default:
      throw new Error(`deserializeShape: unknown type "${data.type}"`);
  }

  // Restore style properties written by serializeShape
  if (data._fillStyle   != null) shape.fillStyle   = data._fillStyle;
  if (data._strokeStyle != null) shape.strokeStyle = data._strokeStyle;
  if (data._lineWidth   != null) shape.lineWidth   = data._lineWidth;

  return shape;
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img   = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('deserializeShape: failed to load image from data-URL'));
    img.src     = src;
  });
}
