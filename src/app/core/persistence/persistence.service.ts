/**
 * persistence.service.ts
 *
 * Handles all save/load concerns for the Fullprint app:
 *
 *   • IndexedDB autosave  — debounced, ~2 s after last change.
 *   • File System Access API (Chrome / Edge)  — save, save-as, open with a
 *     native file picker and write-back to the same handle on subsequent saves.
 *   • Blob download / file-input fallback  — for browsers without FSA.
 *
 * The project file extension is .fpp (JSON inside).
 */

import { Injectable, Optional }           from '@angular/core';
import Shape                              from '../geometry/Shape';
import { TilingSettings }                 from '../tiling/tiling-settings';
import { serializeShape, deserializeShape } from '../geometry/shape-serializer';
import { NotificationService }            from '../notifications/notification.service';
import { AppPreferences, DEFAULT_APP_PREFERENCES, PREFS_IDB_KEY } from '../preferences/app-preferences';

// ── Persisted data model ──────────────────────────────────────────────────────

/** Serialised representation of one tab. */
export interface PersistedTab {
  id:              number;
  name:            string;
  shapes:          any[];           // serializeShape() output
  viewportScale:   number;
  viewportOffsetX: number;
  viewportOffsetY: number;
  tilingActive:    boolean;
  tilingSettings:  TilingSettings;
  calibMode:       'idle' | 'pick1' | 'pick2' | 'confirm';
  calibPoint1:     { x: number; y: number } | null;
  calibPoint2:     { x: number; y: number } | null;
  calibPixelDist:      number;
  calibKnownDistance:  number;
  calibUnit:           'in' | 'mm';
}

/** Top-level save file / IndexedDB record. */
export interface PersistedState {
  version:        number;
  activeTabIndex: number;
  nextTabId:      number;
  tabs:           PersistedTab[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DB_NAME    = 'fullprint';
const DB_VERSION = 1;
const STORE_NAME = 'state';
const APP_KEY    = 'app';
const AUTOSAVE_DELAY_MS = 2000;

const FILE_PICKER_TYPES = [{
  description: 'Fullprint Project',
  accept: { 'application/json': ['.fpp'] as `.${string}`[] },
}];

// ── Service ───────────────────────────────────────────────────────────────────

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

@Injectable({ providedIn: 'root' })
export class PersistenceService {

  /** Observable-ish status for the UI. */
  saveStatus: SaveStatus = 'idle';
  lastSaveError: string | null = null;

  /** Retained after a File System Access API save so re-saves go to the same file. */
  private _fileHandle: FileSystemFileHandle | null = null;

  private _autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private _dbReady: Promise<IDBDatabase>;

  constructor(@Optional() private _notifications?: NotificationService) {
    this._dbReady = this._openDB();
  }

  // ── Shape helpers (delegated from component so it doesn't import serializer) ─

  serializeShapes(shapes: Shape[]): any[] {
    return shapes.map(s => serializeShape(s));
  }

  async deserializeShapes(data: any[]): Promise<Shape[]> {
    const results = await Promise.all(
      (data ?? []).map(async (d: any) => {
        try {
          return await deserializeShape(d);
        } catch (err: any) {
          this._notifications?.warn(
            'Could not restore a shape from saved data',
            err?.message ?? String(err)
          );
          return null;
        }
      })
    );
    return results.filter((s): s is Shape => s !== null);
  }

  // ── Autosave (IndexedDB) ──────────────────────────────────────────────────────

  /**
   * Schedule an autosave.  The callback is called after AUTOSAVE_DELAY_MS of
   * inactivity so the state snapshot is as fresh as possible.
   */
  scheduleSave(getState: () => PersistedState): void {
    if (this._autosaveTimer != null) clearTimeout(this._autosaveTimer);
    this._autosaveTimer = setTimeout(() => {
      this._autosaveTimer = null;
      this._flushToIndexedDB(getState()).catch(err =>
        console.error('PersistenceService autosave failed:', err)
      );
    }, AUTOSAVE_DELAY_MS);
  }

  /**
   * Flush immediately — call from beforeunload so the last state is persisted
   * even if the debounce timer hasn't fired yet.
   */
  flushNow(getState: () => PersistedState): void {
    if (this._autosaveTimer != null) {
      clearTimeout(this._autosaveTimer);
      this._autosaveTimer = null;
    }
    // Fire-and-forget; beforeunload can't await.
    this._flushToIndexedDB(getState()).catch(err =>
      console.error('PersistenceService flushNow failed:', err)
    );
  }

  async loadFromIndexedDB(): Promise<PersistedState | null> {
    try {
      return await this._idbGet();
    } catch (err: any) {
      this._notifications?.warn(
        'Could not load autosaved state',
        err?.message ?? String(err)
      );
      return null;
    }
  }

  // ── Preferences (separate IDB key, independent of project state) ─────────────

  async savePreferences(prefs: AppPreferences): Promise<void> {
    const db = await this._dbReady;
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(prefs, PREFS_IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async loadPreferences(): Promise<AppPreferences> {
    try {
      const db = await this._dbReady;
      const result = await new Promise<AppPreferences | null>((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(PREFS_IDB_KEY);
        req.onsuccess = () => resolve((req.result as AppPreferences) ?? null);
        req.onerror   = () => reject(req.error);
      });
      return result ?? { ...DEFAULT_APP_PREFERENCES };
    } catch {
      return { ...DEFAULT_APP_PREFERENCES };
    }
  }

  // ── File System Access API / download fallback ────────────────────────────────

  /** True when the browser supports the File System Access API. */
  hasFSA(): boolean {
    return 'showSaveFilePicker' in window;
  }

  /**
   * Save to the previously opened/saved file handle.
   * If no handle exists (first save) this falls through to saveAsToFile().
   */
  async saveToFile(state: PersistedState): Promise<void> {
    if (!this._fileHandle) {
      return this.saveAsToFile(state);
    }
    await this._writeToHandle(this._fileHandle, state);
  }

  /** Show a native Save As dialog (FSA) or trigger a download (fallback). */
  async saveAsToFile(state: PersistedState): Promise<void> {
    if (this.hasFSA()) {
      let handle: FileSystemFileHandle;
      try {
        handle = await (window as any).showSaveFilePicker({
          suggestedName: 'untitled.fpp',
          types: FILE_PICKER_TYPES,
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') return;   // user cancelled
        throw err;
      }
      this._fileHandle = handle;
      await this._writeToHandle(handle, state);
      this._notifications?.success(`Saved to ${handle.name}`);
    } else {
      this._blobDownload(state, 'fullprint.fpp');
      this._notifications?.success('Project downloaded as fullprint.fpp');
    }
  }

  /**
   * Open a .fpp file.
   * Returns the parsed PersistedState, or null if the user cancelled.
   */
  async openFromFile(): Promise<PersistedState | null> {
    if (this.hasFSA()) {
      let files: FileSystemFileHandle[];
      try {
        files = await (window as any).showOpenFilePicker({
          multiple: false,
          types: FILE_PICKER_TYPES,
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') return null;
        throw err;
      }
      const handle = files[0];
      this._fileHandle = handle;
      const file = await handle.getFile();
      const state = JSON.parse(await file.text()) as PersistedState;
      this._notifications?.success(`Opened ${handle.name}`);
      return state;
    } else {
      return this._fileInputOpen();
    }
  }

  /** Name of the currently open file (FSA only), or null. */
  get currentFileName(): string | null {
    return (this._fileHandle as any)?.name ?? null;
  }

  /** Clear the retained file handle (e.g. after New Project). */
  clearFileHandle(): void {
    this._fileHandle = null;
  }

  // ── IndexedDB internals ───────────────────────────────────────────────────────

  private _openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      req.onsuccess = (e: Event) => resolve((e.target as IDBOpenDBRequest).result);
      req.onerror   = ()         => reject(req.error);
    });
  }

  private async _idbPut(state: PersistedState): Promise<void> {
    const db = await this._dbReady;
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(state, APP_KEY);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  private async _idbGet(): Promise<PersistedState | null> {
    const db = await this._dbReady;
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(APP_KEY);
      req.onsuccess = () => resolve((req.result as PersistedState) ?? null);
      req.onerror   = () => reject(req.error);
    });
  }

  private async _flushToIndexedDB(state: PersistedState): Promise<void> {
    this.saveStatus = 'saving';
    try {
      await this._idbPut(state);
      this.saveStatus    = 'saved';
      this.lastSaveError = null;
    } catch (err: any) {
      this.saveStatus    = 'error';
      this.lastSaveError = err?.message ?? String(err);
      this._notifications?.error('Autosave failed', this.lastSaveError ?? undefined);
      throw err;
    }
  }

  // ── File helpers ──────────────────────────────────────────────────────────────

  private async _writeToHandle(
    handle: FileSystemFileHandle,
    state:  PersistedState,
  ): Promise<void> {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();
  }

  private _blobDownload(state: PersistedState, filename: string): void {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private _fileInputOpen(): Promise<PersistedState | null> {
    return new Promise((resolve, reject) => {
      const input    = document.createElement('input');
      input.type     = 'file';
      input.accept   = '.fpp,application/json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        try {
          resolve(JSON.parse(await file.text()) as PersistedState);
        } catch (err) {
          reject(err);
        }
      };
      input.click();
    });
  }
}
