import { CanvasUndoStack } from './canvas-undo-stack';
import { UndoableCommand }  from './commands/undoable-command';

// ── Minimal command stubs ─────────────────────────────────────────────────────

function makeCmd(
  executeResult = true,
  undoResult    = true,
  redoResult    = true,
): UndoableCommand & { executeCalls: number; undoCalls: number; redoCalls: number } {
  return {
    executeCalls: 0,
    undoCalls:    0,
    redoCalls:    0,
    execute() { this.executeCalls++; return executeResult; },
    undo()    { this.undoCalls++;    return undoResult;    },
    redo()    { this.redoCalls++;    return redoResult;    },
  };
}

/** Command with no redo() method — falls back to execute(). */
function makeCmdNoRedo(executeResult = true): UndoableCommand & { executeCalls: number } {
  return {
    executeCalls: 0,
    execute() { this.executeCalls++; return executeResult; },
    undo()    { return true; },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CanvasUndoStack', () => {

  // ── execute ────────────────────────────────────────────────────────────────

  it('execute() calls cmd.execute() once', () => {
    const stack = new CanvasUndoStack();
    const cmd   = makeCmd();
    stack.execute(cmd);
    expect(cmd.executeCalls).toBe(1);
  });

  it('execute() returns true when cmd.execute() returns true', () => {
    const stack = new CanvasUndoStack();
    expect(stack.execute(makeCmd(true))).toBe(true);
  });

  it('execute() returns false when cmd.execute() returns false', () => {
    const stack = new CanvasUndoStack();
    expect(stack.execute(makeCmd(false))).toBe(false);
  });

  it('execute() adds to undo stack when changed', () => {
    const stack = new CanvasUndoStack();
    stack.execute(makeCmd(true));
    expect(stack.canUndo()).toBe(true);
  });

  it('execute() does NOT add to undo stack when not changed', () => {
    const stack = new CanvasUndoStack();
    stack.execute(makeCmd(false));
    expect(stack.canUndo()).toBe(false);
  });

  it('execute() clears the redo stack', () => {
    const stack = new CanvasUndoStack();
    stack.execute(makeCmd());
    stack.undo();
    expect(stack.canRedo()).toBe(true);
    stack.execute(makeCmd());           // new action
    expect(stack.canRedo()).toBe(false);
  });

  // ── undo ──────────────────────────────────────────────────────────────────

  it('undo() returns false on empty stack', () => {
    expect(new CanvasUndoStack().undo()).toBe(false);
  });

  it('undo() calls cmd.undo()', () => {
    const stack = new CanvasUndoStack();
    const cmd   = makeCmd();
    stack.execute(cmd);
    stack.undo();
    expect(cmd.undoCalls).toBe(1);
  });

  it('undo() removes from undo stack', () => {
    const stack = new CanvasUndoStack();
    stack.execute(makeCmd());
    stack.undo();
    expect(stack.canUndo()).toBe(false);
  });

  it('undo() adds to redo stack when cmd.undo() returns true', () => {
    const stack = new CanvasUndoStack();
    stack.execute(makeCmd());
    stack.undo();
    expect(stack.canRedo()).toBe(true);
  });

  it('undo() does NOT add to redo stack when cmd.undo() returns false', () => {
    const stack = new CanvasUndoStack();
    stack.execute(makeCmd(true, false)); // undo returns false
    stack.undo();
    expect(stack.canRedo()).toBe(false);
  });

  it('multiple undos work in LIFO order', () => {
    const stack = new CanvasUndoStack();
    const c1 = makeCmd();
    const c2 = makeCmd();
    stack.execute(c1);
    stack.execute(c2);
    stack.undo();
    expect(c2.undoCalls).toBe(1);
    expect(c1.undoCalls).toBe(0);
    stack.undo();
    expect(c1.undoCalls).toBe(1);
  });

  // ── redo ──────────────────────────────────────────────────────────────────

  it('redo() returns false on empty redo stack', () => {
    expect(new CanvasUndoStack().redo()).toBe(false);
  });

  it('redo() calls cmd.redo()', () => {
    const stack = new CanvasUndoStack();
    const cmd   = makeCmd();
    stack.execute(cmd);
    stack.undo();
    stack.redo();
    expect(cmd.redoCalls).toBe(1);
  });

  it('redo() falls back to execute() when redo() is absent', () => {
    const stack = new CanvasUndoStack();
    const cmd   = makeCmdNoRedo();
    stack.execute(cmd);     // executeCalls = 1
    stack.undo();
    stack.redo();           // should call execute() again
    expect(cmd.executeCalls).toBe(2);
  });

  it('redo() removes from redo stack', () => {
    const stack = new CanvasUndoStack();
    stack.execute(makeCmd());
    stack.undo();
    stack.redo();
    expect(stack.canRedo()).toBe(false);
  });

  it('redo() adds back to undo stack', () => {
    const stack = new CanvasUndoStack();
    stack.execute(makeCmd());
    stack.undo();
    stack.redo();
    expect(stack.canUndo()).toBe(true);
  });

  it('multiple redos work in LIFO order', () => {
    const stack = new CanvasUndoStack();
    const c1 = makeCmd();
    const c2 = makeCmd();
    stack.execute(c1);
    stack.execute(c2);
    stack.undo();   // c2 goes to redo
    stack.undo();   // c1 goes to redo
    stack.redo();   // c1 should redo first
    expect(c1.redoCalls).toBe(1);
    expect(c2.redoCalls).toBe(0);
  });

  // ── size limit ────────────────────────────────────────────────────────────

  it('respects maxSize — drops oldest commands', () => {
    const stack = new CanvasUndoStack(3);
    const cmds = [makeCmd(), makeCmd(), makeCmd(), makeCmd()];
    cmds.forEach(c => stack.execute(c));

    // Should be able to undo 3 times (the oldest was dropped)
    expect(stack.undo()).toBe(true);
    expect(stack.undo()).toBe(true);
    expect(stack.undo()).toBe(true);
    expect(stack.undo()).toBe(false);   // fourth undo is gone
  });

  it('default maxSize is 100', () => {
    const stack = new CanvasUndoStack();
    for (let i = 0; i < 101; i++) stack.execute(makeCmd());
    // After 101 executes with maxSize=100, first was dropped — only 100 undos available
    let count = 0;
    while (stack.undo()) count++;
    expect(count).toBe(100);
  });

  // ── clear ─────────────────────────────────────────────────────────────────

  it('clear() empties both stacks', () => {
    const stack = new CanvasUndoStack();
    stack.execute(makeCmd());
    stack.execute(makeCmd());
    stack.undo();
    stack.clear();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });

  // ── canUndo / canRedo ─────────────────────────────────────────────────────

  it('canUndo() is false initially', () => {
    expect(new CanvasUndoStack().canUndo()).toBe(false);
  });

  it('canRedo() is false initially', () => {
    expect(new CanvasUndoStack().canRedo()).toBe(false);
  });

  it('canUndo() becomes true after execute, false after undo', () => {
    const stack = new CanvasUndoStack();
    stack.execute(makeCmd());
    expect(stack.canUndo()).toBe(true);
    stack.undo();
    expect(stack.canUndo()).toBe(false);
  });

  it('canRedo() becomes true after undo, false after redo', () => {
    const stack = new CanvasUndoStack();
    stack.execute(makeCmd());
    stack.undo();
    expect(stack.canRedo()).toBe(true);
    stack.redo();
    expect(stack.canRedo()).toBe(false);
  });
});
