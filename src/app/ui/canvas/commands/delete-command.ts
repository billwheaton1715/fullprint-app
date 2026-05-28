import { UndoableCommand } from './undoable-command';
import Shape from '../../../core/geometry/Shape';
import { CanvasSelectionController } from '../canvas-selection-controller';

export class DeleteCommand implements UndoableCommand {
  private beforeShapes: Shape[] | null = null;
  private beforeSelected: Shape[] | null = null;
  private afterShapes: Shape[] | null = null;

  constructor(
    private readonly getShapes: () => Shape[],
    private readonly setShapes: (s: Shape[]) => void,
    private readonly selectionController: CanvasSelectionController
  ) {}

  execute(): boolean {
    const shapes = this.getShapes();
    const selected = this.selectionController.getSelectedShapes();
    if (!selected.length) return false;

    this.beforeShapes = shapes;
    this.beforeSelected = selected;

    const selectedSet = new Set(selected);
    const next = shapes.filter(s => !selectedSet.has(s));
    this.afterShapes = next;

    this.setShapes(next);
    this.selectionController.replaceSelection([]);
    this.selectionController.syncIndices(next);
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
    if (!this.afterShapes) return false;
    this.setShapes(this.afterShapes);
    this.selectionController.replaceSelection([]);
    this.selectionController.syncIndices(this.afterShapes);
    return true;
  }
}
