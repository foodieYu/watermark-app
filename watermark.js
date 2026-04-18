// watermark.js — canvas rendering logic

// Numpad layout: 7=TL 8=TC 9=TR / 4=ML 5=C 6=MR / 1=BL 2=BC 3=BR
// Each value is [anchorX, anchorY] as a fraction of canvas dimensions.
export const SNAP = {
  7: [0,   0  ], 8: [0.5, 0  ], 9: [1,   0  ],
  4: [0,   0.5], 5: [0.5, 0.5], 6: [1,   0.5],
  1: [0,   1  ], 2: [0.5, 1  ], 3: [1,   1  ],
};

const PREVIEW_MAX_W = 1000; // px — keeps preview fast on mobile

/**
 * Returns the watermark bounding box on a (cw × ch) canvas,
 * plus the snap anchor fractions (sx, sy). Returns null if no wm.
 */
export function getWmBounds(cw, ch, wm, s) {
  if (!wm) return null;
  const wmW = cw * (s.scale / 100);
  const wmH = wm.naturalHeight * (wmW / wm.naturalWidth);
  const [sx, sy] = SNAP[s.snap] ?? [0.5, 0.5];
  const ox = (s.ox / 100) * cw;
  const oy = (s.oy / 100) * ch;
  return {
    x:  sx * cw + ox - sx * wmW,
    y:  sy * ch + oy - sy * wmH,
    w:  wmW,
    h:  wmH,
    sx, sy,
  };
}

/**
 * Renders base image + optional watermark onto `canvas`.
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLImageElement}  base
 * @param {HTMLImageElement|null} wm
 * @param {{ snap:number, ox:number, oy:number, scale:number, opacity:number }} s
 * @param {'preview'|'export'} mode
 */
export function renderToCanvas(canvas, base, wm, s, mode) {
  const ctx = canvas.getContext('2d');
  let cw = base.naturalWidth;
  let ch = base.naturalHeight;

  if (mode === 'preview' && cw > PREVIEW_MAX_W) {
    ch = Math.round(ch * PREVIEW_MAX_W / cw);
    cw = PREVIEW_MAX_W;
  }

  canvas.width  = cw;
  canvas.height = ch;
  ctx.drawImage(base, 0, 0, cw, ch);

  if (!wm) return;

  const b = getWmBounds(cw, ch, wm, s);
  ctx.globalAlpha = s.opacity;
  ctx.drawImage(wm, b.x, b.y, b.w, b.h);
  ctx.globalAlpha = 1;
}
