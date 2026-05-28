import { CanvasCommand } from './canvas-command';
import Shape from '../../../core/geometry/Shape';
import { CanvasSelectionController } from '../canvas-selection-controller';

export class ClickOnShapeCommand implements CanvasCommand {
  constructor(
    private readonly shapesRef: () => Shape[],
    private readonly selectionController: CanvasSelectionController,
    private readonly shape: Shape,
    private readonly shift: boolean
  ) {}

  execute(): boolean {
    const shapes = this.shapesRef();
    const changed = this.selectionController.clickOnShape(this.shape, this.shift);
    if (changed) this.selectionController.syncIndices(shapes);
    return changed;
  }

}
