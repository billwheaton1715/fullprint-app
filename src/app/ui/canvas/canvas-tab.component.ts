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
import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  OnChanges,
  SimpleChanges,
  ViewChild,
  AfterViewInit,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CanvasRendererService } from './canvas-renderer.service';
import { CanvasOverlayRenderer } from './canvas-overlay-renderer';
import { CanvasSelectionModel} from './canvas-selection-model';
import { CanvasInteractionController } from './canvas-interaction-controller';
import { CanvasSelectionController } from './canvas-selection-controller';
import { CanvasHitTestController } from './canvas-hit-test-controller';
import { CanvasTransformController } from './canvas-transform-controller';
import { CanvasPanZoomController } from './canvas-pan-zoom-controller';
import { CommitTranslateCommand } from './commands/commit-translate-command';
import { DeleteCommand } from './commands/delete-command';
import { NudgeCommand } from './commands/nudge-command';
import { AddShapesCommand } from './commands/add-shapes-command';
import { CropImageCommand } from './commands/crop-image-command';
import { ImageShape } from '../../core/geometry/ImageShape';
import { CanvasCropController } from './canvas-crop-controller';
import { TilingSettings, DEFAULT_TILING_SETTINGS, SCREEN_DPI, PAPER_SIZES, PaperSizeId } from '../../core/tiling/tiling-settings';
import { AppPreferences, DEFAULT_APP_PREFERENCES } from '../../core/preferences/app-preferences';
import { TilingLayout, TileRect, computeTilingLayout } from '../../core/tiling/tiling-calculator';
import { CanvasPdfExporter } from './canvas-pdf-exporter';
import { CanvasSnapController, SnapOptions } from './canvas-snap-controller';
import { applyEdgeAwareInkSaver } from './canvas-ink-saver';
import { PersistenceService, PersistedState, PersistedTab } from '../../core/persistence/persistence.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { StatusBarComponent } from '../status-bar/status-bar.component';

import { CanvasCommand } from './commands/canvas-command';
import { isUndoable } from './commands/undoable-command';
import { CanvasUndoStack } from './canvas-undo-stack';


import { CanvasViewport } from './canvas-viewport';

import Shape from '../../core/geometry/Shape';
import { CanvasMarqueeController } from './canvas-marquee-controller';
import { CommitMarqueeSelectionCommand } from './commands/commit-marquee-selection-command';
import { ClickOnEmptyCommand } from './commands/click-on-empty-command';
import { ClickOnShapeCommand } from './commands/click-on-shape-command';

// ── Per-tab persistent state ──────────────────────────────────────────────────
interface TabSnapshot {
  id:              number;
  name:            string;
  editing:         boolean;   // true while the inline rename input is shown
  // canvas
  shapes:          Shape[];
  // viewport
  viewportScale:   number;
  viewportOffsetX: number;
  viewportOffsetY: number;
  // tiling
  tilingActive:    boolean;
  tilingSettings:  TilingSettings;
  // calibration
  calibMode:           'idle' | 'pick1' | 'pick2' | 'confirm';
  calibPoint1:         { x: number; y: number } | null;
  calibPoint2:         { x: number; y: number } | null;
  calibPixelDist:      number;
  calibKnownDistance:  number;
  calibUnit:           'in' | 'mm';
  // undo history
  undoStack: CanvasUndoStack;
}

@Component({
  standalone: true,
  selector: 'app-canvas-tab',
  imports: [CommonModule, FormsModule, StatusBarComponent],
  template: `
    <!-- ── Tab bar ──────────────────────────────────────────────────── -->
    <div class="fp-tab-bar">
      <div *ngFor="let tab of tabs; let i = index"
           class="fp-tab" [class.fp-tab-active]="i === activeTabIndex"
           (click)="switchTab(i)">
        <span *ngIf="!tab.editing" class="fp-tab-name"
              (dblclick)="startRename(i, $event)">{{ tab.name }}</span>
        <input *ngIf="tab.editing" class="fp-tab-input"
               [value]="tab.name"
               (blur)="finishRename(i, $event)"
               (keydown.enter)="finishRename(i, $event)"
               (keydown.escape)="cancelRename(i)"
               (click)="$event.stopPropagation()"
               autofocus>
        <button *ngIf="tabs.length > 1" class="fp-tab-close"
                (click)="closeTab(i, $event)" title="Close tab">&#x2715;</button>
      </div>
      <button class="fp-tab-add" (click)="addTab()" title="New tab">&#xFF0B;</button>
    </div>

    <div class="fp-toolbar">

      <!-- ── File menu ───────────────────────────────────────────────── -->
      <div class="fp-menu-host">
        <button class="fp-btn fp-menu-btn" (click)="showFileMenu = !showFileMenu"
                title="File — Save, Open, etc.">
          File <span class="fp-menu-arrow">&#9660;</span>
        </button>
        <div class="fp-menu-backdrop" *ngIf="showFileMenu" (click)="showFileMenu = false"></div>
        <div class="fp-dropdown" *ngIf="showFileMenu" role="menu">
          <button class="fp-menu-item" role="menuitem"
                  (click)="saveProject(); showFileMenu = false">
            <span>Save</span>
            <span class="fp-menu-kbd">&#8984;S</span>
          </button>
          <button class="fp-menu-item" role="menuitem"
                  (click)="saveProjectAs(); showFileMenu = false">
            Save As…
          </button>
          <button class="fp-menu-item" role="menuitem"
                  (click)="openProject(); showFileMenu = false">
            Open…
          </button>
          <div class="fp-menu-sep" *ngIf="persistence.currentFileName"></div>
          <span class="fp-menu-filename" *ngIf="persistence.currentFileName"
                title="{{ persistence.currentFileName }}">
            {{ persistence.currentFileName }}
          </span>
        </div>
      </div>

      <span class="fp-toolbar-sep"></span>

      <!-- ── Image actions ───────────────────────────────────────────── -->
      <button class="fp-btn" (click)="onImportClick()"
              title="Import image — or drag-and-drop / paste onto canvas">
        Import
      </button>
      <input #fileInput type="file" accept="image/*" multiple style="display:none"
             (change)="onFileInputChange($event)">
      <button class="fp-btn fp-btn-toggle" [class.fp-btn-on]="cropController.isActive"
              [disabled]="!canCrop()"
              (click)="onCropClick()"
              title="Crop selected image (C) — Enter to commit, Escape to cancel">
        Crop
      </button>

      <span class="fp-toolbar-sep"></span>

      <!-- ── View actions ────────────────────────────────────────────── -->
      <button class="fp-btn" (click)="fitToView()"
              title="Fit all content in view (F / Cmd+0)">
        Fit
      </button>
      <button class="fp-btn fp-btn-toggle" [class.fp-btn-on]="snapEnabled"
              (click)="snapEnabled = !snapEnabled"
              title="Snap shapes to grid and other shapes while dragging">
        Snap
      </button>

      <span class="fp-toolbar-sep"></span>

      <!-- ── Layout actions ──────────────────────────────────────────── -->
      <button class="fp-btn fp-btn-toggle" [class.fp-btn-on]="tilingActive"
              (click)="tilingActive = !tilingActive; invalidateFromTemplate()"
              title="Page tiling — split content across multiple printed pages">
        Tiling
      </button>
      <button class="fp-btn fp-btn-toggle" [class.fp-btn-on]="calibMode !== 'idle'"
              (click)="onCalibrateClick()"
              title="Calibrate print scale — pick two points of known distance">
        Calibrate
      </button>
      <span *ngIf="isCalibrated()" class="fp-calib-badge"
            title="Calibrated — {{ tilingSettings.calibrationPxPerIn | number:'1.2-2' }} px/in">
        &#128207; {{ calibSummary() }}
        <button class="fp-calib-reset" (click)="resetCalibration()" title="Clear calibration">&#x2715;</button>
      </span>

      <!-- ── Right side ──────────────────────────────────────────────── -->
      <span class="fp-toolbar-spacer"></span>
      <button class="fp-btn fp-btn-help" (click)="openPreferences()"
              title="Preferences">&#9881;</button>
      <button class="fp-btn fp-btn-help" (click)="showShortcuts = !showShortcuts"
              title="Keyboard shortcuts (?)">?</button>

    </div>

    <!-- Keyboard shortcuts overlay -->
    <div class="fp-shortcuts-backdrop" *ngIf="showShortcuts" (click)="showShortcuts = false"></div>
    <div class="fp-shortcuts-modal" *ngIf="showShortcuts" role="dialog" aria-label="Keyboard shortcuts">
      <div class="fp-shortcuts-header">
        <span>Keyboard Shortcuts</span>
        <button class="fp-shortcuts-close" (click)="showShortcuts = false" title="Close">&#x2715;</button>
      </div>
      <table class="fp-shortcuts-table">
        <tbody>
          <tr><th colspan="2" class="fp-shortcuts-section">Canvas</th></tr>
          <tr><td><kbd>Scroll wheel</kbd></td><td>Zoom in / out</td></tr>
          <tr><td><kbd>Middle drag</kbd></td><td>Pan</td></tr>
          <tr><td><kbd>F</kbd></td><td>Fit to view</td></tr>
          <tr><td><kbd>Cmd/Ctrl 0</kbd></td><td>Fit to view</td></tr>
          <tr><th colspan="2" class="fp-shortcuts-section">Selection</th></tr>
          <tr><td><kbd>Click</kbd></td><td>Select shape</td></tr>
          <tr><td><kbd>Shift+Click</kbd></td><td>Add / remove from selection</td></tr>
          <tr><td><kbd>Drag on empty</kbd></td><td>Marquee select</td></tr>
          <tr><td><kbd>Cmd/Ctrl A</kbd></td><td>Select all</td></tr>
          <tr><td><kbd>Escape</kbd></td><td>Deselect all</td></tr>
          <tr><td><kbd>Delete / Backspace</kbd></td><td>Delete selected</td></tr>
          <tr><td><kbd>↑ ↓ ← →</kbd></td><td>Nudge 1 px</td></tr>
          <tr><td><kbd>Shift + arrows</kbd></td><td>Nudge 10 px</td></tr>
          <tr><th colspan="2" class="fp-shortcuts-section">Tools</th></tr>
          <tr><td><kbd>C</kbd></td><td>Enter crop mode (single image)</td></tr>
          <tr><td><kbd>Enter</kbd></td><td>Apply crop / confirm calibration</td></tr>
          <tr><td><kbd>Escape</kbd></td><td>Cancel crop / calibration</td></tr>
          <tr><th colspan="2" class="fp-shortcuts-section">Edit</th></tr>
          <tr><td><kbd>Cmd/Ctrl Z</kbd></td><td>Undo</td></tr>
          <tr><td><kbd>Cmd+Shift+Z / Ctrl+Y</kbd></td><td>Redo</td></tr>
          <tr><th colspan="2" class="fp-shortcuts-section">File</th></tr>
          <tr><td><kbd>Cmd/Ctrl S</kbd></td><td>Save</td></tr>
          <tr><th colspan="2" class="fp-shortcuts-section">Help</th></tr>
          <tr><td><kbd>?</kbd></td><td>This shortcuts panel</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Preferences overlay -->
    <div class="fp-shortcuts-backdrop" *ngIf="showPreferences" (click)="cancelPreferences()"></div>
    <div class="fp-shortcuts-modal fp-prefs-modal" *ngIf="showPreferences" role="dialog" aria-label="Preferences">
      <div class="fp-shortcuts-header">
        <span>Preferences</span>
        <button class="fp-shortcuts-close" (click)="cancelPreferences()" title="Close">&#x2715;</button>
      </div>
      <div class="fp-prefs-body">
        <p class="fp-prefs-note">These defaults apply to new tabs. Existing tabs are not changed.</p>

        <label class="fp-prefs-row">
          <span class="fp-prefs-lbl">Default paper size</span>
          <select [(ngModel)]="prefsDraft.defaultPaperSizeId">
            <option *ngFor="let ps of paperSizes" [value]="ps.id">{{ ps.label }}</option>
          </select>
        </label>

        <label class="fp-prefs-row">
          <span class="fp-prefs-lbl">Default output DPI</span>
          <input type="number" min="72" max="600" step="1"
                 [(ngModel)]="prefsDraft.defaultDpi" class="fp-tl-num"> dpi
        </label>

        <label class="fp-prefs-row">
          <span class="fp-prefs-lbl">Default overlap</span>
          <input type="number" min="0" max="2" step="0.125"
                 [(ngModel)]="prefsDraft.defaultOverlapIn" class="fp-tl-num"> in
        </label>

        <label class="fp-prefs-row">
          <span class="fp-prefs-lbl">Default margin</span>
          <input type="number" min="0" max="2" step="0.125"
                 [(ngModel)]="prefsDraft.defaultMarginIn" class="fp-tl-num"> in
        </label>

        <div class="fp-prefs-actions">
          <button class="fp-btn" (click)="savePreferences()">Save</button>
          <button class="fp-btn" (click)="cancelPreferences()">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Calibration instruction / confirm panel -->
    <div class="fp-calib-panel" *ngIf="calibMode !== 'idle'">
      <span *ngIf="calibMode === 'pick1'" class="fp-calib-msg">
        Click the <strong>first</strong> calibration point &mdash; zoom in for maximum accuracy
      </span>
      <span *ngIf="calibMode === 'pick2'" class="fp-calib-msg">
        Click the <strong>second</strong> calibration point
        <span *ngIf="calibPixelDist > 0"> &mdash; {{ calibPixelDist | number:'1.1-1' }} px apart</span>
      </span>
      <ng-container *ngIf="calibMode === 'confirm'">
        <span class="fp-calib-msg">
          {{ calibPixelDist | number:'1.1-1' }} px between points &mdash; enter the real-world distance:
        </span>
        <input type="number" [(ngModel)]="calibKnownDistance" min="0.001" step="0.1"
               class="fp-tl-num" style="width:60px" (keydown.enter)="applyCalibration()">
        <select [(ngModel)]="calibUnit">
          <option value="in">inches</option>
          <option value="mm">mm</option>
        </select>
        <button class="fp-btn" (click)="applyCalibration()">Apply</button>
      </ng-container>
      <button class="fp-btn" (click)="cancelCalibration()">Cancel</button>
    </div>

    <!-- Tiling settings panel (shown when Tiling is active) -->
    <div class="fp-tiling-panel" *ngIf="tilingActive">
      <label class="fp-tl-label">Paper
        <select [(ngModel)]="tilingSettings.paperSizeId" (ngModelChange)="invalidateFromTemplate()">
          <option *ngFor="let ps of paperSizes" [value]="ps.id">{{ ps.label }}</option>
        </select>
      </label>
      <ng-container *ngIf="tilingSettings.paperSizeId === 'custom'">
        <label class="fp-tl-label">W
          <input type="number" min="1" max="48" step="0.125"
                 [(ngModel)]="tilingSettings.customPaperWIn"
                 (ngModelChange)="invalidateFromTemplate()" class="fp-tl-num"> in
        </label>
        <label class="fp-tl-label">H
          <input type="number" min="1" max="48" step="0.125"
                 [(ngModel)]="tilingSettings.customPaperHIn"
                 (ngModelChange)="invalidateFromTemplate()" class="fp-tl-num"> in
        </label>
      </ng-container>
      <label class="fp-tl-label">Orientation
        <select [(ngModel)]="tilingSettings.orientation" (ngModelChange)="invalidateFromTemplate()">
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </label>
      <label class="fp-tl-label">Margin
        <input type="number" min="0.1" max="2" step="0.05"
               [(ngModel)]="tilingSettings.marginIn"
               (ngModelChange)="invalidateFromTemplate()" class="fp-tl-num"> in
      </label>
      <label class="fp-tl-label">Overlap
        <input type="number" min="0.05" max="2" step="0.05"
               [(ngModel)]="tilingSettings.overlapIn"
               (ngModelChange)="invalidateFromTemplate()" class="fp-tl-num"> in
      </label>
      <label class="fp-tl-label">Align
        <select [(ngModel)]="tilingSettings.contentAlign" (ngModelChange)="invalidateFromTemplate()">
          <option value="top-left">Top-left</option>
          <option value="center">Center</option>
        </select>
      </label>
      <label class="fp-tl-label">Assembly marks
        <select [(ngModel)]="tilingSettings.assemblyMarks" (ngModelChange)="invalidateFromTemplate()">
          <option value="none">None</option>
          <option value="rectangles">Rectangles</option>
          <option value="diagonals">Diagonals</option>
          <option value="both">Both</option>
        </select>
      </label>
      <label class="fp-tl-label" *ngIf="tilingSettings.assemblyMarks !== 'none'">Grid spacing
        <select [(ngModel)]="tilingSettings.assemblySpacingIn" (ngModelChange)="invalidateFromTemplate()">
          <option [ngValue]="1">1″</option>
          <option [ngValue]="1.5">1.5″</option>
          <option [ngValue]="2">2″</option>
          <option [ngValue]="2.5">2.5″</option>
          <option [ngValue]="3">3″</option>
        </select>
      </label>
      <label class="fp-tl-label">
        <input type="checkbox" [(ngModel)]="tilingSettings.registrationMarks"
               (ngModelChange)="invalidateFromTemplate()">
        Reg. marks
      </label>
      <label class="fp-tl-label">
        <input type="checkbox" [(ngModel)]="tilingSettings.inkSaver"
               (ngModelChange)="invalidateFromTemplate()">
        Ink Saver
      </label>
      <ng-container *ngIf="tilingSettings.inkSaver">
        <label class="fp-tl-label">
          Strength
          <input type="range" min="10" max="100" step="5"
                 [(ngModel)]="tilingSettings.inkSaverStrength"
                 (ngModelChange)="invalidateFromTemplate()"
                 style="width:80px; vertical-align:middle;">
          {{ tilingSettings.inkSaverStrength }}%
        </label>
        <label class="fp-tl-label">
          Fade dist
          <input type="range" min="1" max="20" step="0.5"
                 [(ngModel)]="tilingSettings.inkSaverFadeRadiusMm"
                 (ngModelChange)="invalidateFromTemplate()"
                 style="width:80px; vertical-align:middle;">
          {{ tilingSettings.inkSaverFadeRadiusMm }}mm
        </label>
      </ng-container>
      <span class="fp-tl-info" *ngIf="tilingLayout">
        {{ tilingLayout.cols }}&times;{{ tilingLayout.rows }}
        = {{ tilingLayout.totalPages }} page{{ tilingLayout.totalPages !== 1 ? 's' : '' }}
      </span>
      <span class="fp-tl-info" *ngIf="!tilingLayout" style="color:#c00">
        No content on canvas
      </span>
      <button class="fp-btn" (click)="exportPdf()"
              [disabled]="!tilingLayout" title="Export tiled PDF">
        Export PDF
      </button>
    </div>

    <div #host class="canvas-host"
         (dragover)="onDragOver($event)"
         (drop)="onDrop($event)">
      <canvas #canvasEl></canvas>
    </div>

    <app-status-bar
      [mouseX]="statusMouseX"
      [mouseY]="statusMouseY"
      [unitLabel]="statusUnitLabel"
      [contextHint]="statusContextHint"
      [zoomScale]="viewport.getScale()"
      [saveStatus]="persistence.saveStatus">
    </app-status-bar>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      position: relative;
    }
    .fp-tab-bar {
      display: flex;
      align-items: flex-end;
      gap: 2px;
      padding: 4px 8px 0;
      background: #d8d8d8;
      border-bottom: 1px solid #bbb;
      flex-shrink: 0;
      overflow-x: auto;
      user-select: none;
    }
    .fp-tab {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px 4px 10px;
      background: #c8c8c8;
      border: 1px solid #bbb;
      border-bottom: none;
      border-radius: 4px 4px 0 0;
      cursor: pointer;
      font-size: 12px;
      min-width: 80px;
      max-width: 180px;
      white-space: nowrap;
      position: relative;
    }
    .fp-tab-active {
      background: #f0f0f0;
      border-color: #bbb;
      z-index: 1;
      bottom: -1px;
    }
    .fp-tab-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .fp-tab-input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 12px;
      padding: 0;
      outline: 1px solid #5aaeea;
      min-width: 50px;
    }
    .fp-tab-close {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      color: #999;
      padding: 0 1px;
      line-height: 1;
      flex-shrink: 0;
    }
    .fp-tab-close:hover { color: #c00; }
    .fp-tab-add {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 20px;
      color: #666;
      padding: 0 6px 4px;
      line-height: 1;
      align-self: center;
    }
    .fp-tab-add:hover { color: #222; }
    .fp-toolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: #f0f0f0;
      border-bottom: 1px solid #ccc;
      flex-shrink: 0;
      user-select: none;
    }
    .fp-toolbar-spacer {
      flex: 1 1 0;
    }
    /* File dropdown menu */
    .fp-menu-host {
      position: relative;
    }
    .fp-menu-btn {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .fp-menu-arrow {
      font-size: 8px;
      opacity: 0.55;
    }
    .fp-menu-backdrop {
      position: fixed;
      inset: 0;
      z-index: 80;
    }
    .fp-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      z-index: 81;
      background: #fff;
      border: 1px solid #bbb;
      border-radius: 6px;
      box-shadow: 0 4px 18px rgba(0,0,0,0.15);
      min-width: 170px;
      padding: 4px 0;
    }
    .fp-menu-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 6px 16px;
      background: none;
      border: none;
      text-align: left;
      font-size: 13px;
      cursor: pointer;
      color: #222;
      white-space: nowrap;
    }
    .fp-menu-item:hover { background: #f0f0f0; }
    .fp-menu-kbd {
      font-size: 11px;
      color: #999;
      margin-left: 24px;
    }
    .fp-menu-sep {
      height: 1px;
      background: #e0e0e0;
      margin: 3px 0;
    }
    .fp-menu-filename {
      display: block;
      padding: 3px 16px 6px;
      font-size: 11px;
      color: #888;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .fp-btn {
      padding: 3px 10px;
      font-size: 13px;
      cursor: pointer;
      border: 1px solid #aaa;
      border-radius: 3px;
      background: #fff;
    }
    .fp-btn:hover { background: #e8e8e8; }
    .fp-btn-toggle { color: #666; }
    .fp-btn-on { background: #d0eaff; border-color: #5aaeea; color: #003a6b; }
    .fp-btn-on:hover { background: #b8dcf8; }
    .fp-tiling-panel {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 10px;
      background: #e8f0ff;
      border-bottom: 1px solid #b0c4ee;
      flex-shrink: 0;
      flex-wrap: wrap;
      font-size: 12px;
    }
    .fp-tl-label {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .fp-tl-num {
      width: 48px;
      font-size: 12px;
      padding: 1px 3px;
    }
    .fp-tl-info {
      font-weight: 600;
      color: #003a6b;
      margin: 0 4px;
    }
    .fp-toolbar-sep {
      width: 1px;
      height: 20px;
      background: #ccc;
      margin: 0 2px;
      flex-shrink: 0;
    }
    .fp-save-status {
      font-size: 12px;
      padding: 2px 6px;
      border-radius: 3px;
      white-space: nowrap;
    }
    .fp-save-saving { color: #666; }
    .fp-save-saved  { color: #3a7a00; }
    .fp-save-error  { color: #c00; font-weight: 600; cursor: help; }
    .fp-filename {
      font-size: 11px;
      color: #666;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .fp-calib-panel {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      background: #fff8e8;
      border-bottom: 1px solid #e0c060;
      flex-shrink: 0;
      font-size: 12px;
    }
    .fp-calib-msg { color: #5a3a00; }
    .fp-calib-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #3a5a00;
      background: #eaffcc;
      border: 1px solid #9bc840;
      border-radius: 3px;
      padding: 1px 6px;
    }
    .fp-calib-reset {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 11px;
      color: #666;
      padding: 0 2px;
      line-height: 1;
    }
    .fp-calib-reset:hover { color: #c00; }
    .fp-btn-help {
      font-weight: 700;
      min-width: 26px;
      border-radius: 50%;
    }
    /* Preferences modal */
    .fp-prefs-modal {
      min-width: 340px;
      max-height: none;
    }
    .fp-prefs-body {
      padding: 12px 14px 14px;
    }
    .fp-prefs-note {
      font-size: 11px;
      color: #a6adc8;
      margin: 0 0 12px;
    }
    .fp-prefs-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      font-size: 13px;
    }
    .fp-prefs-lbl {
      flex: 0 0 160px;
      color: #cdd6f4;
    }
    .fp-prefs-row select, .fp-prefs-row input {
      background: #313244;
      border: 1px solid #45475a;
      color: #cdd6f4;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 13px;
    }
    .fp-prefs-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #45475a;
    }
    /* Keyboard shortcuts overlay */
    .fp-shortcuts-backdrop {
      position: absolute;
      inset: 0;
      z-index: 90;
    }
    .fp-shortcuts-modal {
      position: absolute;
      top: 40px;
      right: 12px;
      z-index: 91;
      background: #1e1e2e;
      color: #cdd6f4;
      border: 1px solid #45475a;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      min-width: 380px;
      max-height: 70vh;
      overflow-y: auto;
      font-size: 12px;
    }
    .fp-shortcuts-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px 8px;
      font-weight: 700;
      font-size: 13px;
      border-bottom: 1px solid #45475a;
      position: sticky;
      top: 0;
      background: #1e1e2e;
    }
    .fp-shortcuts-close {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 14px;
      padding: 0 2px;
      line-height: 1;
    }
    .fp-shortcuts-close:hover { color: #cdd6f4; }
    .fp-shortcuts-table {
      border-collapse: collapse;
      width: 100%;
    }
    .fp-shortcuts-table td, .fp-shortcuts-table th {
      padding: 4px 14px;
      text-align: left;
    }
    .fp-shortcuts-table td:first-child {
      white-space: nowrap;
      color: #89b4fa;
      width: 200px;
    }
    .fp-shortcuts-section {
      background: #313244;
      color: #a6adc8;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 6px 14px 4px;
    }
    kbd {
      display: inline-block;
      background: #313244;
      border: 1px solid #585b70;
      border-radius: 3px;
      padding: 1px 5px;
      font-family: monospace;
      font-size: 11px;
      color: #cdd6f4;
    }
    .canvas-host {
      display: flex;
      flex: 1 1 0;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    canvas {
      display: block;
      flex: 1 1 0;
      min-width: 0;
      min-height: 0;
    }
  `]
})
export class CanvasTabComponent
  implements OnInit, AfterViewInit, OnChanges, OnDestroy {

  @ViewChild('canvasEl', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('host',     { static: true }) hostRef!:   ElementRef<HTMLDivElement>;
  @ViewChild('fileInput',{ static: true }) fileInputRef!: ElementRef<HTMLInputElement>;

  @Input() shapes: Shape[] = [];
  private _previewShapes: Shape[] | null = null;

  @Input() showBoundingBoxes = false;
  @Input() showGrid = false;

  readonly viewport = new CanvasViewport();
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
  private undoStack = new CanvasUndoStack();
  private transformController = new CanvasTransformController();
  private marquee = new CanvasMarqueeController(this.interaction, this.hitTest);
  readonly cropController = new CanvasCropController();

  // ── Tab state ──────────────────────────────────────────────────────────────
  tabs: TabSnapshot[] = [];
  activeTabIndex = 0;
  private _nextTabId = 1;

  // ── Tiling state ───────────────────────────────────────────────────────────
  tilingActive   = false;
  tilingSettings: TilingSettings = { ...DEFAULT_TILING_SETTINGS };
  tilingLayout:   TilingLayout | null = null;
  readonly paperSizes = PAPER_SIZES;
  private readonly pdfExporter = new CanvasPdfExporter();

  // ── Snapping ───────────────────────────────────────────────────────────────
  private readonly snapController = new CanvasSnapController();
  snapEnabled = true;
  /** Guides from the most recent snap computation — fed to overlay renderer. */
  private _snapGuides: import('./canvas-snap-controller').SnapGuide[] = [];

  // ── Ink-saver cache ────────────────────────────────────────────────────────
  // The Sobel + distance-transform pass is expensive (~50-200 ms on retina).
  // We cache the processed ImageData and only recompute when the scene actually
  // changes (shapes move, viewport pans/zooms, settings change).
  // Mouse moves that only update the crosshair hit the cache and are instant.
  private _inkSaverCache: { data: ImageData; key: string } | null = null;

  private _inkSaverCacheKey(canvas: HTMLCanvasElement): string {
    const vp  = this.viewport;
    const ts  = this.tilingSettings;
    const dpr = window.devicePixelRatio || 1;
    const fadeRadiusPx = Math.max(2, Math.round(
      Measurement.fromMm(ts.inkSaverFadeRadiusMm ?? 5).toUnit('px')
      * vp.getScale() * dpr
    ));
    // Shape world positions — changes when a shape is moved, added, or deleted
    const shapeKey = this.shapes.map(sh => {
      try {
        const tl = sh.topLeft;
        return `${tl.x.toUnit('px').toFixed(1)},${tl.y.toUnit('px').toFixed(1)}`;
      } catch { return '?'; }
    }).join(';');
    return [
      `${canvas.width}x${canvas.height}`,
      `${vp.getScale().toFixed(4)}`,
      `${vp.getOffsetX().toFixed(2)},${vp.getOffsetY().toFixed(2)}`,
      `str${(ts.inkSaverStrength / 100 * 0.88).toFixed(3)}`,
      `rad${fadeRadiusPx}`,
      shapeKey,
    ].join('|');
  }

  // ── Toolbar menus ──────────────────────────────────────────────────────────
  showFileMenu  = false;

  // ── Keyboard shortcuts overlay ─────────────────────────────────────────────
  showShortcuts = false;

  // ── Preferences ────────────────────────────────────────────────────────────
  showPreferences = false;
  appPreferences: AppPreferences = { ...DEFAULT_APP_PREFERENCES };
  /** Working copy edited in the modal; only committed to appPreferences on Save. */
  prefsDraft: AppPreferences = { ...DEFAULT_APP_PREFERENCES };

  // ── Calibration state ──────────────────────────────────────────────────────
  calibMode: 'idle' | 'pick1' | 'pick2' | 'confirm' = 'idle';
  calibPoint1: { x: number; y: number } | null = null;
  calibPoint2: { x: number; y: number } | null = null;
  calibPixelDist = 0;          // Euclidean distance in world-px between the two points
  calibKnownDistance = 6;      // user-entered real-world distance
  calibUnit: 'in' | 'mm' = 'in';
  private _calibLiveX = 0;     // world-px of live pointer (for preview line)
  private _calibLiveY = 0;


  // ── Status bar state (fed to StatusBarComponent) ───────────────────────────
  statusMouseX:      number | null = null;
  statusMouseY:      number | null = null;
  statusUnitLabel:   string = 'px';
  statusContextHint: string = '';

  constructor(
    private renderer:      CanvasRendererService,
    readonly persistence:  PersistenceService,
    private notifications: NotificationService,
    private _cdr:          ChangeDetectorRef,
  ) {}

  
  ngOnInit(): void {
    // Seed a blank first tab — will be replaced below if autosave data is found.
    this.tabs = [this._buildSnapshot(this._nextTabId, 'Canvas 1')];

    // Load preferences first, then restore the autosaved session.
    this.persistence.loadPreferences().then(prefs => {
      this.appPreferences = prefs;
      this.prefsDraft     = { ...prefs };
      // Update the initial blank tab to use the loaded preferences.
      if (this.tabs.length === 1) {
        this.tabs[0].tilingSettings = this._defaultTilingSettings();
        this.tilingSettings = { ...this.tabs[0].tilingSettings };
      }
    }).catch(() => { /* keep defaults */ });

    // Attempt to restore the last autosaved session from IndexedDB.
    this.persistence.loadFromIndexedDB().then(state => {
      if (state?.tabs?.length) {
        return this._restoreFromPersistedState(state);
      }
      return Promise.resolve();
    }).catch((err: any) => this.notifications.warn(
      'Could not restore autosaved session',
      err?.message ?? String(err)
    ));
  }

  ngAfterViewInit(): void {
    this._mounted = true;

    if (this.hostRef?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(this.hostRef.nativeElement);
    }

    const canvas = this.canvasRef.nativeElement;
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('click', this.onClick);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('pointerenter', this.onPointerEnter);

    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('lostpointercapture', this.onLostPointerCapture);

    window.addEventListener('pointerup',    this.onPointerUp);
    window.addEventListener('keydown',      this.onKeyDown);
    window.addEventListener('paste',        this.onPaste as unknown as EventListener);
    window.addEventListener('beforeunload', this._onBeforeUnload);

    this.resizeCanvas();
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this._mounted) return;
    if (changes['shapes']) {
      this.recomputeTilingLayout();
      this.render();
    }
  }

  ngOnDestroy(): void {
    if (this._rafId != null) cancelAnimationFrame(this._rafId);
    this._rafId = null;    

    this.resizeObserver?.disconnect();
    const canvas = this.canvasRef.nativeElement;
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('click', this.onClick);
    canvas.removeEventListener('pointerleave', this.onPointerLeave);
    canvas.removeEventListener('pointerenter', this.onPointerEnter);

    canvas.removeEventListener('pointercancel', this.onPointerCancel);
    canvas.removeEventListener('lostpointercapture', this.onLostPointerCapture);

    window.removeEventListener('pointerup',    this.onPointerUp);
    window.removeEventListener('keydown',      this.onKeyDown);
    window.removeEventListener('paste',        this.onPaste as unknown as EventListener);
    window.removeEventListener('beforeunload', this._onBeforeUnload);
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
      ctx => {
        // Ink saver: edge-aware lighten effect.
        // Applied after shapes but before overlays so the grid, handles, and
        // snap guides remain crisp on top.
        //
        // Performance: the Sobel + distance-transform pass is expensive.
        // We cache the processed ImageData keyed on canvas size, viewport
        // state, shape positions, and settings.  Mouse moves (crosshair
        // updates) don't change any of those keys, so they hit the cache
        // and render instantly.  During a drag (_previewShapes is set) we
        // skip ink saver entirely to keep the interaction responsive.
        if (this.tilingSettings.inkSaver && this._previewShapes == null) {
          const dpr          = window.devicePixelRatio || 1;
          const fadeRadiusPx = Math.max(2, Math.round(
            Measurement.fromMm(this.tilingSettings.inkSaverFadeRadiusMm ?? 5).toUnit('px')
            * this.viewport.getScale()
            * dpr
          ));
          const strength = (this.tilingSettings.inkSaverStrength / 100) * 0.88;
          const cacheKey = this._inkSaverCacheKey(canvas);

          if (this._inkSaverCache?.key === cacheKey) {
            // Cache hit — blit the previously-processed pixels (instant).
            ctx.putImageData(this._inkSaverCache.data, 0, 0);
          } else {
            // Cache miss — run the full filter and store the result.
            applyEdgeAwareInkSaver(ctx, canvas.width, canvas.height, fadeRadiusPx, strength);
            this._inkSaverCache = {
              data: ctx.getImageData(0, 0, canvas.width, canvas.height),
              key:  cacheKey,
            };
          }
        }
        this.drawOverlays(ctx);
      }
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

    // ── Calibration mode intercept ───────────────────────────────────────────
    if ((this.calibMode === 'pick1' || this.calibMode === 'pick2') && e.button === 0) {
      const pt = { x: world.xPx, y: world.yPx };
      if (this.calibMode === 'pick1') {
        this.calibPoint1 = pt;
        this.calibMode   = 'pick2';
        this.calibPixelDist = 0;
      } else {
        this.calibPoint2 = pt;
        const dx = pt.x - this.calibPoint1!.x;
        const dy = pt.y - this.calibPoint1!.y;
        this.calibPixelDist = Math.sqrt(dx * dx + dy * dy);
        this.calibMode = 'confirm';
      }
      this.invalidate();
      return;
    }

    // ── Crop mode intercept ──────────────────────────────────────────────────
    if (this.cropController.isActive && e.button === 0) {
      const result = this.cropController.pointerDown(
        world.xPx, world.yPx, this.viewport.getScale()
      );
      if (result !== 'none') {
        this.canvasRef.nativeElement.setPointerCapture?.(e.pointerId);
        this.invalidate();
        return;
      }
      // Clicked outside crop area — cancel crop without committing
      this.cropController.exit();
      this.invalidate();
      return;
    }

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

      // Only capture for drag-shape / drag-select when an interaction is actually active.
      const ai = this.interaction.activeInteraction;
      if (ai && (ai.type === 'drag-shape' || ai.type === 'drag-select')) {
        this.canvasRef.nativeElement.setPointerCapture?.(e.pointerId);
      }


      if (hit) {
        // Clear hover immediately — hovering and dragging are mutually exclusive.
        // Without this the hover outline draws the shape at its original position
        // throughout the drag, creating a visible ghost.
        this.setHovered(null);

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

private onPointerMove = (e: PointerEvent) => {
  // ── Calibration live pointer tracking ─────────────────────────────────────
  if (this.calibMode === 'pick1' || this.calibMode === 'pick2') {
    const { world } = this.getWorldFromEvent(e);
    this._calibLiveX = world.xPx;
    this._calibLiveY = world.yPx;
    if (this.calibMode === 'pick2' && this.calibPoint1) {
      const dx = world.xPx - this.calibPoint1.x;
      const dy = world.yPx - this.calibPoint1.y;
      this.calibPixelDist = Math.sqrt(dx * dx + dy * dy);
    }
    this.invalidate();
    return;
  }

  // ── Crop mode intercept ────────────────────────────────────────────────────
  if (this.cropController.isActive && this.cropController.liveRect) {
    const { world } = this.getWorldFromEvent(e);
    this.cropController.pointerMove(world.xPx, world.yPx);
    this.invalidate();
    return;
  }

  if (this.panZoom.pointerMove(e)) {
    const { sx, sy } = this.getScreenFromEvent(e);
    this.setPointer(sx, sy);   // keep crosshair consistent while panning
    this.invalidate();
    return;
  }

  const { sx, sy, world } = this.getWorldFromEvent(e);
  const pointerChanged = this.setPointer(sx, sy);

  // If dragging, keep your existing drag logic
  if (this.interaction.activeInteraction) {
    const pm = this.interaction.pointerMove({ sx, sy, clientX: e.clientX, clientY: e.clientY });

    if (pm.kind === 'drag-select') {
      if (!pm.isPastThreshold) {
        if (pointerChanged) this.invalidate(); // crosshair still moves
        return;
      }

      this.interaction.markDidDrag();
      this.marquee.updatePreview(this.shapes, world.xPx, world.yPx);
      this.invalidate();
      return;
    }

    if (pm.kind === 'drag-shape') {
      if (!pm.isPastThreshold) {
        if (pointerChanged) this.invalidate();
        return;
      }

      this.interaction.markDidDrag();

      const drag = this.interaction.activeInteraction;
      if (drag?.type !== 'drag-shape') return;

      const raw = this.transformController.computeDragDelta(drag, world.xPx, world.yPx);
      const targets = this.selectionController.getDragTargets(drag.original);

      // Apply snapping to the raw delta before preview.
      const snapOpts: SnapOptions = {
        snapEnabled:  this.snapEnabled,
        snapToGrid:   true,
        snapToEdges:  true,
        snapThresholdPx: 8,
        gridSpacingMm:   5,
      };
      const snapped = this.snapController.snapDelta(
        targets, this.shapes,
        raw.dx.toUnit('px'), raw.dy.toUnit('px'),
        this.viewport.getScale(), snapOpts
      );
      this._snapGuides = snapped.guides;

      // Override the transform controller's stored delta with the snapped value
      // so that pointerUp commits the same delta.
      this.transformController.lastDx = Measurement.fromPx(snapped.dx);
      this.transformController.lastDy = Measurement.fromPx(snapped.dy);

      const preview = this.transformController.previewTranslate(
        this.shapes, targets,
        Measurement.fromPx(snapped.dx), Measurement.fromPx(snapped.dy)
      );
      this.invalidate(preview);
      return;
    }

    // If some future interaction kind appears
    if (pointerChanged) this.invalidate();
    return;
  }

  // Not dragging: update hover here (replaces mousemove handler)
  const hit = this.hitTest.hitTestTopmost(this.shapes, world.xPx, world.yPx);
  const hoverChanged = this.setHovered(hit);

  if (pointerChanged || hoverChanged) this.invalidate();
};


  private onPointerUp = (e: PointerEvent) => {
    // ── Crop mode: end drag ──────────────────────────────────────────────────
    if (this.cropController.isActive) {
      this.cropController.pointerUp();
      this.invalidate();
      return;
    }

    // Clear snap guides whenever a drag ends.
    this._snapGuides = [];

    // Always finalize interaction/preview state first
    this.finalizePointerInteraction(e.pointerId);

    // Then end panning (if it was happening)
    this.panZoom.pointerUp(e);
  };


  private onClick = (e: MouseEvent) => {
    if (this.interaction.clickShouldBeSuppressed()) return;
    if (this.panZoom.getIsPanning()) return;

    const { world } = this.getWorldFromEvent(e);
    const found = this.hitTest.hitTestTopmost(this.shapes, world.xPx, world.yPx);

    if (!found) {
      this.executeCommand(
        new ClickOnEmptyCommand(
          () => this.shapes,
          this.selectionController,
          e.shiftKey
        )
      );
      this.invalidate();
      return;
    }

    const changed = this.executeCommand(
      new ClickOnShapeCommand(
        () => this.shapes,
        this.selectionController,
        found,
        e.shiftKey
      )
    );
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
      // Suppress selection decorations while in crop mode
      selectedIndices: this.cropController.isActive ? [] : selectedIndices,
      groupBoundingBox: this.cropController.isActive ? null : groupBoundingBox,
      hoveredShape: this.cropController.isActive ? null : this.hoveredShape,
      pointerScreen:
        this._pointerScreenX != null && this._pointerScreenY != null
          ? { sx: this._pointerScreenX, sy: this._pointerScreenY }
          : null,
      showGrid: this.showGrid,
      showBoundingBoxes: this.showBoundingBoxes,
      dragSelectRect: this.marquee.getDragRect(),
      snapGuides: this._snapGuides,
    });

    // Draw crop overlay on top of everything else
    if (this.cropController.isActive) {
      this.drawCropOverlay(ctx);
    }

    // Draw tiling grid overlay
    if (this.tilingActive && this.tilingLayout) {
      this.drawTilingOverlay(ctx);
    }

    // Draw calibration overlay
    if (this.calibMode !== 'idle') {
      this.drawCalibrationOverlay(ctx);
    }
  }

  private finalizePointerInteraction(pointerId?: number) {
    // Release capture if we still have it
    const canvas = this.canvasRef.nativeElement;
    if (pointerId != null && canvas.hasPointerCapture?.(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }

    let shouldClearPreview = false;

    // Commit drag-select if active
    if (this.interaction.activeInteraction?.type === 'drag-select') {
      this.executeCommand(
        new CommitMarqueeSelectionCommand(
          () => this.shapes,
          this.selectionController,
          this.marquee
        )
      );

      shouldClearPreview = true;
    }

    // Commit drag-shape if active
    if (this.interaction.activeInteraction?.type === 'drag-shape') {
      const drag = this.interaction.activeInteraction;
      const targets = this.selectionController.getDragTargets(drag.original);

      this.executeCommand(
        new CommitTranslateCommand(
          () => this.shapes,
          next => (this.shapes = next),
          this.selectionController,
          this.transformController,
          targets
        )
      );

      shouldClearPreview = true;
    }

    // Clear interaction state
    if (pointerId != null) {
      this.interaction.pointerUp({ pointerId });
    } else {
      // If we don't know pointerId (rare), still force-clear state defensively.
      this.interaction.activeInteraction = null;
    }

    // Pan/zoom cleanup (safe to call)
    // (We don't have a pointerId API on panZoom; pointerUp takes the event in your current code.)
    // We'll keep panZoom cleanup in the caller where we have the event.

    // Recompute hover based on last pointer position
    this.updateHoverFromPointer();

    if (shouldClearPreview) this.clearPreview();
    this.invalidate();
  }

  private onPointerCancel = (e: PointerEvent) => {
    // Treat cancel as “pointer up, but without trusting anything about drag intent”
    this.finalizePointerInteraction(e.pointerId);
    this.panZoom.pointerUp(e);
  };

  private onLostPointerCapture = (e: PointerEvent) => {
    // If capture is lost unexpectedly, we still want to finalize state.
    this.finalizePointerInteraction(e.pointerId);
    // No panZoom call needed here, but harmless if you want symmetry:
    this.panZoom.pointerUp(e);
  };


  private clearPointer(): boolean {
    if (this._pointerScreenX == null && this._pointerScreenY == null) return false;
    this._pointerScreenX = null;
    this._pointerScreenY = null;
    return true;
  }
  private onPointerLeave = (_e: PointerEvent) => {
    const pointerChanged = this.clearPointer();
    this._updateStatusCoords(null, null);
    const hoverChanged = this.setHovered(null);
    if (pointerChanged || hoverChanged) this.invalidate();
  };

  private onPointerEnter = (e: PointerEvent) => {
    const { sx, sy, world } = this.getWorldFromEvent(e);
    const pointerChanged = this.setPointer(sx, sy);
    const hit = this.hitTest.hitTestTopmost(this.shapes, world.xPx, world.yPx);
    const hoverChanged = this.setHovered(hit);
    if (pointerChanged || hoverChanged) this.invalidate();
  };

  private executeCommand(cmd: CanvasCommand): boolean {
    const changed = isUndoable(cmd) ? this.undoStack.execute(cmd) : cmd.execute();
    if (changed) {
      this._scheduleAutosave();
      this.recomputeTilingLayout();
    }
    return changed;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // Ignore if focus is in a text input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const mod = isMac ? e.metaKey : e.ctrlKey;

    // ── Modifier key combos ──────────────────────────────────────────────────
    if (mod) {
      // Fit to view: Cmd+0 / Ctrl+0
      if (e.key === '0') {
        e.preventDefault();
        this.fitToView();
        return;
      }
      // Undo: Cmd+Z / Ctrl+Z
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (this.undoStack.undo()) { this.recomputeTilingLayout(); this.forceRender(); this._scheduleAutosave(); }
        return;
      }
      // Redo: Cmd+Shift+Z (Mac) / Ctrl+Y (Windows)
      if ((e.key === 'z' && e.shiftKey) || (!isMac && e.key === 'y')) {
        e.preventDefault();
        if (this.undoStack.redo()) { this.recomputeTilingLayout(); this.forceRender(); this._scheduleAutosave(); }
        return;
      }
      // Save: Cmd+S / Ctrl+S
      if (e.key === 's') {
        e.preventDefault();
        this.saveProject();
        return;
      }
      // Select all: Cmd+A / Ctrl+A
      if (e.key === 'a') {
        e.preventDefault();
        this.selectionController.replaceSelection([...this.shapes]);
        this.selectionController.syncIndices(this.shapes);
        this.invalidate();
        return;
      }
      return; // unrecognised mod combo — don't fall through
    }

    // ── Plain keys ───────────────────────────────────────────────────────────

    // Calibration mode: Escape = cancel
    if (this.calibMode !== 'idle') {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelCalibration();
      }
      return; // swallow other keys while calibrating
    }

    // Crop mode: Enter = commit, Escape = cancel
    if (this.cropController.isActive) {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.commitCrop();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.cropController.exit();
        this.forceRender();
        return;
      }
      return; // swallow other keys while in crop mode
    }

    // F → fit to view
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      this.fitToView();
      return;
    }

    // C → enter crop mode (if a single image is selected)
    if (e.key === 'c' || e.key === 'C') {
      if (this.canCrop()) {
        e.preventDefault();
        this.onCropClick();
      }
      return;
    }

    // ? → toggle keyboard shortcuts overlay
    if (e.key === '?') {
      e.preventDefault();
      this.showShortcuts = !this.showShortcuts;
      return;
    }

    // Escape → close any open overlay/menu, then deselect all
    if (e.key === 'Escape') {
      if (this.showFileMenu)  { this.showFileMenu  = false; return; }
      if (this.showShortcuts) { this.showShortcuts = false; return; }
      if (this.showPreferences) { this.cancelPreferences(); return; }

      const changed = this.selectionController.pointerDownOnEmpty(false);
      if (changed) {
        this.selectionController.syncIndices(this.shapes);
        this.invalidate();
      }
      return;
    }

    // Delete / Backspace → remove selected shapes (undoable)
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const changed = this.executeCommand(new DeleteCommand(
        () => this.shapes,
        next => (this.shapes = next),
        this.selectionController
      ));
      if (changed) this.forceRender();
      return;
    }

    // Arrow keys → nudge selected shapes (undoable)
    // Plain arrow = 1px world space, Shift+arrow = 10px
    const nudgePx = e.shiftKey ? 10 : 1;
    let dx = 0, dy = 0;
    switch (e.key) {
      case 'ArrowLeft':  dx = -nudgePx; break;
      case 'ArrowRight': dx =  nudgePx; break;
      case 'ArrowUp':    dy = -nudgePx; break;
      case 'ArrowDown':  dy =  nudgePx; break;
      default: return;
    }
    e.preventDefault();
    const changed = this.executeCommand(new NudgeCommand(
      () => this.shapes,
      next => (this.shapes = next),
      this.selectionController,
      Measurement.fromPx(dx),
      Measurement.fromPx(dy)
    ));
    if (changed) this.forceRender();
  };



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
    this._updateStatusCoords(sx, sy);
    return true;
  }

  /** Convert screen coords to world-unit coords and push to the status bar. */
  private _updateStatusCoords(sx: number | null, sy: number | null): void {
    if (sx === null || sy === null) {
      this.statusMouseX = null;
      this.statusMouseY = null;
      return;
    }
    const world = this.viewport.screenToWorld(sx, sy);
    const pxPerIn = this.tilingSettings.calibrationPxPerIn;
    if (pxPerIn && pxPerIn !== 96) {
      // Calibrated — show inches, rounded to 3 decimal places
      this.statusMouseX    = world.xPx / pxPerIn;
      this.statusMouseY    = world.yPx / pxPerIn;
      this.statusUnitLabel = 'in';
    } else {
      this.statusMouseX    = world.xPx;
      this.statusMouseY    = world.yPx;
      this.statusUnitLabel = 'px';
    }
  }

  /** Derive a short context-hint string from current interaction state. */
  private _updateContextHint(): void {
    if (this.calibMode !== 'idle') {
      const map = { pick1: 'Calibrate — click first point', pick2: 'Calibrate — click second point', confirm: 'Calibrate — enter real-world distance' };
      this.statusContextHint = map[this.calibMode];
    } else if (this.cropController.isActive) {
      this.statusContextHint = 'Crop — drag handles · Enter to apply · Esc to cancel';
    } else if (this.interaction.activeInteraction?.type === 'drag-shape') {
      this.statusContextHint = 'Moving';
    } else if (this.interaction.activeInteraction?.type === 'drag-select') {
      this.statusContextHint = 'Selecting';
    } else {
      const sel = this.selectionController.getSelectedShapes();
      if (sel.length === 1) {
        this.statusContextHint = '1 shape selected';
      } else if (sel.length > 1) {
        this.statusContextHint = `${sel.length} shapes selected`;
      } else {
        this.statusContextHint = '';
      }
    }
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
      this._updateContextHint();
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

  // ── Crop tool ────────────────────────────────────────────────────────────────

  /** True when exactly one ImageShape is selected — enables the Crop button/shortcut. */
  canCrop(): boolean {
    const sel = this.selectionController.getSelectedShapes();
    return sel.length === 1 && sel[0] instanceof ImageShape;
  }

  onCropClick(): void {
    if (this.cropController.isActive) {
      // Second click on Crop button while active = commit
      this.commitCrop();
      return;
    }
    const sel = this.selectionController.getSelectedShapes();
    if (sel.length !== 1 || !(sel[0] instanceof ImageShape)) return;
    this.cropController.enter(sel[0] as ImageShape);
    this.forceRender();
  }

  private commitCrop(): void {
    if (!this.cropController.isActive || !this.cropController.target) return;
    const newCrop = this.cropController.getLiveCrop();
    const target  = this.cropController.target;
    this.cropController.exit();
    const changed = this.executeCommand(new CropImageCommand(
      () => this.shapes,
      next => (this.shapes = next),
      this.selectionController,
      target,
      newCrop
    ));
    if (changed) this.forceRender();
  }

  /**
   * Renders the crop editing overlay:
   *   1. Full image behind the dark mask (so masked-out areas are visible but dimmed)
   *   2. Semi-transparent dark mask on the 4 strips outside the crop rect
   *   3. Bright crop-rect border with rule-of-thirds guide
   *   4. Eight resize handles
   *   5. Small "Enter=Apply  Esc=Cancel" hint
   */
  private drawCropOverlay(ctx: CanvasRenderingContext2D): void {
    const cc = this.cropController;
    if (!cc.target) return;

    const full = cc.getFullImageWorldRect();
    const crop = cc.getLiveCropWorldRect();
    const img  = cc.target.image;
    const scale = this.viewport.getScale();

    ctx.save();

    // 1. Full image at reduced alpha so user can see the masked regions
    ctx.globalAlpha = 0.35;
    ctx.drawImage(img, full.x, full.y, full.w, full.h);
    ctx.globalAlpha = 1;

    // 2. Dark mask on the four strips surrounding the crop rect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    // top strip
    if (crop.y > full.y)
      ctx.fillRect(full.x, full.y, full.w, crop.y - full.y);
    // bottom strip
    const btmStart = crop.y + crop.h;
    if (btmStart < full.y + full.h)
      ctx.fillRect(full.x, btmStart, full.w, full.y + full.h - btmStart);
    // left strip (between top and bottom strips)
    if (crop.x > full.x)
      ctx.fillRect(full.x, crop.y, crop.x - full.x, crop.h);
    // right strip
    const rtStart = crop.x + crop.w;
    if (rtStart < full.x + full.w)
      ctx.fillRect(rtStart, crop.y, full.x + full.w - rtStart, crop.h);

    // 3. Re-draw the cropped area of the image at full brightness
    ctx.drawImage(img, cc.liveRect!.sx, cc.liveRect!.sy, cc.liveRect!.sw, cc.liveRect!.sh,
                  crop.x, crop.y, crop.w, crop.h);

    // 4. Crop rect border
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth   = 1.5 / scale;
    ctx.setLineDash([]);
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);

    // 5. Rule-of-thirds guide lines (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth   = 0.75 / scale;
    for (let i = 1; i <= 2; i++) {
      const tx = crop.x + crop.w * i / 3;
      const ty = crop.y + crop.h * i / 3;
      ctx.beginPath(); ctx.moveTo(tx, crop.y); ctx.lineTo(tx, crop.y + crop.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(crop.x, ty); ctx.lineTo(crop.x + crop.w, ty); ctx.stroke();
    }

    // 6. Eight resize handles
    const handleR = 5 / scale;
    ctx.fillStyle   = '#fff';
    ctx.strokeStyle = '#333';
    ctx.lineWidth   = 1 / scale;
    ctx.setLineDash([]);
    for (const h of cc.getHandles()) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, handleR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 7. Hint text in screen space (not affected by world transform)
    ctx.restore();
    ctx.save();
    const canvas = this.canvasRef.nativeElement;
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.font         = '12px system-ui, sans-serif';
    ctx.fillStyle    = 'rgba(0,0,0,0.65)';
    ctx.fillRect(8, canvas.clientHeight - 30, 230, 22);
    ctx.fillStyle    = '#fff';
    ctx.fillText('Enter = Apply   Esc = Cancel   drag handles to resize', 14, canvas.clientHeight - 14);
    ctx.restore();
  }

  // ── Fit to view ─────────────────────────────────────────────────────────────

  /**
   * Fit the viewport to show all shapes (or just the selection if anything is
   * selected). Press F or Cmd+0 / Ctrl+0, or click the Fit toolbar button.
   */
  fitToView(): void {
    const selected = this.selectionController.getSelectedShapes();
    const targets = selected.length ? selected : this.shapes;
    if (!targets.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of targets) {
      try {
        const bb = (s as any).getBoundingBox?.();
        if (!bb) continue;
        const x = bb.topLeft.x.toUnit('px');
        const y = bb.topLeft.y.toUnit('px');
        const w = bb.width.toUnit('px');
        const h = bb.height.toUnit('px');
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
      } catch { /* shape has no bbox — skip */ }
    }

    if (!isFinite(minX) || !isFinite(minY)) return;

    const canvas = this.canvasRef.nativeElement;
    this.viewport.fitToRect(minX, minY, maxX, maxY, canvas.clientWidth, canvas.clientHeight);
    this.forceRender();
  }

  // ── Debug shapes ────────────────────────────────────────────────────────────

  // ── Image import ────────────────────────────────────────────────────────────

  /** Toolbar button click: open the file picker. */
  onImportClick(): void {
    this.fileInputRef.nativeElement.click();
  }

  /** <input type="file"> change event. */
  onFileInputChange = async (e: Event): Promise<void> => {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter(f => f.type.startsWith('image/'));
    input.value = ''; // reset so the same file can be re-picked
    const shapes = await this.loadFiles(files);
    if (shapes.length) this.addImportedShapes(shapes);
  };

  /** Drag-over: signal that drops are accepted. */
  onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }

  /** Drop: import all image files in the drop payload. */
  onDrop = async (e: DragEvent): Promise<void> => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files ?? [])
      .filter(f => f.type.startsWith('image/'));
    const shapes = await this.loadFiles(files);
    if (shapes.length) this.addImportedShapes(shapes);
  };

  /** Paste (Cmd+V / Ctrl+V): import image from clipboard. */
  private onPaste = async (e: ClipboardEvent): Promise<void> => {
    const tag = (document.activeElement as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const items = Array.from(e.clipboardData?.items ?? [])
      .filter(item => item.type.startsWith('image/'));
    if (!items.length) return;

    e.preventDefault();
    const files = items
      .map(item => item.getAsFile())
      .filter((f): f is File => f !== null);
    const shapes = await this.loadFiles(files);
    if (shapes.length) this.addImportedShapes(shapes);
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async loadFiles(files: File[]): Promise<ImageShape[]> {
    const results = await Promise.all(files.map(f => this.loadImageFromFile(f)));
    return results.filter((s): s is ImageShape => s !== null);
  }

  private async loadImageFromFile(file: File): Promise<ImageShape | null> {
    try {
      const src = await this.fileToDataUrl(file);
      const img = await this.loadImageEl(src);
      return this.makeImageShape(img, src);
    } catch (err: any) {
      this.notifications.error(`Failed to load image: ${file.name}`, err?.message ?? String(err));
      return null;
    }
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target!.result as string);
      reader.onerror = () => reject(new Error(`FileReader failed for ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  private loadImageEl(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = src;
    });
  }

  /**
   * Create an ImageShape centered in the current viewport at natural pixel size.
   * The image element is shared (immutable pixels); only geometry differs per copy.
   */
  private makeImageShape(img: HTMLImageElement, src: string): ImageShape {
    const canvas = this.canvasRef.nativeElement;
    const cx = canvas.clientWidth  / 2;
    const cy = canvas.clientHeight / 2;
    const center = this.viewport.screenToWorld(cx, cy);

    const topLeft = new Point(
      Measurement.fromPx(center.xPx - img.naturalWidth  / 2),
      Measurement.fromPx(center.yPx - img.naturalHeight / 2)
    );

    return new ImageShape(
      img,
      src,
      topLeft,
      Measurement.fromPx(img.naturalWidth),
      Measurement.fromPx(img.naturalHeight)
    );
  }

  /** Execute the AddShapesCommand and redraw. */
  private addImportedShapes(shapes: ImageShape[]): void {
    const changed = this.executeCommand(new AddShapesCommand(
      () => this.shapes,
      next => (this.shapes = next),
      this.selectionController,
      shapes
    ));
    if (changed) this.forceRender();
  }

  // ── Calibration ──────────────────────────────────────────────────────────────

  /** Start calibration: toggle between idle and pick1. */
  onCalibrateClick(): void {
    if (this.calibMode !== 'idle') {
      this.cancelCalibration();
    } else {
      this.calibMode   = 'pick1';
      this.calibPoint1 = null;
      this.calibPoint2 = null;
      this.calibPixelDist = 0;
    }
  }

  cancelCalibration(): void {
    this.calibMode   = 'idle';
    this.calibPoint1 = null;
    this.calibPoint2 = null;
    this.calibPixelDist = 0;
    this.invalidate();
  }

  applyCalibration(): void {
    if (!this.calibPoint1 || !this.calibPoint2 || this.calibPixelDist <= 0) return;

    const knownIn = this.calibUnit === 'mm'
      ? this.calibKnownDistance / 25.4
      : this.calibKnownDistance;

    if (knownIn <= 0) return;

    this.tilingSettings = {
      ...this.tilingSettings,
      calibrationPxPerIn: this.calibPixelDist / knownIn,
    };

    this.calibMode = 'idle';
    this.recomputeTilingLayout();
    this.invalidate();
    this._scheduleAutosave();
  }

  // ── Preferences modal ──────────────────────────────────────────────────────

  openPreferences(): void {
    this.prefsDraft    = { ...this.appPreferences };
    this.showPreferences = true;
  }

  cancelPreferences(): void {
    this.showPreferences = false;
  }

  savePreferences(): void {
    this.appPreferences  = { ...this.prefsDraft };
    this.showPreferences = false;
    this.persistence.savePreferences(this.appPreferences).catch((err: any) =>
      this.notifications.warn('Could not save preferences', err?.message ?? String(err))
    );
  }

  /** Build default TilingSettings seeded from current appPreferences. */
  private _defaultTilingSettings(): TilingSettings {
    return {
      ...DEFAULT_TILING_SETTINGS,
      paperSizeId: this.appPreferences.defaultPaperSizeId,
      outputDpi:   this.appPreferences.defaultDpi,
      overlapIn:   this.appPreferences.defaultOverlapIn,
      marginIn:    this.appPreferences.defaultMarginIn,
    };
  }

  resetCalibration(): void {
    this.tilingSettings = {
      ...this.tilingSettings,
      calibrationPxPerIn: SCREEN_DPI,
    };
    this.recomputeTilingLayout();
    this.invalidate();
    this._scheduleAutosave();
  }

  isCalibrated(): boolean {
    return Math.abs(this.tilingSettings.calibrationPxPerIn - SCREEN_DPI) > 0.001;
  }

  /** Short human-readable summary of the current calibration factor. */
  calibSummary(): string {
    const ppi = this.tilingSettings.calibrationPxPerIn;
    const inchesPerPx = 1 / ppi;
    // Show as "X px = 1 in" for low-DPI (large prints) or "1 in = X px" for high
    if (ppi < 200) {
      return `${ppi.toFixed(1)} px/in`;
    }
    return `${ppi.toFixed(0)} px/in`;
  }

  // ── Tab management ──────────────────────────────────────────────────────────

  /** Build a fresh empty TabSnapshot using current component defaults. */
  private _buildSnapshot(id: number, name: string): TabSnapshot {
    return {
      id, name, editing: false,
      shapes:          [],
      viewportScale:   this.viewport.getScale(),
      viewportOffsetX: this.viewport.getOffsetX(),
      viewportOffsetY: this.viewport.getOffsetY(),
      tilingActive:    false,
      tilingSettings:  this._defaultTilingSettings(),
      calibMode:           'idle',
      calibPoint1:         null,
      calibPoint2:         null,
      calibPixelDist:      0,
      calibKnownDistance:  6,
      calibUnit:           'in',
      undoStack:           new CanvasUndoStack(),
    };
  }

  /** Copy live component state into the active tab's snapshot. */
  private _snapshotCurrentTab(): void {
    const snap = this.tabs[this.activeTabIndex];
    snap.shapes        = [...this.shapes];
    snap.viewportScale   = this.viewport.getScale();
    snap.viewportOffsetX = this.viewport.getOffsetX();
    snap.viewportOffsetY = this.viewport.getOffsetY();
    snap.tilingActive   = this.tilingActive;
    snap.tilingSettings = { ...this.tilingSettings };
    snap.calibMode          = this.calibMode;
    snap.calibPoint1        = this.calibPoint1 ? { ...this.calibPoint1 } : null;
    snap.calibPoint2        = this.calibPoint2 ? { ...this.calibPoint2 } : null;
    snap.calibPixelDist     = this.calibPixelDist;
    snap.calibKnownDistance = this.calibKnownDistance;
    snap.calibUnit          = this.calibUnit;
    snap.undoStack          = this.undoStack;
  }

  /** Restore component state from a snapshot. */
  private _restoreTab(snap: TabSnapshot): void {
    // Exit any active modal modes before restoring.
    if (this.cropController.isActive) this.cropController.exit();

    this.shapes = [...snap.shapes];
    this.viewport.setScale(snap.viewportScale);
    this.viewport.setOffset(snap.viewportOffsetX, snap.viewportOffsetY);

    this.tilingActive   = snap.tilingActive;
    this.tilingSettings = { ...snap.tilingSettings };

    this.calibMode          = snap.calibMode;
    this.calibPoint1        = snap.calibPoint1 ? { ...snap.calibPoint1 } : null;
    this.calibPoint2        = snap.calibPoint2 ? { ...snap.calibPoint2 } : null;
    this.calibPixelDist     = snap.calibPixelDist;
    this.calibKnownDistance = snap.calibKnownDistance;
    this.calibUnit          = snap.calibUnit;

    this.undoStack = snap.undoStack;

    this.selectionController.replaceSelection([]);
    this.selectionController.syncIndices(this.shapes);
    this.recomputeTilingLayout();
  }

  switchTab(index: number): void {
    if (index === this.activeTabIndex) return;
    this._snapshotCurrentTab();
    this.activeTabIndex = index;
    this._restoreTab(this.tabs[index]);
    this.forceRender();
    this._scheduleAutosave();
  }

  addTab(): void {
    if (this.tabs.length >= 1000) return;
    this._snapshotCurrentTab();
    const id   = ++this._nextTabId;
    const snap = this._buildSnapshot(id, `Canvas ${id}`);
    this.tabs.push(snap);
    this.activeTabIndex = this.tabs.length - 1;
    this._restoreTab(snap);
    this.forceRender();
    this._scheduleAutosave();
  }

  closeTab(index: number, e: MouseEvent): void {
    e.stopPropagation();
    if (this.tabs.length <= 1) return;
    this.tabs.splice(index, 1);
    // Adjust active index: clamp to last, and if we removed the active tab restore the new one.
    const newActive = Math.min(this.activeTabIndex, this.tabs.length - 1);
    if (index === this.activeTabIndex) {
      this.activeTabIndex = newActive;
      this._restoreTab(this.tabs[newActive]);
      this.forceRender();
    } else if (index < this.activeTabIndex) {
      this.activeTabIndex--;
    }
    this._scheduleAutosave();
  }

  startRename(index: number, e: MouseEvent): void {
    e.stopPropagation();
    this.tabs[index].editing = true;
  }

  finishRename(index: number, e: Event): void {
    const input = e.target as HTMLInputElement;
    const name  = input.value.trim();
    this.tabs[index].name    = name || this.tabs[index].name;
    this.tabs[index].editing = false;
    this._scheduleAutosave();
  }

  cancelRename(index: number): void {
    this.tabs[index].editing = false;
  }

  // ── Tiling ──────────────────────────────────────────────────────────────────

  /**
   * Called from template bindings (ngModelChange, button clicks) to trigger
   * a layout recompute + redraw without going through Angular CD.
   */
  invalidateFromTemplate(): void {
    this.recomputeTilingLayout();
    this.invalidate();
    this._scheduleAutosave();
  }

  private recomputeTilingLayout(): void {
    if (!this.tilingActive || !this.shapes.length) {
      this.tilingLayout = null;
      return;
    }
    const bounds = this.getContentBounds();
    if (!bounds) { this.tilingLayout = null; return; }
    this.tilingLayout = computeTilingLayout(bounds, this.tilingSettings);
  }

  /** Bounding box of all shapes in world-px (same logic as fitToView). */
  private getContentBounds(): { x: number; y: number; w: number; h: number } | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of this.shapes) {
      try {
        const bb = (s as any).getBoundingBox?.();
        if (!bb) continue;
        const x = bb.topLeft.x.toUnit('px');
        const y = bb.topLeft.y.toUnit('px');
        const w = bb.width.toUnit('px');
        const h = bb.height.toUnit('px');
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
      } catch { /* skip */ }
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  async exportPdf(): Promise<void> {
    this.recomputeTilingLayout();
    if (!this.tilingLayout) return;
    try {
      await this.pdfExporter.export(
        this.shapes, this.tilingLayout, this.tilingSettings
      );
      this.notifications.success(
        `PDF exported — ${this.tilingLayout.totalPages} page${this.tilingLayout.totalPages !== 1 ? 's' : ''}`
      );
    } catch (err: any) {
      this.notifications.error('PDF export failed', err?.message ?? String(err));
    }
  }

  // ── Calibration overlay rendering ────────────────────────────────────────

  /**
   * Draws the calibration UI onto the canvas:
   * - pick1: crosshair at live pointer
   * - pick2: point-1 marker + live line to pointer + crosshair at pointer
   * - confirm: fixed line between the two points with endpoint markers
   */
  private drawCalibrationOverlay(ctx: CanvasRenderingContext2D): void {
    const scale = this.viewport.getScale();

    const drawMarker = (x: number, y: number) => {
      const r   = 6  / scale;
      const arm = 12 / scale;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y);
      ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm);
      ctx.stroke();
    };

    ctx.save();
    ctx.strokeStyle = '#e06000';
    ctx.lineWidth   = 1.5 / scale;
    ctx.setLineDash([]);

    if (this.calibMode === 'pick1') {
      drawMarker(this._calibLiveX, this._calibLiveY);
    }

    if (this.calibMode === 'pick2' && this.calibPoint1) {
      // Fixed point-1 marker
      drawMarker(this.calibPoint1.x, this.calibPoint1.y);
      // Live line from point1 to pointer
      ctx.setLineDash([6 / scale, 3 / scale]);
      ctx.beginPath();
      ctx.moveTo(this.calibPoint1.x, this.calibPoint1.y);
      ctx.lineTo(this._calibLiveX,   this._calibLiveY);
      ctx.stroke();
      ctx.setLineDash([]);
      // Live pointer marker
      drawMarker(this._calibLiveX, this._calibLiveY);
    }

    if (this.calibMode === 'confirm' && this.calibPoint1 && this.calibPoint2) {
      // Solid line between the two confirmed points
      ctx.beginPath();
      ctx.moveTo(this.calibPoint1.x, this.calibPoint1.y);
      ctx.lineTo(this.calibPoint2.x, this.calibPoint2.y);
      ctx.stroke();
      drawMarker(this.calibPoint1.x, this.calibPoint1.y);
      drawMarker(this.calibPoint2.x, this.calibPoint2.y);
    }

    ctx.restore();
  }

  // ── Tiling overlay rendering ───────────────────────────────────────────────

  private drawTilingOverlay(ctx: CanvasRenderingContext2D): void {
    const layout = this.tilingLayout;
    if (!layout) return;

    const scale   = this.viewport.getScale();
    const lw      = 1 / scale;

    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        const tile = layout.tiles[row][col];

        // ── Overlap zone: light blue tint ──────────────────────────────────
        if (layout.overlapIn > 0) {
          const op = layout.overlapIn * SCREEN_DPI;
          ctx.fillStyle = 'rgba(100, 160, 255, 0.12)';
          // right overlap strip
          if (col < layout.cols - 1)
            ctx.fillRect(tile.printX + tile.printW - op, tile.printY, op, tile.printH);
          // bottom overlap strip
          if (row < layout.rows - 1)
            ctx.fillRect(tile.printX, tile.printY + tile.printH - op, tile.printW, op);
        }

        // ── Printable area border ──────────────────────────────────────────
        ctx.strokeStyle = '#2255cc';
        ctx.lineWidth   = lw;
        ctx.setLineDash([6 / scale, 3 / scale]);
        ctx.strokeRect(tile.printX, tile.printY, tile.printW, tile.printH);
        ctx.setLineDash([]);

        // ── Page number label ──────────────────────────────────────────────
        const pageNum = row * layout.cols + col + 1;
        const fontSize = Math.max(10, Math.min(24, 18 / scale));
        ctx.font      = `${fontSize}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(34, 85, 204, 0.6)';
        ctx.fillText(
          `${pageNum}/${layout.totalPages}  (${col + 1},${row + 1})`,
          tile.printX + 8 / scale,
          tile.printY + fontSize + 6 / scale
        );

        // ── Registration marks ─────────────────────────────────────────────
        if (this.tilingSettings.registrationMarks && layout.overlapIn > 0) {
          this.drawOverlayRegMark(ctx, tile.printX,               tile.printY,               scale);
          this.drawOverlayRegMark(ctx, tile.printX + tile.printW, tile.printY,               scale);
          this.drawOverlayRegMark(ctx, tile.printX,               tile.printY + tile.printH, scale);
          this.drawOverlayRegMark(ctx, tile.printX + tile.printW, tile.printY + tile.printH, scale);
        }
      }
    }

    // ── Global assembly grid (drawn once across all tiles) ─────────────────
    if (this.tilingSettings.assemblyMarks !== 'none') {
      this.drawOverlayAssemblyGrid(ctx, layout, scale);
    }
  }

  /**
   * Draws a continuous assembly grid spanning the full assembled area.
   *
   * Rectangular: cartesian gridlines (vertical + horizontal) at spacingPx.
   * Diagonal:    two families of true-45° lines at the same spacing.
   * Both:        all four families overlaid.
   *
   * Grid origin is anchored at the top-left of the assembled bounding box.
   */
  private drawOverlayAssemblyGrid(
    ctx:    CanvasRenderingContext2D,
    layout: TilingLayout,
    scale:  number,
  ): void {
    const minX = layout.tiles[0][0].printX;
    const minY = layout.tiles[0][0].printY;
    const maxX = layout.tiles[0][layout.cols - 1].printX + layout.tiles[0][layout.cols - 1].printW;
    const maxY = layout.tiles[layout.rows - 1][0].printY + layout.tiles[layout.rows - 1][0].printH;

    const spacingPx = (this.tilingSettings.assemblySpacingIn ?? 1.5) * SCREEN_DPI;
    const style     = this.tilingSettings.assemblyMarks;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 185, 80, 0.7)';
    ctx.lineWidth   = 1 / scale;
    ctx.setLineDash([]);

    const drawRect = style === 'rectangles' || style === 'both';
    const drawDiag = style === 'diagonals'  || style === 'both';

    // ── Rectangular (cartesian) grid ────────────────────────────────────────
    if (drawRect) {
      for (let x = minX; x <= maxX + 0.5; x += spacingPx) {
        ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke();
      }
      for (let y = minY; y <= maxY + 0.5; y += spacingPx) {
        ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke();
      }
    }

    // ── 45° diagonal grid ───────────────────────────────────────────────────
    // Line equations: y = x + c  (NW→SE)  and  y = -x + c  (NE→SW).
    // Perpendicular spacing s → c-step = s·√2.
    if (drawDiag) {
      const cStep = spacingPx * Math.SQRT2;

      // Family 1: y = x + c  (slopes down-right)
      const c1Anchor = minY - minX;
      const k1Start  = Math.floor((minY - maxX - c1Anchor) / cStep);
      const k1End    = Math.ceil ((maxY - minX - c1Anchor) / cStep);
      for (let k = k1Start; k <= k1End; k++) {
        const c  = c1Anchor + k * cStep;
        const xA = Math.max(minX, minY - c);
        const xB = Math.min(maxX, maxY - c);
        if (xA >= xB) continue;
        ctx.beginPath(); ctx.moveTo(xA, xA + c); ctx.lineTo(xB, xB + c); ctx.stroke();
      }

      // Family 2: y = -x + c  (slopes down-left)
      const c2Anchor = minX + minY;
      const k2End    = Math.ceil((maxX + maxY - c2Anchor) / cStep);
      for (let k = 0; k <= k2End; k++) {
        const c  = c2Anchor + k * cStep;
        const xA = Math.max(minX, c - maxY);
        const xB = Math.min(maxX, c - minY);
        if (xA >= xB) continue;
        ctx.beginPath(); ctx.moveTo(xA, c - xA); ctx.lineTo(xB, c - xB); ctx.stroke();
      }
    }

    ctx.restore();
  }

  private drawOverlayRegMark(
    ctx: CanvasRenderingContext2D, x: number, y: number, scale: number
  ): void {
    const r   = 5  / scale;
    const arm = 9  / scale;
    const lw  = 1  / scale;
    ctx.save();
    ctx.strokeStyle = '#cc3300';
    ctx.lineWidth   = lw;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y);
    ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm);
    ctx.stroke();
    ctx.restore();
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  /** Arrow function so it can be used as a window event listener. */
  private _onBeforeUnload = (): void => {
    this.persistence.flushNow(() => this._buildPersistedState());
  };

  /** Schedule a debounced autosave (~2 s after last call). */
  private _scheduleAutosave(): void {
    this.persistence.scheduleSave(() => this._buildPersistedState());
  }

  /**
   * Build a PersistedState snapshot from live component state.
   * The active tab is built directly from the live fields; other tabs from
   * their stored TabSnapshot (already up-to-date from the last switchTab).
   */
  private _buildPersistedState(): PersistedState {
    const tabs: PersistedTab[] = this.tabs.map((tab, i) => {
      if (i === this.activeTabIndex) {
        return {
          id:   tab.id,
          name: tab.name,
          shapes:          this.persistence.serializeShapes(this.shapes),
          viewportScale:   this.viewport.getScale(),
          viewportOffsetX: this.viewport.getOffsetX(),
          viewportOffsetY: this.viewport.getOffsetY(),
          tilingActive:    this.tilingActive,
          tilingSettings:  { ...this.tilingSettings },
          calibMode:           this.calibMode,
          calibPoint1:         this.calibPoint1 ? { ...this.calibPoint1 } : null,
          calibPoint2:         this.calibPoint2 ? { ...this.calibPoint2 } : null,
          calibPixelDist:      this.calibPixelDist,
          calibKnownDistance:  this.calibKnownDistance,
          calibUnit:           this.calibUnit,
        };
      }
      // Non-active tabs: use the stored snapshot.
      return {
        id:   tab.id,
        name: tab.name,
        shapes:          this.persistence.serializeShapes(tab.shapes),
        viewportScale:   tab.viewportScale,
        viewportOffsetX: tab.viewportOffsetX,
        viewportOffsetY: tab.viewportOffsetY,
        tilingActive:    tab.tilingActive,
        tilingSettings:  { ...tab.tilingSettings },
        calibMode:           tab.calibMode,
        calibPoint1:         tab.calibPoint1 ? { ...tab.calibPoint1 } : null,
        calibPoint2:         tab.calibPoint2 ? { ...tab.calibPoint2 } : null,
        calibPixelDist:      tab.calibPixelDist,
        calibKnownDistance:  tab.calibKnownDistance,
        calibUnit:           tab.calibUnit,
      };
    });

    return {
      version:        1,
      activeTabIndex: this.activeTabIndex,
      nextTabId:      this._nextTabId,
      tabs,
    };
  }

  /**
   * Replace all component state from a PersistedState (load / open-file).
   * Async because ImageShape deserialization loads HTMLImageElements.
   */
  private async _restoreFromPersistedState(state: PersistedState): Promise<void> {
    const snaps = [];

    for (const pt of state.tabs) {
      const shapes = await this.persistence.deserializeShapes(pt.shapes);
      const snap   = this._buildSnapshot(pt.id, pt.name);
      snap.shapes          = shapes;
      snap.viewportScale   = pt.viewportScale;
      snap.viewportOffsetX = pt.viewportOffsetX;
      snap.viewportOffsetY = pt.viewportOffsetY;
      snap.tilingActive    = pt.tilingActive;
      snap.tilingSettings  = { ...pt.tilingSettings };
      snap.calibMode           = pt.calibMode;
      snap.calibPoint1         = pt.calibPoint1  ? { ...pt.calibPoint1  } : null;
      snap.calibPoint2         = pt.calibPoint2  ? { ...pt.calibPoint2  } : null;
      snap.calibPixelDist      = pt.calibPixelDist;
      snap.calibKnownDistance  = pt.calibKnownDistance;
      snap.calibUnit           = pt.calibUnit;
      snaps.push(snap);
    }

    this.tabs        = snaps;
    this._nextTabId  = state.nextTabId;
    const idx        = Math.min(state.activeTabIndex, snaps.length - 1);
    this.activeTabIndex = idx;
    this._restoreTab(snaps[idx]);
    this.forceRender();
  }

  // ── File save / open (toolbar buttons) ──────────────────────────────────────

  /** Cmd+S / Ctrl+S or Save button. */
  saveProject(): void {
    this.persistence.saveToFile(this._buildPersistedState()).catch((err: any) =>
      this.notifications.error('Save failed', err?.message ?? String(err))
    );
  }

  /** Save As button. */
  saveProjectAs(): void {
    this.persistence.saveAsToFile(this._buildPersistedState()).catch((err: any) =>
      this.notifications.error('Save As failed', err?.message ?? String(err))
    );
  }

  /** Open button. */
  openProject(): void {
    this.persistence.openFromFile().then(state => {
      if (!state) return;  // user cancelled
      return this._restoreFromPersistedState(state);
    }).catch((err: any) =>
      this.notifications.error('Open failed', err?.message ?? String(err))
    );
  }

}
