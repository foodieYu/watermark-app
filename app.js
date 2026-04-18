// app.js — main application logic
import { saveWatermark, loadWatermark } from './storage.js';
import { renderToCanvas, getWmBounds  } from './watermark.js';

// ── State ──────────────────────────────────────────────────────────────────
const mkSettings = () => ({ snap: 5, ox: 0, oy: 0, scale: 30, opacity: 0.7 });

const S = {
  wm:     null,   // HTMLImageElement | null
  images: [],     // [{ img: HTMLImageElement, settings: {} }]
  mode:   'batch',
  idx:    0,
  batch:  mkSettings(),
};

// ── DOM refs ───────────────────────────────────────────────────────────────
const el = id => document.getElementById(id);
const D = {
  wmBtn:         el('btn-wm-upload'),
  wmInput:       el('input-wm'),
  wmDot:         el('wm-dot'),
  wmLabel:       el('wm-label'),
  addBtn:        el('btn-add-images'),
  addLabel:      el('add-label'),
  imgInput:      el('input-images'),
  emptyState:    el('empty-state'),
  previewWrap:   el('preview-wrap'),
  canvas:        el('preview-canvas'),
  carouselNav:   el('carousel-nav'),
  carLabel:      el('carousel-label'),
  prevBtn:       el('btn-prev'),
  nextBtn:       el('btn-next'),
  batchBtn:      el('btn-batch'),
  singleBtn:     el('btn-single'),
  snapGrid:      el('snap-grid'),
  slX:           el('sl-x'),       valX:       el('val-x'),
  slY:           el('sl-y'),       valY:       el('val-y'),
  slScale:       el('sl-scale'),   valScale:   el('val-scale'),
  slOpacity:     el('sl-opacity'), valOpacity: el('val-opacity'),
  modeHint:      el('mode-hint'),
  exportBtn:     el('btn-export'),
  exportLabel:   el('export-label'),
  fallbackModal: el('fallback-modal'),
  fallbackGrid:  el('fallback-grid'),
  closeBtn:      el('btn-close-fallback'),
};

// ── Utility ────────────────────────────────────────────────────────────────
const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const loadImg = src => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = rej;
  img.src = src;
});

// Returns the active settings object by reference (not a copy)
const activeSettings = () =>
  S.mode === 'batch' ? S.batch : (S.images[S.idx]?.settings ?? S.batch);

// Sync all slider/snap UI from a settings object
function syncUI(s) {
  D.slX.value       = s.ox;
  D.slY.value       = s.oy;
  D.slScale.value   = s.scale;
  D.slOpacity.value = Math.round(s.opacity * 100);
  D.valX.textContent       = s.ox;
  D.valY.textContent       = s.oy;
  D.valScale.textContent   = s.scale + '%';
  D.valOpacity.textContent = s.opacity.toFixed(1);
  D.snapGrid.querySelectorAll('button').forEach(b =>
    b.classList.toggle('snap-active', +b.dataset.p === s.snap)
  );
}

// ── Snap grid ──────────────────────────────────────────────────────────────
const SNAP_ORDER = [7, 8, 9, 4, 5, 6, 1, 2, 3];

function buildSnapGrid() {
  D.snapGrid.innerHTML = SNAP_ORDER
    .map(p => `<button data-p="${p}" class="snap-btn" aria-label="Snap position ${p}"></button>`)
    .join('');

  D.snapGrid.addEventListener('click', e => {
    const btn = e.target.closest('[data-p]');
    if (!btn) return;
    activeSettings().snap = +btn.dataset.p;
    syncUI(activeSettings());
    render();
  });
}

// ── Watermark ──────────────────────────────────────────────────────────────
async function initWatermark() {
  const src = loadWatermark();
  if (!src) return;
  try {
    S.wm = await loadImg(src);
    setWmIndicator(true, true);
    render();
  } catch { /* stale or corrupt storage */ }
}

function setWmIndicator(loaded, saved) {
  if (!loaded) {
    D.wmDot.className     = 'w-2 h-2 rounded-full bg-stone-300 flex-none';
    D.wmLabel.textContent = 'Add Watermark';
    return;
  }
  D.wmDot.className     = `w-2 h-2 rounded-full ${saved ? 'bg-green-500' : 'bg-yellow-400'} flex-none`;
  D.wmLabel.textContent = saved ? 'Watermark ✓' : 'Watermark (not saved)';
}

D.wmBtn.onclick    = () => D.wmInput.click();
D.wmInput.onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    S.wm = await loadImg(ev.target.result);
    const saved = saveWatermark(ev.target.result);
    setWmIndicator(true, saved);
    render();
  };
  reader.readAsDataURL(file);
  e.target.value = '';
};

// ── Add images ─────────────────────────────────────────────────────────────
D.addBtn.onclick    = () => D.imgInput.click();
D.imgInput.onchange = async e => {
  const files = [...e.target.files];
  for (const f of files) {
    const img = await loadImg(URL.createObjectURL(f));
    S.images.push({ img, settings: { ...S.batch } });
  }
  e.target.value = '';
  if (S.idx >= S.images.length) S.idx = S.images.length - 1;
  render();
};

// ── Mode toggle ────────────────────────────────────────────────────────────
function setMode(mode) {
  // Preserve slider state: copy batch settings into every image when entering single mode
  if (mode === 'single' && S.mode === 'batch') {
    S.images.forEach(e => { e.settings = { ...S.batch }; });
  }
  S.mode = mode;
  const isBatch = mode === 'batch';
  D.batchBtn.classList.toggle('mode-active',     isBatch);
  D.batchBtn.classList.toggle('text-[#A1887F]', !isBatch);
  D.singleBtn.classList.toggle('mode-active',    !isBatch);
  D.singleBtn.classList.toggle('text-[#A1887F]',  isBatch);
  syncUI(activeSettings());
  updateModeHint();
  render();
}
D.batchBtn.onclick  = () => setMode('batch');
D.singleBtn.onclick = () => setMode('single');

function updateModeHint() {
  D.modeHint.textContent = S.mode === 'batch'
    ? `Adjusting: all ${S.images.length || ''} images`.trim()
    : `Adjusting: image ${S.idx + 1} of ${S.images.length}`;
}

// ── Carousel ───────────────────────────────────────────────────────────────
D.prevBtn.onclick = () => { if (S.idx > 0)                    { S.idx--; onNav(); } };
D.nextBtn.onclick = () => { if (S.idx < S.images.length - 1) { S.idx++; onNav(); } };

function onNav() {
  if (S.mode === 'single') syncUI(activeSettings());
  updateModeHint();
  render();
}

// ── Sliders ────────────────────────────────────────────────────────────────
// [inputEl, displayEl, settingsKey, transform, formatFn]
const SLIDERS = [
  [D.slX,       D.valX,       'ox',      v => +v,      v => v                  ],
  [D.slY,       D.valY,       'oy',      v => +v,      v => v                  ],
  [D.slScale,   D.valScale,   'scale',   v => +v,      v => v + '%'            ],
  [D.slOpacity, D.valOpacity, 'opacity', v => v / 100, v => (v/100).toFixed(1)],
];

SLIDERS.forEach(([input, display, key, xform, fmt]) => {
  input.oninput = () => {
    activeSettings()[key] = xform(+input.value);
    display.textContent   = fmt(+input.value);
    render();
  };
});

// ── Canvas Drag ────────────────────────────────────────────────────────────
// Enables direct dragging of the watermark on the preview canvas.
// Dragging updates ox/oy in settings and syncs back to the X/Y sliders.

let drag = null; // { gx, gy } grab offset from watermark top-left in canvas px

/** Map a pointer/touch event to canvas pixel coordinates. */
function canvasPoint(e) {
  const r   = D.canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - r.left) * (D.canvas.width  / r.width),
    y: (src.clientY - r.top)  * (D.canvas.height / r.height),
  };
}

/** Get the current watermark bounds on the preview canvas (or null). */
function currentBounds() {
  if (!S.wm || !S.images.length) return null;
  return getWmBounds(D.canvas.width, D.canvas.height, S.wm, activeSettings());
}

/** Start a drag if the pointer lands inside the watermark. */
function tryStartDrag(e) {
  const b = currentBounds();
  if (!b) return;
  const p = canvasPoint(e);
  if (p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) return;
  drag = { gx: p.x - b.x, gy: p.y - b.y };
  e.preventDefault();
}

/** Move the watermark by updating ox/oy and syncing sliders. */
function processDrag(e) {
  if (!drag) return;
  if (e.cancelable) e.preventDefault();
  const p  = canvasPoint(e);
  const s  = activeSettings();
  const b  = getWmBounds(D.canvas.width, D.canvas.height, S.wm, s);
  if (!b) { drag = null; return; }

  const cw = D.canvas.width, ch = D.canvas.height;
  // Inverse of renderToCanvas formula:
  //   x = sx*cw + (ox/100)*cw - sx*wmW  →  ox = (newX - sx*(cw-wmW)) * 100/cw
  s.ox = clamp(Math.round((p.x - drag.gx - b.sx * (cw - b.w)) * 100 / cw), -50, 50);
  s.oy = clamp(Math.round((p.y - drag.gy - b.sy * (ch - b.h)) * 100 / ch), -50, 50);

  // Two-way sync: update sliders to match drag position
  D.slX.value = s.ox; D.valX.textContent = s.ox;
  D.slY.value = s.oy; D.valY.textContent = s.oy;

  render();
}

D.canvas.addEventListener('mousedown',  tryStartDrag);
D.canvas.addEventListener('touchstart', tryStartDrag, { passive: false });

// Mouse: handle move + cursor hover in one listener
window.addEventListener('mousemove', e => {
  processDrag(e);
  if (drag) { D.canvas.style.cursor = 'grabbing'; return; }
  const b = currentBounds();
  if (!b) { D.canvas.style.cursor = ''; return; }
  const p = canvasPoint(e);
  D.canvas.style.cursor =
    (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) ? 'grab' : '';
});

window.addEventListener('touchmove', processDrag, { passive: false });
window.addEventListener('mouseup',  () => { drag = null; });
window.addEventListener('touchend', () => { drag = null; });

// ── Render (RAF-debounced) ─────────────────────────────────────────────────
let raf = null;
const render = () => { if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(_render); };

function _render() {
  raf = null;
  const has   = S.images.length > 0;
  const multi = S.images.length > 1;

  D.emptyState.style.display  = has   ? 'none' : 'flex';
  D.previewWrap.style.display = has   ? 'flex' : 'none';
  D.carouselNav.style.display = multi ? 'flex' : 'none';
  if (!has) return;

  S.idx = Math.min(S.idx, S.images.length - 1);
  D.carLabel.textContent = `${S.idx + 1} / ${S.images.length}`;

  const { img, settings } = S.images[S.idx];
  renderToCanvas(D.canvas, img, S.wm, S.mode === 'batch' ? S.batch : settings, 'preview');

  D.addLabel.textContent = `Images (${S.images.length})`;
  updateModeHint();
}

// ── Export ─────────────────────────────────────────────────────────────────
let fallbackUrls = [];
D.exportBtn.onclick = doExport;

async function doExport() {
  if (!S.images.length) { alert('Add images first.'); return; }
  D.exportLabel.textContent = 'Processing…';
  D.exportBtn.disabled = true;

  const files = [];
  for (let i = 0; i < S.images.length; i++) {
    const { img, settings } = S.images[i];
    const s = S.mode === 'batch' ? S.batch : settings;
    const offscreen = document.createElement('canvas');
    renderToCanvas(offscreen, img, S.wm, s, 'export');
    const blob = await new Promise(res => offscreen.toBlob(res, 'image/jpeg', 0.92));
    files.push(new File([blob], `watermarked_${i + 1}.jpg`, { type: 'image/jpeg' }));
  }

  D.exportLabel.textContent = 'Share';
  D.exportBtn.disabled = false;

  const shareable = navigator.canShare ? navigator.canShare({ files }) : !!navigator.share;
  if (shareable) {
    try { await navigator.share({ files, title: 'Watermarked Images' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  showFallback(files);
}

function showFallback(files) {
  fallbackUrls.forEach(u => URL.revokeObjectURL(u));
  fallbackUrls = files.map(f => URL.createObjectURL(f));
  D.fallbackGrid.innerHTML = fallbackUrls
    .map(u => `<img src="${u}" class="w-full rounded-xl shadow-lg" loading="lazy" draggable="false">`)
    .join('');
  D.fallbackModal.style.display = 'flex';
}

D.closeBtn.onclick = () => {
  D.fallbackModal.style.display = 'none';
  fallbackUrls.forEach(u => URL.revokeObjectURL(u));
  fallbackUrls = [];
};

// ── Init ───────────────────────────────────────────────────────────────────
buildSnapGrid();
syncUI(S.batch);
updateModeHint();
initWatermark();
