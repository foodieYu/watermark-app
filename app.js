// app.js — main application logic
import { saveWatermark, loadWatermark } from './storage.js';
import { renderToCanvas }              from './watermark.js';

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
const loadImg = src => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = rej;
  img.src = src;
});

// Return the currently active settings object (pointer, not copy)
const activeSettings = () =>
  S.mode === 'batch' ? S.batch : (S.images[S.idx]?.settings ?? S.batch);

// Sync all slider/snap UI to a settings object
function syncUI(s) {
  D.slX.value      = s.ox;
  D.slY.value      = s.oy;
  D.slScale.value  = s.scale;
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
// Rendered in numpad order: 7 8 9 / 4 5 6 / 1 2 3
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
  } catch { /* stale or corrupt storage — ignore */ }
}

function setWmIndicator(loaded, saved) {
  if (!loaded) { D.wmDot.className = 'w-2 h-2 rounded-full bg-stone-300 flex-none'; D.wmLabel.textContent = 'Add Watermark'; return; }
  D.wmDot.className = `w-2 h-2 rounded-full ${saved ? 'bg-green-400' : 'bg-yellow-400'} flex-none`;
  D.wmLabel.textContent = saved ? 'Watermark ✓' : 'Watermark (not saved)';
}

D.wmBtn.onclick  = () => D.wmInput.click();
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
D.addBtn.onclick     = () => D.imgInput.click();
D.imgInput.onchange  = async e => {
  const files = [...e.target.files];
  for (const f of files) {
    const src = URL.createObjectURL(f);
    const img = await loadImg(src);
    // Each image starts with a copy of current batch settings
    S.images.push({ img, settings: { ...S.batch } });
  }
  e.target.value = '';
  // Keep idx valid
  if (S.idx >= S.images.length) S.idx = S.images.length - 1;
  render();
};

// ── Mode toggle ────────────────────────────────────────────────────────────
function setMode(mode) {
  // When entering single mode, push current batch settings into every image
  // so sliders don't appear to reset on toggle
  if (mode === 'single' && S.mode === 'batch') {
    S.images.forEach(e => { e.settings = { ...S.batch }; });
  }
  S.mode = mode;
  const isBatch = mode === 'batch';
  D.batchBtn.classList.toggle('mode-active',   isBatch);
  D.batchBtn.classList.toggle('text-slate-400', !isBatch);
  D.singleBtn.classList.toggle('mode-active',   !isBatch);
  D.singleBtn.classList.toggle('text-slate-400', isBatch);
  syncUI(activeSettings());
  updateModeHint();
  render();
}
D.batchBtn.onclick  = () => setMode('batch');
D.singleBtn.onclick = () => setMode('single');

function updateModeHint() {
  if (S.mode === 'batch') {
    D.modeHint.textContent = `Adjusting: all ${S.images.length || ''} images`.trim();
  } else {
    D.modeHint.textContent = `Adjusting: image ${S.idx + 1} of ${S.images.length}`;
  }
}

// ── Carousel ───────────────────────────────────────────────────────────────
D.prevBtn.onclick = () => { if (S.idx > 0)                      { S.idx--; onNav(); } };
D.nextBtn.onclick = () => { if (S.idx < S.images.length - 1)   { S.idx++; onNav(); } };

function onNav() {
  // In single mode, load this image's own settings into the UI
  if (S.mode === 'single') syncUI(activeSettings());
  updateModeHint();
  render();
}

// ── Sliders ────────────────────────────────────────────────────────────────
// [inputEl, displayEl, settingsKey, transform, formatFn]
const SLIDERS = [
  [D.slX,       D.valX,       'ox',      v => +v,      v => v       ],
  [D.slY,       D.valY,       'oy',      v => +v,      v => v       ],
  [D.slScale,   D.valScale,   'scale',   v => +v,      v => v + '%' ],
  [D.slOpacity, D.valOpacity, 'opacity', v => v / 100, v => (v/100).toFixed(1)],
];

SLIDERS.forEach(([input, display, key, xform, fmt]) => {
  input.oninput = () => {
    activeSettings()[key] = xform(+input.value);
    display.textContent   = fmt(+input.value);
    render();
  };
});

// ── Render (RAF-debounced) ─────────────────────────────────────────────────
let raf = null;
const render = () => { if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(_render); };

function _render() {
  raf = null;
  const has   = S.images.length > 0;
  const multi = S.images.length > 1;

  D.emptyState.style.display    = has   ? 'none' : 'flex';
  D.previewWrap.style.display   = has   ? 'flex' : 'none';
  D.carouselNav.style.display   = multi ? 'flex' : 'none';

  if (!has) return;

  // Clamp idx
  S.idx = Math.min(S.idx, S.images.length - 1);

  D.carLabel.textContent = `${S.idx + 1} / ${S.images.length}`;

  const { img, settings } = S.images[S.idx];
  const s = S.mode === 'batch' ? S.batch : settings;
  renderToCanvas(D.canvas, img, S.wm, s, 'preview');

  // Update add button badge
  D.addLabel.textContent = S.images.length > 0 ? `Images (${S.images.length})` : 'Add Images';
  updateModeHint();
}

// ── Export ─────────────────────────────────────────────────────────────────
let fallbackUrls = [];

D.exportBtn.onclick = doExport;

async function doExport() {
  if (!S.images.length) { alert('Add images first.'); return; }

  D.exportLabel.textContent = 'Processing…';
  D.exportBtn.disabled = true;

  // Render each image to a full-res offscreen canvas, convert to File
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

  // Try Web Share API (triggers iOS native share sheet → "Save X Images")
  const shareable = navigator.canShare ? navigator.canShare({ files }) : !!navigator.share;
  if (shareable) {
    try {
      await navigator.share({ files, title: 'Watermarked Images' });
      return; // done — user handled saving via share sheet
    } catch (e) {
      if (e.name === 'AbortError') return; // user dismissed share sheet
      // Other errors (e.g. file size limit) → fall through to grid fallback
    }
  }

  showFallback(files);
}

// ── Fallback: image grid for long-press save ───────────────────────────────
function showFallback(files) {
  // Revoke any previous URLs
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
