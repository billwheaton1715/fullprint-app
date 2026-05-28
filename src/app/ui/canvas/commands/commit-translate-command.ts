import { UndoableCommand } from './undoable-command';
import Shape from '../../../core/geometry/Shape';
import { CanvasSelectionController } from '../canvas-selection-controller';
import { CanvasTransformController } from '../canvas-transform-controller';

export class CommitTranslateCommand implements UndoableCommand {
  // Snapshots captured at execute() time so undo/redo never need external state
  private beforeShapes: Shape[] | null = null;
  private beforeSelected: Shape[] | null = null;
  private afterShapes: Shape[] | null = null;
  private afterSelected: Shape[] | null = null;

  constructor(
    private readonly getShapes: () => Shape[],
    private readonly setShapes: (s: Shape[]) => void,
    private readonly selectionController: CanvasSelectionController,
    private readonly transformController: CanvasTransformController,
    private readonly targets: Shape[]
  ) {}

  execute(): boolean {
    const shapes = this.getShapes();

    // Bail early if there is no pending delta (nothing was actually dragged)
    if (!this.transformController.lastDx || !this.transformController.lastDy) {
      return false;
    }

    // Snapshot state BEFORE the transform
    this.beforeShapes = shapes;
    this.beforeSelected = this.selectionController.getSelectedShapes();

    const next = this.transformController.commitTranslate(
      shapes,
      this.targets,
      this.selectionController
    );

    this.setShapes(next);
    this.transformController.clearDelta();
    this.selectionController.syncIndices(next);

    // Snapshot state AFTER the transform
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
