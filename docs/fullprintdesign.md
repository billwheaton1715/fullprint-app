Perfect — now that we have the architecture and state management approach locked in, Step 5 is about **technical implementation planning**. This is where we map out how the Angular + NgRx + Signals + Canvas system will actually be built, component by component, service by service, without yet writing the code.

We’ll focus on **V1**, making it realistic and extendable to V2 later.

---

# STEP 5 — Technical Implementation Plan (V1)

---

## 5.1 Angular Application Structure

We want a **modular, maintainable structure**:

```
src/
 ├─ app/
 │   ├─ core/                 # Singleton services, interceptors, state management
 │   │   ├─ store/            # NgRx store, actions, reducers, effects
 │   │   ├─ services/         # Persistence, printer, settings
 │   │   └─ models/           # Types, interfaces, enums
 │   ├─ features/
 │   │   ├─ project/          # Tabs, canvas, image management
 │   │   ├─ calibration/      # Calibration tool
 │   │   ├─ layout/           # Tiling, page layout
 │   │   └─ export/           # PDF generation
 │   ├─ shared/               # Reusable components: buttons, dialogs, grids
 │   └─ app.component.ts      # Root, handles tab container + menu
 └─ assets/
```

* **Standalone components** everywhere
* Signals used inside components for canvas rendering and UI reactions
* NgRx Store as **source of truth**

---

## 5.2 NgRx Store Slices (V1)

### Top-level state:

```ts
AppState {
  appSettings: AppSettingsState
  projects: ProjectsState
  ui: UIState   // minimal, for e.g. menu open/closed, active tool
}
```

### ProjectsState:

```ts
ProjectsState {
  activeProjectId: string | null
  projects: {
    [projectId]: ProjectState
  }
}
```

### ProjectState:

```ts
ProjectState {
  metadata: ProjectMetadata    // units, paper size, overlaps, margins
  tabs: {
    [tabId]: TabState
  }
  activeTabId: string
}
```

### TabState:

```ts
TabState {
  title: string
  image: ImageState
  calibration: CalibrationState
  layout: LayoutState          // pages, tiling, excluded pages
  undoStack: Command[]
  redoStack: Command[]
}
```

* Commands are **immutable** snapshots of actions
* Each tab has its **own undo/redo**
* Tabs can be created, duplicated, closed independently

---

## 5.3 Command & Undo System

**Pattern:** Command pattern + NgRx

1. User performs action → dispatches NgRx Action
2. Reducer:

   * Mutates TabState immutably
   * Stores **inverse command** on undo stack
3. Undo → pops undo stack → applies inverse → pushes to redo stack
4. Redo → pops redo stack → reapplies → pushes to undo stack

**Example commands:**

* `AddCalibrationPoint`
* `MoveCalibrationPoint`
* `CropSelection`
* `PasteImage`
* `ChangeUnits`
* `TogglePageInclusion`
* `SetTabTitle`

---

## 5.4 Autosave / Persistence

* NgRx **Effect** listens to project mutation actions
* Debounce (e.g., 1s) → save JSON-serializable ProjectState to **IndexedDB**
* Reload last saved project on startup
* Dirty indicator in tab label

**IndexedDB advantages:**

* Handles large images via Blob storage
* Works offline
* Browser-native

---

## 5.5 Canvas / Rendering

* Angular component per tab: `<canvas-tab>`
* **Signals** manage:

  * Zoom / pan
  * Cursor guides
  * Drag handles
  * Temporary selection boxes
* Canvas listens to NgRx **TabState** for committed data:

  * Calibration points
  * Crop rectangles
  * Layout grid

**Performance tip:**

* Avoid putting high-frequency mouse movements in NgRx.
* Only commit actions (e.g., final drag end, calibration confirm).

---

## 5.6 Tabs & UI

* Tab container at top by default, optional left-side tab pane
* Tab object:

  * `title`
  * `dirty` flag
  * `close`, `duplicate`
* Switching tabs:

  * Loads active TabState into canvas component
  * Each tab maintains **its own undo/redo** independently
* Keyboard shortcut mapper:

  * Central registry for commands (like IDEs)
  * Supports “Enter = commit”, arrows = nudge, Ctrl/Cmd shortcuts

---

## 5.7 Calibration Module

* Two calibration points
* Adjustable handles
* Keyboard nudging
* Explicit commit (Enter / double-click)
* Optional metric/inches toggle
* Validation dialog (length input)
* Per-tab storage

---

## 5.8 Layout & Tiling

* Paper size (Letter default)
* Auto portrait / landscape
* Overlap / margins
* Grid overlay for assembly
* Page exclusion toggle
* Page numbering + first-page map
* Undoable

---

## 5.9 PDF Export Module

* Input: committed TabState + LayoutState
* Output: multi-page PDF
* Color / grayscale / B&W
* Deterministic scaling (use canonical units)
* Use a library like **pdf-lib** or **jsPDF**

---

## 5.10 App Settings & Metadata

* **AppSettingsService**:

  * Default units
  * Default paper size / overlap / margins
  * Autosave interval
* **ProjectMetadata** saved per project:

  * Units
  * Paper size
  * Overlaps / margins
  * Last active tab

---

## 5.11 Summary

* NgRx manages **everything that affects project persistence**
* Signals manage **live canvas feedback**
* Undo/redo per-tab
* Autosave + crash recovery built-in
* Modular services: persistence, export, printer awareness
* V1 supports full calibration → print → assemble workflow
* Architecture easily extensible for V2: measurement overlays, lasso selection, printer profiles

---

If you want, the **next step** after this is to produce a **first draft action taxonomy** — basically a **list of all NgRx actions for V1**, marking which are undoable and which are transient.

This sets you up for **scaffold coding**, and ensures nothing is forgotten.

Do you want to move on to that now?
