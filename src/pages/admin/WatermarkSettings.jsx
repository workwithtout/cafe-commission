import { useEffect, useRef, useState } from 'react';
import { supabase, unwrap } from '../../lib/supabase.js';
import { useAsync, useSubmit } from '../../lib/hooks.js';
import { useSite } from '../../lib/site.jsx';
import { Alert, Button, ErrorState, Field, Loading } from '../../components/ui.jsx';
import { Icon } from '../../components/Decor.jsx';
import { uploadFile, removeFile } from '../../lib/storage.js';
import { WM_DEFAULTS, checkSourceFile, WM_POSITIONS, drawWatermark, labelFont, loadImageFrom } from '../../lib/imageTools.js';
import { AdminPanel } from './common.jsx';
import { play } from '../../lib/sound.js';

const SAMPLE_SHAPES = [
  { key: 'card', label: 'แนวนอน 4:3', ratio: 4 / 3 },
  { key: 'square', label: 'จัตุรัส 1:1', ratio: 1 },
  { key: 'portrait', label: 'แนวตั้ง 3:4', ratio: 3 / 4 },
  { key: 'wide', label: 'จอกว้าง 16:9', ratio: 16 / 9 },
];

/** A neutral sample picture (light and dark areas) so the watermark can be judged on both. */
function drawSample(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#a8d8ff'); g.addColorStop(0.5, '#ffd9e6'); g.addColorStop(1, '#6b4a42');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const m = Math.min(w, h);
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.beginPath(); ctx.arc(w * 0.27, h * 0.3, m * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8fd18c';
  ctx.beginPath(); ctx.moveTo(0, h); ctx.quadraticCurveTo(w * 0.35, h * 0.55, w * 0.7, h * 0.85); ctx.lineTo(w, h * 0.75); ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a3733';
  ctx.fillRect(w * 0.55, h * 0.38, m * 0.1, m * 0.3);
  ctx.fillStyle = '#ff8fab';
  ctx.beginPath(); ctx.arc(w * 0.6, h * 0.36, m * 0.16, 0, Math.PI * 2); ctx.fill();
}

function Preview({ cfg, imageSrc }) {
  const ref = useRef(null);
  const [shape, setShape] = useState('card');
  const [wmImage, setWmImage] = useState(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let alive = true;
    setWmImage(null); setImgError(false);
    if (cfg.type === 'image' && imageSrc) {
      loadImageFrom(imageSrc, { cors: !imageSrc.startsWith('blob:') })
        .then((i) => { if (alive) setWmImage(i); })
        .catch(() => { if (alive) setImgError(true); });
    }
    return () => { alive = false; };
  }, [cfg.type, imageSrc]);

  const ratio = SAMPLE_SHAPES.find((s) => s.key === shape).ratio;
  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    let alive = true;
    const paint = () => {
      if (!alive) return;
      const w = ratio >= 1 ? 640 : 480;
      const h = Math.round(w / ratio);
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      drawSample(ctx, w, h);
      drawWatermark(ctx, w, h, cfg, wmImage);
    };
    paint();
    // the text font may still be loading: draw again once fonts are ready
    document.fonts?.load(`700 40px ${labelFont()}`, cfg.text || 'ก').then(paint).catch(() => {});
    return () => { alive = false; };
  }, [cfg, wmImage, ratio]);

  const wide = cfg.type === 'image' ? 'ลายน้ำกว้างประมาณ' : 'ข้อความกว้างประมาณ';
  return (
    <div className="wm-preview">
      <div className="filters" role="group" aria-label="สัดส่วนรูปตัวอย่าง">
        {SAMPLE_SHAPES.map((s) => (
          <button key={s.key} type="button" className="chip" aria-pressed={shape === s.key} onClick={() => { play('tap'); setShape(s.key); }}>{s.label}</button>
        ))}
      </div>
      <canvas ref={ref} className="wm-preview__canvas" style={{ aspectRatio: String(ratio) }} aria-label="ตัวอย่างลายน้ำบนรูป" />
      <small>
        {wide} {cfg.size}% ของความกว้างรูป (บนรูปกว้าง 1,200 px ≈ {Math.round(cfg.size * 12)} px) · ระยะห่างจากขอบเป็นสัดส่วนของรูป จึงดูเท่ากันทุกสัดส่วน
        {cfg.type === 'image' && !imageSrc ? ' · ยังไม่ได้อัปโหลดภาพลายน้ำ' : ''}
        {cfg.type === 'text' && !cfg.text.trim() ? ' · ยังไม่ได้พิมพ์ข้อความ' : ''}
        {imgError ? ' · เปิดภาพลายน้ำไม่ได้' : ''}
      </small>
    </div>
  );
}

export default function WatermarkSettings() {
  const site = useSite();
  const q = useAsync(async () => unwrap(await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()), []);
  const fileInput = useRef(null);
  const [f, setF] = useState(null);
  const [img, setImg] = useState({ url: '', path: '', file: null, preview: '', removed: false });
  const [errs, setErrs] = useState({});
  const [ok, setOk] = useState(false);
  const [over, setOver] = useState(false);

  const migrated = !q.loading && q.data !== undefined && (q.data === null || 'watermark_gallery' in q.data);

  useEffect(() => {
    if (q.loading || q.data === undefined) return;
    const d = q.data || {};
    setF({
      watermark_gallery: Boolean(d.watermark_gallery), watermark_services: Boolean(d.watermark_services),
      watermark_type: d.watermark_type || WM_DEFAULTS.type, watermark_text: d.watermark_text || '',
      watermark_opacity: d.watermark_opacity ?? WM_DEFAULTS.opacity, watermark_position: d.watermark_position || WM_DEFAULTS.position,
      watermark_size: d.watermark_size ?? WM_DEFAULTS.size,
    });
    setImg({ url: d.watermark_image_url || '', path: d.watermark_image_path || '', file: null, preview: '', removed: false });
  }, [q.data, q.loading]);

  useEffect(() => () => { if (img.preview) URL.revokeObjectURL(img.preview); }, [img.preview]);

  const pickFile = (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) { play('error'); setErrs((e) => ({ ...e, image: 'เลือกได้เฉพาะไฟล์รูปภาพ (แนะนำ PNG พื้นใส)' })); return; }
    const tooBig = checkSourceFile(file);
    if (tooBig) { play('error'); setErrs((e) => ({ ...e, image: tooBig })); return; }
    setErrs((e) => ({ ...e, image: undefined }));
    setImg((prev) => ({ ...prev, file, preview: URL.createObjectURL(file), removed: false }));
  };

  const imageSrc = img.preview || (!img.removed ? img.url : '');

  const [save, busy, error] = useSubmit(async () => {
    setOk(false);
    const e = {};
    const anyOn = f.watermark_gallery || f.watermark_services;
    if (f.watermark_type === 'text' && anyOn && !f.watermark_text.trim()) e.text = 'พิมพ์ข้อความลายน้ำก่อน หรือปิดการใช้ลายน้ำ';
    if (f.watermark_type === 'image' && anyOn && !imageSrc) e.image = 'อัปโหลดภาพลายน้ำก่อน หรือปิดการใช้ลายน้ำ';
    setErrs(e);
    if (Object.keys(e).length) { play('error'); return; }

    let url = img.removed ? null : (img.url || null);
    let path = img.removed ? null : (img.path || null);
    const oldPath = img.path || null;
    let uploadedPath = null;
    if (img.file) {   // the watermark file is stored exactly as given: no resizing, no re-colouring, transparency kept
      const up = await uploadFile(img.file, 'watermark', { lossless: true });
      url = up.url; path = up.path; uploadedPath = up.path;
    }
    try {
      unwrap(await supabase.from('site_settings').upsert({
        id: 1, ...f, watermark_text: f.watermark_text.trim(), watermark_image_url: url, watermark_image_path: path, updated_at: new Date().toISOString(),
      }));
    } catch (err) {
      if (uploadedPath) await removeFile(uploadedPath);
      throw err;
    }
    if (oldPath && oldPath !== path) await removeFile(oldPath);   // only the current configuration is kept
    setImg({ url: url || '', path: path || '', file: null, preview: '', removed: false });
    await site.reload();
    play('success');
    setOk(true);
  });

  if (q.loading || !f) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const cfg = { type: f.watermark_type, text: f.watermark_text, imageUrl: imageSrc, opacity: Number(f.watermark_opacity), position: f.watermark_position, size: Number(f.watermark_size) };

  return (
    <AdminPanel label="Watermark" title="ลายน้ำบนรูป">
      {!migrated && <Alert kind="error">ฐานข้อมูลยังไม่ได้อัปเดตสำหรับลายน้ำ กรุณารันไฟล์ <code>supabase/migrations/006_watermark_settings.sql</code> ใน Supabase SQL Editor ก่อน</Alert>}
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <div className="wm-switches">
          <label className="check"><input type="checkbox" checked={f.watermark_gallery} onChange={(e) => setF({ ...f, watermark_gallery: e.target.checked })} /> ใส่ลายน้ำให้รูปในแกลลอรี่</label>
          <label className="check"><input type="checkbox" checked={f.watermark_services} onChange={(e) => setF({ ...f, watermark_services: e.target.checked })} /> ใส่ลายน้ำให้รูปเมนูงาน</label>
        </div>
        <Alert>ลายน้ำจะถูกใส่ลงในไฟล์รูปตอนอัปโหลดรูปใหม่ รูปที่อัปโหลดไว้แล้วจะไม่เปลี่ยน ถ้าเปลี่ยนข้อความหรือภาพลายน้ำ ค่าใหม่จะใช้กับรูปที่อัปโหลดต่อจากนี้ทันที (ไม่เก็บค่าเก่า)</Alert>

        <div className="field" role="radiogroup" aria-label="ชนิดลายน้ำ">
          <span className="field__label">ชนิดลายน้ำ</span>
          <div className="row">
            <label className="check"><input type="radio" name="wm-type" checked={f.watermark_type === 'text'} onChange={() => setF({ ...f, watermark_type: 'text' })} /> ข้อความ</label>
            <label className="check"><input type="radio" name="wm-type" checked={f.watermark_type === 'image'} onChange={() => setF({ ...f, watermark_type: 'image' })} /> ภาพของฉัน (PNG พื้นใสได้)</label>
          </div>
        </div>

        {f.watermark_type === 'text' ? (
          <Field label="ข้อความลายน้ำ" htmlFor="wm-text" error={errs.text} hint="พิมพ์อะไรก็ได้ เช่น ชื่อร้านหรือชื่อช่องทาง">
            <input id="wm-text" type="text" maxLength={80} value={f.watermark_text} onChange={set('watermark_text')} placeholder="เช่น ผลงานจากร้านนี้" />
          </Field>
        ) : (
          <div className="field">
            <span className="field__label">ภาพลายน้ำ</span>
            <div
              className={`dropzone ${over ? 'dropzone--over' : ''}`}
              onDragEnter={(e) => { e.preventDefault(); setOver(true); }} onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
              onDrop={(e) => { e.preventDefault(); setOver(false); pickFile(e.dataTransfer?.files?.[0]); }}
            >
              <div className="dropzone__thumb dropzone__thumb--checker">
                {imageSrc ? <img src={imageSrc} alt="ภาพลายน้ำที่เลือก" /> : <Icon name="image" size={34} />}
              </div>
              <div className="dropzone__body">
                <input ref={fileInput} type="file" hidden accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; pickFile(file); }} />
                <button type="button" className="dropzone__pick" onClick={() => fileInput.current?.click()}>
                  <Icon name="upload" size={22} />
                  <span><b className="dz-drag">ลากไฟล์มาวางที่นี่</b><b className="dz-tap">แตะเพื่อเลือกไฟล์</b><span className="dz-drag"> หรือกดเพื่อเลือกไฟล์</span></span>
                </button>
                <small>ใช้ไฟล์ลายน้ำสำเร็จรูป ระบบไม่ตัดพื้นใส ไม่เปลี่ยนสี และคงสัดส่วนเดิม ปรับได้เฉพาะความโปร่งใส</small>
                {imageSrc && <div className="actions"><Button small variant="danger" icon="trash" onClick={() => setImg({ ...img, file: null, preview: '', removed: true })}>เอาภาพลายน้ำออก</Button></div>}
              </div>
            </div>
            {errs.image && <span className="error" role="alert">{errs.image}</span>}
          </div>
        )}

        <div className="cols-2">
          <Field label={`ความโปร่งใส (Opacity) ${f.watermark_opacity}%`} htmlFor="wm-op" hint="ยิ่งน้อยยิ่งจาง">
            <input id="wm-op" type="range" min="5" max="100" step="1" value={f.watermark_opacity} onChange={set('watermark_opacity')} />
          </Field>
          <Field label={`ขนาด ${f.watermark_size}% ของความกว้างรูป`} htmlFor="wm-size">
            <input id="wm-size" type="range" min="5" max="60" step="1" value={f.watermark_size} onChange={set('watermark_size')} />
          </Field>
        </div>

        <div className="field">
          <span className="field__label" id="wm-pos-l">ตำแหน่ง</span>
          <div className="pos-grid" role="radiogroup" aria-labelledby="wm-pos-l">
            {WM_POSITIONS.map(([key, label]) => (
              <button
                key={key} type="button" role="radio" aria-checked={f.watermark_position === key} aria-label={label} title={label}
                className={`pos-grid__cell ${f.watermark_position === key ? 'is-on' : ''}`}
                onClick={() => { play('tap'); setF({ ...f, watermark_position: key }); }}
              ><span>{label}</span></button>
            ))}
          </div>
        </div>

        <h4>ตัวอย่าง</h4>
        <Preview cfg={cfg} imageSrc={imageSrc} />

        {error && <Alert kind="error">{error}</Alert>}
        {ok && <Alert kind="ok">บันทึกลายน้ำแล้ว ใช้กับรูปที่อัปโหลดต่อจากนี้</Alert>}
        <Button type="submit" variant="primary" disabled={busy || !migrated}>{busy ? 'กำลังบันทึก…' : 'บันทึกลายน้ำ'}</Button>
      </form>
    </AdminPanel>
  );
}
