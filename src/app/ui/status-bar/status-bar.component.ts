/**
 * StatusBarComponent
 *
 * Fixed bar at the bottom of the app. Three zones:
 *
 *   LEFT   — X / Y mouse position in world units (mm if calibrated, otherwise px)
 *   CENTER — context hint string (set by the canvas: idle / crop / drag / etc.)
 *   RIGHT  — zoom % · save status · notification badge
 *
 * The notification badge opens/closes the slide-up log panel.
 * Clicking outside the panel closes it; Escape also closes it.
 */

import {
  Component, Input, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  NotificationService, Notification, NotificationLevel,
} from '../../core/notifications/notification.service';

@Component({
  standalone:   true,
  selector:     'app-status-bar',
  imports:      [CommonModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ── Log panel (slide-up, shown when logOpen) ───────────────────── -->
    <div class="fp-log-panel" *ngIf="logOpen" role="log" aria-live="polite">
      <div class="fp-log-header">
        <span class="fp-log-title">Message Log</span>
        <button class="fp-log-clear" (click)="clearLog()" title="Clear all messages">Clear</button>
        <button class="fp-log-close" (click)="closeLog()" title="Close">&#x2715;</button>
      </div>
      <div class="fp-log-body">
        <div *ngIf="messages.length === 0" class="fp-log-empty">No messages.</div>
        <div *ngFor="let m of messages" class="fp-log-entry fp-log-{{ m.level }}">
          <span class="fp-log-time">{{ m.timestamp | date:'HH:mm:ss' }}</span>
          <span class="fp-log-level">{{ levelLabel(m.level) }}</span>
          <span class="fp-log-msg">{{ m.message }}<span *ngIf="m.detail" class="fp-log-detail"> — {{ m.detail }}</span></span>
        </div>
      </div>
    </div>

    <!-- ── Status bar ────────────────────────────────────────────────────── -->
    <div class="fp-statusbar">

      <!-- Left: mouse coordinates -->
      <div class="fp-sb-left">
        <span class="fp-sb-coord" *ngIf="mouseX !== null && mouseY !== null; else noCoord">
          X&nbsp;{{ mouseX | number:'1.1-1' }}&nbsp;{{ unitLabel }}&nbsp;&nbsp;
          Y&nbsp;{{ mouseY | number:'1.1-1' }}&nbsp;{{ unitLabel }}
        </span>
        <ng-template #noCoord>
          <span class="fp-sb-coord fp-sb-dim">—</span>
        </ng-template>
      </div>

      <!-- Center: context hint -->
      <div class="fp-sb-center">
        <span class="fp-sb-hint" *ngIf="contextHint">{{ contextHint }}</span>
      </div>

      <!-- Right: zoom · save status · notification badge -->
      <div class="fp-sb-right">
        <span class="fp-sb-zoom">{{ zoomPercent | number:'1.0-0' }}%</span>

        <span class="fp-sb-sep"></span>

        <span class="fp-sb-save"
              [class.fp-sb-saving]="saveStatus === 'saving'"
              [class.fp-sb-saved]="saveStatus === 'saved'"
              [class.fp-sb-error]="saveStatus === 'error'"
              *ngIf="saveStatus !== 'idle'">
          <ng-container [ngSwitch]="saveStatus">
            <span *ngSwitchCase="'saving'">&#x23F3;</span>
            <span *ngSwitchCase="'saved'">&#x2713; Saved</span>
            <span *ngSwitchCase="'error'">&#x26A0; Save error</span>
          </ng-container>
        </span>

        <span class="fp-sb-sep" *ngIf="saveStatus !== 'idle'"></span>

        <!-- Notification badge -->
        <button class="fp-sb-badge"
                [class.fp-sb-badge-error]="hasErrors"
                [class.fp-sb-badge-warn]="!hasErrors && hasWarnings"
                [class.fp-sb-badge-open]="logOpen"
                (click)="toggleLog()"
                [title]="unreadCount > 0 ? unreadCount + ' unread message(s)' : 'Message log'">
          <span class="fp-sb-badge-icon">{{ hasErrors ? '&#x26A0;' : hasWarnings ? '&#x26A0;' : '&#x2139;' }}</span>
          <span class="fp-sb-badge-count" *ngIf="unreadCount > 0">{{ unreadCount }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      position: relative;
    }

    /* ── Log panel ─────────────────────────────────────────────────────── */
    .fp-log-panel {
      position: absolute;
      bottom: 100%;
      left: 0; right: 0;
      max-height: 280px;
      display: flex;
      flex-direction: column;
      background: #1e1e1e;
      border-top: 1px solid #444;
      box-shadow: 0 -4px 16px rgba(0,0,0,0.35);
      z-index: 200;
      font-size: 12px;
      font-family: 'SF Mono', 'Consolas', monospace;
    }
    .fp-log-header {
      display: flex;
      align-items: center;
      padding: 5px 10px;
      border-bottom: 1px solid #333;
      gap: 8px;
      flex-shrink: 0;
    }
    .fp-log-title {
      flex: 1;
      color: #ccc;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .fp-log-clear, .fp-log-close {
      background: none;
      border: none;
      cursor: pointer;
      color: #888;
      font-size: 11px;
      padding: 2px 6px;
    }
    .fp-log-clear:hover, .fp-log-close:hover { color: #eee; }
    .fp-log-body {
      overflow-y: auto;
      flex: 1 1 0;
    }
    .fp-log-empty {
      color: #555;
      padding: 12px 12px;
      font-style: italic;
    }
    .fp-log-entry {
      display: grid;
      grid-template-columns: 58px 44px 1fr;
      gap: 6px;
      padding: 3px 10px;
      border-bottom: 1px solid #2a2a2a;
      align-items: baseline;
      line-height: 1.4;
    }
    .fp-log-entry:hover { background: #252525; }
    .fp-log-time  { color: #666; font-size: 11px; }
    .fp-log-level { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .fp-log-msg   { color: #ccc; word-break: break-word; }
    .fp-log-detail { color: #888; }

    .fp-log-error .fp-log-level { color: #f55; }
    .fp-log-warn  .fp-log-level { color: #fa0; }
    .fp-log-info  .fp-log-level { color: #5af; }
    .fp-log-success .fp-log-level { color: #4c4; }
    .fp-log-error .fp-log-msg { color: #fbb; }

    /* ── Status bar ────────────────────────────────────────────────────── */
    .fp-statusbar {
      display: flex;
      align-items: center;
      height: 22px;
      background: #2b2b2b;
      border-top: 1px solid #111;
      color: #bbb;
      font-size: 11px;
      user-select: none;
      padding: 0 8px;
      gap: 0;
    }
    .fp-sb-left {
      flex: 0 0 auto;
      min-width: 180px;
    }
    .fp-sb-center {
      flex: 1 1 0;
      text-align: center;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      padding: 0 8px;
    }
    .fp-sb-right {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .fp-sb-coord { font-family: 'SF Mono', 'Consolas', monospace; color: #9dc; }
    .fp-sb-dim   { color: #555; }
    .fp-sb-hint  { color: #aaa; font-style: italic; }
    .fp-sb-zoom  { color: #999; font-family: 'SF Mono', 'Consolas', monospace; }
    .fp-sb-sep   { width: 1px; height: 12px; background: #444; margin: 0 3px; }

    .fp-sb-save { font-size: 11px; }
    .fp-sb-saving { color: #999; }
    .fp-sb-saved  { color: #6c6; }
    .fp-sb-error  { color: #f66; font-weight: 600; }

    /* Notification badge button */
    .fp-sb-badge {
      display: flex;
      align-items: center;
      gap: 3px;
      background: #383838;
      border: 1px solid #555;
      border-radius: 3px;
      color: #999;
      font-size: 11px;
      cursor: pointer;
      padding: 1px 5px;
      line-height: 1;
      height: 16px;
    }
    .fp-sb-badge:hover { background: #444; color: #ccc; }
    .fp-sb-badge-open  { background: #333; border-color: #666; color: #ccc; }
    .fp-sb-badge-error { color: #f88; border-color: #a44; }
    .fp-sb-badge-warn  { color: #fb8; border-color: #874; }
    .fp-sb-badge-count {
      background: #c44;
      color: #fff;
      border-radius: 8px;
      padding: 0 4px;
      font-size: 10px;
      font-weight: 700;
      min-width: 14px;
      text-align: center;
    }
    .fp-sb-badge-warn .fp-sb-badge-count { background: #a70; }
  `],
})
export class StatusBarComponent implements OnInit, OnDestroy {

  /** World-space X in display units (null when pointer is off-canvas). */
  @Input() mouseX: number | null = null;
  /** World-space Y in display units. */
  @Input() mouseY: number | null = null;
  /** Unit suffix to show next to coordinates. */
  @Input() unitLabel: string = 'px';
  /** Short description of the current canvas mode. */
  @Input() contextHint: string = '';
  /** Viewport zoom as a linear scale (1.0 = 100%). */
  @Input() zoomScale: number = 1;
  /** Save status forwarded from PersistenceService. */
  @Input() saveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';

  messages:    Notification[] = [];
  unreadCount: number = 0;
  logOpen      = false;

  get zoomPercent(): number { return this.zoomScale * 100; }
  get hasErrors():   boolean { return this.messages.some(m => m.level === 'error' && !m.read); }
  get hasWarnings(): boolean { return this.messages.some(m => m.level === 'warn'  && !m.read); }

  private _subs = new Subscription();

  constructor(
    private notifications: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this._subs.add(
      this.notifications.messages$.subscribe(msgs => {
        this.messages = msgs;
        this.cdr.markForCheck();
      })
    );
    this._subs.add(
      this.notifications.unreadCount$.subscribe(n => {
        this.unreadCount = n;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this._subs.unsubscribe();
  }

  toggleLog(): void {
    this.logOpen = !this.logOpen;
    if (this.logOpen) this.notifications.markAllRead();
  }

  closeLog(): void {
    this.logOpen = false;
  }

  clearLog(): void {
    this.notifications.clear();
  }

  levelLabel(level: NotificationLevel): string {
    return level === 'warn' ? 'WARN' : level.toUpperCase();
  }

  /** Close the panel when user clicks outside it. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.logOpen) return;
    const host = (e.target as HTMLElement).closest('app-status-bar');
    if (!host) this.closeLog();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.logOpen) this.closeLog();
  }
}
