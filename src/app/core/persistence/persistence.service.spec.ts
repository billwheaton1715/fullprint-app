/**
 * persistence.service.spec.ts
 *
 * Tests PersistenceService using only Jasmine APIs (no jest.fn / fake timers).
 *
 * Strategy:
 *   • IndexedDB  — minimal in-memory mock installed on global.indexedDB.
 *   • FSA API    — install/remove stubs on window.showSaveFilePicker etc.
 *   • Debounce   — use jasmine.clock() for fake timer control.
 *   • Spies      — jasmine.createSpy() / spyOn().
 */

import { PersistenceService, PersistedState } from './persistence.service';
import { Rectangle }  from '../geometry/Rectangle';
import Measurement    from '../units/Measurement';
import Point          from '../geometry/Point';

// ── IDB property helpers ──────────────────────────────────────────────────────

/** Saved so we can restore the real getter after each test. */
const _origIDBDescriptor = Object.getOwnPropertyDescriptor(window, 'indexedDB');

function setIDB(value: any) {
  Object.defineProperty(window, 'indexedDB', {
    value,
    writable:     true,
    configurable: true,
  });
}

afterEach(() => {
  // Restore the original browser IndexedDB descriptor so tests don't bleed.
  if (_origIDBDescriptor) {
    Object.defineProperty(window, 'indexedDB', _origIDBDescriptor);
  } else {
    // If there was no own descriptor (inherited), just delete the override.
    try { delete (window as any).indexedDB; } catch { /* read-only — leave it */ }
  }
});

// ── Minimal IDB mock ──────────────────────────────────────────────────────────

function installIDBMock() {
  const store = new Map<any, any>();

  function makeReq(result: any) {
    const req: any = { result, error: null, onsuccess: null, onerror: null };
    Promise.resolve().then(() => req.onsuccess?.());
    return req;
  }

  const objectStoreMock = {
    put: (value: any, key: any) => { store.set(key, value); return makeReq(undefined); },
    get: (key: any)             => makeReq(store.get(key)),
  };
  const txMock  = { objectStore: () => objectStoreMock };
  const dbMock  = {
    objectStoreNames: { contains: () => true },
    transaction:      () => txMock,
    createObjectStore: () => {},
  };
  const openReq: any = {
    result: dbMock, error: null,
    onsuccess: null, onupgradeneeded: null, onerror: null,
  };
  Promise.resolve().then(() => openReq.onsuccess?.({ target: openReq }));

  setIDB({ open: () => openReq });
  return { store };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mm(v: number) { return new Measurement(v, 'mm'); }
function ptMm(x: number, y: number) { return new Point(mm(x), mm(y)); }

function stubState(overrides: Partial<PersistedState> = {}): PersistedState {
  return { version: 1, activeTabIndex: 0, nextTabId: 2, tabs: [], ...overrides };
}

// ── Image stub ────────────────────────────────────────────────────────────────

let OriginalImage: typeof Image;
beforeEach(() => {
  OriginalImage = (window as any).Image;
  (window as any).Image = class {
    naturalWidth = 100; naturalHeight = 100;
    onload:  (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) { this.onload?.(); }
  };
});
afterEach(() => {
  (window as any).Image = OriginalImage;
});

// ── serializeShapes / deserializeShapes ───────────────────────────────────────

describe('PersistenceService — shape serialization helpers', () => {

  it('serializeShapes produces an array of plain objects', () => {
    installIDBMock();
    const svc  = new PersistenceService();
    const out  = svc.serializeShapes([new Rectangle(ptMm(0, 0), mm(10), mm(20))]);
    expect(Array.isArray(out)).toBe(true);
    expect(out[0].type).toBe('Rectangle');
  });

  it('deserializeShapes rebuilds shapes', async () => {
    installIDBMock();
    const svc  = new PersistenceService();
    const data = svc.serializeShapes([new Rectangle(ptMm(5, 5), mm(30), mm(15))]);
    const back = await svc.deserializeShapes(data);
    expect(back.length).toBe(1);
    expect(back[0] instanceof Rectangle).toBe(true);
  });

  it('deserializeShapes skips corrupt entries and returns the rest', async () => {
    installIDBMock();
    const svc  = new PersistenceService();
    const good = svc.serializeShapes([new Rectangle(ptMm(0, 0), mm(10), mm(10))])[0];
    const back = await svc.deserializeShapes([good, { type: 'BrokenShape' }]);
    expect(back.length).toBe(1);
    expect(back[0] instanceof Rectangle).toBe(true);
  });

  it('deserializeShapes handles an empty array', async () => {
    installIDBMock();
    const svc  = new PersistenceService();
    const back = await svc.deserializeShapes([]);
    expect(back.length).toBe(0);
  });
});

// ── IndexedDB autosave ────────────────────────────────────────────────────────

describe('PersistenceService — IndexedDB save and load', () => {

  it('loadFromIndexedDB returns null when nothing is stored', async () => {
    installIDBMock();
    const svc = new PersistenceService();
    await new Promise(r => setTimeout(r, 20));
    const result = await svc.loadFromIndexedDB();
    expect(result).toBeNull();
  });

  it('state stored via flushNow is retrievable via loadFromIndexedDB', async () => {
    installIDBMock();
    const svc   = new PersistenceService();
    const state = stubState({ nextTabId: 99 });
    await new Promise(r => setTimeout(r, 20));

    svc.flushNow(() => state);
    await new Promise(r => setTimeout(r, 20));

    const back = await svc.loadFromIndexedDB();
    expect(back).not.toBeNull();
    expect(back!.nextTabId).toBe(99);
  });

  it('loadFromIndexedDB returns null (no throw) when IDB is unavailable', async () => {
    setIDB(undefined);
    const svc    = new PersistenceService();
    const result = await svc.loadFromIndexedDB();
    expect(result).toBeNull();
  });
});

// ── Debounce / scheduleSave ───────────────────────────────────────────────────

describe('PersistenceService — scheduleSave debounce', () => {

  beforeEach(() => {
    installIDBMock();
    jasmine.clock().install();
  });
  afterEach(() => jasmine.clock().uninstall());

  it('does not call getState immediately', () => {
    const svc      = new PersistenceService();
    const getState = jasmine.createSpy('getState').and.returnValue(stubState());
    svc.scheduleSave(getState);
    expect(getState).not.toHaveBeenCalled();
  });

  it('calls getState after 2 s', () => {
    const svc      = new PersistenceService();
    const getState = jasmine.createSpy('getState').and.returnValue(stubState());
    svc.scheduleSave(getState);
    jasmine.clock().tick(2000);
    expect(getState).toHaveBeenCalledTimes(1);
  });

  it('multiple rapid calls only call getState once', () => {
    const svc      = new PersistenceService();
    const getState = jasmine.createSpy('getState').and.returnValue(stubState());
    svc.scheduleSave(getState);
    svc.scheduleSave(getState);
    svc.scheduleSave(getState);
    jasmine.clock().tick(2500);
    expect(getState).toHaveBeenCalledTimes(1);
  });

  it('flushNow cancels a pending scheduleSave', () => {
    const svc       = new PersistenceService();
    const getState1 = jasmine.createSpy('gs1').and.returnValue(stubState());
    const getState2 = jasmine.createSpy('gs2').and.returnValue(stubState());
    svc.scheduleSave(getState1);
    svc.flushNow(getState2);          // cancels the above and fires immediately
    jasmine.clock().tick(2500);
    expect(getState1).not.toHaveBeenCalled();
    expect(getState2).toHaveBeenCalledTimes(1);
  });
});

// ── hasFSA ────────────────────────────────────────────────────────────────────

describe('PersistenceService — hasFSA()', () => {

  it('returns false when showSaveFilePicker is absent', () => {
    installIDBMock();
    const saved = (window as any).showSaveFilePicker;
    delete (window as any).showSaveFilePicker;
    expect(new PersistenceService().hasFSA()).toBe(false);
    if (saved !== undefined) (window as any).showSaveFilePicker = saved;
  });

  it('returns true when showSaveFilePicker is present', () => {
    installIDBMock();
    (window as any).showSaveFilePicker = () => {};
    expect(new PersistenceService().hasFSA()).toBe(true);
    delete (window as any).showSaveFilePicker;
  });
});

// ── currentFileName / clearFileHandle ────────────────────────────────────────

describe('PersistenceService — currentFileName', () => {

  it('is null initially', () => {
    installIDBMock();
    expect(new PersistenceService().currentFileName).toBeNull();
  });

  it('reflects the saved-file name after saveAsToFile with FSA', async () => {
    installIDBMock();
    const writable = { write: () => Promise.resolve(), close: () => Promise.resolve() };
    const handle   = { name: 'test.fpp', createWritable: () => Promise.resolve(writable) };
    (window as any).showSaveFilePicker = () => Promise.resolve(handle);

    const svc = new PersistenceService();
    await new Promise(r => setTimeout(r, 20));
    await svc.saveAsToFile(stubState());
    expect(svc.currentFileName).toBe('test.fpp');

    svc.clearFileHandle();
    expect(svc.currentFileName).toBeNull();
    delete (window as any).showSaveFilePicker;
  });
});

// ── Blob download fallback ────────────────────────────────────────────────────

describe('PersistenceService — blob download fallback', () => {

  it('saveAsToFile triggers an <a> click when FSA is absent', async () => {
    installIDBMock();
    delete (window as any).showSaveFilePicker;

    const clickedDownloads: string[] = [];
    const origCreate = document.createElement.bind(document);

    spyOn(document, 'createElement').and.callFake((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        spyOn(el as HTMLAnchorElement, 'click').and.callFake(() => {
          clickedDownloads.push((el as HTMLAnchorElement).download);
        });
      }
      return el;
    });

    const svc = new PersistenceService();
    await svc.saveAsToFile(stubState());

    expect(clickedDownloads.length).toBeGreaterThan(0);
    expect(clickedDownloads[0]).toMatch(/\.fpp$/);
  });
});

// ── FSA AbortError is swallowed ───────────────────────────────────────────────

describe('PersistenceService — FSA AbortError handling', () => {

  it('saveAsToFile does not throw when user cancels picker', async () => {
    installIDBMock();
    const abort = Object.assign(new Error('user cancelled'), { name: 'AbortError' });
    (window as any).showSaveFilePicker = () => Promise.reject(abort);

    const svc = new PersistenceService();
    let threw = false;
    try { await svc.saveAsToFile(stubState()); }
    catch { threw = true; }
    expect(threw).toBe(false);

    delete (window as any).showSaveFilePicker;
  });

  it('openFromFile returns null when user cancels picker', async () => {
    installIDBMock();
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    // hasFSA() checks for showSaveFilePicker, so we must stub it too.
    (window as any).showSaveFilePicker = () => {};
    (window as any).showOpenFilePicker = () => Promise.reject(abort);

    const svc    = new PersistenceService();
    const result = await svc.openFromFile();
    expect(result).toBeNull();

    delete (window as any).showOpenFilePicker;
    delete (window as any).showSaveFilePicker;
  });
});
