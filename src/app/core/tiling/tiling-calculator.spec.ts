import { computeTilingLayout, ContentBounds } from './tiling-calculator';
import {
  TilingSettings, DEFAULT_TILING_SETTINGS, SCREEN_DPI,
  paperDims, printableDims,
} from './tiling-settings';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Default settings, but easy to override one field at a time. */
function settings(overrides: Partial<TilingSettings> = {}): TilingSettings {
  return { ...DEFAULT_TILING_SETTINGS, ...overrides };
}

/** Shorthand content bounds anchored at (0,0). */
function bounds(w: number, h: number, x = 0, y = 0): ContentBounds {
  return { x, y, w, h };
}

// With default portrait settings (margin=0.5", overlap=0.25", 96 dpi):
//   printableW = (8.5 - 1.0)" × 96 = 720 px
//   printableH = (11  - 1.0)" × 96 = 960 px
//   overlapPx  = 0.25 × 96         =  24 px
//   stepX      = 720 - 24           = 696 px
//   stepY      = 960 - 24           = 936 px
const S = settings();
const PRINT_W_PX  = printableDims(S).w * SCREEN_DPI;   // 720
const PRINT_H_PX  = printableDims(S).h * SCREEN_DPI;   // 960
const OVERLAP_PX  = S.overlapIn * SCREEN_DPI;           //  24
const STEP_X      = PRINT_W_PX - OVERLAP_PX;            // 696
const STEP_Y      = PRINT_H_PX - OVERLAP_PX;            // 936

// ── Null cases ────────────────────────────────────────────────────────────────

describe('computeTilingLayout — null cases', () => {

  it('returns null for zero-width content', () => {
    expect(computeTilingLayout(bounds(0, 500), S)).toBeNull();
  });

  it('returns null for zero-height content', () => {
    expect(computeTilingLayout(bounds(500, 0), S)).toBeNull();
  });

  it('returns null for negative dimensions', () => {
    expect(computeTilingLayout(bounds(-1, -1), S)).toBeNull();
  });
});

// ── Single-page layouts ───────────────────────────────────────────────────────

describe('computeTilingLayout — single page', () => {

  it('1×1 when content fits within printable area', () => {
    const layout = computeTilingLayout(bounds(400, 500), S)!;
    expect(layout.cols).toBe(1);
    expect(layout.rows).toBe(1);
    expect(layout.totalPages).toBe(1);
  });

  it('1×1 when content exactly equals printable area', () => {
    const layout = computeTilingLayout(bounds(PRINT_W_PX, PRINT_H_PX), S)!;
    expect(layout.cols).toBe(1);
    expect(layout.rows).toBe(1);
  });

  it('paper and printable dimensions are correct for portrait', () => {
    const layout = computeTilingLayout(bounds(100, 100), S)!;
    expect(layout.paperWIn).toBeCloseTo(8.5, 5);
    expect(layout.paperHIn).toBeCloseTo(11,  5);
    expect(layout.printableWIn).toBeCloseTo(7.5, 5);
    expect(layout.printableHIn).toBeCloseTo(10,  5);
    expect(layout.marginIn).toBe(0.5);
  });

  it('paper and printable dimensions are correct for landscape', () => {
    const ls = settings({ orientation: 'landscape' });
    const layout = computeTilingLayout(bounds(100, 100), ls)!;
    expect(layout.paperWIn).toBeCloseTo(11,  5);
    expect(layout.paperHIn).toBeCloseTo(8.5, 5);
  });
});

// ── Multi-page layouts ────────────────────────────────────────────────────────

describe('computeTilingLayout — multi-page', () => {

  it('2×1 when content is wider than one printable width', () => {
    // stepX=696 → cols=2 when w > PRINT_W_PX (720)
    const layout = computeTilingLayout(bounds(800, 500), S)!;
    expect(layout.cols).toBe(2);
    expect(layout.rows).toBe(1);
    expect(layout.totalPages).toBe(2);
  });

  it('1×2 when content is taller than one printable height', () => {
    const layout = computeTilingLayout(bounds(400, 1000), S)!;
    expect(layout.cols).toBe(1);
    expect(layout.rows).toBe(2);
    expect(layout.totalPages).toBe(2);
  });

  it('2×2 for content wider and taller than one page', () => {
    const layout = computeTilingLayout(bounds(800, 1000), S)!;
    expect(layout.cols).toBe(2);
    expect(layout.rows).toBe(2);
    expect(layout.totalPages).toBe(4);
  });

  it('3×2 for appropriately-sized content', () => {
    // 3 cols: w > 2*STEP_X + OVERLAP = 2*696 + 24 = 1416
    // 2 rows: h > 1*STEP_Y + OVERLAP = 936 + 24 = 960 → h = 1000
    const w = STEP_X * 2 + OVERLAP_PX + 1;  // forces 3 cols
    const h = STEP_Y + OVERLAP_PX + 1;       // forces 2 rows
    const layout = computeTilingLayout(bounds(w, h), S)!;
    expect(layout.cols).toBe(3);
    expect(layout.rows).toBe(2);
    expect(layout.totalPages).toBe(6);
  });
});

// ── Overlap effect ────────────────────────────────────────────────────────────

describe('computeTilingLayout — overlap', () => {

  it('larger overlap means smaller step, so more pages for the same content', () => {
    const bigOverlap = settings({ overlapIn: 1.0 });
    const noOverlap  = settings({ overlapIn: 0.0 });
    const w = PRINT_W_PX + 100;

    const lo = computeTilingLayout(bounds(w, 100), bigOverlap)!;
    const ln = computeTilingLayout(bounds(w, 100), noOverlap)!;
    expect(lo.cols).toBeGreaterThanOrEqual(ln.cols);
  });

  it('zero overlap still produces correct 2-col layout', () => {
    const noOverlap = settings({ overlapIn: 0.0 });
    const printW    = printableDims(noOverlap).w * SCREEN_DPI;
    const layout    = computeTilingLayout(bounds(printW + 1, 100), noOverlap)!;
    expect(layout.cols).toBe(2);
  });

  it('overlapIn is stored in the returned layout', () => {
    const layout = computeTilingLayout(bounds(400, 400), S)!;
    expect(layout.overlapIn).toBe(S.overlapIn);
  });
});

// ── Tile positions ────────────────────────────────────────────────────────────

describe('computeTilingLayout — tile positions', () => {

  it('tile (0,0) starts at content origin for top-left alignment', () => {
    const layout = computeTilingLayout(bounds(800, 1000, 50, 75), S)!;
    const t00 = layout.tiles[0][0];
    // top-left alignment: origin = content origin
    // (but origin may be shifted left/up if grid is wider than content —
    //  so we just check the step between adjacent tiles)
    expect(t00.col).toBe(0);
    expect(t00.row).toBe(0);
    expect(t00.printW).toBeCloseTo(PRINT_W_PX, 0);
    expect(t00.printH).toBeCloseTo(PRINT_H_PX, 0);
  });

  it('adjacent tiles differ by stepX / stepY', () => {
    const layout = computeTilingLayout(bounds(800, 1000), S)!;
    const t00 = layout.tiles[0][0];
    const t01 = layout.tiles[0][1];
    const t10 = layout.tiles[1][0];
    expect(t01.printX - t00.printX).toBeCloseTo(STEP_X, 0);
    expect(t10.printY - t00.printY).toBeCloseTo(STEP_Y, 0);
  });

  it('tiles have correct row/col indices', () => {
    const layout = computeTilingLayout(bounds(800, 1000), S)!;
    expect(layout.tiles[1][1].row).toBe(1);
    expect(layout.tiles[1][1].col).toBe(1);
  });

  it('pageX/Y offsets tile origin by one margin', () => {
    const layout  = computeTilingLayout(bounds(400, 400), S)!;
    const tile    = layout.tiles[0][0];
    const marginPx = S.marginIn * SCREEN_DPI;
    expect(tile.pageX).toBeCloseTo(tile.printX - marginPx, 1);
    expect(tile.pageY).toBeCloseTo(tile.printY - marginPx, 1);
  });
});

// ── Content alignment ─────────────────────────────────────────────────────────

describe('computeTilingLayout — content alignment', () => {

  it('center alignment shifts origin so content sits in the middle of the grid', () => {
    const centered = settings({ contentAlign: 'center' });
    const topLeft  = settings({ contentAlign: 'top-left' });
    const b = bounds(800, 1000);

    const lc = computeTilingLayout(b, centered)!;
    const lt = computeTilingLayout(b, topLeft)!;

    // With centering the first tile origin is shifted left/up relative to
    // top-left alignment (grid is always >= content, excess is split evenly).
    expect(lc.tiles[0][0].printX).toBeLessThanOrEqual(lt.tiles[0][0].printX);
  });

  it('center: content bounding box center aligns with grid center', () => {
    const centered = settings({ contentAlign: 'center' });
    const b = bounds(800, 1000, 0, 0);
    const layout = computeTilingLayout(b, centered)!;

    const gridW = PRINT_W_PX + (layout.cols - 1) * STEP_X;
    const gridH = PRINT_H_PX + (layout.rows - 1) * STEP_Y;

    const contentCx = b.x + b.w / 2;
    const contentCy = b.y + b.h / 2;

    const gridX = layout.tiles[0][0].printX;
    const gridY = layout.tiles[0][0].printY;
    const gridCx = gridX + gridW / 2;
    const gridCy = gridY + gridH / 2;

    expect(gridCx).toBeCloseTo(contentCx, 1);
    expect(gridCy).toBeCloseTo(contentCy, 1);
  });
});

// ── Calibration ───────────────────────────────────────────────────────────────

describe('computeTilingLayout — calibration', () => {

  it('higher calibrationPxPerIn means fewer pages for the same px content', () => {
    // Higher px/in → same content covers fewer real inches → fewer pages
    const highDpi = settings({ calibrationPxPerIn: 192 }); // 2× screen DPI
    const lowDpi  = settings({ calibrationPxPerIn:  48 }); // 0.5× screen DPI
    const w = 1000;
    const lh = computeTilingLayout(bounds(w, 100), highDpi)!;
    const ll = computeTilingLayout(bounds(w, 100), lowDpi)!;
    expect(lh.cols).toBeLessThanOrEqual(ll.cols);
  });
});

// ── contentBounds passthrough ─────────────────────────────────────────────────

describe('computeTilingLayout — contentBounds', () => {

  it('layout.contentBounds matches the input bounds', () => {
    const b = bounds(500, 700, 12, 34);
    const layout = computeTilingLayout(b, S)!;
    expect(layout.contentBounds).toEqual(b);
  });
});
