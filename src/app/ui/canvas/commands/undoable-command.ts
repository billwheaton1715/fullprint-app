import { CanvasCommand } from './canvas-command';

/**
 * A command that can be undone and optionally re-done without re-executing
 * from scratch.  Selection-only commands (click, marquee) do NOT implement
 * this — only geometry-mutating commands go onto the undo stack.
 */
export interface UndoableCommand extends CanvasCommand {
  undo(): boolean;
  /** Optional — falls back to execute() if absent (re-runs the operation). */
  redo?(): boolean;
}

export function isUndoable(cmd: CanvasCommand): cmd is UndoableCommand {
  return typeof (cmd as UndoableCommand).undo === 'function';
}
