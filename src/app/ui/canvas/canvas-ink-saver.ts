/**
 * canvas-ink-saver.ts
 *
 * Edge-aware ink saver filter for HTML5 Canvas.
 *
 * Algorithm
 * ─────────
 * 1. Convert to luminance.
 * 2. Sobel gradient → edge-magnitude map.
 * 3. Suppress edges that border the canvas background (near-white areas) so
 *    the image boundary is not treated as a content line.
 * 4. Threshold remaining edges → binary seed mask.
 * 5. Two-pass Manhattan distance transform: every pixel gets its distance
 *    (in physical pixels) to the nearest content-edge seed.
 * 6. Blend each pixel toward white:
 *      alpha = clamp(dist / fadeRadius, 0, 1) × strength
 *    Pixels right at a content edge keep their original colour.
 *    Pixels ≥ fadeRadius away from any content line fade to strength × white.
 *
 * Works in physical pixel space (ignores any canvas transform), so call it
 * before drawing screen-space overlays (grid, handles, guides).
 */

/**
 * Apply an edge-aware ink-saver effect to the current canvas contents.
 *
 * @param ctx            2D rendering context
 * @param width          Physical pixel width  (canvas.width)
 * @param height         Physical pixel height (canvas.height)
 * @param fadeRadiusPx   Distance (physical px) over which colour transitions
 *                       from preserved → fully lightened.
 *                       Pass  Measurement.fromMm(mm).toUnit('px') × viewportScale × dpr
 *                       so the band tracks zoom level correctly.
 * @param strength       Maximum white-blend fraction at full distance (0–1).
 *                       0.85 ≈ BigPrint "Lighten areas".
 */
export function applyEdgeAwareInkSaver(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fadeRadiusPx: number,
  strength: number,
): void {
  if (strength <= 0 || fadeRadiusPx <= 0 || width < 3 || height < 3) return;

  // ── 1. Read pixels ────────────────────────────────────────────────────────
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const n = width * height;

  // ── 2. Luminance (fast integer approximation: 0.299R + 0.587G + 0.114B) ──
  const lum = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i << 2;
    lum[i] = (77 * data[p] + 150 * data[p + 1] + 29 * data[p + 2]) >> 8;
  }

  // ── 3. Sobel gradient magnitude ───────────────────────────────────────────
  const edgeMag = new Float32Array(n);
  let maxMag = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx =
        -lum[i - width - 1] + lum[i - width + 1]
        - 2 * lum[i - 1]     + 2 * lum[i + 1]
        - lum[i + width - 1] + lum[i + width + 1];
      const gy =
        -lum[i - width - 1] - 2 * lum[i - width] - lum[i - width + 1]
        + lum[i + width - 1] + 2 * lum[i + width] + lum[i + width + 1];
      const mag = Math.sqrt(gx * gx + gy * gy);
      edgeMag[i] = mag;
      if (mag > maxMag) maxMag = mag;
    }
  }

  // ── 4. Suppress edges that touch the canvas background ───────────────────
  // The canvas background is pure white (#fff → lum ≈ 255).  An edge between
  // image content and that background is the image border — not a content
  // line — so we don't want the fill to be preserved around it.
  // Any Sobel-detected edge pixel whose luminance is > 252 (essentially white)
  // OR whose immediate neighbours include a near-white pixel is suppressed.
  const BG_THRESH = 252; // lum above this → canvas background
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (edgeMag[i] === 0) continue;
      if (
        lum[i]         > BG_THRESH ||
        lum[i - 1]     > BG_THRESH ||
        lum[i + 1]     > BG_THRESH ||
        lum[i - width] > BG_THRESH ||
        lum[i + width] > BG_THRESH
      ) {
        edgeMag[i] = 0;
      }
    }
  }

  // ── 5. Edge threshold ─────────────────────────────────────────────────────
  // Top-15 % of surviving magnitudes become edge seeds.
  const threshold = maxMag * 0.15;

  // ── 6. Distance transform (2-pass Manhattan) ──────────────────────────────
  const INF = 1e6;
  const dist = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    dist[i] = edgeMag[i] >= threshold ? 0 : INF;
  }

  // Forward pass: top-left → bottom-right
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x > 0)      { const d = dist[i - 1]    + 1; if (d < dist[i]) dist[i] = d; }
      if (y > 0)      { const d = dist[i - width] + 1; if (d < dist[i]) dist[i] = d; }
    }
  }

  // Backward pass: bottom-right → top-left
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (x < width - 1) { const d = dist[i + 1]     + 1; if (d < dist[i]) dist[i] = d; }
      if (y < height - 1){ const d = dist[i + width]  + 1; if (d < dist[i]) dist[i] = d; }
    }
  }

  // ── 7. Blend toward white based on distance ───────────────────────────────
  for (let i = 0; i < n; i++) {
    // Skip pixels that are already background-white — no change needed.
    if (lum[i] > BG_THRESH) continue;

    const t     = dist[i] >= fadeRadiusPx ? 1 : dist[i] / fadeRadiusPx;
    const alpha = t * strength;
    const p = i << 2;
    data[p]     = (data[p]     + ((255 - data[p])     * alpha + 0.5)) | 0;
    data[p + 1] = (data[p + 1] + ((255 - data[p + 1]) * alpha + 0.5)) | 0;
    data[p + 2] = (data[p + 2] + ((255 - data[p + 2]) * alpha + 0.5)) | 0;
    // alpha channel (p+3) intentionally unchanged
  }

  // ── 8. Write back ─────────────────────────────────────────────────────────
  ctx.putImageData(imageData, 0, 0);
}
