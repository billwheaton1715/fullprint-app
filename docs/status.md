# Fullprint – Build Status
_Last updated: 2026-05-28 (Claude Cowork session — ink saver live preview, tiling auto-update, dead code removal)_

---

## Where We Are

**V1 is complete.** All milestones 0–7 are done. The app has a working canvas with pan/zoom,
image import, crop tool, multi-tab workspace, two-point printer calibration, page tiling with
a live assembly-grid overlay, PDF export, and a live edge-aware ink saver effect. Work is
saved automatically to IndexedDB and can be explicitly saved/opened as a `.fpp` project file.
A 290-test suite covers all core layers and passes cleanly. The app is deployable as a static
SPA (Netlify config included).

---

## Milestone Status

| Milestone | Name | Status | Notes |
|---|---|---|---|
| 0 | Foundations | ✅ Done | Scaffolding, multi-tab, persistence, autosave all complete |
| 1 | Canvas & Image Presence | ✅ Done | Canvas, pan/zoom, resize, image import all complete |
| 2 | Geometry & Data Model | ✅ Done | Primitives, units, world-space coords, serialization complete |
| 3 | Interaction & Editing | ✅ Done | Grid snap + edge snap with toolbar toggle and magenta guide lines |
| 4 | Cropping & Layout Tools | ✅ Done | Crop tool complete |
| 5 | Export & Print Readiness | ✅ Done | PDF export working (jsPDF installed) |
| 6 | UX Polish & Hardening | ✅ Done | Status bar, notifications, paper sizes, shortcuts overlay, preferences panel, ink saver live preview all complete |
| 7 | Late V1 Calibration | ✅ Done | Two-point calibration complete |

---

## What Is Working

### Canvas & Rendering
- HTML5 Canvas rendering loop with requestAnimationFrame invalidation
- Pan (middle-mouse drag) and zoom (scroll wheel, centered on pointer)
- Canvas correctly fills the browser viewport and tracks window resize via ResizeObserver
- HiDPI / devicePixelRatio support
- Background clear + white fill per frame

### Geometry & Data Model
- Shape base class with optional `fillStyle`, `strokeStyle`, `lineWidth`
  — style is carried through translate / rotate / scale
- Implemented primitives: Rectangle, Triangle, Circle, Polygon, PolygonWithHoles,
  Line, LineString, Arc, BezierCurve, Ellipse
- `ImageShape` — raster image on the canvas; holds `HTMLImageElement` + data-URL src;
  AABB hit test; translate/rotate/scale immutable (V1: rotation moves position only)
- World-space coordinate system: everything in mm internally, converted to px for rendering
- `Measurement` class handles unit conversion (mm ↔ px ↔ in)
- `CanvasViewport` encapsulates scale + pan offset, screen↔world conversion
- Full shape serialization/deserialization via `shape-serializer.ts` (all 9 shape types,
  including ImageShape with async HTMLImageElement reconstruction)

### Image Import
- Three import paths: drag-and-drop onto canvas, Cmd+V paste, toolbar file-picker button
- Images placed centered in current viewport at natural pixel size
- Import is fully undoable via `AddShapesCommand`
- Multiple files supported in a single drag/paste/pick operation

### Interaction
- Click to select a shape; Shift+click to add/remove from selection
- Drag-marquee to select all shapes within a rectangle
- Drag to move selected shapes (preview during drag, commit on mouse-up)
- Bounding box overlay on selected shapes
- Grid overlay (toggleable)
- Crosshair at pointer position

### Fit to View
- `F` key or `Cmd+0` / `Ctrl+0` fits all shapes (or just the selection) into the viewport
- Uses `CanvasViewport.fitToRect()` with 5% padding

### Crop Tool
- Non-destructive: crop rect stored on `ImageShape` as `cropRect` (image-natural pixels)
- Shape bounds (topLeft / width / height) always reflect the visible (cropped) area
- Full image origin is recoverable via `getFullImageOriginPx()` — original crop is undoable
- `CanvasCropController` manages 8 resize handles + move interaction in world-space
- `CropImageCommand` is undoable; replaces the shape in the shapes array via `withCrop()`
- **Activate**: select an image and click "Crop" toolbar button, or press `C`
- **Commit**: press `Enter` or click "Crop" again
- **Cancel**: press `Escape`

### Two-Point Calibration
- Maps two canvas points to a known real-world distance (mm or in)
- Computes a `calibrationPxPerIn` factor stored in tiling settings
- Affects how many tiles are generated and the physical output scale of each tile
- Calibration survives save/restore via the persisted tiling settings

### Multi-Tab System
- Multiple independent canvases in a tabbed workspace
- Each tab carries its own shapes, viewport state, tiling settings, and calibration
- Tabs can be added, closed, and renamed
- Active tab index and all tab state are fully persisted

### Persistence
- **IndexedDB autosave**: state is saved automatically ~2 seconds after any change;
  on reload the app restores the last autosaved state
- **File System Access API** (Chrome/Edge): Save / Save As / Open dialogs with native
  file picker; files use the `.fpp` extension (JSON)
- **Blob download fallback**: browsers without FSA get a `<a download>` file instead
- **Save status indicator** in the toolbar (`Saving…` / `Saved` / `Error`)
- `Cmd+S` triggers Save (falls back to Save As if no file handle is open)

### Page Tiling & PDF Export
- `TilingCalculator` computes an N×M page grid covering the content bounding box
  - **Paper sizes**: Letter, Legal, Tabloid, A4, A3, A2, and Custom (user-entered W×H)
  - Configurable margin and overlap in inches
  - Content alignment: top-left (default) or center
  - Step = printable area − overlap; minimum 1 page
- **Tiling panel** controls: paper size, orientation, margin, overlap, content alignment,
  assembly marks style, assembly grid spacing, registration marks
- **Canvas overlay** shows the tile grid with blue dashed borders, overlap zones,
  page numbers, registration marks, and the assembly grid in green
- `CanvasPdfExporter` renders each tile to an offscreen canvas (JPEG), embeds in a
  jsPDF document, and triggers a browser download
  - jsPDF is installed (`yarn add jspdf`) and imported as a lazy dynamic import
  - Each PDF page includes the tile image, vector registration marks, and a gray
    page label (e.g., "Page 2 of 6  (col 2/3, row 1/2)")

### Assembly Grid
- A single continuous grid spanning the entire assembled area — lines align seamlessly
  across page seams when the printed pages are taped together
- **Rectangular**: cartesian gridlines (vertical + horizontal)
- **Diagonal**: two families of true 45° lines (NW→SE and NE→SW)
- **Both**: all four line families overlaid
- Spacing selectable 1″ to 3″ (½″ steps); default 1.5″
- Identical rendering logic in both the canvas overlay and the PDF tiles

### Ink Saver (Live Canvas + PDF Export)
Inspired by BigPrint's "Lighten areas" feature. Reduces ink usage while keeping lines,
labels, and dimensions readable — the effect fades the fill toward white in large interior
areas far from any marking, while preserving original color at edges.

**Algorithm** (`canvas-ink-saver.ts`):
1. Compute luminance from RGB
2. Sobel gradient → edge-magnitude map
3. Suppress edges adjacent to canvas background (near-white, lum > 252) so the image
   border is not treated as a content line
4. Threshold top-15% of surviving magnitudes → binary edge seed mask
5. Two-pass Manhattan distance transform: every pixel gets distance to nearest edge seed
6. Blend each pixel toward white: pixels at edge keep original color; pixels ≥ fade radius
   from any edge fade to `strength × white`

**Controls** (in the tiling panel):
- **Ink Saver on/off** checkbox
- **Strength** slider (0–100 %)
- **Fade distance** slider (1–20 mm; default 5 mm — same as BigPrint)

**Live canvas preview**:
- Effect is applied to the rendered canvas after shapes are drawn, before overlays
- Zoom-aware: fade radius is computed in mm and converted to physical pixels at current
  zoom level and device pixel ratio, so the band appears at a constant real-world size
  regardless of zoom level
- Cached: the processed `ImageData` is keyed on canvas size + viewport state + shape
  positions + settings. Mouse moves and hover use the cache instantly. The effect is
  skipped during drag preview (`_previewShapes != null`) so interaction stays smooth.
- Selection/hover outlines are drawn as `strokeRect` (not `shape.toCanvas`) so they
  never overwrite the ink-saved pixels

**Tiling layout auto-update**:
- `recomputeTilingLayout()` is now called from `executeCommand` (on any committed change)
  and from undo/redo handlers — so the tile grid overlay updates immediately when shapes
  are moved, added, deleted, or cropped, without needing to toggle the panel.

### Toolbar
Organized into labeled groups: **File** · **Image** · **View** · **Layout** · **?** (help)
- **File**: Save, Save As, Open, filename display
- **Image**: Import (file picker, also drag-drop and paste), Crop
- **View**: Fit viewport to content
- **Layout**: Tiling (panel toggle), Calibrate, calibration badge

### Keyboard Shortcuts
Press **?** in the app to open the in-app shortcuts overlay. Available shortcuts:

| Key | Action |
|---|---|
| Cmd+Z / Ctrl+Z | Undo |
| Cmd+Shift+Z / Ctrl+Y | Redo |
| Cmd+S / Ctrl+S | Save (Save As if no file is open) |
| Cmd+A / Ctrl+A | Select all |
| Escape | Deselect all / cancel crop / close shortcuts overlay |
| Delete / Backspace | Delete selected shapes |
| Arrow keys | Nudge selected 1 px |
| Shift+Arrow | Nudge selected 10 px |
| F | Fit viewport to content (or selection) |
| Cmd+0 / Ctrl+0 | Fit viewport to content |
| C | Activate crop (when an image is selected) |
| Enter | Commit crop (while in crop mode) |
| ? | Open/close keyboard shortcuts overlay |

### Undo / Redo
- `CanvasUndoStack` with 100-step limit
- Undoable commands: move (translate), delete, nudge, add shapes (import), crop
- Selection changes (click, marquee) intentionally not on undo stack
- Before/after shape snapshots in each command — no dependency on ephemeral state at undo time

### Test Suite
- **290 tests, all passing** (Karma + Jasmine, Angular CLI / Chrome)
- Covers: viewport math, hit testing, selection model, drag/move, overlays, group
  operations, undo stack, shape serialization (all 9 types, round-trip), crop controller
  (geometry, handles, pointer interaction), tiling calculator (layout math, calibration,
  alignment), persistence service (IDB autosave, FSA, blob fallback, debounce, AbortError),
  ImageShape (construction, crop, translate, toJson, equals)
- Test-environment notes:
  - `window.indexedDB` is a read-only getter in Chrome — tests override it with
    `Object.defineProperty` and restore in `afterEach`
  - Jasmine fake timers (`jasmine.clock()`) used for debounce tests
  - `Image` constructor stubbed with a synchronous fake for image deserialization tests

---

## What Is Not Done Yet (V1 — all resolved)

1. ~~**Preferences panel**~~ — ✅ Done (⚙ gear in toolbar; default paper size, DPI, overlap, margin; persisted in IDB independently of project state)
2. ~~**Snapping**~~ — ✅ Done (grid snap 5 mm + shape edge snap, Snap toggle in toolbar, magenta guide lines on canvas)
3. ~~**Ink Saver**~~ — ✅ Done (see Ink Saver section below for full details)
4. ~~**Dead code cleanup**~~ — ✅ Done (see Dead Code Removed section below)

---

## Architecture Notes

- Angular 21 standalone components, no NgRx (intentional)
- `CanvasTabComponent` is the thin shell; logic extracted into controllers:
  - `CanvasInteractionController` — pointer state machine
  - `CanvasSelectionController` + `CanvasSelectionModel` — selection state
  - `CanvasHitTestController` — point-in-shape and marquee tests
  - `CanvasTransformController` — translate delta management
  - `CanvasPanZoomController` — pan/zoom state
  - `CanvasMarqueeController` — drag-select preview
  - `CanvasOverlayRenderer` — grid, bounding boxes, crosshair, tiling overlay
  - `CanvasCropController` — crop handle hit-testing and drag logic
- `CanvasUndoStack` holds `UndoableCommand` instances; selection commands do NOT go on the stack
- All shape transforms are immutable — translate/rotate/scale return new instances
- `ImageShape.cropRect` stores the crop in image-natural pixels; `withCrop()` returns a new
  instance with topLeft/size reflecting the cropped area
- Tiling: `TilingSettings` + `TilingCalculator` (pure functions) → `TilingLayout`
  (grid of `TileRect`); `CanvasPdfExporter` renders tiles to jsPDF (lazy dynamic import)
- Assembly grid anchored to assembled bounding box; each tile clips its own slice naturally
  via the offscreen canvas transform
- `PersistenceService`: injectable, `@Injectable({ providedIn: 'root' })`; manages both IDB
  and FSA; `PersistedState` / `PersistedTab` are the serialized data model

---

## Known Behaviors / Gotchas

- **FSA file handle does not survive a page reload.** After you reload the tab, the app
  restores your last autosaved state from IndexedDB, but `currentFileName` is null — the
  browser does not persist the file handle between sessions. To continue saving to the same
  `.fpp` file you must use Open to reopen it, or Save As to re-establish the handle.

- **IndexedDB autosave runs independently of file save.** Saving to a `.fpp` file does not
  stop IndexedDB autosaving. If you make changes after a file save, those changes are
  autosaved to IDB. On next reload you'll get the IDB state (which may be newer than the
  file), but without a file handle.

- **`ImageShape.rotate()` V1 limitation** — moves topLeft only; the image stays
  axis-aligned. True image rotation is a V2 item.

- **`canvas-tab.component.spec.ts`** has a "moves selected shape with drag" test that
  dispatches `pointermove` to `window` rather than the canvas, so it expects zero movement.
  The test name is misleading but the behavior under test (event routing) is correct.

---

## Dead Code Removed (V1 cleanup)

The following were removed after V1 was complete; `tsc --noEmit` passes clean after removal.

- **`src/setup-jest.ts`** — leftover Jest bootstrap file; Jest was never used (project uses Karma/Jasmine)
- **`src/test/jest-setup.ts`** — orphaned PointerEvent polyfill not wired into angular.json or tsconfig
- **`core/geometry/Rect.ts` + `Rect.spec.ts`** — early prototype raw-number rect class, fully superseded by `Rectangle.ts`
- **`core/geometry/Square.ts`** — Rectangle subclass, not used anywhere in production or test code
- **Empty folder scaffolding** removed: `core/domain/` (tab, canvas, units, project, commands), `core/application/` (state, services), `core/persistence/local/`, `shared/` (types)
