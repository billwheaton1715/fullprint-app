# Step 9 – Print Pipeline & PDF Generation

## Purpose
This document defines how Fullprint converts a calibrated, cropped canvas into
accurate, real-world, full-scale printed output.

The print pipeline is responsible for:
- Tiling large designs across multiple pages
- Preserving true physical dimensions
- Minimizing wasted paper
- Producing assembly aids (page map, numbering, grids)
- Generating reliable, portable output (PDF)

Accuracy is non-negotiable.

---

## Core Principles

1. **Physical Size Is the Source of Truth**
   - All printing is driven by real-world units
   - Screen DPI is irrelevant at print time

2. **PDF Is the Primary Output Format**
   - Portable
   - Predictable
   - Print-driver independent

3. **Print Preview Equals Print Output**
   - What you see in preview is exactly what prints
   - No hidden scaling or driver surprises

---

## Input to the Print Pipeline

Each print job consumes:

- Calibrated image
- Active crop geometry (lasso or rectangle)
- Measurement system (inches / metric)
- Printer profile (page size, margins)
- User print settings:
  - Overlap amount
  - Orientation preferences
  - Color / grayscale

---

## World Space → Print Space Conversion

### Coordinate Mapping
- World units (inches/mm) mapped directly to PDF units (points)
- 1 inch = 72 PDF points
- No intermediate raster scaling

### Calibration Enforcement
- Calibration line defines scale factor
- Any mismatch triggers a warning before export
- User must explicitly acknowledge scale changes

---

## Page Tiling Algorithm

### Page Definition
Each page tile is defined by:
- Printable area (page size minus margins)
- Optional overlap region

### Tiling Strategy
1. Compute bounding box of cropped geometry
2. Evaluate:
   - Portrait vs landscape
   - Rotation options (0°, 90°)
3. Choose layout with:
   - Fewest pages
   - Least wasted area
4. Generate tile grid

Auto-orientation is default but overridable.

---

## Overlap Handling

- User-defined overlap (e.g., 0.25", 6mm)
- Overlaps applied symmetrically
- Overlap areas optionally marked with:
  - Dashed cut lines
  - Shaded waste zones

Overlap is part of the geometry, not a printer trick.

---

## Page Numbering & Metadata

Each page includes optional metadata:

- Page index (e.g., A1, A2, B1)
- Total page count
- Orientation indicator
- Crop boundary reference

All metadata is:
- Configurable
- Positionable
- Excludable

---

## Assembly Map (Overview Page)

### Purpose
Provide a clear guide for assembling printed pages.

### Features
- Miniature map of all pages
- Labeled tiles
- Orientation arrows
- Optional diagonal grid

### Placement
- Printed as:
  - First page
  - Separate page
  - Or embedded in unused space on a tile

User may drag and reposition the map to avoid important geometry.

---

## Grid & Alignment Aids (Print-Time)

Optional print-time overlays:
- Orthogonal grid
- Diagonal grid
- Crosshair markers at overlaps
- Registration marks

These aids are:
- Non-destructive
- Excluded from final geometry
- Toggleable per print job

---

## Color & Rendering Options

- Full color
- Grayscale
- High-contrast black & white

Rendering intent favors:
- Line clarity
- Edge sharpness
- Predictable toner/ink usage

---

## PDF Generation Details

### Format
- Single multi-page PDF
- One tile per page
- Optional cover / assembly page

### Technical Notes
- Vector overlays where possible
- Raster images embedded at native resolution
- No printer-driver scaling instructions embedded

---

## Print Preview

Print preview:
- Uses the same pipeline as export
- Displays:
  - Page boundaries
  - Overlaps
  - Page labels
  - Assembly aids

Preview is not cosmetic — it is authoritative.

---

## Error Detection & Warnings

Before export, the system checks for:
- Missing calibration
- Extremely small printable areas
- Excessive page counts
- Printer margin conflicts

Warnings must be acknowledged, not ignored.

---

## Persistence

Each print configuration is:
- Saved per tab
- Undoable
- Restored on reload

Print settings are part of project state.

---

## Future Extensions (V2+)

- Printer-specific profiles
- Duplex-aware layouts
- Cut-order optimization
- Export to SVG or DXF
- Batch printing across tabs

---

## Summary

Step 9 defines the heart of Fullprint’s value:

- Accurate, real-world sizing
- Predictable, repeatable output
- Human-friendly assembly
- Zero guesswork at the printer

This is where pixels become physical.
