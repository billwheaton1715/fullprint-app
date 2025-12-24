# Deferring:
Yes — and you’re thinking about this *exactly* right. Deferring calibration to late V1 is sensible and keeps early velocity high.

Below is a **short, succinct milestone list** that cleanly maps to everything we’ve defined so far, without dragging in deferred complexity.

You can paste this straight into a doc if you want.

---

# V1 Milestones (Concise)

### Milestone 0 – Foundations

**Goal:** App exists and stays standing

* Project scaffolding
* Strict typing & linting
* Core folder structure
* Tab system
* Per-tab state containers
* Persistence + autosave

✅ Output: You can refresh the browser and nothing breaks

---

### Milestone 1 – Canvas & Image Presence

**Goal:** Something real appears on screen

* Canvas rendering loop
* View transform (pan / zoom)
* Image import (file + paste)
* Fit-to-view
* Stable resize behavior

✅ Output: Images render correctly and predictably

---

### Milestone 2 – Geometry & Data Model

**Goal:** The app understands shapes, not pixels

* World-space coordinate system
* Geometry primitives
* Overlap metadata
* Serialization / deserialization
* Unit handling (in/mm)

✅ Output: State is semantic, not visual

---

### Milestone 3 – Interaction & Editing

**Goal:** User can *work* with geometry

* Selection
* Hit testing
* Drag/move
* Snapping (basic)
* Keyboard nudging
* Undo/redo for visual changes

✅ Output: Editing feels intentional, not fragile

---

### Milestone 4 – Cropping & Layout Tools

**Goal:** Fullprint’s core value emerges

* Crop rectangles
* Overlap visualization
* Page tiling logic
* Page boundary overlays
* Layout preview

✅ Output: User can prepare a printable layout

---

### Milestone 5 – Export & Print Readiness

**Goal:** Work leaves the app correctly

* Print preview
* PDF export
* Page numbering
* Overlap margins preserved
* Consistent scale

✅ Output: Output matches what user expects

---

### Milestone 6 – UX Polish & Hardening

**Goal:** Remove friction

* Menu completeness
* Shortcut mapping
* Preferences
* Error handling
* Accessibility checks

✅ Output: App feels deliberate and calm

---

### Milestone 7 – Late V1 Calibration (Deferred)

**Goal:** Precision tuning (explicitly deferred)

* Printer calibration workflow
* Measurement correction
* Per-printer profiles
* Validation prints

🚧 **Not required for usable V1**

---

## One-Sentence Summary

> **V1 is complete when a user can import an image, lay it out across pages, export a correctly scaled PDF, and never think about the internals.**

---

If you’d like next, I can:

* Collapse this into a **single roadmap graphic**
* Map milestones → steps (8–13)
* Turn this into **GitHub milestones/issues**
* Or define **V1 exit criteria** in bullet form

Just tell me the next move.
