# Step 8A — Canvas & Rendering Architecture

## Purpose
This document defines the rendering foundation for Fullprint. Rendering exists solely to support accurate, real‑world‑scale printing, not artistic drawing.

---

## 1. Core Rendering Goals
The rendering system must:

- Preserve exact real‑world dimensions
- Support precise hit‑testing and snapping
- Render large raster images efficiently
- Remain deterministic for print preview
- Separate geometry from view transforms

This is closer to a CAD/DTP renderer than a paint program.

---

## 2. Rendering Technology Choice

### Primary Surface: HTML Canvas
Canvas is the authoritative render surface.

Reasons:
- Pixel‑accurate raster rendering
- Efficient for large images
- Simple, explicit transform pipeline
- Excellent browser support
- Predictable print output

### Secondary Overlay: SVG (Optional)
SVG may be layered above the canvas for:

- Selection outlines
- Grab handles
- Guides and grids
- Calibration lines

SVG is never the source of truth.

---

## 3. Coordinate Spaces

Three coordinate systems are mandatory:

### 3.1 Image Space
- Units: pixels
- Origin: image top‑left
- Used only for decoding raster images

### 3.2 World Space (Canonical)
- Units: millimeters
- Origin: arbitrary, project‑defined
- All geometry, selections, and layouts live here

### 3.3 Screen Space
- Units: CSS pixels
- Origin: canvas top‑left
- Used for input and display only

All conversions are explicit and reversible.

---

## 4. Transform Pipeline

World Space (mm)
   → scale (mm → px)
   → translate (pan)
   → Screen Space

Rules:
- Zoom modifies scale only
- Pan modifies translation only
- Geometry is never mutated by view changes

---

## 5. Rendering Order (Conceptual Layers)

1. Background (solid or checkerboard)
2. Raster image layer
3. Selection geometry
4. Guides & grids
5. Handles & UI affordances

Layers may share a single canvas for performance.

---

## 6. Hit‑Testing Strategy

Input pipeline:
Mouse Event (screen px)
 → Screen → World transform
 → Geometry test in world space

Advantages:
- Consistent snapping regardless of zoom
- Stable behavior at any resolution
- Unit‑accurate selection tolerance

---

## 7. Snapping Philosophy

- All snapping occurs in world space
- Snapping tolerance defined in millimeters
- Pixel snapping is forbidden

This ensures calibration accuracy even under extreme zoom.

---

## 8. Redraw Strategy

- Render on demand
- requestAnimationFrame for interaction
- No continuous animation loops
- Dirty‑flag invalidation (V2+)

---

## 9. Determinism Guarantee

Given identical:
- Project state
- Transform state
- Rendering options

The output must be pixel‑identical.

This is critical for print preview trust.

---

## 10. Why This Architecture Is Correct

- Mirrors CAD and DTP best practices
- Keeps math explicit and testable
- Avoids premature GPU or WebGL complexity
- Supports future overlays and tools cleanly

This architecture intentionally favors correctness over novelty.
