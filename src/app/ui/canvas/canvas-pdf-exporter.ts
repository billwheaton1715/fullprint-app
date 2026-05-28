import { TilingLayout, TileRect } from '../../core/tiling/tiling-calculator';
import { TilingSettings, SCREEN_DPI } from '../../core/tiling/tiling-settings';
import Shape from '../../core/geometry/Shape';

/**
 * Renders each tile of a TilingLayout to a jsPDF document and triggers a
 * browser download.
 *
 * Requires jsPDF to be installed:
 *   yarn add jspdf
 *
 * Rendering pipeline per tile:
 *   1. Create an offscreen HTMLCanvasElement at outputDPI resolution.
 *   2. Set up a 2D transform that maps the tile's world-px region to the
 *      canvas (0, 0, outputW, outputH).
 *   3. Draw all shapes via their toCanvas() method.
 *   4. Optionally draw registration marks.
 *   5. Export as JPEG and embed in the PDF page at the margin offset.
 */
export class CanvasPdfExporter {

  async export(
    shapes:   Shape[],
    layout:   TilingLayout,
    settings: TilingSettings,
    filename  = 'fullprint.pdf',
  ): Promise<void> {
    // Dynamic import so jsPDF is lazy-loaded only when the user exports.
    const { jsPDF } = await import('jspdf');

    const pdf = new jsPDF({
      orientation: settings.orientation,
      unit:        'in',
      format:      [layout.paperWIn, layout.paperHIn],
    });

    let firstPage = true;

    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        if (!firstPage) pdf.addPage();
        firstPage = false;

        const tile   = layout.tiles[row][col];
        const imgData = this._renderTile(tile, shapes, settings, layout);

        // Content goes at the margin offset
        pdf.addImage(
          imgData, 'JPEG',
          layout.marginIn, layout.marginIn,
          layout.printableWIn, layout.printableHIn,
        );

        if (settings.registrationMarks) {
          this._drawPdfRegistrationMarks(pdf, layout, tile);
        }

        this._drawPageLabel(pdf, layout, tile);
      }
    }

    pdf.save(filename);
  }

  // ── Tile rendering ─────────────────────────────────────────────────────────

  private _renderTile(
    tile:     TileRect,
    shapes:   Shape[],
    settings: TilingSettings,
    layout:   TilingLayout,
  ): string {
    // Use the calibrated px/in so tiles render at true physical scale.
    const pxPerIn = settings.calibrationPxPerIn ?? SCREEN_DPI;
    const scale   = settings.outputDpi / pxPerIn;
    const outW   = Math.round(tile.printW * scale);
    const outH   = Math.round(tile.printH * scale);

    const canvas = document.createElement('canvas');
    canvas.width  = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d')!;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);

    // Transform: world-px → tile-local → output pixels.
    // The canvas is sized to printW×printH so lines outside that area are
    // clipped automatically — perfect for slicing the global grid per tile.
    ctx.setTransform(scale, 0, 0, scale, -tile.printX * scale, -tile.printY * scale);

    for (const s of shapes) {
      try { (s as any).toCanvas(ctx); } catch { /* skip broken shapes */ }
    }

    // Ink saver: lighten + desaturate pixel data BEFORE drawing marks so
    // registration and assembly marks remain crisp.
    if (settings.inkSaver) {
      // Reset transform to identity so getImageData covers the full canvas.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this._applyInkSaver(ctx, outW, outH, settings.inkSaverStrength ?? 50);
      // Restore transform for any subsequent drawing (marks etc.)
      ctx.setTransform(scale, 0, 0, scale, -tile.printX * scale, -tile.printY * scale);
    }

    if (settings.registrationMarks) {
      this._drawCanvasRegistrationMarks(ctx, tile, scale);
    }

    if (settings.assemblyMarks !== 'none') {
      this._drawCanvasAssemblyMarks(ctx, layout, settings, scale);
    }

    return canvas.toDataURL('image/jpeg', 0.92);
  }

  // ── Ink saver ─────────────────────────────────────────────────────────────

  /**
   * Applies a lighten + desaturate filter to the canvas pixel data in place.
   *
   * @param strength  0–100.  At 100: ~50% lighter, ~70% desaturated.
   *                          At 50 (default): ~25% lighter, ~35% desaturated.
   */
  private _applyInkSaver(
    ctx:      CanvasRenderingContext2D,
    width:    number,
    height:   number,
    strength: number,
  ): void {
    const s = Math.max(0, Math.min(100, strength)) / 100;
    const lighten = s * 0.5;   // max 50% blend toward white
    const desat   = s * 0.7;   // max 70% blend toward luma

    const imageData = ctx.getImageData(0, 0, width, height);
    const d = imageData.data;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];

      // Desaturate: blend each channel toward perceived luma
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      r = r + (luma - r) * desat;
      g = g + (luma - g) * desat;
      b = b + (luma - b) * desat;

      // Lighten: blend toward white
      r = r + (255 - r) * lighten;
      g = g + (255 - g) * lighten;
      b = b + (255 - b) * lighten;

      d[i]     = r;
      d[i + 1] = g;
      d[i + 2] = b;
      // alpha unchanged
    }

    ctx.putImageData(imageData, 0, 0);
  }

  // ── Assembly marks ────────────────────────────────────────────────────────

  /**
   * Draws the global assembly grid onto an offscreen tile canvas.
   *
   * The grid spans the full assembled area (all tiles together).  Because the
   * offscreen canvas is sized to one tile's printable area and the ctx transform
   * maps world-px → canvas-px, lines outside the tile are clipped automatically
   * — each tile naturally receives its own slice of the global grid.
   *
   * Rectangular: cartesian grid — vertical + horizontal lines at spacingPx.
   * Diagonal:    two families of true-45° lines at spacingPx (perpendicular).
   * Both:        all four families overlaid.
   *
   * Grid origin is anchored at the top-left of the assembled bounding box so
   * lines are consistent across tiles.
   */
  private _drawCanvasAssemblyMarks(
    ctx:      CanvasRenderingContext2D,
    layout:   TilingLayout,
    settings: TilingSettings,
    scale:    number,
  ): void {
    // Assembled bounding box in world-px
    const minX = layout.tiles[0][0].printX;
    const minY = layout.tiles[0][0].printY;
    const maxX = layout.tiles[0][layout.cols - 1].printX + layout.tiles[0][layout.cols - 1].printW;
    const maxY = layout.tiles[layout.rows - 1][0].printY + layout.tiles[layout.rows - 1][0].printH;

    const spacingPx = (settings.assemblySpacingIn ?? 1.5) * SCREEN_DPI;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 185, 80, 0.65)';
    ctx.lineWidth   = 1 / scale;   // ~1 pt in the printed output
    ctx.setLineDash([]);

    const drawRect = settings.assemblyMarks === 'rectangles' || settings.assemblyMarks === 'both';
    const drawDiag = settings.assemblyMarks === 'diagonals'  || settings.assemblyMarks === 'both';

    // ── Rectangular (cartesian) grid ──────────────────────────────────────
    if (drawRect) {
      // Vertical lines
      for (let x = minX; x <= maxX + 0.5; x += spacingPx) {
        ctx.beginPath();
        ctx.moveTo(x, minY);
        ctx.lineTo(x, maxY);
        ctx.stroke();
      }
      // Horizontal lines
      for (let y = minY; y <= maxY + 0.5; y += spacingPx) {
        ctx.beginPath();
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
        ctx.stroke();
      }
    }

    // ── Diagonal grid (true 45°) ──────────────────────────────────────────
    // For 45° lines the perpendicular spacing = s means c-step = s√2,
    // where the line equations are y = x + c  and  y = -x + c.
    if (drawDiag) {
      const sqrt2   = Math.SQRT2;
      const cStep   = spacingPx * sqrt2;

      // Family 1: y = x + c  (NW→SE, slope +1 in screen coords)
      // c ranges over [minY − maxX, maxY − minX]; anchor at top-left corner.
      const c1Min = minY - maxX;
      const c1Max = maxY - minX;
      const c1Anchor = minY - minX;
      const k1Start = Math.floor((c1Min - c1Anchor) / cStep);
      const k1End   = Math.ceil ((c1Max - c1Anchor) / cStep);
      for (let k = k1Start; k <= k1End; k++) {
        const c = c1Anchor + k * cStep;
        const xA = Math.max(minX, minY - c);
        const xB = Math.min(maxX, maxY - c);
        if (xA >= xB) continue;
        ctx.beginPath();
        ctx.moveTo(xA, xA + c);
        ctx.lineTo(xB, xB + c);
        ctx.stroke();
      }

      // Family 2: y = -x + c  (NE→SW, slope -1 in screen coords)
      // c ranges over [minX + minY, maxX + maxY]; anchor at top-left corner.
      const c2Min = minX + minY;
      const c2Max = maxX + maxY;
      const c2Anchor = minX + minY;
      const k2Start = 0;
      const k2End   = Math.ceil((c2Max - c2Anchor) / cStep);
      for (let k = k2Start; k <= k2End; k++) {
        const c = c2Anchor + k * cStep;
        const xA = Math.max(minX, c - maxY);
        const xB = Math.min(maxX, c - minY);
        if (xA >= xB) continue;
        ctx.beginPath();
        ctx.moveTo(xA, c - xA);
        ctx.lineTo(xB, c - xB);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ── Registration marks ─────────────────────────────────────────────────────

  /**
   * Four corner marks drawn ON the tile canvas (world-px coordinates).
   * Each mark = circle + crosshair, centred on the printable-area corner.
   */
  private _drawCanvasRegistrationMarks(
    ctx:   CanvasRenderingContext2D,
    tile:  TileRect,
    scale: number,
  ): void {
    const markRadiusPx = 8;   // world-px radius of the circle
    const armLenPx     = 14;  // world-px length of each crosshair arm

    const corners = [
      { x: tile.printX,               y: tile.printY               },
      { x: tile.printX + tile.printW, y: tile.printY               },
      { x: tile.printX,               y: tile.printY + tile.printH },
      { x: tile.printX + tile.printW, y: tile.printY + tile.printH },
    ];

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth   = 1 / scale;

    for (const c of corners) {
      // Circle
      ctx.beginPath();
      ctx.arc(c.x, c.y, markRadiusPx, 0, Math.PI * 2);
      ctx.stroke();

      // Horizontal arm
      ctx.beginPath();
      ctx.moveTo(c.x - armLenPx, c.y);
      ctx.lineTo(c.x + armLenPx, c.y);
      ctx.stroke();

      // Vertical arm
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - armLenPx);
      ctx.lineTo(c.x, c.y + armLenPx);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Registration marks drawn directly on the PDF page using jsPDF primitives.
   * The marks sit at the corners of the printable area (in inches).
   */
  private _drawPdfRegistrationMarks(pdf: any, layout: TilingLayout, _tile: TileRect): void {
    const m         = layout.marginIn;
    const pw        = layout.printableWIn;
    const ph        = layout.printableHIn;
    const markR     = 0.06;   // circle radius (inches)
    const armLen    = 0.1;    // crosshair arm length (inches)

    const corners = [
      { x: m,      y: m      },
      { x: m + pw, y: m      },
      { x: m,      y: m + ph },
      { x: m + pw, y: m + ph },
    ];

    pdf.setLineWidth(0.008);
    pdf.setDrawColor(0, 0, 0);

    for (const c of corners) {
      pdf.circle(c.x, c.y, markR, 'S');
      pdf.line(c.x - armLen, c.y, c.x + armLen, c.y);
      pdf.line(c.x, c.y - armLen, c.x, c.y + armLen);
    }
  }

  // ── Page label ─────────────────────────────────────────────────────────────

  private _drawPageLabel(pdf: any, layout: TilingLayout, tile: TileRect): void {
    const pageNum = tile.row * layout.cols + tile.col + 1;
    const label   =
      `Page ${pageNum} of ${layout.totalPages}` +
      `  (col ${tile.col + 1}/${layout.cols}, row ${tile.row + 1}/${layout.rows})`;

    const m = layout.marginIn;
    const x = m;
    const y = layout.paperHIn - m * 0.55;  // near bottom margin

    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 120);
    pdf.text(label, x, y);
  }
}
