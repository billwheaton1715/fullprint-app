# Step 13 – First-Week Implementation Checklist

## Purpose
This document defines a concrete, achievable set of tasks for the first week
of Fullprint development.

The goal is momentum, not completeness.

---

## Day 1 – Project Foundation

- Create Angular project (latest stable)
- Enable strict TypeScript
- Set up linting & formatting
- Define folder structure:
  - core/
  - canvas/
  - commands/
  - persistence/
  - ui/
  - models/

Deliverable:
- App builds and runs
- Empty shell renders

---

## Day 2 – Tab & State Infrastructure

- Implement TabManagerService
- Define TabState interface
- Create per-tab state container
- Basic tab UI (no canvas yet)

Deliverable:
- Multiple tabs openable
- Active tab switching works

---

## Day 3 – Canvas Rendering Skeleton

- Canvas component
- Resize handling
- Clear background rendering
- View transform stub (no zoom yet)

Deliverable:
- Canvas renders consistently
- No interaction errors

---

## Day 4 – Image Import & Display

- Paste image support
- File import support
- Image rendering layer
- Fit-to-view logic

Deliverable:
- Image appears on canvas
- Resizes correctly
- Survives reload

---

## Day 5 – Command System Wiring

- Command interface
- Command dispatcher
- Undo stack per tab
- Simple test command (e.g., rename tab)

Deliverable:
- Undo/redo works for non-visual state
- Foundation proven

---

## Day 6 – Persistence & Autosave

- IndexedDB schema
- Autosave on command commit
- Reload project on startup
- Versioning stub

Deliverable:
- Refresh page, work restored
- No explicit save needed

---

## Day 7 – Reality Check & Cleanup

- Manual walkthrough of flows
- Print architectural docs
- Identify friction points
- Remove dead code
- Write TODO list for Week 2

Deliverable:
- Stable, boring foundation
- Confidence to proceed

---

## Non-Goals for Week 1

- Calibration math
- Cropping tools
- Printing
- Polishing UI

Week 1 is about *infrastructure*, not features.

---

## Final Advice

If you feel impatient during Week 1:
- You are doing it correctly

This groundwork is what makes the rest of the project enjoyable instead of fragile.
