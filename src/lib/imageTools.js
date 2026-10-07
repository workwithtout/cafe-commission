// Image helpers shared by the image editor, the watermark preview and the tests.
// Everything that decides WHERE something goes is expressed in fractions of the image,
// never in fixed pixels, so the result looks the same on every aspect ratio and screen.

export const WM_POSITIONS = [
  ['top-left', 'บนซ้าย'], ['top-center', 'บนกลาง'], ['top-right', 'บนขวา'],
  ['middle-left', 'กลางซ้าย'], ['center', 'กลาง'], ['middle-right', 'กลางขวา'],
  ['bottom-left', 'ล่างซ้าย'], ['bottom-center', 'ล่างกลาง'], ['bottom-right', 'ล่างขวา'],
];

export const WM_DEFAULTS = {
  type: 'text', text: '', imageUrl: '', opacity: 40, position: 'bottom-right', size: 22,
};

/** Margin from the edge = a fixed share of the SHORTER side, so it feels the same on wide and tall images. */
export const WM_MARGIN = 0.035;

const POS = {
  'top-left': ['top', 'left'], 'top-center': ['top', 'center'], 'top-right': ['top', 'right'],
  'middle-left': ['middle', 'left'], center: ['middle', 'center'], 'middle-right': ['middle', 'right'],
  'bottom-left': ['bottom', 'left'], 'bottom-center': ['bottom', 'center'], 'bottom-right': ['bottom', 'right'],
};

/** Places a bw x bh box inside a w x h image at one of the 9 positions, with a proportional margin. */
export function placeBox(w, h, bw, bh, position = 'bottom-right') {
  const margin = Math.round(Math.min(w, h) * WM_MARGIN);
  const [vt, hz] = POS[position] || POS['bottom-right'];
  const x = hz === 'left' ? margin : hz === 'right' ? w - margin - bw : (w - bw) / 2;
  const y = vt === 'top' ? margin : vt === 'bottom' ? h - margin - bh : (h - bh) / 2;
  return { x, y, w: bw, h: bh, margin };
}

/**
 * Box of an IMAGE watermark of ratio (bw / bh) on a w x h image.
 * `size` = watermark width as % of the image width (limited so it never covers more than ~45% of the height).
 */
export function watermarkBox(w, h, ratio, { position = 'bottom-right', size = 22 } = {}) {
  const r = ratio || 1;
  const margin = Math.round(Math.min(w, h) * WM_MARGIN);
  let bw = (w * size) / 100;
  let bh = bw / r;
  if (bh > h * 0.45) { bh = h * 0.45; bw = bh * r; }
  if (bw > w - margin * 2) { bw = Math.max(1, w - margin * 2); bh = bw / r; }
  return placeBox(w, h, bw, bh, position);
}

let measureCtx;
function ctx2d() {
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
  return measureCtx;
}

export function labelFont() {
  const f = getComputedStyle(document.documentElement).getPropertyValue('--font-label').trim();
  return f || "'Itim', sans-serif";
}

/** Draws the watermark onto ctx (a canvas of w x h). `wmImage` is a loaded <img> for image watermarks. */
export function drawWatermark(ctx, w, h, cfg, wmImage) {
  const opacity = Math.min(100, Math.max(5, Number(cfg.opacity) || 40)) / 100;
  ctx.save();
  ctx.globalAlpha = opacity;
  if (cfg.type === 'image') {
    if (!wmImage || !wmImage.naturalWidth) { ctx.restore(); return false; }
    const box = watermarkBox(w, h, wmImage.naturalWidth / wmImage.naturalHeight, cfg);
    // drawn as-is: transparency, colours and aspect ratio untouched; only opacity is applied
    ctx.drawImage(wmImage, box.x, box.y, box.w, box.h);
  } else {
    const text = String(cfg.text || '').trim();
    if (!text) { ctx.restore(); return false; }
    const family = labelFont();
    const m = ctx2d();
    m.font = `700 100px ${family}`;
    const tw100 = m.measureText(text).width || 1;
    const targetW = (w * (Number(cfg.size) || 22)) / 100;
    let px = (targetW / tw100) * 100;
    px = Math.min(px, h * 0.2);                 // never taller than 20% of the image
    ctx.font = `700 ${px}px ${family}`;
    const textW = Math.min(ctx.measureText(text).width, w * 0.94);
    const box = placeBox(w, h, textW, px * 1.2, cfg.position);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const cx = box.x; const cy = box.y + box.h / 2;
    // soft outline so light text stays readable on light pictures and dark text on dark ones
    ctx.lineWidth = Math.max(1, px * 0.08);
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, cx, cy);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, cx, cy);
  }
  ctx.restore();
  return true;
}

/** Everything an image watermark / text watermark needs to be drawn, from the shop's settings row. null = off. */
export function watermarkConfigFor(settings, kind) {
  if (!settings) return null;
  const on = kind === 'gallery' ? settings.watermark_gallery : kind === 'services' ? settings.watermark_services : false;
  if (!on) return null;
  const type = settings.watermark_type === 'image' ? 'image' : 'text';
  if (type === 'text' && !String(settings.watermark_text || '').trim()) return null;
  if (type === 'image' && !settings.watermark_image_url) return null;
  return {
    type, text: settings.watermark_text || '', imageUrl: settings.watermark_image_url || '',
    opacity: settings.watermark_opacity ?? 40, position: settings.watermark_position || 'bottom-right', size: settings.watermark_size ?? 22,
  };
}

/** Loads what the canvas needs before drawing: the web font (text) or the watermark picture (image). */
export async function prepareWatermark(cfg) {
  if (!cfg) return { cfg: null, wmImage: null };
  if (cfg.type === 'image') {
    try {
      return { cfg, wmImage: await loadImageFrom(cfg.imageUrl, { cors: true }) };
    } catch {
      throw new Error('โหลดภาพลายน้ำไม่สำเร็จ ลองใหม่อีกครั้ง หรืออัปโหลดลายน้ำใหม่ที่ตั้งค่าลายน้ำ');
    }
  }
  try { await document.fonts?.load(`700 40px ${labelFont()}`, cfg.text); } catch { /* fall back to the default font */ }
  return { cfg, wmImage: null };
}

export function loadImageFrom(src, { cors = false } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('เปิดไฟล์ภาพไม่ได้'));
    img.src = src;
  });
}

const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));

/* ------------------------------------------------------------------ file size policy */
/** Size the processed file should stay under. Bigger sources are shrunk automatically before they reach Storage. */
export const TARGET_BYTES = 5 * 1024 * 1024;
/** Largest ORIGINAL file we are willing to open in the browser at all. */
export const HARD_LIMIT_BYTES = 50 * 1024 * 1024;

export const fmtBytes = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** null = fine, otherwise a Thai message for the user. Runs BEFORE anything is decoded or uploaded. */
export function checkSourceFile(file) {
  if (!file) return 'ยังไม่ได้เลือกไฟล์';
  if (!/^image\//.test(file.type || '')) return 'เลือกได้เฉพาะไฟล์รูปภาพ (png / jpg / webp / gif / svg)';
  if (file.size > HARD_LIMIT_BYTES) return `ไฟล์ใหญ่เกินไป (${fmtBytes(file.size)}) รับไฟล์ต้นฉบับไม่เกิน 50 MB ไม่มีการอัปโหลด`;
  return null;
}

/**
 * The attempts made, in order, until the file fits under the target:
 * first lower the quality a little, then shrink the picture by 15% and start again.
 * Quality never drops below 0.74 (artwork keeps its detail), pixels give way first.
 */
export function compressionAttempts({ lossless = false, minSide = 640, w, h } = {}) {
  const out = [];
  let scale = 1;
  for (let round = 0; round < 12; round += 1) {
    if (Math.min(w * scale, h * scale) < minSide && round > 0) break;
    const qs = lossless ? [1] : round === 0 ? [0.9, 0.82, 0.74] : [0.8, 0.74];
    for (const q of qs) out.push({ quality: q, scale });
    scale *= 0.85;
  }
  return out;
}

/**
 * Draws `source` (a canvas) into the smallest-loss file that fits under `target`.
 * WebP keeps transparency. Browsers that cannot encode WebP get PNG (alpha) or JPEG.
 * `lossless` (watermark pictures) only ever uses PNG so colours and transparency stay exactly as drawn.
 */
export async function encodeUnder(source, { hasAlpha = true, lossless = false, target = TARGET_BYTES } = {}) {
  const w0 = source.width; const h0 = source.height;
  let best = null;
  let canvas = source; let scale = 1;
  let types = lossless ? ['image/png'] : ['image/webp'];
  for (const a of compressionAttempts({ lossless, w: w0, h: h0 })) {
    if (a.scale !== scale) {
      scale = a.scale;
      canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w0 * scale)); canvas.height = Math.max(1, Math.round(h0 * scale));
      const c = canvas.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(source, 0, 0, canvas.width, canvas.height);
    }
    let blob = await toBlob(canvas, types[0], a.quality);
    if (types[0] === 'image/webp' && (!blob || blob.type !== 'image/webp')) {          // no WebP encoder here
      types = [hasAlpha ? 'image/png' : 'image/jpeg'];
      blob = await toBlob(canvas, types[0], a.quality);
    }
    if (!blob) throw new Error('สร้างรูปไม่สำเร็จ');
    best = { blob, width: canvas.width, height: canvas.height };
    if (blob.size <= target) return { ...best, fits: true };
  }
  return { ...best, fits: false };
}

const extFor = (type) => (type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'jpg');
const baseName = (name) => String(name).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'image';

/**
 * Crop (in the image's own pixels) + shrink to maxSide + optional watermark -> File, kept under TARGET_BYTES.
 */
export function sourceSize(img) {
  const natW = img.naturalWidth || img.width || 1024;
  const natH = img.naturalHeight || img.height || Math.round(natW * 0.75);
  return { natW, natH };
}

export async function renderCrop(img, crop, { maxSide = 1600, sourceType = 'image/jpeg', name = 'image', watermark = null, wmImage = null } = {}) {
  const f = Math.min(1, maxSide / Math.max(crop.sw, crop.sh));
  const w = Math.max(1, Math.round(crop.sw * f));
  const h = Math.max(1, Math.round(crop.sh * f));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
  if (watermark) drawWatermark(ctx, w, h, watermark, wmImage);
  const out = await encodeUnder(canvas, { hasAlpha: /png|webp|gif|svg/.test(sourceType) });
  if (!out.fits) throw new Error('บีบอัดรูปให้ไม่เกิน 5 MB ไม่สำเร็จ ลองเลือกรูปที่เล็กลง');
  return { file: new File([out.blob], `${baseName(name)}.${extFor(out.blob.type)}`, { type: out.blob.type }), width: out.width, height: out.height };
}

/**
 * Safety net for files that are uploaded WITHOUT the editor (e.g. the watermark picture):
 * a file already under the target is returned untouched; a bigger one is re-encoded under it.
 * `lossless` keeps PNG (transparency and colours exact) and only reduces the pixel size.
 */
export async function shrinkToTarget(file, { lossless = false, target = TARGET_BYTES } = {}) {
  if (file.size <= target) return file;
  if (file.type === 'image/svg+xml') throw new Error(`ไฟล์ SVG ใหญ่เกิน ${fmtBytes(target)} บีบอัดอัตโนมัติไม่ได้ กรุณาใช้ไฟล์ที่เล็กลง`);
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImageFrom(url);
    const { natW, natH } = sourceSize(img);
    const canvas = document.createElement('canvas');
    canvas.width = natW; canvas.height = natH;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const out = await encodeUnder(canvas, { hasAlpha: file.type !== 'image/jpeg', lossless, target });
    if (!out.fits) throw new Error('บีบอัดรูปให้ไม่เกิน 5 MB ไม่สำเร็จ');
    return new File([out.blob], `${baseName(file.name)}.${extFor(out.blob.type)}`, { type: out.blob.type });
  } finally { URL.revokeObjectURL(url); }
}

/**
 * Pure geometry of the editor: image of natW x natH shown in a viewport of vw x vh at `scale`,
 * top-left of the image at (x, y). Returns the clamped position (the image always covers the frame)
 * and the matching crop rectangle in image pixels.
 */
export function clampView({ natW, natH, vw, vh, scale, x, y }) {
  const min = Math.max(vw / natW, vh / natH);
  const s = Math.min(Math.max(scale, min), min * 6);
  const iw = natW * s; const ih = natH * s;
  const cx = Math.min(0, Math.max(vw - iw, x));
  const cy = Math.min(0, Math.max(vh - ih, y));
  return { scale: s, x: cx, y: cy, min };
}

export function cropFromView({ natW, natH, vw, vh, scale, x, y }) {
  const v = clampView({ natW, natH, vw, vh, scale, x, y });
  return { sx: -v.x / v.scale, sy: -v.y / v.scale, sw: vw / v.scale, sh: vh / v.scale };
}
