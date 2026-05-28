/**
 * notification.service.ts
 *
 * Lightweight in-app notification/logging bus.
 *
 * Components push messages here via error() / warn() / info() / success().
 * The StatusBarComponent subscribes to display the unread count badge and
 * render the slide-up log panel.
 *
 * All state lives in memory — messages are gone on page reload (by design).
 */

import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';

export type NotificationLevel = 'error' | 'warn' | 'info' | 'success';

export interface Notification {
  id:        number;
  level:     NotificationLevel;
  message:   string;
  detail?:   string;        // optional secondary line (e.g. error.message)
  timestamp: Date;
  read:      boolean;
}

const MAX_MESSAGES = 100;

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private _idCounter = 0;
  private _messages: Notification[] = [];

  /** Emits the full message list whenever it changes. */
  readonly messages$ = new BehaviorSubject<Notification[]>([]);

  /** Emits the unread count whenever it changes. */
  readonly unreadCount$ = new BehaviorSubject<number>(0);

  // ── Public API ──────────────────────────────────────────────────────────────

  error(message: string, detail?: string): void {
    this._push('error', message, detail);
  }

  warn(message: string, detail?: string): void {
    this._push('warn', message, detail);
  }

  info(message: string, detail?: string): void {
    this._push('info', message, detail);
  }

  success(message: string, detail?: string): void {
    this._push('success', message, detail);
  }

  /** Mark all messages as read (call when the log panel is opened). */
  markAllRead(): void {
    this._messages.forEach(m => m.read = true);
    this.unreadCount$.next(0);
    this.messages$.next([...this._messages]);
  }

  /** Remove all messages. */
  clear(): void {
    this._messages = [];
    this.messages$.next([]);
    this.unreadCount$.next(0);
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private _push(level: NotificationLevel, message: string, detail?: string): void {
    const note: Notification = {
      id:        ++this._idCounter,
      level,
      message,
      detail,
      timestamp: new Date(),
      read:      false,
    };

    this._messages.unshift(note);           // newest first
    if (this._messages.length > MAX_MESSAGES) {
      this._messages.length = MAX_MESSAGES; // drop oldest
    }

    this.messages$.next([...this._messages]);
    this.unreadCount$.next(this._messages.filter(m => !m.read).length);
  }
}
