# Step 7B — Command System, State Transitions & Undo

## 1. Core Principle
Every meaningful user action is a Command. Commands are deterministic, serializable, reversible, and scoped to a single tab.

## 2. Command Model
```ts
interface Command {
  id: string;
  type: CommandType;
  timestamp: number;
  payload: unknown;
  apply(state: TabState): TabState;
  undo(state: TabState): TabState;
}
```

## 3. Per-Tab Command Stack
Each TabState owns its own undo/redo stack.

```ts
interface TabState {
  commandStack: Command[];
  commandIndex: number;
}
```

## 4. What Is and Is Not a Command
Recorded: title changes, image paste, calibration edits, crop actions, centering.
Not recorded: zoom, pan, hover, cursor movement.

## 5. Command Granularity
Commands represent user intent, not raw mouse events.

## 6. Example Commands
Includes SetTitleCommand and NudgeCalibrationPointCommand with apply/undo methods.

## 7. Command Dispatcher
A lightweight CommandService executes, undoes, and redoes commands without NgRx.

## 8. Autosave Strategy
Persist base state plus command log for crash-safe recovery.

## 9. Units Handling
Canonical units remain millimeters; unit switching affects display only.

## 10. Why This Scales
Supports future overlays, snapping, annotations, and playback without re-architecture.
