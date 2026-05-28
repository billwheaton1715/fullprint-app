import { UndoableCommand } from './undoable-command';
import Shape from '../../../core/geometry/Shape';
import Measurement from '../../../core/units/Measurement';
import { CanvasSelectionController } from '../canvas-selection-controller';

export class NudgeCommand implements UndoableCommand {
  private beforeShapes: Shape[] | null = null;
  private beforeSelected: Shape[] | null = null;
  private afterShapes: Shape[] | null = null;
  private afterSelected: Shape[] | null = null;

  constructor(
    private readonly getShapes: () => Shape[],
    private readonly setShapes: (s: Shape[]) => void,
    private readonly selectionController: CanvasSelectionController,
    private readonly dx: Measurement,
    private readonly dy: Measurement
  ) {}

  execute(): boolean {
    const shapes = this.getShapes();
    const targets = this.selectionController.getSelectedShapes();
    if (!targets.length) return false;

    this.beforeShapes = shapes;
    this.beforeSelected = targets;

    const targetSet = new Set(targets);
    const next = shapes.map(s => targetSet.has(s) ? s.translate(this.dx, this.dy) : s);

    // Build old→new map for selection remapping
    const oldToNew = new Map<Shape, Shape>();
    for (let i = 0; i < shapes.length; i++) {
      if (targetSet.has(shapes[i])) oldToNew.set(shapes[i], next[i]);
    }

    this.setShapes(next);
    this.selectionController.remapAfterShapeReplacement(oldToNew, next);
    this.selectionController.syncIndices(next);

    this.afterShapes = next;
    this.afterSelected = this.selectionController.getSelectedShapes();
    return true;
  }

  undo(): boolean {
    if (!this.beforeShapes || !this.beforeSelected) return false;
    this.setShapes(this.beforeShapes);
    this.selectionController.replaceSelection(this.beforeSelected);
    this.selectionController.syncIndices(this.beforeShapes);
    return true;
  }

  redo(): boolean {
    if (!this.afterShapes || !this.afterSelected) return false;
    this.setShapes(this.afterShapes);
    this.selectionController.replaceSelection(this.afterSelected);
    this.selectionController.syncIndices(this.afterShapes);
    return true;
  }
}
