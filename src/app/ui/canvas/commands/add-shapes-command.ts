import { UndoableCommand } from './undoable-command';
import Shape from '../../../core/geometry/Shape';
import { CanvasSelectionController } from '../canvas-selection-controller';

/**
 * Adds one or more shapes to the canvas and selects them.
 * Fully undoable: undo removes the added shapes; redo re-adds them.
 */
export class AddShapesCommand implements UndoableCommand {
  private beforeShapes: Shape[] | null = null;
  private afterShapes:  Shape[] | null = null;

  constructor(
    private readonly getShapes:           () => Shape[],
    private readonly setShapes:           (s: Shape[]) => void,
    private readonly selectionController: CanvasSelectionController,
    private readonly newShapes:           Shape[]
  ) {}

  execute(): boolean {
    if (!this.newShapes.length) return false;

    this.beforeShapes = this.getShapes();
    const next = [...this.beforeShapes, ...this.newShapes];
    this.afterShapes = next;

    this.setShapes(next);
    this.selectionController.replaceSelection([...this.newShapes]);
    this.selectionController.syncIndices(next);
    return true;
  }

  undo(): boolean {
    if (!this.beforeShapes) return false;
    this.setShapes(this.beforeShapes);
    this.selectionController.replaceSelection([]);
    this.selectionController.syncIndices(this.beforeShapes);
    return true;
  }

  redo(): boolean {
    if (!this.afterShapes) return false;
    this.setShapes(this.afterShapes);
    this.selectionController.replaceSelection([...this.newShapes]);
    this.selectionController.syncIndices(this.afterShapes);
    return true;
  }
}
