# Step 8B — Interaction, Hit-Testing & Snapping

## Purpose
This document defines how users interact with geometry on the canvas: selection, manipulation, snapping, and precision control. Interaction exists to make accurate real-world layout easy, not merely possible.

---

## 1. Interaction Philosophy

- User intent is more important than raw pointer movement
- Precision must be achievable without extreme zoom
- Keyboard and mouse are first-class input devices
- All interactions map to Commands (see Step 7B)
- View-only actions (pan, zoom) are not commands

---

## 2. Selection Types

### 2.1 Point Selection
Used for:
- Calibration endpoints
- Grab handles
- Anchors and corners

Behavior:
- Click selects nearest eligible point within tolerance
- Ambiguous selections can be cycled via keyboard
- Active point is clearly highlighted

---

### 2.2 Rectangular Selection
- Click-drag defines rectangle in world space
- Selects intersecting geometry
- Supports add / subtract / intersect modifiers

---

### 2.3 Freeform (Lasso) Selection
- Mouse-drawn polyline in screen space
- Converted to closed polygon in world space
- Enables non-rectangular print regions (T, L, cross, E shapes)

---

## 3. Selection Modifiers

| Modifier | Effect |
|--------|--------|
| Shift  | Add to selection |
| Alt    | Subtract from selection |
| Ctrl   | Toggle selection |
| Esc    | Clear selection |

Modifiers behave consistently across tools.

---

## 4. Grab Handles

### 4.1 Handle Types
- Corner handles (resize)
- Edge handles (axis-constrained resize)
- Center handles (move)
- Calibration handles (endpoint placement)

### 4.2 Handle Rules
- Rendered via SVG overlay
- Hit-tested in world space
- Only visible when relevant
- Never modify geometry implicitly

---

## 5. Precision Nudging

### 5.1 Keyboard Nudging
- Arrow keys: coarse nudge (configurable mm)
- Shift + arrows: fine nudge
- Alt + arrows: ultra-fine nudge

All nudges produce commands and are undoable.

---

### 5.2 Visual Nudge Indicator
- Circular indicator appears near click location
- Indicator can be nudged independently
- Geometry not committed until confirmation
- Commit via Enter, double-click, or explicit UI action

---

## 6. Snapping System

### 6.1 Snap Targets
- Calibration endpoints
- Image corners
- Selection bounds
- Grid intersections (if enabled)

### 6.2 Snap Rules
- Snapping evaluated in world space
- Tolerance defined in millimeters
- Visual snap hints appear transiently
- Geometry unchanged until commit

Snapping assists but never coerces.

---

## 7. Hit-Testing Tolerance

- Defined in millimeters
- Independent of zoom level
- Scales visually, not logically

---

## 8. Cursor & Feedback

Cursor reflects active context:
- Default
- Move
- Resize
- Precision adjust
- Rotate (reserved for V2)

Feedback is immediate and non-destructive.

---

## 9. Accessibility & Ergonomics

- Full keyboard operability
- No drag-only requirements
- Generous hit targets
- Undo always available

---

## 10. Why This Matters

This interaction model:
- Eliminates pixel hunting
- Enables confident calibration on low-quality images
- Matches expectations from IDEs, SketchUp, and CAD tools
- Scales cleanly as features expand

Precision is a baseline feature, not an advanced option.
