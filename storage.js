// storage.js — localStorage persistence for watermark image
const KEY = 'wm_v1';

export function saveWatermark(src) {
  try   { localStorage.setItem(KEY, src); return true; }
  catch { return false; } // quota exceeded (large image)
}

export function loadWatermark() {
  return localStorage.getItem(KEY); // null if not set
}
