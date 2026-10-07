import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, IconButton, Alert } from './ui.jsx';
import { Icon } from './Decor.jsx';
import { clampView, cropFromView, drawWatermark, loadImageFrom, renderCrop, sourceSize } from '../lib/imageTools.js';
import { play } from '../lib/sound.js';

/**
 * Crop / zoom / move editor shown BEFORE an image is uploaded.
 *  - Mouse: drag to move, wheel or +/- to zoom.   Touch: drag to move, pinch (or +/-) to zoom.
 *  - Keyboard: arrow keys move, + / - zoom.
 *  - The frame has the shape (aspect ratio) that suits the place the picture will be used.
 *  - The small preview is drawn with the very same code that produces the uploaded file,
 *    so it includes the watermark exactly as it will appear.
 *
 * Props
 *   file           the picked File
 *   choices        [{ key, label, ratio }]  ratio = width / height, or null for "original ratio"
 *   defaultChoice  key of the choice that starts selected
 *   round          show a circular guide (avatars)
 *   maxSide        longest side of the final image in px
 *   watermark      { cfg, wmImage } | null
 *   onCancel()     onDone({ file, width, height })
 */
export default function ImageEditor({ file, choices, defaultChoice, round = false, maxSide = 1600, watermark = null, title = 'จัดรูปก่อนอัปโหลด', onCancel, onDone }) {
  const [img, setImg] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [choice, setChoice] = useState(defaultChoice || choices[0].key);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [box, setBox] = useState({ w: 300, h: 300 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const wrapRef = useRef(null);
  const frameRef = useRef(null);
  const previewRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const boxRef = useRef(box);
  const viewRef = useRef(view);
  boxRef.current = box;
  viewRef.current = view;

  /* ---- load the picked file ---- */
  useEffect(() => {
    let alive = true;
    const url = URL.createObjectURL(file);
    loadImageFrom(url)
      .then((i) => { if (alive) setImg(i); })
      .catch(() => { if (alive) setLoadError('เปิดไฟล์รูปนี้ไม่ได้ ลองเลือกไฟล์อื่น (png / jpg / webp)'); });
    return () => { alive = false; URL.revokeObjectURL(url); };
  }, [file]);

  const size = useMemo(() => (img ? sourceSize(img) : { natW: 1, natH: 1 }), [img]);
  const current = choices.find((c) => c.key === choice) || choices[0];
  const ratio = current.ratio || size.natW / size.natH;

  /* ---- frame size: as wide as the dialog allows, never taller than ~55% of the screen ---- */
  const measure = useCallback(() => {
    const avail = Math.max(160, Math.min(wrapRef.current?.clientWidth || 320, 560));
    const maxH = Math.max(160, Math.round(window.innerHeight * 0.5));
    let w = avail; let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    setBox({ w: Math.round(w), h: Math.round(h) });
  }, [ratio]);
  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  /* ---- start (and whenever frame shape changes): whole picture visible, centred ---- */
  useEffect(() => {
    if (!img) return;
    const min = Math.max(box.w / size.natW, box.h / size.natH);
    setView(clampView({ ...size, vw: box.w, vh: box.h, scale: min, x: (box.w - size.natW * min) / 2, y: (box.h - size.natH * min) / 2 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, choice, box.w, box.h]);

  const apply = useCallback((next) => {
    const b = boxRef.current;
    setView(clampView({ ...size, vw: b.w, vh: b.h, ...next }));
  }, [size]);

  const zoomAround = useCallback((factor, cx, cy) => {
    const v = viewRef.current;
    const b = boxRef.current;
    const px = cx ?? b.w / 2; const py = cy ?? b.h / 2;
    const target = clampView({ ...size, vw: b.w, vh: b.h, scale: v.scale * factor, x: v.x, y: v.y });
    const k = target.scale / v.scale;
    apply({ scale: target.scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
  }, [apply, size]);

  /* ---- pointer gestures (mouse + touch + pen) ---- */
  const local = (e) => { const r = frameRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onPointerDown = (e) => {
    if (!img) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    const pts = [...pointers.current.values()];
    gesture.current = pts.length === 2
      ? { type: 'pinch', d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) }
      : { type: 'drag' };
  };
  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId);
    const now = local(e);
    pointers.current.set(e.pointerId, now);
    const pts = [...pointers.current.values()];
    if (pts.length >= 2 && gesture.current?.type === 'pinch') {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (gesture.current.d > 0) zoomAround(d / gesture.current.d, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      gesture.current.d = d;
    } else if (pts.length === 1) {
      const v = viewRef.current;
      apply({ scale: v.scale, x: v.x + (now.x - prev.x), y: v.y + (now.y - prev.y) });
    }
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    const pts = [...pointers.current.values()];
    gesture.current = pts.length === 1 ? { type: 'drag' } : null;
  };

  // wheel needs a non-passive listener so the page does not scroll while zooming
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAround(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAround, img]);

  const onKeyDown = (e) => {
    const v = viewRef.current; const step = 24;
    if (e.key === 'ArrowLeft') apply({ ...v, x: v.x + step });
    else if (e.key === 'ArrowRight') apply({ ...v, x: v.x - step });
    else if (e.key === 'ArrowUp') apply({ ...v, y: v.y + step });
    else if (e.key === 'ArrowDown') apply({ ...v, y: v.y - step });
    else if (e.key === '+' || e.key === '=') zoomAround(1.15);
    else if (e.key === '-' || e.key === '_') zoomAround(1 / 1.15);
    else return;
    e.preventDefault();
  };

  /* ---- keep this dialog's Escape / Tab to itself (it can sit on top of another dialog) ---- */
  const rootRef = useRef(null);
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    play('open');
    rootRef.current?.querySelector('[data-autofocus]')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); if (!busyRef.current) onCancel(); }
      if (e.key === 'Tab' && rootRef.current) {
        e.stopPropagation();
        const f = rootRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const a = f[0]; const z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); document.body.style.overflow = prevOverflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const busyRef = useRef(false);
  busyRef.current = busy;

  /* ---- live preview (same drawing code as the real result) ---- */
  const crop = useMemo(() => (img ? cropFromView({ ...size, vw: box.w, vh: box.h, ...view }) : null), [img, size, box, view]);
  const outSize = useMemo(() => {
    if (!crop) return { w: 0, h: 0 };
    const f = Math.min(1, maxSide / Math.max(crop.sw, crop.sh));
    return { w: Math.max(1, Math.round(crop.sw * f)), h: Math.max(1, Math.round(crop.sh * f)) };
  }, [crop, maxSide]);
  useEffect(() => {
    const c = previewRef.current;
    if (!c || !img || !crop) return;
    const pw = 160; const ph = Math.max(1, Math.round(pw / ratio));
    c.width = pw; c.height = ph;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, pw, ph);
    ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, pw, ph);
    if (watermark?.cfg) drawWatermark(ctx, pw, ph, watermark.cfg, watermark.wmImage);
  }, [img, crop, ratio, watermark]);

  const min = img ? Math.max(box.w / size.natW, box.h / size.natH) : 1;
  const zoomT = img ? Math.log(view.scale / min) / Math.log(6) : 0;

  const confirm = async () => {
    if (!img || busy) return;
    setBusy(true); setError('');
    try {
      const out = await renderCrop(img, crop, { maxSide, sourceType: file.type, name: file.name, watermark: watermark?.cfg || null, wmImage: watermark?.wmImage || null });
      play('success');
      onDone(out);
    } catch (e) {
      setError(e.message || 'ทำรูปไม่สำเร็จ ลองใหม่อีกครั้ง');
      setBusy(false);
    }
  };

  const ui = (
    <div className="ie-back" ref={rootRef}>
      <div className="ie" role="dialog" aria-modal="true" aria-labelledby="ie-title">
        <IconButton icon="close" label="ยกเลิกการจัดรูป" className="modal__close" sfx="close" onClick={onCancel} disabled={busy} />
        <h3 id="ie-title">{title}</h3>

        {choices.length > 1 && (
          <div className="filters ie__choices" role="group" aria-label="สัดส่วนรูป">
            {choices.map((c) => (
              <button key={c.key} type="button" className="chip" aria-pressed={choice === c.key} onClick={() => { play('tap'); setChoice(c.key); }}>{c.label}</button>
            ))}
          </div>
        )}

        <div className="ie__stage" ref={wrapRef}>
          {loadError ? <Alert kind="error">{loadError}</Alert> : (
            <div
              ref={frameRef} className={`ie__frame ${round ? 'ie__frame--round' : ''}`} style={{ width: box.w, height: box.h }}
              tabIndex={0} role="application" aria-label="พื้นที่จัดรูป: ลากเพื่อเลื่อน หนีบหรือเลื่อนล้อเมาส์เพื่อซูม ใช้ลูกศรและ + - ได้"
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown}
            >
              {img ? (
                <img
                  src={img.src} alt="" draggable={false}
                  style={{ width: size.natW * view.scale, height: size.natH * view.scale, transform: `translate(${view.x}px, ${view.y}px)` }}
                />
              ) : <span className="ie__wait">กำลังเปิดรูป…</span>}
              {round && <span className="ie__ring" aria-hidden="true" />}
            </div>
          )}
        </div>

        <div className="ie__zoom">
          <IconButton icon="minus" label="ซูมออก" sfx="tap" onClick={() => zoomAround(1 / 1.2)} disabled={!img} />
          <input
            type="range" min="0" max="1" step="0.01" value={Math.min(1, Math.max(0, zoomT))} disabled={!img}
            aria-label="ซูม" onChange={(e) => { const t = Number(e.target.value); const b = boxRef.current; const v = viewRef.current; const target = min * (6 ** t); const k = target / v.scale; apply({ scale: target, x: b.w / 2 - (b.w / 2 - v.x) * k, y: b.h / 2 - (b.h / 2 - v.y) * k }); }}
          />
          <IconButton icon="plus" label="ซูมเข้า" sfx="tap" onClick={() => zoomAround(1.2)} disabled={!img} />
        </div>
        <p className="ie__hint">ลากรูปเพื่อเลื่อน · หนีบสองนิ้วหรือใช้แถบ/ล้อเมาส์เพื่อซูม</p>

        <div className="ie__result">
          <canvas ref={previewRef} className="ie__preview" aria-label="ตัวอย่างรูปที่จะอัปโหลด" style={round ? { borderRadius: '50%' } : undefined} />
          <div>
            <b>ตัวอย่างรูปที่จะอัปโหลด</b>
            <div className="ie__meta">{outSize.w} × {outSize.h} px{watermark?.cfg ? ' · ใส่ลายน้ำแล้ว' : ''}</div>
            {file.type === 'image/gif' && <div className="ie__meta">GIF จะถูกแปลงเป็นภาพนิ่ง</div>}
          </div>
        </div>

        {error && <Alert kind="error">{error}</Alert>}
        <div className="row row--end ie__actions">
          <Button onClick={onCancel} sfx="close" disabled={busy}>ยกเลิก</Button>
          <Button variant="primary" icon="check" onClick={confirm} disabled={!img || busy} data-autofocus>{busy ? 'กำลังทำรูป…' : 'ใช้รูปนี้'}</Button>
        </div>
      </div>
    </div>
  );
  return createPortal(ui, document.body);
}
