/**
 * CanvasTabComponent
 *
 * Supported Canvas Interactions:
 *
 * 1. Drag-shape (pointer capture):
 *    - Begin: pointerdown on a selected shape
 *    - Track: pointermove (with pointer capture)
 *    - Commit: pointerup
 *
 * 2. Drag-select (pointer capture):
 *    - Begin: pointerdown on empty space
 *    - Track: pointermove (with pointer capture)
 *    - Commit: pointerup (selects intersecting shapes)
 *
 * 3. Pan (middle mouse button (button===1), no pointer capture):
 *    - Begin: pointerdown (button 1)
 *    - Track: pointermove
 *    - End: pointerup
 *
 * 4. Zoom (wheel):
 *    - wheel event zooms at pointer location
 *
 * 5. Hover (mousemove):
 *    - Updates hovered shape
 *
 * 6. Click (click):
 *    - Selects or toggles selection of shapes
 *
 * 7. Overlay/crosshair rendering:
 *    - Drawn on top of canvas, not an interaction
 *
 * Only drag-shape and drag-select use pointer capture.
 */
// SelectionOperation model for clarity and future-proofing
// type SelectionOperation =
//   | { type: 'replace'; shapes: any[] }
//   | { type: 'add'; shapes: any[] }
//   | { type: 'toggle'; shapes: any[] };

/**
 * CanvasTabComponent
 *
 * Fully-featured canvas interaction component:
 * - Drag-shape
 * - Drag-select
 * - Pan
 * - Zoom
 * - Hover & click selection
 * - Overlay rendering (grid, bounding boxes, selection handles, crosshairs)
 */
import Measurement from '../../core/units/Measurement';
import { Point } from '../../core/geometry/Point';
import { Rectangle } from '../../core/geometry/Rectangle';
import { Triangle } from '../../core/geometry/Triangle';
import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  OnChanges,
  SimpleChanges,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CanvasRendererService } from './canvas-renderer.service';
import { CanvasOverlayRenderer } from './canvas-overlay-renderer';
import { CanvasSelectionModel} from './canvas-selection-model';
import { CanvasInteractionController } from './canvas-interaction-controller';
import { CanvasSelectionController } from './canvas-selection-controller';
import { CanvasHitTestController } from './canvas-hit-test-controller';
import { CanvasTransformController } from './canvas-transform-controller';
import { CanvasPanZoomController } from './canvas-pan-zoom-controller';
import { CanvasViewport } from './canvas-viewport';

import Shape from '../../core/geometry/Shape';
import { CanvasMarqueeController } from './canvas-marquee-controller';

@Component({
  standalone: true,
  selector: 'app-canvas-tab',
  imports: [CommonModule],
  template: `
    <div #host class="canvas-host">
      <canvas #canvasEl></canvas>
    </div>
  `,
  styles: [`
    :host, .canvas-host {
      display: flex;
      flex: 1 1 auto;
      width: 100%;
      height: 100%;
      min-height: 0;
    }
    canvas {
      flex: 1 1 auto;
      width: 100%;
      height: 100%;
      display: block;
    }
  `]
})
export class CanvasTabComponent
  implements OnInit, AfterViewInit, OnChanges, OnDestroy {

  @ViewChild('canvasEl', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  @Input() shapes: Shape[] = [];
  private _previewShapes: Shape[] | null = null;

  @Input() showBoundingBoxes = false;
  @Input() showGrid = false;

  private viewport = new CanvasViewport();
  private _mounted = false;

  hoveredShape: Shape | null = null;

  private _pointerScreenX: number | null = null;
  private _pointerScreenY: number | null = null;

  private panZoom = new CanvasPanZoomController(this.viewport);

 
  private resizeObserver?: ResizeObserver;

  private overlayRenderer = new CanvasOverlayRenderer();
  private interaction = new CanvasInteractionController();
  private selectionController = new CanvasSelectionController(new CanvasSelectionModel());
  private hitTest = new CanvasHitTestController();
  private _rafId: number | null = null;
  private _needsRender = false;
  private transformController = new CanvasTransformController();
  private marquee = new CanvasMarqueeController(this.interaction, this.hitTest);


  constructor(private renderer: CanvasRendererService) {}

  
   ngOnInit(): void {}

  ngAfterViewInit(): void {
    this._mounted = true;

    if (this.hostRef?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(this.hostRef.nativeElement);
    }

    const canvas = this.canvasRef.nativeElement;
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('click', this.onClick);

    canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);

    // TEMP DEBUG: remove once parent provides shapes
    if (!this.shapes || this.shapes.length === 0) {
      this.shapes = [
        new Rectangle(
          new Point(Measurement.fromPx(100), Measurement.fromPx(100)),
          Measurement.fromPx(120),
          Measurement.fromPx(80)
        ),
        new Rectangle(
          new Point(Measurement.fromPx(300), Measurement.fromPx(180)),
          Measurement.fromPx(140),
          Measurement.fromPx(90)
        ),

        // Triangle A
        new Triangle(
          new Point(Measurement.fromPx(200), Measurement.fromPx(300)),
          new Point(Measurement.fromPx(260), Measurement.fromPx(380)),
          new Point(Measurement.fromPx(140), Measurement.fromPx(380))
        ),

        // Triangle B
        new Triangle(
          new Point(Measurement.fromPx(420), Measurement.fromPx(90)),
          new Point(Measurement.fromPx(500), Measurement.fromPx(150)),
          new Point(Measurement.fromPx(380), Measurement.fromPx(150))
        )
      ];
      this.render();
    }
    // END TEMP DEBUG: remove once parent provides shapes
    this.resizeCanvas();
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this._mounted) return;
    if (changes['shapes']) this.render();
  }

  ngOnDestroy(): void {
    if (this._rafId != null) cancelAnimationFrame(this._rafId);
    this._rafId = null;    

    this.resizeObserver?.disconnect();
    const canvas = this.canvasRef.nativeElement;
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('click', this.onClick);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  private render(preview?: Shape[]) {
    if (!this.canvasRef?.nativeElement || !this.hostRef?.nativeElement) return;

    const canvas = this.canvasRef.nativeElement;

    const drawShapes = preview ?? this.shapes;

    this.renderer.render(
      canvas,
      drawShapes,
      this.viewport,
      { background: '#fff' },
      ctx => this.drawOverlays(ctx)
    );
  }


  private resizeCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const host = this.hostRef.nativeElement;
    const rect = host.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.forceRender();
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { sx, sy } = this.getScreenFromEvent(e);
    if (this.panZoom.wheel(e, sx, sy)) this.invalidate();
  };

  private onPointerDown = (e: PointerEvent) => {
    const { sx, sy, world } = this.getWorldFromEvent(e);

    this.interaction.clearPreview();

    if (e.button === 0) {
      const hit = this.hitTest.hitTestTopmost(this.shapes, world.xPx, world.yPx);

      this.interaction.pointerDown({
        sx, sy,
        worldX: world.xPx,
        worldY: world.yPx,
        button: e.button,
        shiftKey: e.shiftKey,
        pointerId: e.pointerId,
        hit
      });

      this.clearPreview();
      this.canvasRef.nativeElement.setPointerCapture?.(e.pointerId);

      if (hit) {
        // SHIFT: toggle immediately
        if (e.shiftKey) {
          const changed = this.selectionController.pointerDownOnShape(hit, e.shiftKey);
          if (changed) this.selectionController.syncIndices(this.shapes);

          this.interaction.setSuppressNextClickSelection();

          if (!this.selectionController.isSelected(hit)) {
            this.interaction.activeInteraction = null;
          }

          if (changed) this.invalidate();
          return;
        }

        // Non-shift: select-for-drag (only if needed)
        if (!this.selectionController.isSelected(hit)) {
          const changed = this.selectionController.pointerDownOnShape(hit, false);
          if (changed) this.selectionController.syncIndices(this.shapes);

          this.interaction.setSuppressNextClickSelection();

          if (changed) this.invalidate();
        }
      }
    }

    if (this.panZoom.pointerDown(e)) {
      // optional: avoid click selection glitches on middle button
      return;
    }

  };


  private onMouseMove = (e: MouseEvent) => {
    const { sx, sy, world } = this.getWorldFromEvent(e);

    const pointerChanged = this.setPointer(sx, sy);

    if (this.interaction.activeInteraction) {
      // keep crosshairs tracking even during interactions
      if (pointerChanged) this.invalidate();
      return;
    }

    const hit = this.hitTest.hitTestTopmost(this.shapes, world.xPx, world.yPx);
    const hoverChanged = this.setHovered(hit);

    if (pointerChanged || hoverChanged) this.invalidate();
  };


  private onPointerMove = (e: PointerEvent) => {
    if (this.panZoom.pointerMove(e)) {
      this.invalidate();
      return;
    }


    if (!this.interaction.activeInteraction) return;

    const { sx, sy, world} = this.getWorldFromEvent(e);

    const pm = this.interaction.pointerMove({ sx, sy, clientX: e.clientX, clientY: e.clientY });

    this.setPointer(sx, sy);

    if (pm.kind === 'drag-select') {
      if (!pm.isPastThreshold) return;
      this.interaction.markDidDrag();

      const changed = this.marquee.pointerMove(this.shapes, world.xPx, world.yPx);
      if (changed) this.invalidate();
      return;
    }


    if (pm.kind === 'drag-shape') {
      if (!pm.isPastThreshold) return;
      this.interaction.markDidDrag();

      const drag = this.interaction.activeInteraction;
      if (drag?.type !== 'drag-shape') return;

      const { dx, dy } = this.transformController.computeDragDelta(
        drag,
        world.xPx,
        world.yPx
      );

      const targets = this.selectionController.getDragTargets(drag.original);
      const preview = this.transformController.previewTranslate(this.shapes, targets, dx, dy);
      this.invalidate(preview);
      return;
    }




  };

  private onPointerUp = (e: PointerEvent) => {
    const canvas = this.canvasRef.nativeElement;
    if (canvas.hasPointerCapture?.(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    let shouldClearPreview = false;

    if (this.interaction.activeInteraction?.type === 'drag-select') {
      const r = this.interaction.activeInteraction;

      const selected = this.marquee.computeSelected(this.shapes) ?? [];
      const changed = this.selectionController.commitMarquee(selected, r.shift);

      this.marquee.clearPreview();
      if (changed) this.selectionController.syncIndices(this.shapes);

      shouldClearPreview = true;
    }




    if (this.interaction.activeInteraction?.type === 'drag-shape') {
      const drag = this.interaction.activeInteraction;
      const targets = this.selectionController.getDragTargets(drag.original);
      this.shapes = this.transformController.commitTranslate(this.shapes, targets, this.selectionController);
      this.transformController.clearDelta();

      this.selectionController.syncIndices(this.shapes);
      shouldClearPreview = true;
    }

    this.interaction.pointerUp({ pointerId: e.pointerId });

    this.panZoom.pointerUp(e);

    this.updateHoverFromPointer();
    if (shouldClearPreview) this.clearPreview();
    this.invalidate();

  };

  private onClick = (e: MouseEvent) => {

    if (this.interaction.clickShouldBeSuppressed()) return;

    if (this.panZoom.getIsPanning()) return;

    const { world } = this.getWorldFromEvent(e);


    const found = this.hitTest.hitTestTopmost(this.shapes, world.xPx, world.yPx);

    if (!found) {
      // Click on empty: clear selection (but Shift+click empty should preserve selection)
      const changed = this.selectionController.pointerDownOnEmpty(e.shiftKey);
      if (changed) this.selectionController.syncIndices(this.shapes);
      if (changed) this.invalidate();
      return;
    }

    const changed = this.selectionController.clickOnShape(found, e.shiftKey);
    if (changed) this.selectionController.syncIndices(this.shapes);
    if (changed) this.invalidate();

  };
  public drawOverlays(ctx: CanvasRenderingContext2D) {
    const canvas = this.canvasRef.nativeElement;
    const shapesForOverlay: Shape[] = this._previewShapes ?? this.shapes;
    const selectedIndices = this.interaction.previewSelectedIndices ?? this.selectionController.getSelectedIndices();

    const groupBoundingBox =
      selectedIndices.length
        ? this.selectionController.getGroupBoundingBoxFor(shapesForOverlay, selectedIndices)
        : null;
    this.overlayRenderer.draw(ctx, canvas, {
      viewport: this.viewport,
      shapesForOverlay,
      selectedIndices,
      groupBoundingBox,
      hoveredShape: this.hoveredShape,
      pointerScreen:
        this._pointerScreenX != null && this._pointerScreenY != null
          ? { sx: this._pointerScreenX, sy: this._pointerScreenY }
          : null,
      showGrid: this.showGrid,
      showBoundingBoxes: this.showBoundingBoxes,
      dragSelectRect: this.marquee.getDragRect()
    });
  }


  private updateHoverFromPointer() {
    if (this._pointerScreenX == null || this._pointerScreenY == null) {
      this.setHovered(null);
      return;
    }

    const world = this.getWorldFromScreen(this._pointerScreenX, this._pointerScreenY);
    const hit = this.hitTest.hitTestTopmost(this.shapes, world.xPx, world.yPx);
    this.setHovered(hit);
  }


  private getScreenFromEvent(e: MouseEvent | PointerEvent | WheelEvent) {
    const canvas = this.canvasRef.nativeElement;
    return this.viewport.getScreenCoordsFromEvent(e, canvas); // { sx, sy }
  }

  private getWorldFromEvent(e: MouseEvent | PointerEvent | WheelEvent) {
    const { sx, sy } = this.getScreenFromEvent(e);
    const world = this.viewport.screenToWorld(sx, sy);        // { xPx, yPx }
    return { sx, sy, world };
  }

  private getWorldFromScreen(sx: number, sy: number) {
    return this.viewport.screenToWorld(sx, sy);
  }

  private setPointer(sx: number, sy: number): boolean {
    if (this._pointerScreenX === sx && this._pointerScreenY === sy) return false;
    this._pointerScreenX = sx;
    this._pointerScreenY = sy;
    return true;
  }

  private invalidate(preview?: Shape[]) {
    // keep your existing preview behavior
    if (preview !== undefined) {
      this._previewShapes = preview; // allow explicitly setting a preview
    }

    this._needsRender = true;
    if (this._rafId != null) return;

    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (!this._needsRender) return;
      this._needsRender = false;
      this.render(this._previewShapes ?? undefined);
    });
  }

  private forceRender(preview?: Shape[]) {
    // for “must update now” moments (rare)
    this._previewShapes = preview ?? null; // allow explicitly setting a preview

    this._needsRender = false;
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.render(preview);
  }

  private clearPreview() {
    this._previewShapes = null;
  }


  private setHovered(next: Shape | null): boolean {
    if (this.hoveredShape === next) return false;
    this.hoveredShape = next;
    return true;
  }

}
