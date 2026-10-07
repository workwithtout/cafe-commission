import { useRef, useState } from 'react';
import { supabase, unwrap } from '../../lib/supabase.js';
import { useAsync, useSubmit } from '../../lib/hooks.js';
import { Alert, Button, ConfirmDialog, Empty, ErrorState, Field, IconButton, Loading, Modal } from '../../components/ui.jsx';
import { Icon } from '../../components/Decor.jsx';
import { formatThaiDate } from '../../lib/logic.js';
import { sortGallery } from '../../lib/data.js';
import { uploadFile } from '../../lib/storage.js';
import { AdminPanel, ImagePicker, SHAPES, assertRemoved, commitImage, deleteRows, removeFile } from './common.jsx';
import { useImageIntake } from '../../components/ImagePicker.jsx';
import { RichEditor } from '../../components/RichText.jsx';
import { cleanForSave, plainText } from '../../lib/richtext.js';
import { play } from '../../lib/sound.js';

const today = () => new Date().toISOString().slice(0, 10);
const MAX_EXTRA = 11;            // cover + 11 = 12 pictures in one item
const MAX_PINS = 3;
const isAlbumUrl = (u) => /^https?:\/\/[^\s]+$/i.test(String(u || '').trim()) && String(u).trim().length <= 500;
const pathOf = (row) => row?.image_path || row?.image_url || null;

/** Extra pictures of one item: add (drag & drop / tap, same editor as every other picture), reorder, remove. */
function ExtraImages({ items, onChange }) {
  const ref = useRef(null);
  const [over, setOver] = useState(false);
  const intake = useImageIntake({
    choices: [SHAPES.original, SHAPES.square, SHAPES.card, SHAPES.portrait, SHAPES.wide], defaultChoice: 'original', maxSide: 2000, watermarkKind: 'gallery',
    onResult: (file) => onChange([...items, { key: `n${Date.now()}${Math.random()}`, file, preview: URL.createObjectURL(file) }]),
  });
  const move = (i, d) => { const a = [...items]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  return (
    <div className="field">
      <span className="field__label">รูปเพิ่มเติมในผลงานนี้ (ไม่บังคับ — ผู้ชมปัด/เลื่อนดูได้ในผลงานเดียว)</span>
      {items.length > 0 && (
        <div className="extra-list">
          {items.map((s, i) => (
            <div key={s.key} className="extra-item">
              <img src={s.preview || s.image_url} alt={`รูปเพิ่มเติม ${i + 1}`} />
              <span className="actions">
                <IconButton icon="up" label={`เลื่อนรูป ${i + 1} ขึ้น`} onClick={() => move(i, -1)} disabled={i === 0} />
                <IconButton icon="down" label={`เลื่อนรูป ${i + 1} ลง`} onClick={() => move(i, 1)} disabled={i === items.length - 1} />
                <IconButton icon="trash" label={`ลบรูปเพิ่มเติม ${i + 1}`} onClick={() => onChange(items.filter((_, k) => k !== i))} />
              </span>
            </div>
          ))}
        </div>
      )}
      {items.length < MAX_EXTRA && (
        <div
          className={`dropzone dropzone--compact ${over ? 'dropzone--over' : ''}`}
          onDragEnter={(e) => { e.preventDefault(); setOver(true); }} onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer?.files?.[0]; if (f) intake.start(f); }}
        >
          <input ref={ref} type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; intake.start(f); }} />
          <button type="button" className="dropzone__pick" onClick={() => ref.current?.click()}>
            <Icon name="upload" size={22} />
            <span><b className="dz-drag">ลากรูปมาวางที่นี่</b><b className="dz-tap">แตะเพื่อเลือกรูป</b><span className="dz-drag"> หรือกดเพื่อเลือกไฟล์</span> (เพิ่มได้อีก {MAX_EXTRA - items.length} รูป)</span>
          </button>
        </div>
      )}
      {intake.error && <span className="error" role="alert">{intake.error}</span>}
      {intake.editor}
    </div>
  );
}

function GalleryForm({ item, services, onClose, onSaved }) {
  const creating = !item;
  const [f, setF] = useState({
    title: item?.title || '', owner_name: item?.owner_name || '', service_id: item?.service_id || '',
    description: item?.description || '', art_date: item?.art_date || today(), is_visible: item?.is_visible ?? true,
    kind: item?.kind === 'album' ? 'album' : 'image', album_url: item?.album_url || '',
  });
  const [img, setImg] = useState({ url: item?.image_url || '' });
  const [extras, setExtras] = useState(() => [...(item?.images || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((r) => ({ key: r.id, ...r })));
  const [errs, setErrs] = useState({});
  const album = f.kind === 'album';

  const [save, busy, error] = useSubmit(async () => {
    const e = {};
    if (!f.title.trim()) e.title = 'ต้องมีชื่อผลงาน';
    if (plainText(f.description).length > 800) e.desc = 'คำอธิบายยาวเกิน 800 ตัวอักษร';
    if (!img.file && (!img.url || img.removed)) e.image = album ? 'อัลบั้มต้องมีรูป Preview 1 รูป' : 'ต้องเลือกรูปภาพ';
    if (!f.art_date || Number.isNaN(new Date(f.art_date).getTime())) e.date = 'วันที่ไม่ถูกต้อง';
    if (album && !isAlbumUrl(f.album_url)) e.album = 'ใส่ลิงก์อัลบั้มที่ขึ้นต้นด้วย https:// หรือ http:// (ไม่เกิน 500 ตัวอักษร)';
    setErrs(e);
    if (Object.keys(e).length) { play('error'); return; }

    const uploaded = [];   // files uploaded by THIS save: removed again if the database write fails
    const cleanUp = async () => { for (const p of uploaded) await removeFile(p); };
    let pic; let extraFinal;
    try {
      // 1) upload (throws => nothing is written to the database)
      pic = await commitImage(img, 'gallery', item?.image_path);
      if (!pic.url) throw new Error('ต้องมีรูปภาพ');
      if (img.file) uploaded.push(pic.path);
      extraFinal = [];
      for (const x of album ? [] : extras) {
        if (x.file) { const up = await uploadFile(x.file, 'gallery'); uploaded.push(up.path); extraFinal.push({ ...x, image_url: up.url, image_path: up.path, isNew: true }); }
        else extraFinal.push(x);
      }
    } catch (err) { await cleanUp(); throw err; }

    const row = {
      title: f.title.trim(), owner_name: f.owner_name.trim() || null, service_id: f.service_id || null,
      description: cleanForSave(f.description), art_date: f.art_date, is_visible: f.is_visible,
      image_url: pic.url, image_path: pic.path, kind: f.kind, album_url: album ? f.album_url.trim() : null,
    };
    // 2) write the item; if this fails, the new files are removed and the old ones are untouched
    let id = item?.id;
    try {
      if (creating) id = unwrap(await supabase.from('gallery_items').insert(row).select('id').single()).id;
      else unwrap(await supabase.from('gallery_items').update(row).eq('id', id).select('id').single());
    } catch (err) { await cleanUp(); throw err; }
    // the item now points at the new cover: only now may the old cover go (reference-checked)
    if (pic.oldPath && pic.oldPath !== pic.path) await removeFile(pic.oldPath);

    // 3) extra pictures (rows live in gallery_item_images)
    const existing = item?.images || [];
    const keptIds = new Set(extraFinal.filter((x) => !x.isNew).map((x) => x.id));
    const removedRows = existing.filter((r) => !keptIds.has(r.id));
    const fresh = extraFinal.map((x, i) => ({ x, order: i + 1 })).filter(({ x }) => x.isNew);
    try {
      if (fresh.length) unwrap(await supabase.from('gallery_item_images').insert(fresh.map(({ x, order }) => ({ gallery_item_id: id, image_url: x.image_url, image_path: x.image_path, sort_order: order }))));
    } catch (err) {
      for (const { x } of fresh) await removeFile(x.image_path);   // rows were not created: do not leave their files behind
      throw new Error(`บันทึกผลงานแล้ว แต่เพิ่มรูปเพิ่มเติมไม่สำเร็จ: ${err.message} (ถ้าเพิ่งรัน migration 009 ไม่ได้ ให้รันก่อน)`);
    }
    for (const [i, x] of extraFinal.entries()) {
      if (!x.isNew && x.sort_order !== i + 1) unwrap(await supabase.from('gallery_item_images').update({ sort_order: i + 1 }).eq('id', x.id).select('id').single());
    }
    if (removedRows.length) {
      await deleteRows('gallery_item_images', removedRows.map((r) => r.id));
      for (const r of removedRows) await removeFile(pathOf(r));   // after the rows are gone, and only if nothing else uses the file
    }
    play('success');
    onSaved();
  });

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={creating ? 'เพิ่มผลงาน' : 'แก้ไขผลงาน'} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <div className="field" role="radiogroup" aria-label="ชนิดผลงาน">
          <span className="field__label">ชนิดผลงาน</span>
          <div className="row">
            <label className="check"><input type="radio" name="gl-kind" checked={!album} onChange={() => setF({ ...f, kind: 'image' })} /> ผลงานปกติ (มีรูปได้หลายรูป)</label>
            <label className="check"><input type="radio" name="gl-kind" checked={album} onChange={() => setF({ ...f, kind: 'album' })} /> อัลบั้ม (รูป Preview + ลิงก์ภายนอก)</label>
          </div>
        </div>
        <ImagePicker label={album ? 'รูป Preview ของอัลบั้ม' : 'รูปภาพ'} value={img} onChange={setImg} required choices={[SHAPES.square, SHAPES.card, SHAPES.portrait, SHAPES.wide, SHAPES.original]} defaultChoice="square" maxSide={2000} watermark="gallery" hint="ช่องแกลลอรี่เป็นจัตุรัส เลือกสัดส่วนอื่นหรือ “ตามสัดส่วนรูปเดิม” ได้ถ้าไม่อยากตัดรูป" />
        {errs.image && <span className="error">{errs.image}</span>}
        {album
          ? (
            <Field label="ลิงก์อัลบั้ม *" htmlFor="gl-album" error={errs.album} hint="เช่น Google Drive, Google Photos, Dropbox หรือเว็บแกลลอรี่อื่น — ระบบเก็บแค่ลิงก์ ไม่ดึงหรือคัดลอกรูปจากอัลบั้ม ผู้ชมกด “ดูอัลบั้มนี้” แล้วเปิดแท็บใหม่">
              <input id="gl-album" type="text" inputMode="url" autoCapitalize="off" placeholder="https://..." value={f.album_url} onChange={set('album_url')} />
              {!creating && extras.length > 0 && <small>เมื่อบันทึกเป็นอัลบั้ม รูปเพิ่มเติมของผลงานนี้ ({extras.length} รูป) จะถูกลบ</small>}
            </Field>
          )
          : <ExtraImages items={extras} onChange={setExtras} />}
        <Field label="ชื่อผลงาน *" htmlFor="gl-title" error={errs.title}><input id="gl-title" type="text" maxLength={120} value={f.title} onChange={set('title')} data-autofocus /></Field>
        <div className="cols-2">
          <Field label="ชื่อลูกค้าที่สั่ง / Display Name" htmlFor="gl-owner" hint="แสดงเป็น “สั่งโดย …” ถ้าเว้นว่างจะไม่แสดงอะไร"><input id="gl-owner" type="text" maxLength={80} value={f.owner_name} onChange={set('owner_name')} /></Field>
          <Field label="ประเภทงาน" htmlFor="gl-svc">
            <select id="gl-svc" value={f.service_id} onChange={set('service_id')}>
              <option value="">ไม่ระบุ (หมวด “อื่น ๆ”)</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="คำอธิบาย" htmlFor="gl-desc" error={errs.desc}><RichEditor id="gl-desc" value={f.description} onChange={(html) => setF((p) => ({ ...p, description: html }))} maxText={800} ariaLabel="คำอธิบายผลงาน" /></Field>
        <div className="cols-2">
          <Field label="วันที่" htmlFor="gl-date" error={errs.date}><input id="gl-date" type="date" value={f.art_date} onChange={set('art_date')} /></Field>
          <label className="check" style={{ alignSelf: 'end', marginBottom: 14 }}><input type="checkbox" checked={f.is_visible} onChange={(e) => setF({ ...f, is_visible: e.target.checked })} /> แสดงบนหน้าเว็บ</label>
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="row row--end">
          <Button onClick={onClose} sfx="close" disabled={busy}>ยกเลิก</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังอัปโหลด/บันทึก…' : 'บันทึก'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function GalleryAdmin() {
  const q = useAsync(async () => {
    let g = await supabase.from('gallery_items').select('*, images:gallery_item_images(*)');
    if (g.error) g = await supabase.from('gallery_items').select('*');                     // release 009 not applied yet
    const [items, services] = await Promise.all([
      Promise.resolve(sortGallery(unwrap(g))),
      supabase.from('services').select('id, name').order('sort_order').then(unwrap),
    ]);
    return { items, services };
  }, []);
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [filter, setFilter] = useState('all');
  const [act, actBusy, actError] = useSubmit(async (fn) => { await fn(); await q.reload(); });
  const [doDelete, delBusy, delError] = useSubmit(async () => {
    const files = [pathOf(del), ...(del.images || []).map(pathOf)].filter(Boolean);
    await deleteRows('gallery_items', del.id);        // really deleted (checked); extra-picture rows go with it (cascade); queue links become NULL
    const gone = [];
    for (const p of files) gone.push(await removeFile(p));   // the real files in Storage, unless another record still uses one
    await q.reload();
    assertRemoved(gone);
    setDel(null);
  });

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  const { items, services } = q.data;
  const name = (id) => services.find((s) => s.id === id)?.name || 'อื่น ๆ';
  const shown = items.filter((g) => filter === 'all' || (filter === 'none' ? !g.service_id : g.service_id === filter));
  const pinned = items.filter((g) => g.pinned_order != null);   // already in slot order (sortGallery)

  // Pin = a slot (1-3) on the gallery item itself; pinned items come first on the site, in slot order.
  const setSlot = async (id, slot) => unwrap(await supabase.from('gallery_items').update({ pinned_order: slot }).eq('id', id).select('id').single());
  const pin = (g) => act(async () => {
    if (pinned.length >= MAX_PINS) throw new Error(`ปักหมุดได้สูงสุด ${MAX_PINS} รายการ ยกเลิกหมุดอันอื่นก่อน`);
    await setSlot(g.id, pinned.length + 1);
  });
  const unpin = (g) => act(async () => {
    await setSlot(g.id, null);
    const rest = pinned.filter((x) => x.id !== g.id);
    for (const [i, x] of rest.entries()) if (x.pinned_order !== i + 1) await setSlot(x.id, i + 1);   // close the gap, keep the order
  });
  const movePin = (g, dir) => act(async () => {
    const i = pinned.findIndex((x) => x.id === g.id); const other = pinned[i + dir];
    if (!other) return;
    const a = g.pinned_order; const b = other.pinned_order;
    await setSlot(g.id, null); await setSlot(other.id, a); await setSlot(g.id, b);   // swap through "free" so the unique slot is never used twice
  });

  return (
    <AdminPanel label="Gallery" title="ผลงานในแกลลอรี่" actions={<Button variant="primary" icon="plus" onClick={() => setForm('new')}>เพิ่มผลงาน</Button>}>
      <Field label="กรองตามประเภทงาน" htmlFor="gl-filter">
        <select id="gl-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">ทั้งหมด ({items.length})</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="none">ไม่ระบุประเภท</option>
        </select>
      </Field>
      <p className="admin-note">ปักหมุดงานสำคัญได้สูงสุด {MAX_PINS} รายการ ({pinned.length}/{MAX_PINS}) งานที่ปักหมุดจะอยู่บนสุดของแกลลอรี่และหน้าแรก ส่วนที่เหลือเรียงตามวันที่ใหม่ไปเก่า</p>
      {actError && <Alert kind="error">{actError}</Alert>}
      {shown.length === 0 ? <Empty title="ยังไม่มีผลงานในหมวดนี้" /> : (
        <div className="list">
          {shown.map((g) => {
            const pi = pinned.findIndex((x) => x.id === g.id);
            return (
              <div key={g.id} className={`list-item ${!g.is_visible ? 'list-item--off' : ''}`}>
                <div className="list-item__main">
                  <img src={g.image_url} alt={g.title} />
                  <div>
                    <div className="list-item__title">{g.title}</div>
                    <div className="list-item__sub">{name(g.service_id)} · {g.owner_name ? `สั่งโดย ${g.owner_name}` : 'ไม่ระบุชื่อลูกค้า'} · {formatThaiDate(g.art_date)}</div>
                    <div className="row" style={{ gap: 6 }}>
                      {pi >= 0 && <span className="badge badge--butter">ปักหมุด {pi + 1}</span>}
                      {g.kind === 'album' && <span className="badge badge--lilac">อัลบั้ม</span>}
                      {g.kind !== 'album' && (g.images?.length || 0) > 0 && <span className="badge badge--sky">{g.images.length + 1} รูป</span>}
                      {!g.is_visible && <span className="badge badge--grey">ซ่อนอยู่</span>}
                    </div>
                  </div>
                </div>
                <div className="actions">
                  {pi >= 0 && <IconButton icon="up" label={`เลื่อนหมุด ${g.title} ขึ้น`} onClick={() => movePin(g, -1)} disabled={actBusy || pi === 0} />}
                  {pi >= 0 && <IconButton icon="down" label={`เลื่อนหมุด ${g.title} ลง`} onClick={() => movePin(g, 1)} disabled={actBusy || pi === pinned.length - 1} />}
                  <Button small disabled={actBusy || (pi < 0 && pinned.length >= MAX_PINS)} icon="pin" onClick={() => (pi >= 0 ? unpin(g) : pin(g))}>{pi >= 0 ? 'เลิกปักหมุด' : 'ปักหมุด'}</Button>
                  <Button small disabled={actBusy} icon={g.is_visible ? 'eyeOff' : 'eye'} onClick={() => act(async () => unwrap(await supabase.from('gallery_items').update({ is_visible: !g.is_visible }).eq('id', g.id)))}>{g.is_visible ? 'ซ่อน' : 'แสดง'}</Button>
                  <IconButton icon="edit" label={`แก้ไข ${g.title}`} onClick={() => setForm(g)} />
                  <IconButton icon="trash" label={`ลบ ${g.title}`} onClick={() => setDel(g)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {form && <GalleryForm item={form === 'new' ? null : form} services={services} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await q.reload(); }} />}
      {del && <ConfirmDialog title={`ลบ “${del.title}”?`} message="รูปและข้อมูลผลงานจะถูกลบถาวร ถ้ามีคิวงานเชื่อมกับผลงานนี้ ปุ่ม “ดูตัวอย่างผลงาน” ของคิวนั้นจะกลับไปใช้หมวดงานแทน (หรือซ่อนถ้าไม่มี)" busy={delBusy} error={delError} onCancel={() => setDel(null)} onConfirm={doDelete} />}
    </AdminPanel>
  );
}
