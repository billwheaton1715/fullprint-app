This is the 
# Step 12 – V1 Implementation Plan

## Purpose
This document defines a pragmatic, low-risk plan to deliver **Fullprint V1**:
a usable, accurate, browser-based replacement for legacy tools like BigPrint,
while leaving clear extension paths for V2 and beyond.

V1 prioritizes:
- Correctness
- Usability
- Architectural integrity
- Personal sustainability (this is not a startup death march)

---

## V1 Definition (What “Done” Means)

A V1 build is considered complete when a user can:

1. Open the app in a modern browser
2. Create a new project and tab
3. Paste or import a raster image
4. Calibrate scale using two points and a known distance
5. Crop using rectangle or lasso selection
6. Preview tiled pages with overlaps
7. Export a multi-page PDF
8. Print at true physical size
9. Undo actions reliably per tab
10. Close and reopen without losing work

Anything beyond this is explicitly **out of scope for V1**.

---

## Guiding Implementation Principles

- Favor clarity over cleverness
- Prefer simple, explicit data models
- Avoid premature optimization
- Every feature must be undoable
- Every state change must be serializable

---

## Technology Stack (V1)

### Frontend
- Angular (latest stable)
- TypeScript (strict mode)
- RxJS for state streams
- Native `<canvas>` 2D API
- IndexedDB for persistence

### Output
- Client-side PDF generation (e.g., pdf-lib or equivalent)
- No backend required

---

## Milestone Breakdown

### Milestone 1 – Project Skeleton & Infrastructure
**Goal:** App boots, tabs exist, nothing breaks.

Includes:
- Angular project setup
- App shell
- Tab manager service
- Command dispatcher scaffold
- Per-tab state container
- IndexedDB wiring (empty schema)

Deliverable:
- Multiple tabs openable and closable
- State objects created per tab

---

### Milestone 2 – Canvas Rendering Core
**Goal:** See things reliably.

Includes:
- Canvas component
- View transform (pan/zoom)
- Layer rendering pipeline
- Image loading & display
- Dirty-region redraw strategy

Deliverable:
- Image renders correctly
- Zoom/pan works smoothly
- No interaction yet

---

### Milestone 3 – Calibration System
**Goal:** Establish real-world scale.

Includes:
- Calibration point placement
- Pixel snapping & nudging
- Calibration confirmation dialog
- Unit switching (inch/mm)

Deliverable:
- Known-length line defines scale
- Scale persists across reloads
- Unit switching does not distort geometry

---

### Milestone 4 – Selection & Cropping
**Goal:** Define what will be printed.

Includes:
- Rectangle crop tool
- Lasso selection tool
- Grab handles & nudging
- Add / subtract selection
- Visual feedback layers

Deliverable:
- Arbitrary crop shapes
- Accurate visual feedback
- Undoable edits

---

### Milestone 5 – Undo / Redo System
**Goal:** Make the app safe to use.

Includes:
- Command objects for all mutations
- Per-tab undo stacks
- Redo support
- Non-recorded navigation actions

Deliverable:
- Infinite undo per tab (session-limited)
- Stable replay across reloads

---

### Milestone 6 – Persistence & Autosave
**Goal:** Never lose work.

Includes:
- Autosave on every committed command
- Project reload
- Versioned schema
- Crash recovery behavior

Deliverable:
- Reload restores exact state
- No explicit “Save” required

---

### Milestone 7 – Print Preview & Tiling
**Goal:** Turn geometry into pages.

Includes:
- Page tiling algorithm
- Orientation optimization
- Overlap handling
- Page numbering
- Assembly map generation

Deliverable:
- Accurate preview of final output
- Page count matches expectation

---

### Milestone 8 – PDF Export
**Goal:** Produce physical output.

Includes:
- PDF generation
- Vector overlays
- Embedded raster images
- Page metadata
- Scale verification warnings

Deliverable:
- Printable PDF
- Measured output matches calibration

---

## Explicitly Deferred (Not V1)

- Printer calibration utility
- Multiple crop regions per tab
- Measurement overlays
- SVG/DXF export
- GPU/WebGL acceleration
- Collaboration or cloud sync
- Mobile UI optimization

These are **V2+ only**.

---

## Development Strategy

### Recommended Order
Implement milestones strictly in order.
Each milestone should leave the app in a runnable state.

### Testing Strategy
- Manual testing first (this is visual software)
- Add lightweight automated tests only where useful
- Print real pages early and often

---

## Risk Management

Primary risks:
- PDF scale correctness
- Browser differences in printing
- Over-engineering too early

Mitigations:
- Early test prints
- Minimal abstractions
- Keep V1 opinionated

---

## Success Criteria

V1 is successful if:
- You stop using BigPrint
- Others can use it without instruction
- Output matches real-world measurements
- The codebase feels calm, not fragile

---

## Final Note

This plan is intentionally conservative.

The goal is not to build *everything* —
it is to build a **tool you trust**.

Once V1 exists, momentum will take care of the rest.
