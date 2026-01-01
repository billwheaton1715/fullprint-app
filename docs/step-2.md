
----- beginning of step 2 discussion -----

me:
exactly why I hesitated mentioning it.  good.

Lets go onto step 2: defining the command system.  I'm going to ask you to fully document all this again in the end, so be sure to keep track of what we are doing here.

cgpt:
Perfect. We are now squarely in **tool-architecture territory**, and this is exactly the right moment to do this carefully. I’ll treat this as a *design document*, not a code dump, and I’ll be explicit about **why** each decision exists so it’s easy to re-document later.

I’ll also consciously “keep track” of what we’re defining, so this can later be consolidated cleanly.

---

# STEP 2 — Command System (Undo / Redo Backbone)

## 2.0 What problem the command system solves

The command system exists to guarantee all of the following simultaneously:

1. **Endless undo (per tab, per session)**
2. **Deterministic project state**
3. **Fine-grained control (micro nudges, precision edits)**
4. **Coarse-grained meaning (crop commit, calibration confirm)**
5. **No accidental undo spam**
6. **Clear separation of model vs view**
7. **Future extensibility without refactors**

This is not optional scaffolding.
This *is* the spine of the application.

---

## 2.1 Core Design Principle

> **Nothing modifies the Project Model directly.**

All changes happen via **Commands**.

If you ever find yourself writing code that mutates the project without a command, that’s a bug by definition.

This single rule gives you:

* undo
* redo
* repeatability
* debuggability
* testability

---

## 2.2 High-level architecture

Per **tab**:

```
Project
  ↑
CommandDispatcher
  ↑
UndoManager
  ↑
UI / Input / Tools
```

Important:

* Each tab has **its own UndoManager**
* Commands never cross project boundaries
* Switching tabs switches the active dispatcher + undo stack

---

## 2.3 What *is* a Command?

A command is:

* a **recorded intention**
* with enough information to:

  * apply itself
  * undo itself

It is **not**:

* a UI event
* a mouse movement
* a view change

---

## 2.4 Base Command Interface (conceptual)

This is the minimal, durable shape:

```ts
export interface Command {
  readonly name: string;

  execute(project: Project): void;
  undo(project: Project): void;
}
```

That’s it.

No return values.
No side effects outside the project.
No UI knowledge.

---

## 2.5 Why commands mutate the project *in place*

You might wonder:

> “Why not immutable state snapshots?”

Because:

* images are large
* geometry is incremental
* memory use matters
* performance matters
* undo depth is unbounded

Professional tools use **command reversal**, not snapshot replacement, for exactly this reason.

---

## 2.6 Example: Simple Metadata Command

```ts
export class SetProjectTitleCommand implements Command {
  readonly name = 'Set Project Title';

  constructor(
    private readonly before: string,
    private readonly after: string
  ) {}

  execute(project: Project): void {
    project.title = this.after;
  }

  undo(project: Project): void {
    project.title = this.before;
  }
}
```

This is trivial, but important:

* “before” and “after” are explicit
* undo is exact
* no inference needed

---

## 2.7 Example: Micro-adjustment Command (nudge)

```ts
export class MoveCalibrationPointCommand implements Command {
  readonly name = 'Move Calibration Point';

  constructor(
    private readonly point: 'A' | 'B',
    private readonly dx: number,
    private readonly dy: number
  ) {}

  execute(project: Project): void {
    const p = this.point === 'A'
      ? project.calibration!.pointA!
      : project.calibration!.pointB!;
    p.x += this.dx;
    p.y += this.dy;
  }

  undo(project: Project): void {
    const p = this.point === 'A'
      ? project.calibration!.pointA!
      : project.calibration!.pointB!;
    p.x -= this.dx;
    p.y -= this.dy;
  }
}
```

This enables:

* 1-pixel nudges
* Shift-nudges
* Ctrl-nudges
* Arbitrary precision

Each nudge is undoable.

---

## 2.8 Undo Manager (per tab)

Now we define the thing that **records and replays commands**.

Conceptually:

```ts
export class UndoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  execute(command: Command, project: Project): void {
    command.execute(project);
    this.undoStack.push(command);
    this.redoStack.length = 0;
  }

  undo(project: Project): void {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo(project);
    this.redoStack.push(cmd);
  }

  redo(project: Project): void {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.execute(project);
    this.undoStack.push(cmd);
  }
}
```

Key properties:

* Unlimited undo (memory permitting)
* Redo invalidated on new command
* No time-based heuristics
* Deterministic behavior

---

## 2.9 Command grouping (critical for usability)

Without grouping:

* dragging a crop edge creates 300 undo steps
* nudging feels noisy
* undo becomes annoying

### Solution: Composite Commands

```ts
export class CompositeCommand implements Command {
  readonly name: string;

  constructor(
    name: string,
    private readonly commands: Command[]
  ) {
    this.name = name;
  }

  execute(project: Project): void {
    for (const cmd of this.commands) {
      cmd.execute(project);
    }
  }

  undo(project: Project): void {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo(project);
    }
  }
}
```

Use cases:

* Dragging a selection edge
* Multi-step calibration refinement
* “Center → nudge → nudge → center” as one logical action (optional)

This preserves:

* precision
* sanity
* user trust

---

## 2.10 When commands are created

Important rule:

> **Commands are created at semantic boundaries, not event boundaries.**

Examples:

| Action            | Command strategy       |
| ----------------- | ---------------------- |
| Arrow key nudge   | 1 command per keypress |
| Mouse drag        | Composite command      |
| Paste image       | Single command         |
| Zoom              | No command             |
| Pan               | No command             |
| Crop commit       | Single command         |
| Selection preview | No command             |

This is how you avoid undo pollution.

---

## 2.11 Command names (why they matter)

Each command has a `name` because:

* menus may show “Undo Crop”
* accessibility benefits
* debugging benefits
* future command palette support

This is *not* fluff.

---

## 2.12 Relationship to View State

Explicit rule:

> Commands **never** touch view state.

So:

* no zoom changes
* no pan changes
* no cursor updates

View state:

* lives outside undo
* can be signals
* resets freely

This keeps undo pure.

---

## 2.13 Tabs & Command Isolation

Per tab:

* 1 Project
* 1 UndoManager
* 1 CommandDispatcher

Switching tabs:

* switches active instances
* does *not* merge histories
* does *not* affect undo depth

Closing a tab:

* discards undo history
* project state may be persisted

---

## 2.14 What we’ve locked in (keep this list)

We have now formally defined:

* Command-based mutation
* Per-tab undo stacks
* Session-scoped undo
* Command reversal (not snapshots)
* Composite commands
* Semantic command boundaries
* Separation of model vs view

This is the **architectural heart** of the app.

---

## 2.15 Next Logical Step

Now that:

* the **model exists** (Step 1)
* the **command system exists** (Step 2)

The next step is:

### **STEP 3 — Project Lifecycle & Tab Management**

That means defining:

* how projects are created
* how tabs are opened/closed
* how persistence plugs in
* how undo stacks are initialized and discarded

Once *that* is done, the app’s skeleton is complete.

When you’re ready, say the word and we’ll move to **Step 3**.
