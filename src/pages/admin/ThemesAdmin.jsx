import { useRef, useState } from 'react';
import { supabase, unwrap } from '../../lib/supabase.js';
import { useAsync, useSubmit } from '../../lib/hooks.js';
import { useSite, resolveTheme } from '../../lib/site.jsx';
import { Alert, Button, ConfirmDialog, ErrorState, Field, IconButton, Loading, Modal } from '../../components/ui.jsx';
import { MOTIFS } from '../../components/Decor.jsx';
import { FONT_CHOICES, MOTIF_KEYS, PALETTES, defaultsForTheme } from '../../themes/palettes.js';
import { uploadFile, removeFile, assertRemoved } from '../../lib/storage.js';
import { AdminPanel, deleteRows, ImagePicker, SHAPES } from './common.jsx';
import { useImageIntake } from '../../components/ImagePicker.jsx';
import { Icon } from '../../components/Decor.jsx';
import { play } from '../../lib/sound.js';

const COLOR_KEYS = [
  ['--c-main', 'สีหลัก'], ['--c-main-dark', 'สีหลัก (เข้ม)'], ['--c-main-soft', 'สีหลัก (อ่อน)'], ['--ribbon', 'ริบบิ้น'],
  ['--awning-b', 'กันสาดลาย'], ['--bg', 'พื้นหลังหน้าเว็บ'], ['--frame', 'กรอบ'], ['--ink', 'เส้นขอบ / ตัวอักษรหัวข้อ'],
];

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function StickerList({ items, onChange }) {
  const ref = useRef(null);
  const [over, setOver] = useState(false);
  const intake = useImageIntake({
    choices: [SHAPES.original, SHAPES.square], defaultChoice: 'original', maxSide: 600,
    onResult: (file) => onChange([...items, { file, preview: URL.createObjectURL(file) }]),
  });
  return (
    <div className="field">
      <span className="field__label">รูปสติกเกอร์ของธีม (ไม่บังคับ — ถ้าใส่จะใช้แทนสติกเกอร์ที่วาดไว้)</span>
      <div className="img-pick">
        {items.map((s, i) => (
          <div key={i} className="sticker-thumb">
            <img src={s.preview || s.url} alt={`สติกเกอร์ ${i + 1}`} />
            <IconButton icon="trash" label={`ลบสติกเกอร์ ${i + 1}`} onClick={() => onChange(items.filter((_, k) => k !== i))} />
          </div>
        ))}
      </div>
      {items.length < 6 && (
        <div
          className={`dropzone dropzone--compact ${over ? 'dropzone--over' : ''}`}
          onDragEnter={(e) => { e.preventDefault(); setOver(true); }} onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer?.files?.[0]; if (f) intake.start(f); }}
        >
          <input ref={ref} type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; intake.start(f); }} />
          <button type="button" className="dropzone__pick" onClick={() => ref.current?.click()}>
            <Icon name="upload" size={22} />
            <span><b className="dz-drag">ลากรูปมาวางที่นี่</b><b className="dz-tap">แตะเพื่อเลือกรูป</b><span className="dz-drag"> หรือกดเพื่อเลือกไฟล์</span> (เพิ่มได้ {6 - items.length} ชิ้น)</span>
          </button>
        </div>
      )}
      {intake.error && <span className="error" role="alert">{intake.error}</span>}
      {intake.editor}
    </div>
  );
}

function ThemeForm({ theme, onClose, onSaved }) {
  const creating = !theme;
  const base = theme?.config || {};
  const [name, setName] = useState(theme?.name || '');
  const [slug, setSlug] = useState(theme?.slug || '');
  const [motif, setMotif] = useState(base.motif || 'strawberry');
  const [vars, setVars] = useState(() => {
    const pal = PALETTES[base.motif || 'strawberry'];
    return Object.fromEntries(COLOR_KEYS.map(([k]) => [k, (base.vars && base.vars[k]) || pal[k]]));
  });
  const [fonts, setFonts] = useState({ display: base.fonts?.display || 'Mali', label: base.fonts?.label || 'Itim', body: 'Noto Sans Thai Looped' });
  const [pitch, setPitch] = useState(base.sfx_pitch ?? 1);
  const paths = base.paths || {};
  const [bg, setBg] = useState({ url: base.bg_image_url || '' });
  const [header, setHeader] = useState({ url: base.header_image_url || '' });
  const [stickers, setStickers] = useState((base.sticker_urls || []).map((url, i) => ({ url, path: paths.stickers?.[i] || null })));
  const [errs, setErrs] = useState({});

  const pickMotif = (m) => {
    setMotif(m);
    // switching world resets the palette to that world's defaults so the pack stays coherent
    setVars(Object.fromEntries(COLOR_KEYS.map(([k]) => [k, PALETTES[m][k]])));
  };

  const [confirmReset, setConfirmReset] = useState(false);

  const [save, busy, error] = useSubmit(async (override) => {
    // `override` is used by "Reset to default" so the defaults are saved directly, not whatever is in the form
    const cur = override || { motif, vars, fonts, pitch, bg, header, stickers };
    const e = {};
    if (!name.trim()) e.name = 'ต้องมีชื่อธีม';
    const finalSlug = creating ? (slug || slugify(name)) : theme.slug;
    if (!/^[a-z0-9-]+$/.test(finalSlug)) e.slug = 'slug ใช้ได้เฉพาะ a-z 0-9 และ -';
    setErrs(e);
    if (Object.keys(e).length) { play('error'); return; }

    const uploaded = [];       // for rollback if the DB write fails
    const toDelete = [];       // old files, removed only after success
    try {
      const handle = async (val, folder, oldPath) => {
        if (val.file) {
          const up = await uploadFile(val.file, folder); uploaded.push(up.path);
          if (oldPath) toDelete.push(oldPath);
          return { url: up.url, path: up.path };
        }
        if (val.removed) { if (oldPath) toDelete.push(oldPath); return { url: '', path: null }; }
        return { url: val.url || '', path: oldPath || null };
      };
      const b = await handle(cur.bg, `themes/${finalSlug}`, paths.bg_image);
      const h = await handle(cur.header, `themes/${finalSlug}`, paths.header_image);
      const stickerOut = [];
      for (const s of cur.stickers) {
        if (s.file) { const up = await uploadFile(s.file, `themes/${finalSlug}`); uploaded.push(up.path); stickerOut.push({ url: up.url, path: up.path }); }
        else stickerOut.push({ url: s.url, path: s.path });
      }
      (paths.stickers || []).forEach((p) => { if (p && !stickerOut.some((s) => s.path === p)) toDelete.push(p); });

      const config = {
        ...base, motif: cur.motif, vars: cur.vars, fonts: cur.fonts, sfx_pitch: Number(cur.pitch) || 1,
        bg_image_url: b.url, header_image_url: h.url, sticker_urls: stickerOut.map((s) => s.url),
        paths: { bg_image: b.path, header_image: h.path, stickers: stickerOut.map((s) => s.path) },
      };
      if (creating) unwrap(await supabase.from('themes').insert({ slug: finalSlug, name: name.trim(), config }));
      else unwrap(await supabase.from('themes').update({ name: name.trim(), config }).eq('id', theme.id));
    } catch (err) {
      await Promise.all(uploaded.map(removeFile));
      if (err.code === '23505') throw new Error('slug นี้มีธีมใช้อยู่แล้ว ลองชื่ออื่นนะ');
      throw err;
    }
    await Promise.all(toDelete.map(removeFile));
    play('success');
    onSaved();
  });

  const doReset = async () => {
    const d = defaultsForTheme(theme, motif);
    const fresh = {
      motif: d.motif, vars: Object.fromEntries(COLOR_KEYS.map(([k]) => [k, PALETTES[d.motif][k]])),
      fonts: { display: d.fonts.display, label: d.fonts.label, body: 'Noto Sans Thai Looped' }, pitch: d.sfx_pitch,
      bg: { url: '', removed: true }, header: { url: '', removed: true }, stickers: [],
    };
    setMotif(fresh.motif); setVars(fresh.vars); setFonts(fresh.fonts); setPitch(fresh.pitch); setBg(fresh.bg); setHeader(fresh.header); setStickers(fresh.stickers);
    setConfirmReset(false);
    if (creating) { play('success'); return; }   // nothing is saved yet for a new theme: just back to the defaults
    await save(fresh);
  };

  const preview = resolveTheme({ slug: 'preview', name, config: { motif, vars, fonts } });
  return (
    <Modal title={creating ? 'สร้างธีมใหม่ (Asset Pack)' : `แก้ไขธีม: ${theme.name}`} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <div className="cols-2">
          <Field label="ชื่อธีม *" htmlFor="th-name" error={errs.name}><input id="th-name" type="text" maxLength={60} value={name} onChange={(e) => { setName(e.target.value); if (creating && !slug) setSlug(''); }} data-autofocus /></Field>
          {creating && <Field label="slug (ตัวระบุ)" htmlFor="th-slug" error={errs.slug} hint={`เว้นว่าง = ใช้ “${slugify(name) || 'ชื่อธีม'}”`}><input id="th-slug" type="text" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} /></Field>}
        </div>
        <Field label="โลกของธีม (ชุดภาพวาดตกแต่ง)" htmlFor="th-motif" hint="เปลี่ยนทั้งสติกเกอร์ ขนม และของตกแต่งทั้งเว็บ ไม่ใช่แค่สี">
          <select id="th-motif" value={motif} onChange={(e) => pickMotif(e.target.value)}>
            {MOTIF_KEYS.map((k) => <option key={k} value={k}>{MOTIFS[k].label}</option>)}
          </select>
        </Field>
        <div className="field__label" style={{ fontFamily: 'var(--font-label)' }}>สี</div>
        <div className="cols-2" style={{ marginBottom: 8 }}>
          {COLOR_KEYS.map(([k, l]) => (
            <label key={k} className="check" style={{ marginBottom: 6 }}>
              <input type="color" value={vars[k]} onChange={(e) => setVars({ ...vars, [k]: e.target.value })} style={{ width: 44, height: 32, padding: 0 }} aria-label={l} /> {l}
            </label>
          ))}
        </div>
        <div className="cols-2">
          <Field label="ฟอนต์หัวข้อ" htmlFor="th-fd"><select id="th-fd" value={fonts.display} onChange={(e) => setFonts({ ...fonts, display: e.target.value })}>{FONT_CHOICES.display.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="ฟอนต์ป้าย/ปุ่ม" htmlFor="th-fl"><select id="th-fl" value={fonts.label} onChange={(e) => setFonts({ ...fonts, label: e.target.value })}>{FONT_CHOICES.label.map((x) => <option key={x}>{x}</option>)}</select></Field>
        </div>
        <ImagePicker label="ภาพพื้นหลังเอง (ไม่บังคับ — ถ้าไม่ใส่ใช้ลายตาราง)" value={bg} onChange={setBg} choices={[SHAPES.original, SHAPES.wide, SHAPES.portrait]} defaultChoice="original" maxSide={2000} />
        <ImagePicker label="ภาพแบนเนอร์ใต้ป้ายร้าน (ไม่บังคับ)" value={header} onChange={setHeader} choices={[SHAPES.banner, SHAPES.wide, SHAPES.original]} defaultChoice="banner" maxSide={1800} />
        <StickerList items={stickers} onChange={setStickers} />
        <Field label={`ระดับเสียงปุ่ม (pitch) ${Number(pitch).toFixed(2)}`} htmlFor="th-pitch" hint="ต่ำ = นุ่มทุ้ม, สูง = ใสแหลม">
          <input id="th-pitch" type="range" min="0.5" max="1.5" step="0.05" value={pitch} onChange={(e) => setPitch(e.target.value)} />
        </Field>
        <div className="panel panel--tinted" style={{ ...Object.fromEntries(Object.entries(preview.vars).map(([k, v]) => [k, v])), marginTop: 10 }}>
          <b>ตัวอย่างสีธีม</b>
          <div className="theme-swatches" style={{ marginTop: 6 }}>{COLOR_KEYS.map(([k]) => <i key={k} style={{ background: vars[k] }} />)}</div>
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        {confirmReset && (
          <Alert kind="error">
            <div>
              <b>คืนค่าเริ่มต้นของธีม “{name || 'ธีมนี้'}” ใช่ไหม?</b>
              <div>สี ฟอนต์ ระดับเสียงปุ่ม รูปพื้นหลัง แบนเนอร์ และสติกเกอร์ที่ตั้งเองจะกลับเป็นค่าเริ่มต้นของธีมนี้{creating ? '' : ' และบันทึกทันที'}</div>
              <div className="row" style={{ marginTop: 8 }}>
                <Button small variant="danger" icon="reset" onClick={doReset} disabled={busy}>ยืนยันคืนค่าเริ่มต้น</Button>
                <Button small onClick={() => setConfirmReset(false)} sfx="close" disabled={busy}>ไม่ต้องคืนค่า</Button>
              </div>
            </div>
          </Alert>
        )}
        <div className="row row--end form-actions" style={{ marginTop: 12 }}>
          <Button icon="reset" onClick={() => setConfirmReset(true)} disabled={busy || confirmReset} className="form-actions__start">คืนค่าเริ่มต้น</Button>
          <Button onClick={onClose} sfx="close" disabled={busy}>ยกเลิก</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังอัปโหลด/บันทึก…' : 'บันทึกธีม'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ThemesAdmin() {
  const site = useSite();
  const q = useAsync(async () => {
    const [themes, settings] = await Promise.all([
      supabase.from('themes').select('*').order('created_at').then(unwrap),
      supabase.from('site_settings').select('*').eq('id', 1).maybeSingle().then(unwrap),
    ]);
    return { themes, activeId: settings?.active_theme_id || null };
  }, []);
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const refresh = async () => { await q.reload(); await site.reload(); };
  const [activate, busy, err] = useSubmit(async (id) => {
    unwrap(await supabase.from('site_settings').upsert({ id: 1, active_theme_id: id, updated_at: new Date().toISOString() }));
    play('success');
    await refresh();
  });
  const [dup, dupBusy, dupErr] = useSubmit(async (t) => {
    let slug = `${t.slug}-copy`;
    const existing = new Set(q.data.themes.map((x) => x.slug));
    for (let i = 2; existing.has(slug); i += 1) slug = `${t.slug}-copy-${i}`;
    // the copy shares the uploaded files with the original (same URLs AND paths); a file is only removed from Storage
    // once no theme / row uses it any more, so deleting either one never breaks the other
    const cfg = { ...t.config };
    unwrap(await supabase.from('themes').insert({ slug, name: `${t.name} (สำเนา)`, config: cfg }));
    await refresh();
  });
  const [doDelete, delBusy, delErr] = useSubmit(async () => {
    await deleteRows('themes', del.id);
    const p = del.config?.paths || {};
    const gone = [];
    for (const f of [p.bg_image, p.header_image, ...(p.stickers || [])].filter(Boolean)) gone.push(await removeFile(f));   // one by one: each check sees the previous result
    await refresh();
    assertRemoved(gone, 'ภาพธีม');
    setDel(null);
  });

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  const { themes, activeId } = q.data;

  return (
    <AdminPanel label="Themes" title="ธีมของร้าน" actions={<Button variant="primary" icon="plus" onClick={() => setForm('new')}>สร้างธีมใหม่</Button>}>
      <Field label="ธีมที่ใช้อยู่ตอนนี้" htmlFor="th-active" hint="เลือกแล้วหน้าเว็บสาธารณะทั้งเว็บเปลี่ยนทันที (ลูกค้าเปลี่ยนธีมเองไม่ได้)">
        <select id="th-active" value={activeId || ''} disabled={busy} onChange={(e) => activate(e.target.value)}>
          {!activeId && <option value="">— ยังไม่ได้เลือก —</option>}
          {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      {(err || dupErr) && <Alert kind="error">{err || dupErr}</Alert>}
      <div className="list">
        {themes.map((t) => {
          const r = resolveTheme(t);
          const active = t.id === activeId;
          return (
            <div key={t.id} className="list-item">
              <div className="list-item__main">
                <div className="theme-swatches" aria-hidden="true">{['--c-main', '--c-main-soft', '--ribbon', '--frame'].map((k) => <i key={k} style={{ background: r.vars[k] }} />)}</div>
                <div>
                  <div className="list-item__title">{t.name} {active && <span className="badge badge--mint">ใช้อยู่</span>}</div>
                  <div className="list-item__sub">ชุดตกแต่ง: {MOTIFS[r.motif].label}{r.stickerUrls.length ? ` · สติกเกอร์เอง ${r.stickerUrls.length}` : ''}{t.is_builtin ? ' · ธีมตั้งต้น' : ''}</div>
                </div>
              </div>
              <div className="actions">
                {!active && <Button small variant="primary" disabled={busy} onClick={() => activate(t.id)}>ใช้ธีมนี้</Button>}
                <IconButton icon="edit" label={`แก้ไข ${t.name}`} onClick={() => setForm(t)} />
                <IconButton icon="copy" label={`ทำสำเนา ${t.name}`} onClick={() => dup(t)} disabled={dupBusy} />
                {!t.is_builtin && !active && <IconButton icon="trash" label={`ลบ ${t.name}`} onClick={() => setDel(t)} />}
              </div>
            </div>
          );
        })}
      </div>
      {form && <ThemeForm theme={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await refresh(); }} />}
      {del && <ConfirmDialog title={`ลบธีม “${del.name}”?`} message="ธีมและไฟล์ภาพที่อัปโหลดไว้จะถูกลบถาวร" busy={delBusy} error={delErr} onCancel={() => setDel(null)} onConfirm={doDelete} />}
    </AdminPanel>
  );
}
