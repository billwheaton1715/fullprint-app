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
 * 3. Pan (middle mouse button, no pointer capture):
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
import { CanvasSelectionModel, SelectionOperation } from './canvas-selection-model';

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
  private _didDrag = false;
  private _lastDragDx: Measurement | null = null;
  private _lastDragDy: Measurement | null = null;
  private _suppressNextClickSelection = false;
  private _downScreenX: number | null = null;
  private _downScreenY: number | null = null;
  private _dragThresholdPx = 4;


  @Input() showBoundingBoxes = false;
  @Input() showGrid = false;

  private viewport = new CanvasViewport();
  private _mounted = false;

  hoveredShape: Shape | null = null;
  private selection: CanvasSelectionModel = new CanvasSelectionModel();

  private _pointerScreenX: number | null = null;
  private _pointerScreenY: number | null = null;

  private _isPanning = false;
  private _lastX = 0;
  private _lastY = 0;

  private resizeObserver?: ResizeObserver;

  private activeInteraction: null | (
    | { type: 'drag-shape'; original: Shape; startWorldX: number; startWorldY: number }
    | { type: 'drag-select'; x0: number; y0: number; x1: number; y1: number; shift: boolean }
  ) = null;

  private overlayRenderer = new CanvasOverlayRenderer();

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
      this.selection.remapAfterShapeReplacement(oldToNew, this.shapes);

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

//    window.addEventListener('pointermove', this.onPointerMove);
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
    this._downScreenX = sx;
    this._downScreenY = sy;

    const world = this.viewport.screenToWorld(sx, sy);

    if (e.button === 0) {
      const p = new Point(Measurement.fromPx(world.xPx), Measurement.fromPx(world.yPx));
      const hit = [...this.shapes].reverse().find(s => s.containsPoint?.(p)) ?? null;

      canvas.setPointerCapture?.(e.pointerId);

      if (hit) {
        canvas.setPointerCapture?.(e.pointerId);

        // SHIFT behavior: toggle immediately on pointerdown (and skip click handler)
        if (e.shiftKey) {
          this.selection.apply({ type: 'toggle', shapes: [hit] });
          this.selection.syncIndices(this.shapes);
          this._suppressNextClickSelection = true;

          // If the toggle turned it ON, allow drag to start right away.
          // If the toggle turned it OFF, do not start a drag interaction.
          if (this.selection.selectedShapes.includes(hit)) {
            this.activeInteraction = {
              type: 'drag-shape',
              original: hit,
              startWorldX: world.xPx,
              startWorldY: world.yPx
            };
            this._lastDragDx = null;
            this._lastDragDy = null;
          } else {
            this.activeInteraction = null;
          }

          this.render(); // show the toggle immediately
          return;
        }

        // Non-shift: standard behavior (select-for-drag)
        if (!this.selection.selectedShapes.includes(hit)) {
          this.selection.apply({ type: 'replace', shapes: [hit] });
          this.selection.syncIndices(this.shapes);

          // Optional: prevent click from re-doing selection (keeps logic single-source)
          this._suppressNextClickSelection = true;
        }

        this.activeInteraction = {
          type: 'drag-shape',
          original: hit,
          startWorldX: world.xPx,
          startWorldY: world.yPx
        };
        this._lastDragDx = null;
        this._lastDragDy = null;
      } else {
        canvas.setPointerCapture?.(e.pointerId);

        // Only empty space starts drag-select
        this.activeInteraction = {
          type: 'drag-select',
          x0: sx,
          y0: sy,
          x1: sx,
          y1: sy,
          shift: e.shiftKey
        };
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

    if (this.activeInteraction) return;   

    const world = this.viewport.screenToWorld(sx, sy);
    const p = new Point(Measurement.fromPx(world.xPx), Measurement.fromPx(world.yPx));

    this.hoveredShape =
      [...this.shapes].reverse().find(s => s.containsPoint?.(p)) ?? null;

    this.render();
    

  };

  private onPointerMove = (e: PointerEvent) => {
    //console.log('pointermove', this.activeInteraction?.type);

    if (!this.activeInteraction) return;

    const canvas = this.canvasRef.nativeElement;
    const { sx, sy } = this.viewport.getScreenCoordsFromEvent(e, canvas);
    const dx0 = this._downScreenX == null ? 0 : (sx - this._downScreenX);
    const dy0 = this._downScreenY == null ? 0 : (sy - this._downScreenY);
    const isPastThreshold = (dx0 * dx0 + dy0 * dy0) >= (this._dragThresholdPx * this._dragThresholdPx);

    this._pointerScreenX = sx;
    this._pointerScreenY = sy;

    if (this.activeInteraction?.type === 'drag-select') {
      if (!isPastThreshold) return;
      this._didDrag = true;


      this.activeInteraction.x1 = sx;
      this.activeInteraction.y1 = sy;
      const r = this.activeInteraction;

      const x0 = Math.min(r.x0, r.x1);
      const y0 = Math.min(r.y0, r.y1);
      const x1 = Math.max(r.x0, r.x1);
      const y1 = Math.max(r.y0, r.y1);

      const previewSelected = this.shapes.filter(s => {
        const bb = s.getBoundingBox();
        const bx0 = bb.topLeft.x.toUnit('px');
        const by0 = bb.topLeft.y.toUnit('px');
        const bx1 = bx0 + bb.width.toUnit('px');
        const by1 = by0 + bb.height.toUnit('px');

        return !(bx1 < x0 || bx0 > x1 || by1 < y0 || by0 > y1);
      });

      this._previewShapes = this.shapes;
      this.selection.selectedIndices = previewSelected
        .map(s => this.shapes.indexOf(s))
        .filter(i => i !== -1);

      this.render();

      return;
    }

    if (this.activeInteraction?.type === 'drag-shape') {
      if (!isPastThreshold) return;
      this._didDrag = true;


      const drag = this.activeInteraction;

      const worldNow = this.viewport.screenToWorld(sx, sy);

      const dx = Measurement.fromPx(worldNow.xPx - drag.startWorldX);
      const dy = Measurement.fromPx(worldNow.yPx - drag.startWorldY);

      this._lastDragDx = dx;
      this._lastDragDy = dy;

      const targets =
        this.selection.selectedShapes.length > 1 && this.selection.selectedShapes.includes(drag.original)
          ? this.selection.selectedShapes
          : [drag.original];

      this.render(this.applyGroupTransform(targets, s => s.translate(dx, dy), true));
      return;
    }


    if (this._isPanning) {
      this.viewport.panBy(e.clientX - this._lastX, e.clientY - this._lastY);
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this.render();
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    this.canvasRef.nativeElement.releasePointerCapture?.(e.pointerId);

    if (this.activeInteraction?.type === 'drag-select') {
      const r = this.activeInteraction;

      const x0 = Math.min(r.x0, r.x1);
      const y0 = Math.min(r.y0, r.y1);
      const x1 = Math.max(r.x0, r.x1);
      const y1 = Math.max(r.y0, r.y1);

      const selected = this.shapes.filter(s => {
        const bb = s.getBoundingBox();
        const bx0 = bb.topLeft.x.toUnit('px');
        const by0 = bb.topLeft.y.toUnit('px');
        const bx1 = bx0 + bb.width.toUnit('px');
        const by1 = by0 + bb.height.toUnit('px');

        return !(bx1 < x0 || bx0 > x1 || by1 < y0 || by0 > y1);
      });

      this.selection.apply({
        type: r.shift ? 'add' : 'replace',
        shapes: selected
      });

      this._previewShapes = null;
      this.selection.syncIndices(this.shapes);
    }


    if (this.activeInteraction?.type === 'drag-shape') {
      const drag = this.activeInteraction;

      const targets =
        this.selection.selectedShapes.length > 1 && this.selection.selectedShapes.includes(drag.original)
          ? this.selection.selectedShapes
          : [drag.original];

      if (this._lastDragDx && this._lastDragDy) {
        this.applyGroupTransform(targets, s => s.translate(this._lastDragDx!, this._lastDragDy!));
      }

      this._lastDragDx = null;
      this._lastDragDy = null;
      this._previewShapes = null;
      this.selection.syncIndices(this.shapes);
    }


    this.activeInteraction = null;
    this._isPanning = false;
    this.updateHoverFromPointer();

    this.render();

    this._downScreenX = null;
    this._downScreenY = null;


  };

  private onClick = (e: MouseEvent) => {
    if (this._didDrag) {
      this._didDrag = false;
      return;
    }

    if (this._suppressNextClickSelection) {
      this._suppressNextClickSelection = false;
      return;
    }


    if (this._isPanning) return;

    const canvas = this.canvasRef.nativeElement;
    const { sx, sy } = this.viewport.getScreenCoordsFromEvent(e, canvas);
    const world = this.viewport.screenToWorld(sx, sy);
    const p = new Point(Measurement.fromPx(world.xPx), Measurement.fromPx(world.yPx));

    const found =
      [...this.shapes].reverse().find(s => s.containsPoint?.(p)) ?? null;

    if (!found) {
      // Click on empty: clear selection (but Shift+click empty should preserve selection)
      if (!e.shiftKey) {
        this.selection.apply({ type: 'replace', shapes: [] });
        this.selection.syncIndices(this.shapes);
        this.render();
      }
      return;
    }

    this.selection.apply({
      type: e.shiftKey ? 'toggle' : 'replace',
      shapes: [found]
    });

    this.selection.syncIndices(this.shapes);
    this.render();


  };
  public drawOverlays(ctx: CanvasRenderingContext2D) {
    const canvas = this.canvasRef.nativeElement;
    const shapesForOverlay: Shape[] = this._previewShapes ?? this.shapes;

    this.overlayRenderer.draw(ctx, canvas, {
      viewport: this.viewport,
      shapesForOverlay,
      selectedIndices: this.selection.selectedIndices,
      hoveredShape: this.hoveredShape,
      pointerScreen:
        this._pointerScreenX != null && this._pointerScreenY != null
          ? { sx: this._pointerScreenX, sy: this._pointerScreenY }
          : null,
      showGrid: this.showGrid,
      showBoundingBoxes: this.showBoundingBoxes,
      dragSelectRect:
        this.activeInteraction?.type === 'drag-select'
          ? { x0: this.activeInteraction.x0, y0: this.activeInteraction.y0, x1: this.activeInteraction.x1, y1: this.activeInteraction.y1 }
          : null
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
