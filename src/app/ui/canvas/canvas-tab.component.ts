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
import { CanvasViewport } from './canvas-viewport';

import Shape from '../../core/geometry/Shape';

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

  @Input() shapes: any[] = [];
  private _previewShapes: Shape[] | null = null;

  @Input() showBoundingBoxes = false;
  @Input() showGrid = false;

  private viewport = new CanvasViewport();
  private _mounted = false;

  hoveredShape: Shape | null = null;

  private _pointerScreenX: number | null = null;
  private _pointerScreenY: number | null = null;

  private _isPanning = false;
  private _lastX = 0;
  private _lastY = 0;

  private resizeObserver?: ResizeObserver;

  private overlayRenderer = new CanvasOverlayRenderer();
  private interaction = new CanvasInteractionController();
  private selectionController = new CanvasSelectionController(new CanvasSelectionModel());
  private hitTest = new CanvasHitTestController();

  constructor(private renderer: CanvasRendererService) {}

  
  private applyGroupTransform(
    targets: Shape[],
    transformFn: (shape: Shape) => Shape,
    previewOnly = false
  ): Shape[] {
    if (!targets.length) return this.shapes;

    const targetSet = new Set(targets);
    const newShapes = this.shapes.map(s =>
      targetSet.has(s) ? transformFn(s) : s
    );

    if (!previewOnly) {
      const oldToNew = new Map<Shape, Shape>();

      this.shapes.forEach((oldShape, i) => {
        if (targetSet.has(oldShape)) {
          oldToNew.set(oldShape, newShapes[i]);
        }
      });

      this.shapes = newShapes;
      this.selectionController.remapAfterShapeReplacement(oldToNew, this.shapes);

    }
    return newShapes;
  }

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

    this._previewShapes = preview ?? null;

    this.renderer.render(
      canvas,
      preview ?? this.shapes,
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
    this.render();
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const { sx, sy } = this.viewport.getScreenCoordsFromEvent(e, this.canvasRef.nativeElement);
    this.viewport.zoomAt(delta, sx, sy);
    this.render();
  };

  private onPointerDown = (e: PointerEvent) => {
    const canvas = this.canvasRef.nativeElement;
    const { sx, sy } = this.viewport.getScreenCoordsFromEvent(e, canvas);
    const world = this.viewport.screenToWorld(sx, sy);

    this.interaction.clearPreview();


    if (e.button === 0) {
      const p = new Point(Measurement.fromPx(world.xPx), Measurement.fromPx(world.yPx));

      const hit =  this.hitTest.hitTestTopmost(this.shapes, world.xPx, world.yPx);

      this.interaction.pointerDown({
        sx, sy,
        worldX: world.xPx,
        worldY: world.yPx,
        button: e.button,
        shiftKey: e.shiftKey,
        pointerId: e.pointerId,
        hit
      });

      this._previewShapes = null;

      canvas.setPointerCapture?.(e.pointerId);

      if (hit) {
        // SHIFT behavior: toggle immediately on pointerdown (and skip click handler)
        if (e.shiftKey) {
          this.selectionController.pointerDownOnShape(hit, e.shiftKey);
          this.selectionController.syncIndices(this.shapes);

          this.interaction.setSuppressNextClickSelection();

          // if toggled OFF, cancel drag
          if (!this.selectionController.isSelected(hit)) {
            this.interaction.activeInteraction = null;
          }


          this.render(); // show the toggle immediately
          return;
        }

        // Non-shift: standard behavior (select-for-drag)
        if (!this.selectionController.isSelected(hit)) {
          this.selectionController.pointerDownOnShape(hit, e.shiftKey);
          this.selectionController.syncIndices(this.shapes);

          this.interaction.setSuppressNextClickSelection();
        }
      } 
    }

    if (e.button === 1) {
      this._isPanning = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    }
    

  };

  private onMouseMove = (e: MouseEvent) => {
    const canvas = this.canvasRef.nativeElement;
    const { sx, sy } = this.viewport.getScreenCoordsFromEvent(e, canvas);

    this._pointerScreenX = sx;
    this._pointerScreenY = sy;

    if (this.interaction.activeInteraction) return;   

    const world = this.viewport.screenToWorld(sx, sy);
    const p = new Point(Measurement.fromPx(world.xPx), Measurement.fromPx(world.yPx));

    this.hoveredShape = [...this.shapes].reverse().find(s => s.containsPoint?.(p)) ?? null;

    this.render();
  };

  private onPointerMove = (e: PointerEvent) => {
     if (this._isPanning) {
      this.viewport.panBy(e.clientX - this._lastX, e.clientY - this._lastY);
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this.render();
      return
    }

    if (!this.interaction.activeInteraction) return;

    const canvas = this.canvasRef.nativeElement;
    const { sx, sy } = this.viewport.getScreenCoordsFromEvent(e, canvas);
    const pm = this.interaction.pointerMove({ sx, sy, clientX: e.clientX, clientY: e.clientY });

    this._pointerScreenX = sx;
    this._pointerScreenY = sy;

    if (pm.kind === 'drag-select') {
      if (!pm.isPastThreshold) return;
      this.interaction.markDidDrag();

      const r = this.interaction.activeInteraction;
      if (r?.type !== 'drag-select') return;

      // Update world end-point from current pointer (screen -> world)
      const worldNow = this.viewport.screenToWorld(sx, sy);
      r.wx1 = worldNow.xPx;
      r.wy1 = worldNow.yPx;

      // Use WORLD rectangle for hit testing
      const x0 = Math.min(r.wx0, r.wx1);
      const y0 = Math.min(r.wy0, r.wy1);
      const x1 = Math.max(r.wx0, r.wx1);
      const y1 = Math.max(r.wy0, r.wy1);

      this.interaction.previewSelectedIndices = this.selectionController.previewMarqueeIndices(this.shapes, x0, y0, x1, y1);

      this._previewShapes = this.shapes;
      this.render();
      return;
    }


    if (pm.kind === 'drag-shape') {
      if (!pm.isPastThreshold) return;
      this.interaction.markDidDrag();

      const drag = this.interaction.activeInteraction;
      if (drag?.type !== 'drag-shape') return;

      const worldNow = this.viewport.screenToWorld(sx, sy);

      const dx = Measurement.fromPx(worldNow.xPx - drag.startWorldX);
      const dy = Measurement.fromPx(worldNow.yPx - drag.startWorldY);

      this.interaction.lastDragDx = dx;
      this.interaction.lastDragDy = dy;

      const targets = this.selectionController.getDragTargets(drag.original);


      this.render(this.applyGroupTransform(targets, s => s.translate(dx, dy), true));
      return;
    }



  };

  private onPointerUp = (e: PointerEvent) => {
//    this.canvasRef.nativeElement.releasePointerCapture?.(e.pointerId);
    const canvas = this.canvasRef.nativeElement;
    if (canvas.hasPointerCapture?.(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }


    if (this.interaction.activeInteraction?.type === 'drag-select') {
      const r = this.interaction.activeInteraction;

      // World rectangle
      const x0 = Math.min(r.wx0, r.wx1);
      const y0 = Math.min(r.wy0, r.wy1);
      const x1 = Math.max(r.wx0, r.wx1);
      const y1 = Math.max(r.wy0, r.wy1);
      const indices = this.selectionController.previewMarqueeIndices(this.shapes, x0, y0, x1, y1);


     const selected = this.selectionController.getShapesByIndices(this.shapes, indices);


      
      this.selectionController.commitMarquee(selected, r.shift);
      this._previewShapes = null;
      this.interaction.previewSelectedIndices = null;
      this.selectionController.syncIndices(this.shapes);

    }




    if (this.interaction.activeInteraction?.type === 'drag-shape') {
      const drag = this.interaction.activeInteraction;

      const targets = this.selectionController.getDragTargets(drag.original);

      if (this.interaction.lastDragDx && this.interaction.lastDragDy) {
        this.applyGroupTransform(targets, s => s.translate(this.interaction.lastDragDx!, this.interaction.lastDragDy!));
      }

      this.interaction.lastDragDx = null;
      this.interaction.lastDragDy = null;
      this._previewShapes = null;
      this.interaction.previewSelectedIndices = null;
      this.selectionController.syncIndices(this.shapes);

    }

    this.interaction.pointerUp({ pointerId: e.pointerId });

    this._isPanning = false;
    this.updateHoverFromPointer();
    this.render();

  };

  private onClick = (e: MouseEvent) => {

    if (this.interaction.clickShouldBeSuppressed()) return;

    if (this._isPanning) return;

    const canvas = this.canvasRef.nativeElement;
    const { sx, sy } = this.viewport.getScreenCoordsFromEvent(e, canvas);
    const world = this.viewport.screenToWorld(sx, sy);
    const p = new Point(Measurement.fromPx(world.xPx), Measurement.fromPx(world.yPx));

    const found =
      [...this.shapes].reverse().find(s => s.containsPoint?.(p)) ?? null;

    if (!found) {
      // Click on empty: clear selection (but Shift+click empty should preserve selection)
      this.selectionController.pointerDownOnEmpty(e.shiftKey);
      this.selectionController.syncIndices(this.shapes);
      this.render();
      return;
    }

    this.selectionController.clickOnShape(found, e.shiftKey);
    this.selectionController.syncIndices(this.shapes);
    this.render();

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
      dragSelectRect: (() => {
        const a = this.interaction.activeInteraction;
        if (!a || a.type !== 'drag-select') return null;

        // WORLD coords (px) because overlay drawing happens under viewport transform
        return { x0: a.wx0, y0: a.wy0, x1: a.wx1, y1: a.wy1 };
      })()


    });
  }


  private updateHoverFromPointer() {
    if (this._pointerScreenX == null || this._pointerScreenY == null) {
      this.hoveredShape = null;
      return;
    }
    const world = this.viewport.screenToWorld(this._pointerScreenX, this._pointerScreenY);
    const p = new Point(Measurement.fromPx(world.xPx), Measurement.fromPx(world.yPx));
    this.hoveredShape = [...this.shapes].reverse().find(s => s.containsPoint?.(p)) ?? null;
  }

}
