# Step 11 – Application Shell & UI Architecture

## Purpose
This document defines the structure, layout, and interaction patterns of the
Fullprint user interface.

The UI must feel:
- Familiar to IDE users
- Efficient for experts
- Discoverable for beginners
- Calm, not cluttered

---

## Core UI Philosophy

1. **Menu-first, shortcut-later**
   - Menus expose functionality
   - Shortcuts accelerate mastery
   - Nothing is shortcut-only

2. **Everything is contextual**
   - Active tab defines context
   - Commands act on current tab only

3. **UI never mutates state directly**
   - UI issues commands
   - Command system owns mutations

---

## Application Shell Layout

### Primary Regions

- **Top Menu Bar**
  - File
  - Edit
  - View
  - Units
  - Print
  - Help

- **Toolbar (Optional, Toggleable)**
  - Selection tools
  - Crop tools
  - Calibration
  - Zoom/pan

- **Tab Strip (Default)**
  - One tab per printable artifact
  - Editable tab names
  - Dirty indicator (*)

- **Optional Side Tab Pane**
  - Left or right dock
  - IDE-style list of open tabs
  - User-configurable

- **Main Canvas Area**
  - One active canvas at a time
  - Keyboard focus follows canvas

- **Status Bar**
  - Cursor position (world units)
  - Zoom level
  - Active tool
  - Snapping indicators

---

## Tabs & Navigation

### Tab Behavior
- Each tab has:
  - Independent undo stack
  - Independent print settings
  - Independent persistence state

- Closing a tab:
  - Prompts only if unsaved mutations exist
  - Autosave reduces prompts

### Navigation
- Mouse click switches tabs
- Keyboard shortcuts supported
- No global undo across tabs

---

## Menus (Initial V1 Set)

### File
- New Project
- New Tab
- Close Tab
- Export PDF
- Preferences

### Edit
- Undo
- Redo
- Cut / Copy / Paste (geometry-aware)
- Clear Selection

### View
- Zoom In / Out
- Reset View
- Toggle Grid
- Toggle Guides
- Toggle Overlays

### Units
- Inches
- Millimeters
- Unit settings dialog

### Print
- Print Preview
- Page Setup
- Export PDF

---

## Command Palette (V1 Optional, V2 Recommended)

- IDE-style searchable command launcher
- Keyboard activated
- Lists:
  - Menu actions
  - Tool switches
  - View toggles

Not required for V1, but architecture must not preclude it.

---

## Keyboard Shortcuts

### Principles
- Shortcuts are configurable
- No hardcoded assumptions
- Default bindings provided

### Examples
- Arrow keys: nudge selection
- Shift + arrows: micro-nudge
- Ctrl/Cmd + Z: undo
- Ctrl/Cmd + Shift + Z: redo
- Space: pan tool
- Esc: cancel active tool

Shortcut mapper is a first-class system.

---

## Preferences & Defaults

Stored locally and applied globally:
- Default units
- Default overlap
- Grid visibility
- Snap strength
- Tab layout (top vs side)

Preferences are not part of undo history.

---

## Accessibility & Ergonomics

- Keyboard-only operation supported
- High-contrast mode compatible
- No reliance on color alone
- Cursor feedback for all modes

---

## Summary

Step 11 defines how users *live* inside Fullprint.

It borrows the best ideas from IDEs and creative tools without copying
their complexity.

The UI exists to serve accuracy, not distract from it.
