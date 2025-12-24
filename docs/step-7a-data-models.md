# Step 7A — Data Models & Interfaces (V1)

## Design Principles

1. All persisted state is immutable  
2. All lengths are stored in canonical units (millimeters)  
3. Undo operates on domain objects, not UI state  
4. IDs are opaque UUID strings  
5. No UI-only data is persisted  
6. Models are JSON-serializable  
7. Schema versioning is mandatory  

---

## Canonical Types

```ts
export type UUID = string;
export type Millimeters = number;
export type Degrees = number;
```

---

## Application Settings

```ts
export interface AppSettings {
  version: number;
  defaultUnits: 'in' | 'mm';
  defaultPaperSize: PaperSize;
  defaultMargins: Margins;
  defaultOverlap: Millimeters;
  autosaveIntervalMs: number;
  tabLayout: 'top' | 'side';
}
```

---

## Project Model

```ts
export interface Project {
  version: number;
  id: UUID;
  title: string;
  createdAt: number;
  modifiedAt: number;
  metadata: ProjectMetadata;
  tabs: Record<UUID, Tab>;
  activeTabId: UUID | null;
}
```

### ProjectMetadata

```ts
export interface ProjectMetadata {
  units: 'in' | 'mm';
  paperSize: PaperSize;
  margins: Margins;
  overlap: Millimeters;
  printerProfileId?: UUID;
}
```

---

## Tab Model

```ts
export interface Tab {
  id: UUID;
  title: string;
  image: ImageState | null;
  calibration: CalibrationState | null;
  layout: LayoutState;
  undoStack: Command[];
  redoStack: Command[];
}
```

---

## Image State

```ts
export interface ImageState {
  source: ImageSource;
  widthPx: number;
  heightPx: number;
}
```

```ts
export type ImageSource =
  | { type: 'blob'; blobId: UUID }
  | { type: 'url'; url: string };
```

---

## Calibration State

```ts
export interface CalibrationState {
  pointA: PointPx;
  pointB: PointPx;
  realWorldDistanceMm: Millimeters;
}
```

```ts
export interface PointPx {
  x: number;
  y: number;
}
```

---

## Selection & Crop

```ts
export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

---

## Layout & Tiling

```ts
export interface LayoutState {
  selection: SelectionRect | null;
  pageLayout: PageLayout;
  excludedPageIds: UUID[];
}
```

```ts
export interface PageLayout {
  pages: Page[];
  orientation: 'portrait' | 'landscape';
}
```

```ts
export interface Page {
  id: UUID;
  row: number;
  column: number;
  xMm: Millimeters;
  yMm: Millimeters;
  widthMm: Millimeters;
  heightMm: Millimeters;
}
```

---

## Paper & Margins

```ts
export interface PaperSize {
  name: string;
  widthMm: Millimeters;
  heightMm: Millimeters;
}

export interface Margins {
  topMm: Millimeters;
  rightMm: Millimeters;
  bottomMm: Millimeters;
  leftMm: Millimeters;
}
```

---

## Command Model

```ts
export interface Command {
  type: CommandType;
  payload: unknown;
  inverse: Command;
  timestamp: number;
}
```

```ts
export type CommandType =
  | 'IMAGE_PASTED'
  | 'IMAGE_CLEARED'
  | 'CALIBRATION_CONFIRMED'
  | 'CALIBRATION_CLEARED'
  | 'SELECTION_CREATED'
  | 'SELECTION_UPDATED'
  | 'CROP_APPLIED'
  | 'LAYOUT_UPDATED'
  | 'UNITS_CHANGED'
  | 'TAB_RENAMED';
```

---

## Persistence Envelope

```ts
export interface PersistedProject {
  schemaVersion: number;
  project: Project;
}
```

---

## Explicitly Excluded (UI-only)

- zoom / pan  
- cursor position  
- hover state  
- snap guides  
- selection previews  
- calibration handles  

---

This document is canonical for V1.
