import {
  TilingSettings, SCREEN_DPI,
  paperDims, printableDims,
} from './tiling-settings';

/** Content bounding box in world-px. */
export interface ContentBounds {
  x: number; y: number; w: number; h: number;
}

/**
 * One page in the grid.
 *
 * All world-px values are at SCREEN_DPI (96 px/in).
 *
 * printX/Y/W/H  — the content region this page covers (printable area, no margins).
 * pageX/Y/W/H   — the full paper rect (printable area + margins on all sides).
 *
 * The four registration mark positions (world-px) are the corners of the
 * printable area; they land in the overlap zone so they appear on
 * adjacent pages.
 */
export interface TileRect {
  col: number;
  row: number;
  printX: number;
  printY: number;
  printW: number;
  printH: number;
  pageX: number;
  pageY: number;
  pageW: number;
  pageH: number;
}

export interface TilingLayout {
  cols: number;
  rows: number;
  tiles: TileRect[][];   // [row][col]
  totalPages: number;
  printableWIn: number;
  printableHIn: number;
  paperWIn:     number;
  paperHIn:     number;
  marginIn:     number;
  overlapIn:    number;
  contentBounds: ContentBounds;
}

/**
 * Compute the full tiling layout for the given content bounds and settings.
 * Returns null when there is no content.
 */
export function computeTilingLayout(
  bounds: ContentBounds,
  settings: TilingSettings,
): TilingLayout | null {
  if (bounds.w <= 0 || bounds.h <= 0) return null;

  const pxPerIn       = settings.calibrationPxPerIn ?? SCREEN_DPI;
  const paper         = paperDims(settings);
  const printable     = printableDims(settings);

  const printWpx  = printable.w * pxPerIn;
  const printHpx  = printable.h * pxPerIn;
  const overlapPx = settings.overlapIn * pxPerIn;
  const marginPx  = settings.marginIn  * pxPerIn;
  const paperWpx  = paper.w * pxPerIn;
  const paperHpx  = paper.h * pxPerIn;

  // Step = unique content advance per page (printable area minus overlap strip)
  const stepX = Math.max(1, printWpx - overlapPx);
  const stepY = Math.max(1, printHpx - overlapPx);

  // Minimum 1 page; ceil formula: cols = ceil((W - overlap) / step)
  const cols = Math.max(1, Math.ceil((bounds.w - overlapPx) / stepX));
  const rows = Math.max(1, Math.ceil((bounds.h - overlapPx) / stepY));

  // Total world-px covered by the grid
  const totalCovX = printWpx + (cols - 1) * stepX;
  const totalCovY = printHpx + (rows - 1) * stepY;

  // Origin of the grid — shifted left/up by half the extra space when centering
  const originX = settings.contentAlign === 'center'
    ? bounds.x - (totalCovX - bounds.w) / 2
    : bounds.x;
  const originY = settings.contentAlign === 'center'
    ? bounds.y - (totalCovY - bounds.h) / 2
    : bounds.y;

  const tiles: TileRect[][] = [];

  for (let row = 0; row < rows; row++) {
    tiles[row] = [];
    for (let col = 0; col < cols; col++) {
      const printX = originX + col * stepX;
      const printY = originY + row * stepY;

      tiles[row][col] = {
        col, row,
        printX, printY,
        printW: printWpx,
        printH: printHpx,
        pageX: printX - marginPx,
        pageY: printY - marginPx,
        pageW: paperWpx,
        pageH: paperHpx,
      };
    }
  }

  return {
    cols, rows,
    tiles,
    totalPages: cols * rows,
    printableWIn: printable.w,
    printableHIn: printable.h,
    paperWIn: paper.w,
    paperHIn: paper.h,
    marginIn:  settings.marginIn,
    overlapIn: settings.overlapIn,
    contentBounds: bounds,
  };
}
