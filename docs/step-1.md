# Let’s Start STEP 1: Core Data Model

I’ll propose a **clean, minimal, v1-friendly model** that matches everything you’ve described.

We can iterate on it, but this gives us something concrete to work with.

---

## STEP 1.1 — Project Model (Draft)

```ts
export interface Project {
  id: string;
  title: string;
  createdAt: number;
  modifiedAt: number;

  image: ImageAsset | null;
  calibration: Calibration | null;
  selection: Selection | null;
  layout: Layout;

  settings: ProjectSettings;
}
```

---

## STEP 1.2 — Image Asset

```ts
export interface ImageAsset {
  id: string;
  widthPx: number;
  heightPx: number;
  sourceType: 'paste' | 'file';
  dataUrl?: string;        // small images
  blobId?: string;         // IndexedDB reference for large images
}
```

---

## STEP 1.3 — Calibration

```ts
export interface Calibration {
  pointA: CalibrationPoint | null;
  pointB: CalibrationPoint | null;
  realWorldLength: number | null; // in project units
  unit: 'in' | 'mm' | 'cm';
}

export interface CalibrationPoint {
  x: number; // image space, float
  y: number;
}
```

---

## STEP 1.4 — Selection (v1)

We start simple but extensible.

```ts
export type Selection =
  | RectSelection
  | LassoSelection;

export interface RectSelection {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LassoSelection {
  type: 'lasso';
  points: Array<{ x: number; y: number }>;
}
```

---

## STEP 1.5 — Layout & Tiling

```ts
export interface Layout {
  paperSize: PaperSize;
  orientation: 'portrait' | 'landscape' | 'auto';
  margin: number;
  overlap: number;
  center: boolean;
  grid: GridSettings;
  excludedPages: number[];
}
```

---

## STEP 1.6 — Project Settings

```ts
export interface ProjectSettings {
  units: 'in' | 'mm' | 'cm';
  colorMode: 'color' | 'grayscale' | 'bw';
}
```

---

## Why this is a good starting point

* Pure TypeScript
* Serializable
* Undo-friendly
* UI-agnostic
* Future-proof

Nothing here commits you to:

* Angular specifics
* Canvas specifics
* PDF specifics

That’s exactly what we want.

---

## Next Question (small, but important)

Before we move on to **Step 2 (Command System)**, I need one clarification:

> Do you want **per-tab undo stacks**, or a **global undo stack that respects active tab**?

Both are valid. IDEs usually do per-document undo.

My recommendation:

* **Per-tab undo stack**
* Switching tabs does not affect undo history

But I want your explicit confirmation before we proceed, because it affects the design.

Once you answer that, we’ll define the command interface and undo manager cleanly.


me:
I want per-tab undo stacks explicitly, not global ones.  To me, each tab is a separate thing that will be printed, and there may be several things in play, but they shouldn't necessarily affect each other I don't think.

But that raises another question about how my IDEs work.  All of what I work on are textual files (for the most part) in different tabs using a text editor.  and I am able to click a forward/backward button (I have a logi mx master 3s mouse) and it changes the context to the last or next place I was editing, and that might well be in a different file.  I'm not so certain there is really a correlary with what I am proposing though.  Do you see a pressing case for doing something with that?

Your instinct is correct, and your hesitation is *healthy*. There **is** a related concept in IDEs — but it is *not* undo, and conflating the two would be a mistake. You’re right to separate them.

Let’s disentangle this cleanly.

---

## 1. Per-tab undo is the correct choice (and now locked in)

You’ve justified it perfectly:

> *Each tab is a separate thing that will be printed.*

That maps exactly to:

* one document
* one model
* one undo stack

This mirrors:

* Photoshop documents
* GIMP images
* CAD drawings
* Text files in IDEs

So we are **explicitly** doing:

* **Undo stack per tab**
* No cross-tab undo
* Closing a tab discards its undo history
* Switching tabs does nothing to undo history

That’s settled and correct.

---

## 2. What your IDE’s “back/forward” actually is (and isn’t)

What you’re describing with the MX Master’s back/forward buttons is **not undo** and not even document history.

It is usually called one of:

* *Navigation history*
* *Location history*
* *Edit location stack*

Key properties:

* Tracks **cursor positions**
* Tracks **view focus**
* Crosses file boundaries
* Does *not* change content
* Is orthogonal to undo/redo

In other words:

> “Where was I looking / editing?”
> not
> “What did I change?”

That’s why:

* Undo doesn’t jump files
* Back/forward doesn’t undo changes

---

## 3. Is there a pressing analogue for *this* app?

Short answer: **not for v1**, and not urgently at all.

Longer, more precise answer:

### In your app, navigation consists of:

* zoom
* pan
* selection focus
* calibration focus
* page focus

These are:

* transient
* view-only
* non-destructive

Which makes them poor candidates for:

* undo
* persistent history
* cross-tab navigation

There *could* eventually be a concept of:

> “jump back to previous selection”
> or
> “jump to last calibration edit”

But:

* the canvas is always visible
* the user doesn’t “lose their place” the way they do in code
* there’s no linear reading flow like text

So the *problem IDE navigation solves* doesn’t really exist here.

---

## 4. Why IDEs need that, and you probably don’t

IDEs:

* have thousands of lines
* hide context off-screen
* have many invisible states
* involve deep nesting

Your app:

* has one canvas
* is spatial, not linear
* keeps everything visible or quickly reachable

The cost/benefit ratio is very different.

---

## 5. A subtle but important distinction (this matters)

Undo answers:

> “I didn’t mean to do that.”

Navigation history answers:

> “Where was I?”

Your app overwhelmingly triggers the *first* question, not the second.

So your focus on undo — not navigation history — is correct.

---

## 6. Could this exist *later*?

Yes, but only as a **nice-to-have** and only if a real pain emerges.

For example:

* jumping between multiple calibration operations
* hopping between multiple selection regions
* stepping through page tiles

Even then, it would be:

* per-tab
* optional
* view-only
* not undoable

And very likely mapped to different shortcuts than browser back/forward.

---

## 7. Design conclusion (important checkpoint)

We now have a clean separation:

| Concept              | Scope   | Undoable |
| -------------------- | ------- | -------- |
| Project content      | Per tab | ✅        |
| Undo history         | Per tab | ✅        |
| View navigation      | Per tab | ❌        |
| Cross-tab navigation | N/A     | ❌        |

This is *exactly* how professional tools stay sane.

---

## 8. Where we go next (now very clear)

You’ve answered the key question.

### Next step is now unambiguous:

**STEP 2 — Define the Command System**

Specifically:

* `Command` interface
* Undo/redo manager
* Command grouping (for nudges, drag operations, etc.)
* How commands apply to a single project instance

This is the keystone. Once we define this, everything else becomes straightforward.

If you’re ready, I’ll:

* propose the `Command` interface
* show how per-tab undo stacks are implemented cleanly
* demonstrate how micro-operations (nudges) don’t become undo spam unless you want them to

Say the word and we’ll move into STEP 2.

