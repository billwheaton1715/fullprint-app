import { PaperSizeId } from '../tiling/tiling-settings';

/**
 * Application-level preferences.
 * Stored in IndexedDB under a key separate from the project state so they
 * persist regardless of which .fpp file is open.
 */
export interface AppPreferences {
  /** Default paper size for new tabs. */
  defaultPaperSizeId: PaperSizeId;
  /** Default output DPI for PDF export. */
  defaultDpi: number;
  /** Default page overlap in inches. */
  defaultOverlapIn: number;
  /** Default page margin in inches. */
  defaultMarginIn: number;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  defaultPaperSizeId: 'letter',
  defaultDpi:         150,
  defaultOverlapIn:   0.25,
  defaultMarginIn:    0.5,
};

/** IDB key used to store preferences (separate from the project state key). */
export const PREFS_IDB_KEY = 'prefs';
