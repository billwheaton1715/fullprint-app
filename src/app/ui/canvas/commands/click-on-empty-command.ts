import { CanvasCommand } from './canvas-command';
import Shape from '../../../core/geometry/Shape';
import { CanvasSelectionController } from '../canvas-selection-controller';

export class ClickOnEmptyCommand implements CanvasCommand {
  constructor(
    private readonly shapesRef: () => Shape[],
    private readonly selectionController: CanvasSelectionController,
    private readonly shift: boolean
  ) {}

  execute(): boolean {
    const shapes = this.shapesRef();
    const changed = this.selectionController.pointerDownOnEmpty(this.shift);
    if (changed) this.selectionController.syncIndices(shapes);
    return changed;
  }

}
