import { CanvasCommand } from './canvas-command';
import Shape from '../../../core/geometry/Shape';
import { CanvasSelectionController } from '../canvas-selection-controller';
import { CanvasMarqueeController } from '../canvas-marquee-controller';

export class CommitMarqueeSelectionCommand implements CanvasCommand {
  constructor(
    private readonly shapesRef: () => Shape[],
    private readonly selectionController: CanvasSelectionController,
    private readonly marquee: CanvasMarqueeController
  ) {}

  execute(): boolean {
    const shapes = this.shapesRef();
    const selected = this.marquee.computeSelected(shapes);

    const changed = this.selectionController.commitMarquee(selected, this.marquee.getShift());
    this.marquee.clearPreview();

    if (changed) this.selectionController.syncIndices(shapes);
    return changed;
  }
}
