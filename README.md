# WatermarkIt

A mobile-first web app for batch image watermarking, optimised for iPhone. Built with HTML5 Canvas, Vanilla JS, and Tailwind CSS — no build step required.

---

## Features

- **Persistent watermark** — upload once, saved to localStorage across sessions
- **Batch mode** — apply position, scale, and opacity to all images at once
- **Single mode** — fine-tune the watermark per image via carousel navigation
- **9-grid snap** — one-tap placement (top-left, center, bottom-right, etc.) with X/Y offset sliders for precision
- **iOS-native export** — triggers the share sheet via `navigator.share()` so images save directly to the Camera Roll; falls back to a long-press grid if the API is unavailable

---

## Usage

Open `index.html` in a browser (Safari on iPhone recommended for full share-sheet support).

> **Note:** `navigator.share()` requires a secure context (HTTPS or localhost). For local testing, serve with any static file server:
> ```bash
> npx serve .
> # or
> python -m http.server
> ```

---

## File Structure

```
├── index.html      # App shell & UI markup
├── app.js          # State management, event handling, render loop
├── watermark.js    # Canvas rendering & watermark positioning logic
├── storage.js      # localStorage persistence helpers
└── style.css       # Safe-area support, slider & snap-grid styles
```

---

## Controls

| Control | Description |
|---|---|
| **Add Watermark** | Upload a watermark image (PNG with transparency recommended) |
| **Batch / Single** | Toggle between global and per-image adjustment mode |
| **Snap grid** | 9-point anchor (numpad layout: 7=top-left → 3=bottom-right) |
| **X / Y Offset** | Fine-tune position ±50% relative to the snap anchor |
| **Scale** | Watermark width as a percentage of the image width (1–100%) |
| **Opacity** | Transparency from 0.0 (invisible) to 1.0 (fully opaque) |
| **Share** | Export all watermarked images at full resolution |

---

## Tech Stack

- **HTML5 Canvas** — real-time preview and full-resolution export
- **Vanilla ES Modules** — no framework, no bundler
- **Tailwind CSS** (CDN) — utility-first styling
- **Web Share API** — native iOS share sheet integration
- **localStorage** — watermark persistence across sessions
