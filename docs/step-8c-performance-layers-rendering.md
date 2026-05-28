# Step 8C – Performance, Layers & Rendering Optimization

## Purpose
This document defines how Fullprint maintains high performance, responsiveness,
and correctness while handling large images, deep zoom levels, multiple tabs,
and complex selection geometry.

The goal is professional-grade interaction even on modest hardware.

---

## Design Principles

### 1. Never Re-render More Than Necessary
- Separate model state from render state
- Re-render only when geometry, selection, or view changes

### 2. Visual Fidelity Scales With Zoom
- Pixel-accurate at high zoom
- Aggregated rendering at low zoom

### 3. Each Tab Is Fully Isolated
- Independent render trees
- Independent undo stacks

---

## Layered Rendering Model

Each canvas tab renders through ordered layers:

1. **Background Layer**
   - Neutral background or checkerboard
   - Page boundaries and bleed guides

2. **Source Image Layer**
   - Original raster image
   - GPU-accelerated `drawImage` rendering

3. **Calibration Geometry Layer**
   - Calibration points
   - Calibration line
   - Dimension annotation

4. **Selection Geometry Layer**
   - Crop rectangles
   - Lasso paths
   - Grab handles and anchors

5. **Guides & Grid Layer**
   - Orthogonal grid
   - Diagonal alignment grid
   - Smart snapping guides

6. **UI Overlay Layer**
   - Hover highlights
   - Snap indicators
   - Cursor hints and halos

Layers are rendered in order and can be independently invalidated.

---

## Dirty-Region Rendering

To avoid unnecessary full redraws:

- Track bounding boxes of modified geometry
- Clear and redraw only affected regions
- Perform full redraw only on:
  - Zoom change
  - Pan
  - Tab switch
  - DPI or printer setting change

---

## Zoom & Pan Strategy

### View Transform
- Single transform matrix per tab:
  - Scale
  - Translate
- Applied uniformly to all render layers

### Precision Handling
- World coordinates stored in floating-point units
- Rendering snapped to device pixels at high zoom
- Logical units independent of screen DPI

---

## Grid & Guide Optimization

- Grid density adapts dynamically to zoom level
- Major and minor grid lines fade in/out smoothly
- Diagonal grid generated lazily and cached
- Guides are clipped to viewport bounds

---

## Hit Testing Performance

- Hit testing occurs in world space, not screen space
- Spatial indexing used for:
  - Handles
  - Control points
  - Selection geometry
- Cached handle shapes reused across frames

---

## Image Memory Management

- Original image retained at native resolution
- Downscaled versions cached for low-zoom rendering
- Browser-managed bitmap caching leveraged
- No image reload on undo/redo

---

## Multi-Tab Performance Model

- Only the active tab:
  - Tracks pointer movement
  - Performs hit testing
  - Triggers redraws
- Inactive tabs remain fully dormant
- Tab switching performs a single full redraw

---

## Undo / Redo Interaction

Undo and redo operations:
- Invalidate only affected layers
- Do not reload images
- Do not rebuild canvas state
- Do not reset view transforms

---

## Future-Proofing

This architecture cleanly supports future features:

- Measurement overlays
- Multiple independent crop regions
- Vector exports (SVG, PDF)
- Tiled print previews
- WebGL or OffscreenCanvas acceleration

---

## Summary

Step 8C ensures that Fullprint:
- Remains responsive at any scale
- Handles real-world image sizes reliably
- Avoids architectural rewrites
- Feels like a professional-grade tool, not a toy

Performance is not an optimization here — it is a core feature.
