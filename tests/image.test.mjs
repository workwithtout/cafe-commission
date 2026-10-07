import assert from 'node:assert/strict';
import { placeBox, watermarkBox, clampView, cropFromView, watermarkConfigFor, WM_POSITIONS, WM_MARGIN } from '../src/lib/imageTools.js';

let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('ok -', name); };
const SIZES = [[1600, 1200], [1000, 1000], [900, 1600], [3200, 800], [600, 2400]];

t('9 watermark positions', () => assert.equal(WM_POSITIONS.length, 9));
t('every position stays fully inside the image, for every shape', () => {
  for (const [w, h] of SIZES) for (const [p] of WM_POSITIONS) for (const size of [5, 22, 60]) for (const r of [0.5, 1, 4]) {
    const b = watermarkBox(w, h, r, { position: p, size });
    assert.ok(b.x >= -0.5 && b.y >= -0.5 && b.x + b.w <= w + 0.5 && b.y + b.h <= h + 0.5, `${w}x${h} ${p} ${size} ${r}`);
  }
});
t('margin is proportional to the shorter side', () => {
  for (const [w, h] of SIZES) {
    const b = placeBox(w, h, 10, 10, 'top-left');
    assert.equal(b.x, Math.round(Math.min(w, h) * WM_MARGIN));
    assert.equal(b.y, b.x);
  }
});
t('image watermark keeps its aspect ratio', () => {
  for (const [w, h] of SIZES) for (const r of [0.4, 1, 3]) {
    const b = watermarkBox(w, h, r, { size: 30 });
    assert.ok(Math.abs(b.w / b.h - r) < 1e-6);
  }
});
t('center is centered', () => { const b = placeBox(1000, 600, 100, 50, 'center'); assert.equal(b.x, 450); assert.equal(b.y, 275); });
t('editor view: image always covers the frame', () => {
  const v = clampView({ natW: 4000, natH: 1000, vw: 400, vh: 300, scale: 0.01, x: 500, y: 500 });
  assert.ok(v.scale >= 0.3 - 1e-9 && v.x <= 0 && v.y <= 0);
  assert.ok(v.x >= 400 - 4000 * v.scale - 1e-9);
});
t('editor view: zoom is limited to 6x of the minimum', () => {
  const v = clampView({ natW: 1000, natH: 1000, vw: 300, vh: 300, scale: 99, x: 0, y: 0 });
  assert.ok(Math.abs(v.scale - 0.3 * 6) < 1e-9);
});
t('crop rectangle matches the frame ratio and stays inside the picture', () => {
  for (const [w, h] of SIZES) for (const ratio of [1, 4 / 3, 3 / 4, 16 / 9, 4]) {
    const vw = 300; const vh = vw / ratio;
    const c = cropFromView({ natW: w, natH: h, vw, vh, scale: 0, x: -50, y: -50 });
    assert.ok(Math.abs(c.sw / c.sh - ratio) < 1e-6);
    assert.ok(c.sx >= -1e-6 && c.sy >= -1e-6 && c.sx + c.sw <= w + 1e-6 && c.sy + c.sh <= h + 1e-6, `${w}x${h} ${ratio}`);
  }
});
t('watermark config: per-feature switch and completeness', () => {
  const s = { watermark_gallery: true, watermark_services: false, watermark_type: 'text', watermark_text: 'me', watermark_opacity: 50 };
  assert.equal(watermarkConfigFor(s, 'gallery').text, 'me');
  assert.equal(watermarkConfigFor(s, 'services'), null);
  assert.equal(watermarkConfigFor({ ...s, watermark_text: ' ' }, 'gallery'), null);
  assert.equal(watermarkConfigFor({ ...s, watermark_type: 'image' }, 'gallery'), null);
  assert.equal(watermarkConfigFor(null, 'gallery'), null);
});
console.log(`\n${n} image tests passed`);
