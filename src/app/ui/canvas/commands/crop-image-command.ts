import { UndoableCommand } from './undoable-command';
import Shape from '../../../core/geometry/Shape';
import { ImageShape, CropRect } from '../../../core/geometry/ImageShape';
import { CanvasSelectionController } from '../canvas-selection-controller';

/**
 * Applies (or re-applies) a crop to an ImageShape.
 * The original ImageShape is replaced in the shapes array with a new instance
 * that has the updated cropRect / topLeft / width / height.
 * Fully undoable: undo restores the original instance.
 */
export class CropImageCommand implements UndoableCommand {
  private beforeShapes: Shape[] | null = null;
  private afterShapes:  Shape[] | null = null;
  private afterShape:   ImageShape | null = null;

  constructor(
    private readonly getShapes:           () => Shape[],
    private readonly setShapes:           (s: Shape[]) => void,
    private readonly selectionController: CanvasSelectionController,
    private readonly target:              ImageShape,
    private readonly newCrop:             CropRect
  ) {}

  execute(): boolean {
    const shapes = this.getShapes();
    const idx = shapes.indexOf(this.target);
    if (idx === -1) return false;

    this.beforeShapes = shapes;
    this.afterShape   = this.target.withCrop(this.newCrop);
    this.afterShapes  = shapes.map((s, i) => (i === idx ? this.afterShape! : s));

    this.setShapes(this.afterShapes);
    this.selectionController.replaceSelection([this.afterShape]);
    this.selectionController.syncIndices(this.afterShapes);
    return true;
  }

  undo(): boolean {
    if (!this.beforeShapes) return false;
    this.setShapes(this.beforeShapes);
    this.selectionController.replaceSelection([this.target]);
    this.selectionController.syncIndices(this.beforeShapes);
    return true;
  }

  redo(): boolean {
    if (!this.afterShapes || !this.afterShape) return false;
    this.setShapes(this.afterShapes);
    this.selectionController.replaceSelection([this.afterShape]);
    this.selectionController.syncIndices(this.afterShapes);
    return true;
  }
}
