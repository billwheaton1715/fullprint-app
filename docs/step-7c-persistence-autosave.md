# Step 7C — Persistence, Autosave & Recovery

## 1. Goals
Persistence exists to:
- Prevent data loss
- Enable crash recovery
- Support autosave without user friction
- Remain fully local (no backend dependency)

Persistence is not version control or collaboration.

## 2. Storage Technology
Primary storage: IndexedDB  
Access layer: idb or Dexie.js  
Reasoning: large binary blobs, async, transactional, browser-native.

## 3. Persistence Scope
Persisted:
- Project metadata
- Tab states
- Canonical geometry data
- Command stacks (undo/redo)
- App-level settings

Not persisted:
- Viewport zoom
- Pan offsets
- Cursor hover state
- Temporary drag previews

## 4. Persistence Model
```ts
interface PersistedProject {
  projectId: string;
  lastSaved: number;
  projectState: ProjectStateSnapshot;
}
```

## 5. Autosave Strategy
Autosave is:
- Silent
- Incremental
- Debounced (e.g. 500–1000ms)
- Triggered only by committed commands

Autosave is not triggered by navigation or rendering events.

## 6. Save Frequency & Limits
- One logical save per command batch
- IndexedDB cleanup for abandoned projects
- No explicit save button required (optional manual save allowed)

## 7. Crash Recovery
On startup:
1. Load project list from IndexedDB
2. Restore last saved snapshot
3. Rehydrate command stacks
4. Resume exactly where user left off

No dialogs unless recovery fails.

## 8. Undo Interaction
Undo does not trigger autosave until user performs a new command.
Redo reuses existing persisted command entries.

## 9. Versioning
Persisted schema versioned explicitly.
Migration scripts required on version bump.

## 10. Security & Privacy
All data remains local.
No network transmission by default.

## 11. Why This Works
- Matches IDE-grade reliability
- Enables infinite undo safely
- Keeps mental model simple for users
- Scales to future cloud sync if desired
