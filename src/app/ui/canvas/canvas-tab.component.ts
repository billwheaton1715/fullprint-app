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
type SelectionOperation =
  | { type: 'replace'; shapes: any[] }
  | { type: 'add'; shapes: any[] }
  | { type: 'toggle'; shapes: any[] };

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
  private _selectedIndices: number[] = [];
  private _didDrag = false;
  private _lastDragDx: Measurement | null = null;
  private _lastDragDy: Measurement | null = null;
  private _suppressNextClickSelection = false;


  @Input() showBoundingBoxes = false;
  @Input() showGrid = false;

  private viewport = new CanvasViewport();
  private _mounted = false;

  hoveredShape: Shape | null = null;
  selectedShapes: Shape[] = [];

  private _pointerScreenX: number | null = null;
  private _pointerScreenY: number | null = null;

  private _isPanning = false;
  private _lastX = 0;
  private _lastY = 0;

  private resizeObserver?: ResizeObserver;

  private activeInteraction: null | (
    | { type: 'drag-shape'; original: Shape; startWorldX: number; startWorldY: number }
    | { type: 'drag-select'; x0: number; y0: number; x1: number; y1: number }
  ) = null;

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

      // 🔑 remap selectedShapes to new instances
      this.selectedShapes = this.selectedShapes
        .map(s => oldToNew.get(s) ?? s)
        .filter(s => this.shapes.includes(s));

    }


    return newShapes;
  }


  private applySelectionOperation(op: SelectionOperation) {
    switch (op.type) {
      case 'replace':
        this.selectedShapes = op.shapes.slice();
        break;
      case 'add':
        for (const s of op.shapes) {
          if (!this.selectedShapes.includes(s)) this.selectedShapes.push(s);
        }
        break;
      case 'toggle':
        for (const s of op.shapes) {
          const idx = this.selectedShapes.indexOf(s);
          idx >= 0
            ? this.selectedShapes.splice(idx, 1)
            : this.selectedShapes.push(s);
        }
        break;
    }
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
    const world = this.viewport.screenToWorld(sx, sy);

    if (e.button === 0) {
      const p = new Point(Measurement.fromPx(world.xPx), Measurement.fromPx(world.yPx));
      const hit = [...this.shapes].reverse().find(s => s.containsPoint?.(p)) ?? null;

      canvas.setPointerCapture?.(e.pointerId);

      // if (hit) {
      //   // If the hit shape isn't already selected, select it now.
      //   // (Drag immediately = select + drag, standard editor behavior)
      //   if (!this.selectedShapes.includes(hit)) {
      //     this.applySelectionOperation({ type: 'replace', shapes: [hit] });
      //     this.rebuildSelectedIndices();
      //   }
        
      //   this.activeInteraction = {
      //     type: 'drag-shape',
      //     original: hit,
      //     startWorldX: world.xPx,
      //     startWorldY: world.yPx
      //   };
      //   // reset last drag delta
      //   this._lastDragDx = null;
      //   this._lastDragDy = null;        
      // } else {
      //   // Only empty space starts drag-select
      //   this.activeInteraction = {
      //     type: 'drag-select',
      //     x0: sx,
      //     y0: sy,
      //     x1: sx,
      //     y1: sy
      //   };
      // }
      if (hit) {
        canvas.setPointerCapture?.(e.pointerId);

        // SHIFT behavior: toggle immediately on pointerdown (and skip click handler)
        if (e.shiftKey) {
          this.applySelectionOperation({ type: 'toggle', shapes: [hit] });
          this.rebuildSelectedIndices();
          this._suppressNextClickSelection = true;

          // If the toggle turned it ON, allow drag to start right away.
          // If the toggle turned it OFF, do not start a drag interaction.
          if (this.selectedShapes.includes(hit)) {
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
        if (!this.selectedShapes.includes(hit)) {
          this.applySelectionOperation({ type: 'replace', shapes: [hit] });
          this.rebuildSelectedIndices();

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
          y1: sy
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
    // 🔑 If we're dragging, pointermove is already driving renders (including previews).
    // Do NOT repaint from mousemove or you'll overwrite the preview and it will "teleport".
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
    this._pointerScreenX = sx;
    this._pointerScreenY = sy;

    if (this.activeInteraction?.type === 'drag-select') {
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
      this._selectedIndices = previewSelected
        .map(s => this.shapes.indexOf(s))
        .filter(i => i !== -1);

      this.render();

      return;
    }

    if (this.activeInteraction?.type === 'drag-shape') {
      this._didDrag = true;

      const drag = this.activeInteraction;

      const worldNow = this.viewport.screenToWorld(sx, sy);

      const dx = Measurement.fromPx(worldNow.xPx - drag.startWorldX);
      const dy = Measurement.fromPx(worldNow.yPx - drag.startWorldY);

      this._lastDragDx = dx;
      this._lastDragDy = dy;

      const targets =
        this.selectedShapes.length > 1 && this.selectedShapes.includes(drag.original)
          ? this.selectedShapes
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

      this.selectedShapes = this.shapes.filter(s => {
        const bb = s.getBoundingBox();
        const bx0 = bb.topLeft.x.toUnit('px');
        const by0 = bb.topLeft.y.toUnit('px');
        const bx1 = bx0 + bb.width.toUnit('px');
        const by1 = by0 + bb.height.toUnit('px');

        return !(bx1 < x0 || bx0 > x1 || by1 < y0 || by0 > y1);
      });
      this._previewShapes = null;
      this.rebuildSelectedIndices();
    }

    if (this.activeInteraction?.type === 'drag-shape') {
      const drag = this.activeInteraction;

      const targets =
        this.selectedShapes.length > 1 && this.selectedShapes.includes(drag.original)
          ? this.selectedShapes
          : [drag.original];

      if (this._lastDragDx && this._lastDragDy) {
        this.applyGroupTransform(targets, s => s.translate(this._lastDragDx!, this._lastDragDy!));
      }

      this._lastDragDx = null;
      this._lastDragDy = null;
      this._previewShapes = null;
      this.rebuildSelectedIndices();
    }


    this.activeInteraction = null;
    this._isPanning = false;
    this.updateHoverFromPointer();

    this.render();

    

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

    this.applySelectionOperation({
      type: e.shiftKey ? 'toggle' : 'replace',
      shapes: found ? [found] : []
    });

    this.rebuildSelectedIndices();
    this.render();
  };




  public drawOverlays(ctx: CanvasRenderingContext2D) {
    const canvas = this.canvasRef.nativeElement;
    const { topLeft, bottomRight } = this.viewport.getVisibleWorldRect(canvas);
    const shapesForOverlay: Shape[] = this._previewShapes ?? this.shapes;
    
    // Grid
    if (this.showGrid) {
      const spacingPx = Measurement.fromMm(1).toUnit('px');
      const startX = Math.floor(topLeft.xPx / spacingPx) * spacingPx;
      const endX = Math.ceil(bottomRight.xPx / spacingPx) * spacingPx;
      const startY = Math.floor(topLeft.yPx / spacingPx) * spacingPx;
      const endY = Math.ceil(bottomRight.yPx / spacingPx) * spacingPx;
      ctx.save();
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 1 / (this.viewport.getScale() || 1);
      for (let x = startX; x <= endX; x += spacingPx) {
        ctx.beginPath();
        ctx.moveTo(x, topLeft.yPx - spacingPx);
        ctx.lineTo(x, bottomRight.yPx + spacingPx);
        ctx.stroke();
      }
      for (let y = startY; y <= endY; y += spacingPx) {
        ctx.beginPath();
        ctx.moveTo(topLeft.xPx - spacingPx, y);
        ctx.lineTo(bottomRight.xPx + spacingPx, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Bounding boxes
    if (this.showBoundingBoxes) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1 / (this.viewport.getScale() || 1);
      for (const s of shapesForOverlay || []) {
        try {
          if (s && typeof s.getBoundingBox === 'function') {
            const bb = s.getBoundingBox();
            ctx.strokeRect(bb.topLeft.x.toUnit('px'), bb.topLeft.y.toUnit('px'), bb.width.toUnit('px'), bb.height.toUnit('px'));
          }
        } catch {}
      }
      ctx.restore();
    }

    // Selection outlines
    if (shapesForOverlay && shapesForOverlay.length) {
      const groupBox = this.getGroupBoundingBox(this._selectedIndices.map(i => shapesForOverlay[i]).filter(Boolean));
      if (groupBox) {
        ctx.save();
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = '#0078D7';
        ctx.lineWidth = 2 / (this.viewport.getScale() || 1);
        const x = groupBox.topLeft.x.toUnit('px');
        const y = groupBox.topLeft.y.toUnit('px');
        const w = groupBox.width.toUnit('px');
        const h = groupBox.height.toUnit('px');
        ctx.strokeRect(x, y, w, h);

        const handles = [
          new Point(Measurement.fromPx(x), Measurement.fromPx(y)),
          new Point(Measurement.fromPx(x + w / 2), Measurement.fromPx(y)),
          new Point(Measurement.fromPx(x + w), Measurement.fromPx(y)),
          new Point(Measurement.fromPx(x + w), Measurement.fromPx(y + h / 2)),
          new Point(Measurement.fromPx(x + w), Measurement.fromPx(y + h)),
          new Point(Measurement.fromPx(x + w / 2), Measurement.fromPx(y + h)),
          new Point(Measurement.fromPx(x), Measurement.fromPx(y + h)),
          new Point(Measurement.fromPx(x), Measurement.fromPx(y + h / 2))
        ];

        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#0078D7';
        for (const pt of handles) {
          ctx.beginPath();
          ctx.arc(pt.x.toUnit('px'), pt.y.toUnit('px'), 6, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }

        const rotHandle = new Point(Measurement.fromPx(x + w / 2), Measurement.fromPx(y - 24));
        ctx.beginPath();
        ctx.arc(rotHandle.x.toUnit('px'), rotHandle.y.toUnit('px'), 7, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffe';
        ctx.strokeStyle = '#f80';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2 / (this.viewport.getScale() || 1);
      this._selectedIndices.forEach(i => {
        const s = shapesForOverlay[i];
        if (!s) return;
        try { s.toCanvas(ctx); } catch {}
      });


      ctx.restore();
    }
    const isDragging = this.activeInteraction?.type === 'drag-shape' || this.activeInteraction?.type === 'drag-select';
    if (!isDragging && this.hoveredShape && (!this.selectedShapes || !this.selectedShapes.includes(this.hoveredShape))) {
      if (this.hoveredShape && (!this.selectedShapes || !this.selectedShapes.includes(this.hoveredShape))) {
        ctx.save();
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 1 / (this.viewport.getScale() || 1);
        try { this.hoveredShape.toCanvas(ctx); } catch {}
        ctx.restore();
      }
    }

    // Draw drag-select rectangle if active
    if (this.activeInteraction && this.activeInteraction.type === 'drag-select') {
      ctx.save();
      ctx.strokeStyle = '#0078D7';
      ctx.setLineDash([4, 2]);
      ctx.lineWidth = 1.5 / (this.viewport.getScale() || 1);
      const r = this.activeInteraction;
      ctx.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      ctx.restore();
    }

    if (this._pointerScreenX != null && this._pointerScreenY != null) {
      const world = this.viewport.screenToWorld(this._pointerScreenX, this._pointerScreenY);
      const wx = world.xPx;
      const wy = world.yPx;
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1 / (this.viewport.getScale() || 1);
      const snapX = Math.round(wx);
      const snapY = Math.round(wy);
      ctx.beginPath();
      ctx.moveTo(snapX, topLeft ? topLeft.yPx - 10000 : -10000);
      ctx.lineTo(snapX, bottomRight ? bottomRight.yPx + 10000 : 10000);
      ctx.moveTo(topLeft ? topLeft.xPx - 10000 : -10000, snapY);
      ctx.lineTo(bottomRight ? bottomRight.xPx + 10000 : 10000, snapY);
      ctx.stroke();
      ctx.restore();
    }
  }
  public getGroupBoundingBox(shapes: Shape[]): Rectangle | null {
    if (!shapes || shapes.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const s of shapes) {
      if (s) {
        const bb = s.getBoundingBox();
        const x = bb.topLeft.x.toUnit('px');
        const y = bb.topLeft.y.toUnit('px');
        const w = bb.width.toUnit('px');
        const h = bb.height.toUnit('px');
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
      }
    }

    if (minX === Infinity) return null;

    return new Rectangle(
      new Point(Measurement.fromPx(minX), Measurement.fromPx(minY)),
      Measurement.fromPx(maxX - minX),
      Measurement.fromPx(maxY - minY)
    );
  }  

  private rebuildSelectedIndices() {
    this._selectedIndices = this.selectedShapes
      .map(s => this.shapes.indexOf(s))
      .filter(i => i !== -1);
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
