import { UndoableCommand } from './commands/undoable-command';

/**
 * Simple undo / redo stack for canvas geometry commands.
 *
 * Usage:
 *   stack.execute(cmd)   — runs cmd.execute(), pushes onto undo stack
 *   stack.undo()         — pops and runs cmd.undo(), pushes onto redo stack
 *   stack.redo()         — pops and runs cmd.redo() (or re-execute), pushes onto undo stack
 */
export class CanvasUndoStack {
  private readonly _undo: UndoableCommand[] = [];
  private readonly _redo: UndoableCommand[] = [];

  constructor(private readonly maxSize = 100) {}

  execute(cmd: UndoableCommand): boolean {
    const changed = cmd.execute();
    if (changed) {
      this._undo.push(cmd);
      if (this._undo.length > this.maxSize) this._undo.shift();
      this._redo.length = 0; // new action clears redo history
    }
    return changed;
  }

  undo(): boolean {
    const cmd = this._undo.pop();
    if (!cmd) return false;
    const changed = cmd.undo();
    if (changed) this._redo.push(cmd);
    return changed;
  }

  redo(): boolean {
    const cmd = this._redo.pop();
    if (!cmd) return false;
    // Use redo() if available, otherwise re-execute (safe for idempotent commands)
    const changed = cmd.redo ? cmd.redo() : cmd.execute();
    if (changed) this._undo.push(cmd);
    return changed;
  }

  canUndo(): boolean { return this._undo.length > 0; }
  canRedo(): boolean { return this._redo.length > 0; }
  clear(): void { this._undo.length = 0; this._redo.length = 0; }
}
