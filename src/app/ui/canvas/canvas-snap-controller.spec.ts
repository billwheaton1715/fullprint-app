import { CanvasSnapController, SnapOptions } from './canvas-snap-controller';
import Shape from '../../core/geometry/Shape';
import { Rectangle } from '../../core/geometry/Rectangle';
import { Point } from '../../core/geometry/Point';
import Measurement from '../../core/units/Measurement';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a Rectangle shape with world-px dimensions (treated as mm internally via Measurement). */
function makeRect(xPx: number, yPx: number, wPx: number, hPx: number): Shape {
  return new Rectangle(
    new Point(Measurement.fromPx(xPx), Measurement.fromPx(yPx)),
    Measurement.fromPx(wPx),
    Measurement.fromPx(hPx),
  );
}

const DEFAULT_OPTS: SnapOptions = {
  snapEnabled:     true,
  snapToGrid:      true,
  snapToEdges:     true,
  snapThresholdPx: 8,
  gridSpacingMm:   5,
};

// Grid spacing in world-px (5 mm at 96 dpi: 5/25.4*96 ≈ 18.9)
const GRID_PX = Measurement.fromMm(5).toUnit('px');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CanvasSnapController', () => {

  let ctrl: CanvasSnapController;
  beforeEach(() => { ctrl = new CanvasSnapController(); });

  // ── Master switch ──────────────────────────────────────────────────────────

  it('returns original deltas unchanged when snapEnabled is false', () => {
    const shape = makeRect(0, 0, 100, 100);
    const result = ctrl.snapDelta([shape], [shape], 7, 7, 1, {
      ...DEFAULT_OPTS,
      snapEnabled: false,
    });
    expect(result.dx).toBeCloseTo(7);
    expect(result.dy).toBeCloseTo(7);
    expect(result.guides).toHaveSize(0);
  });

  it('returns original deltas unchanged when targets array is empty', () => {
    const result = ctrl.snapDelta([], [], 5, 5, 1, DEFAULT_OPTS);
    expect(result.dx).toBeCloseTo(5);
    expect(result.dy).toBeCloseTo(5);
  });

  // ── Grid snap ─────────────────────────────────────────────────────────────

  it('snaps left edge to nearest grid line when within threshold', () => {
    // Place a shape at exactly x=0, propose dx=3 (which puts left edge at 3,
    // close to 0; nearest grid is 0 → snap back to 0).
    const shape = makeRect(0, 0, 50, 50);
    const result = ctrl.snapDelta([shape], [shape], 3, 0, 1, {
      ...DEFAULT_OPTS,
      snapToEdges: false,
    });
    expect(result.dx).toBeCloseTo(0, 0);
  });

  it('snaps to next grid line when closer to it', () => {
    // GRID_PX ≈ 18.9 px. Propose dx = GRID_PX - 2 so the left edge lands
    // 2 px shy of the next grid line → should snap to it.
    const shape = makeRect(0, 0, 50, 50);
    const dx = GRID_PX - 2;
    const result = ctrl.snapDelta([shape], [shape], dx, 0, 1, {
      ...DEFAULT_OPTS,
      snapToEdges: false,
    });
    expect(result.dx).toBeCloseTo(GRID_PX, 0);
  });

  it('does NOT snap when farther than threshold from any grid line', () => {
    // Use a width=1 shape so left/center/right edges all stay ≥ half-grid
    // from any grid line. GRID_PX ≈ 18.9; half-grid ≈ 9.45 > threshold 8.
    // With width=1: left=9.45, center=9.95, right=10.45 — all >8 px from
    // nearest grid lines (0 and 18.9).
    const shape = makeRect(0, 0, 1, 1);
    const halfGrid = GRID_PX / 2;
    const result = ctrl.snapDelta([shape], [shape], halfGrid, halfGrid, 1, {
      ...DEFAULT_OPTS,
      snapToEdges: false,
      snapThresholdPx: 8,
    });
    // dx should remain unchanged (half-grid is beyond threshold for all edges)
    expect(result.dx).toBeCloseTo(halfGrid, 0);
    expect(result.dy).toBeCloseTo(halfGrid, 0);
  });

  it('does not snap to grid when snapToGrid is false', () => {
    const shape = makeRect(0, 0, 50, 50);
    const result = ctrl.snapDelta([shape], [shape], 3, 3, 1, {
      ...DEFAULT_OPTS,
      snapToGrid:  false,
      snapToEdges: false,
    });
    expect(result.dx).toBeCloseTo(3);
    expect(result.dy).toBeCloseTo(3);
  });

  // ── Edge snap ─────────────────────────────────────────────────────────────

  it('snaps dragged shape left edge to stationary shape left edge', () => {
    const moving     = makeRect(0, 0, 50, 50);
    const stationary = makeRect(200, 0, 50, 50);
    // Propose dx = 203 so dragged left edge lands at 203, 3 px from 200 → snap to 200.
    const result = ctrl.snapDelta([moving], [moving, stationary], 203, 0, 1, {
      ...DEFAULT_OPTS,
      snapToGrid: false,
    });
    expect(result.dx).toBeCloseTo(200, 0);
  });

  it('snaps dragged shape right edge to stationary shape left edge', () => {
    // moving: left=0, right=50. stationary: left=150.
    // Propose dx=97 → dragged right = 147, close to 150 → snap so right=150, dx=100.
    const moving     = makeRect(0,   0, 50, 50);
    const stationary = makeRect(150, 0, 50, 50);
    const result = ctrl.snapDelta([moving], [moving, stationary], 97, 0, 1, {
      ...DEFAULT_OPTS,
      snapToGrid: false,
    });
    expect(result.dx).toBeCloseTo(100, 0);
  });

  it('does not snap to edge when farther than threshold', () => {
    const moving     = makeRect(0, 0, 50, 50);
    const stationary = makeRect(200, 0, 50, 50);
    // Propose dx=190: dragged left = 190, dist from 200 = 10 > threshold 8.
    const result = ctrl.snapDelta([moving], [moving, stationary], 190, 0, 1, {
      ...DEFAULT_OPTS,
      snapToGrid:      false,
      snapThresholdPx: 8,
    });
    expect(result.dx).toBeCloseTo(190, 0);
  });

  it('does not snap to edges of shapes in the target set', () => {
    // Both shapes are being dragged — neither should snap to the other.
    const a = makeRect(0, 0, 50, 50);
    const b = makeRect(60, 0, 50, 50);
    const result = ctrl.snapDelta([a, b], [a, b], 3, 0, 1, {
      ...DEFAULT_OPTS,
      snapToGrid: false,
    });
    // No stationary shapes → no edge snap; but grid snap could fire.
    // With snapToGrid also off there should be no snap at all.
    const resultNoGrid = ctrl.snapDelta([a, b], [a, b], 3, 0, 1, {
      ...DEFAULT_OPTS,
      snapToGrid:  false,
      snapToEdges: true,
    });
    // dx should not be pulled to 0 (which is where target edges are)
    expect(resultNoGrid.dx).toBeCloseTo(3, 0);
  });

  // ── Guide lines ────────────────────────────────────────────────────────────

  it('emits at least one guide when snapping fires', () => {
    const shape = makeRect(0, 0, 50, 50);
    const result = ctrl.snapDelta([shape], [shape], 2, 0, 1, {
      ...DEFAULT_OPTS,
      snapToEdges: false,
    });
    // dx=2 should snap to 0 → guide at x=0
    expect(result.guides.length).toBeGreaterThan(0);
  });

  it('emits no guides when no snap fires', () => {
    const shape = makeRect(0, 0, 50, 50);
    const result = ctrl.snapDelta([shape], [shape], 0, 0, 1, {
      ...DEFAULT_OPTS,
      snapEnabled: false,
    });
    expect(result.guides).toHaveSize(0);
  });

  // ── Viewport scale ────────────────────────────────────────────────────────

  it('respects viewport scale when computing threshold', () => {
    // At scale=2, 8 screen px = 4 world px threshold.
    // Use width=1 so all three candidate edges (left=5, center=5.5, right=6)
    // are all > 4 world px from any grid line → no snap.
    const shape = makeRect(0, 0, 1, 1);
    const result = ctrl.snapDelta([shape], [shape], 5, 0, 2, {
      ...DEFAULT_OPTS,
      snapToEdges:     false,
      snapThresholdPx: 8,
    });
    // 5 world px > 4 world px threshold → no snap for any edge
    expect(result.dx).toBeCloseTo(5, 0);
  });
});
