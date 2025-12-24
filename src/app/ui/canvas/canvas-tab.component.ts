import { Component, ElementRef, Input, OnDestroy, OnInit, OnChanges, SimpleChanges, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CanvasRendererService } from './canvas-renderer.service';
import { CanvasViewport } from './canvas-viewport';

@Component({
  standalone: true,
  selector: 'app-canvas-tab',
  imports: [CommonModule],
  template: `<div class="canvas-host"><canvas #canvasEl></canvas></div>`,
  styles: [`.canvas-host{width:100%;height:100%;display:block}canvas{display:block;width:100%;height:100%}`]
})
export class CanvasTabComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvasEl', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() shapes: any[] = [];

  private viewport = new CanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 });

  private _mounted = false;

  constructor(private renderer: CanvasRendererService) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this._mounted = true;
    const canvas = this.canvasRef.nativeElement;
    // hook interaction listeners for view-only pan/zoom
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);

    this.renderer.render(canvas, this.shapes, this.viewport, { background: '#fff' });
    window.addEventListener('resize', this.onResize);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this._mounted) return;
    if (changes['shapes']) {
      this.renderer.render(this.canvasRef.nativeElement, this.shapes, this.viewport, { background: '#fff' });
    }
  }

  private onResize = () => {
    this.renderer.render(this.canvasRef.nativeElement, this.shapes, this.viewport, { background: '#fff' });
  };

  // interaction state
  private _isPanning = false;
  private _lastX = 0;
  private _lastY = 0;

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.viewport.zoomAt(factor, sx, sy);
    this.renderer.render(canvas, this.shapes, this.viewport, { background: '#fff' });
  };

  private onPointerDown = (e: PointerEvent) => {
    const canvas = this.canvasRef.nativeElement;
    canvas.setPointerCapture?.(e.pointerId);
    this._isPanning = true;
    this._lastX = e.clientX;
    this._lastY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this._isPanning) return;
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX;
    this._lastY = e.clientY;
    // pan by screen delta
    this.viewport.panBy(dx, dy);
    this.renderer.render(this.canvasRef.nativeElement, this.shapes, this.viewport, { background: '#fff' });
  };

  private onPointerUp = (e: PointerEvent) => {
    const canvas = this.canvasRef.nativeElement;
    canvas.releasePointerCapture?.(e.pointerId);
    this._isPanning = false;
  };

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
  }
}
