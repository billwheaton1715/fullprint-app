/**
 * All measurements in inches; conversions done by TilingCalculator.
 */

export type PaperOrientation  = 'portrait' | 'landscape';
export type ContentAlign      = 'top-left' | 'center';
export type AssemblyMarkStyle = 'none' | 'rectangles' | 'diagonals' | 'both';

/** Known paper size identifiers. 'custom' lets the user enter W×H directly. */
export type PaperSizeId =
  | 'letter'    // US Letter   8.5 × 11 in
  | 'legal'     // US Legal    8.5 × 14 in
  | 'tabloid'   // Tabloid/Ledger 11 × 17 in
  | 'a4'        // ISO A4      8.27 × 11.69 in  (210 × 297 mm)
  | 'a3'        // ISO A3      11.69 × 16.54 in (297 × 420 mm)
  | 'a2'        // ISO A2      16.54 × 23.39 in (420 × 594 mm)
  | 'custom';   // user-defined

export interface PaperSizeDef {
  id:    PaperSizeId;
  label: string;
  /** Portrait width in inches */
  wIn:   number;
  /** Portrait height in inches */
  hIn:   number;
}

/** Catalog of standard paper sizes (portrait dimensions). */
export const PAPER_SIZES: PaperSizeDef[] = [
  { id: 'letter',  label: 'US Letter (8.5 × 11 in)',       wIn: 8.5,   hIn: 11    },
  { id: 'legal',   label: 'US Legal (8.5 × 14 in)',        wIn: 8.5,   hIn: 14    },
  { id: 'tabloid', label: 'Tabloid / Ledger (11 × 17 in)', wIn: 11,    hIn: 17    },
  { id: 'a4',      label: 'A4 (210 × 297 mm)',             wIn: 8.268, hIn: 11.693 },
  { id: 'a3',      label: 'A3 (297 × 420 mm)',             wIn: 11.693,hIn: 16.535 },
  { id: 'a2',      label: 'A2 (420 × 594 mm)',             wIn: 16.535,hIn: 23.386 },
  { id: 'custom',  label: 'Custom…',                       wIn: 8.5,   hIn: 11    },
];

export interface TilingSettings {
  paperSizeId:    PaperSizeId;
  customPaperWIn: number;   // only used when paperSizeId === 'custom'
  customPaperHIn: number;
  orientation:    PaperOrientation;
  marginIn:       number;   // uniform margin on all four sides (inches)
  overlapIn:      number;   // shared strip between adjacent pages (inches)
  outputDpi:      number;   // render quality for PDF tiles
  registrationMarks: boolean;
  contentAlign:   ContentAlign;      // how content sits within the tile grid
  assemblyMarks:   AssemblyMarkStyle; // green lines printed to help tape pages together
  assemblySpacingIn: number;          // grid line spacing in inches (0.5-step, 1–3)
  calibrationPxPerIn: number;         // world-px per real inch; SCREEN_DPI = uncalibrated
  inkSaver:              boolean;  // apply edge-aware lighten filter on canvas and export
  inkSaverStrength:      number;   // 0–100: max white-blend in the interior
  inkSaverFadeRadiusMm:  number;   // mm from any line before full interior lightening
}

/** World-pixels per inch (CSS / screen resolution). */
export const SCREEN_DPI = 96;

/** Legacy constants kept for backward compatibility with existing code. */
export const PAPER_W_IN = 8.5;
export const PAPER_H_IN = 11;

export const DEFAULT_TILING_SETTINGS: TilingSettings = {
  paperSizeId:       'letter',
  customPaperWIn:    8.5,
  customPaperHIn:    11,
  orientation:       'portrait',
  marginIn:          0.5,
  overlapIn:         0.25,
  outputDpi:         150,
  registrationMarks: true,
  contentAlign:      'top-left',
  assemblyMarks:      'both',
  assemblySpacingIn:  1.5,
  calibrationPxPerIn: SCREEN_DPI,   // default = uncalibrated
  inkSaver:              false,
  inkSaverStrength:      50,
  inkSaverFadeRadiusMm:  5,    // 5 mm ≈ the BigPrint "Lighten areas" default
};

/**
 * Returns paper [width, height] in portrait inches for the selected size.
 * Falls back to US Letter for unknown ids.
 */
export function paperPortraitDims(s: TilingSettings): { w: number; h: number } {
  if (s.paperSizeId === 'custom') {
    return { w: s.customPaperWIn || 8.5, h: s.customPaperHIn || 11 };
  }
  const def = PAPER_SIZES.find(p => p.id === s.paperSizeId) ?? PAPER_SIZES[0];
  return { w: def.wIn, h: def.hIn };
}

/** Returns paper [width, height] in inches for the given orientation. */
export function paperDims(s: TilingSettings): { w: number; h: number } {
  const p = paperPortraitDims(s);
  return s.orientation === 'portrait'
    ? { w: p.w, h: p.h }
    : { w: p.h, h: p.w };
}

/** Returns printable [width, height] in inches (paper minus two margins). */
export function printableDims(s: TilingSettings): { w: number; h: number } {
  const p = paperDims(s);
  return { w: p.w - 2 * s.marginIn, h: p.h - 2 * s.marginIn };
}
