import { useState } from 'react';
import { supabase, unwrap } from '../../lib/supabase.js';
import { useAsync, useSubmit } from '../../lib/hooks.js';
import { useSite } from '../../lib/site.jsx';
import { Alert, Button, ConfirmDialog, Empty, ErrorState, Field, IconButton, Loading, Modal } from '../../components/ui.jsx';
import { formatDuration, formatPrice, sortSteps } from '../../lib/logic.js';
import { AdminPanel, deleteRows, ImagePicker, OrderButtons, SHAPES, StepsEditor, assertRemoved, commitImage, move, removeFile, reorderRows, syncSteps, validateSteps } from './common.jsx';
import { RichEditor } from '../../components/RichText.jsx';
import { cleanForSave, plainText } from '../../lib/richtext.js';
import { play } from '../../lib/sound.js';

// Starting workflow for a new menu item: rename / add / remove steps freely, just pick a status category for each.
const DEFAULT_STEPS = [
  { label: 'รับบรีฟ', category: 'pending' }, { label: 'ชำระเงิน', category: 'confirmed' }, { label: 'กำลังทำ', category: 'in_progress' },
  { label: 'ตรวจงาน', category: 'review' }, { label: 'ส่งมอบงาน', category: 'review' },
];

function ServiceForm({ service, onClose, onSaved }) {
  const creating = !service;
  const [f, setF] = useState({
    name: service?.name || '', description: service?.description || '', price_from: service?.price_from ?? 0,
    duration_min: service?.duration_min ?? 1, duration_max: service?.duration_max ?? 3,
    is_open: service?.is_open ?? true, is_visible: service?.is_visible ?? true,
  });
  const [img, setImg] = useState({ url: service?.image_url || '' });
  const [steps, setSteps] = useState(() => (service
    ? sortSteps(service.steps)
    : DEFAULT_STEPS.map((s, i) => ({ ...s, id: `new-d${i}` }))));
  const [errs, setErrs] = useState({});

  const [save, busy, error] = useSubmit(async () => {
    const e = {};
    const price = Number(f.price_from); const dmin = Number(f.duration_min); const dmax = Number(f.duration_max);
    if (!f.name.trim()) e.name = 'ต้องมีชื่อประเภทงาน';
    if (plainText(f.description).length > 600) e.desc = 'คำอธิบายยาวเกิน 600 ตัวอักษร';
    if (f.price_from === '' || !Number.isFinite(price) || price < 0) e.price = 'ราคาต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป';
    if (!Number.isInteger(dmin) || dmin < 0) e.dmin = 'ระยะเวลาต้องเป็นจำนวนเต็มวัน';
    if (!Number.isInteger(dmax) || dmax < dmin) e.dmax = 'ระยะเวลาสูงสุดต้องไม่น้อยกว่าต่ำสุด';
    const se = validateSteps(steps); if (se) e.steps = se;
    setErrs(e);
    if (Object.keys(e).length) { play('error'); return; }

    const pic = await commitImage(img, 'services', service?.image_path);
    const row = {
      name: f.name.trim(), description: cleanForSave(f.description), price_from: price, duration_min: dmin, duration_max: dmax,
      is_open: f.is_open, is_visible: f.is_visible, image_url: pic.url, image_path: pic.path,
    };
    let id = service?.id;
    try {
      if (creating) {
        const max = unwrap(await supabase.from('services').select('sort_order').order('sort_order', { ascending: false }).limit(1));
        const created = unwrap(await supabase.from('services').insert({ ...row, sort_order: (max[0]?.sort_order || 0) + 1 }).select('id').single());
        id = created.id;
      } else {
        unwrap(await supabase.from('services').update(row).eq('id', id));
      }
    } catch (err) {
      if (img.file) await removeFile(pic.path);   // the row was not saved: do not leave the new upload behind
      throw err;
    }
    if (pic.oldPath && pic.oldPath !== pic.path) await removeFile(pic.oldPath);   // row now points at the new file
    await syncSteps('service_steps', 'service_id', id, service ? sortSteps(service.steps) : [], steps);
    play('success');
    onSaved();
  });

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={creating ? 'เพิ่มประเภทงาน' : `แก้ไข: ${service.name}`} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <Field label="ชื่อประเภทงาน *" htmlFor="sv-name" error={errs.name}><input id="sv-name" type="text" maxLength={80} value={f.name} onChange={set('name')} data-autofocus /></Field>
        <Field label="คำอธิบาย" htmlFor="sv-desc" error={errs.desc}><RichEditor id="sv-desc" value={f.description} onChange={(html) => setF((p) => ({ ...p, description: html }))} maxText={600} ariaLabel="คำอธิบาย" /></Field>
        <div className="cols-2">
          <Field label="ราคาเริ่มต้น (บาท) *" htmlFor="sv-price" error={errs.price}><input id="sv-price" type="number" min="0" step="1" value={f.price_from} onChange={set('price_from')} /></Field>
          <div className="cols-2" style={{ gap: 8 }}>
            <Field label="ใช้เวลาต่ำสุด (วัน)" htmlFor="sv-dmin" error={errs.dmin}><input id="sv-dmin" type="number" min="0" step="1" value={f.duration_min} onChange={set('duration_min')} /></Field>
            <Field label="สูงสุด (วัน)" htmlFor="sv-dmax" error={errs.dmax}><input id="sv-dmax" type="number" min="0" step="1" value={f.duration_max} onChange={set('duration_max')} /></Field>
          </div>
        </div>
        <ImagePicker label="รูปตัวอย่าง" value={img} onChange={setImg} choices={[SHAPES.card, SHAPES.square, SHAPES.portrait, SHAPES.wide, SHAPES.original]} defaultChoice="card" watermark="services" hint="การ์ดเมนูใช้สัดส่วน 4:3 รูปที่จัดไว้ตรงสัดส่วนจะแสดงเต็มกรอบพอดี" />
        <div className="row" style={{ marginBottom: 12 }}>
          <label className="check"><input type="checkbox" checked={f.is_open} onChange={(e) => setF({ ...f, is_open: e.target.checked })} /> เปิดรับงานประเภทนี้</label>
          <label className="check"><input type="checkbox" checked={f.is_visible} onChange={(e) => setF({ ...f, is_visible: e.target.checked })} /> แสดงบนหน้าเว็บ</label>
        </div>
        <h4>ขั้นตอนการทำงาน (Workflow เริ่มต้น)</h4>
        {!creating && <Alert>แก้ขั้นตอนตรงนี้มีผลกับ <b>งานใหม่</b> เท่านั้น งานที่อยู่ในคิวแล้วเก็บขั้นตอนเดิมไว้ ไม่เปลี่ยนตาม</Alert>}
        <StepsEditor steps={steps} onChange={setSteps} />
        {errs.steps && <span className="error">{errs.steps}</span>}
        {error && <Alert kind="error">{error}</Alert>}
        <div className="row row--end" style={{ marginTop: 12 }}>
          <Button onClick={onClose} sfx="close" disabled={busy}>ยกเลิก</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ServicesAdmin() {
  const site = useSite();
  const q = useAsync(async () => {
    const [services, queue, gallery] = await Promise.all([
      supabase.from('services').select('*, steps:service_steps(*)').order('sort_order').then(unwrap),
      supabase.from('queue_items').select('service_id').then(unwrap),
      supabase.from('gallery_items').select('service_id').then(unwrap),
    ]);
    const count = (rows, id) => rows.filter((r) => r.service_id === id).length;
    return services.map((s) => ({ ...s, queueCount: count(queue, s.id), galleryCount: count(gallery, s.id) }));
  }, []);
  const [form, setForm] = useState(null);   // null | 'new' | service
  const [del, setDel] = useState(null);

  const refresh = async () => { await q.reload(); await site.reload(); };
  const [act, actBusy, actError] = useSubmit(async (fn) => { await fn(); await refresh(); });

  const [doDelete, delBusy, delError] = useSubmit(async () => {
    await deleteRows('services', del.id);
    const gone = await removeFile(del.image_path || del.image_url);
    await refresh();
    assertRemoved(gone);
    setDel(null);
  });

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  const list = q.data;

  return (
    <AdminPanel label="Services" title="ประเภทงาน / เมนูงาน" actions={<Button variant="primary" icon="plus" onClick={() => setForm('new')}>เพิ่มประเภทงาน</Button>}>
      {actError && <Alert kind="error">{actError}</Alert>}
      {list.length === 0 ? <Empty title="ยังไม่มีประเภทงาน">กด “เพิ่มประเภทงาน” เพื่อเริ่มสร้างเมนูของร้าน</Empty> : (
        <div className="list">
          {list.map((s, i) => (
            <div key={s.id} className={`list-item ${!s.is_visible ? 'list-item--off' : ''}`}>
              <div className="list-item__main">
                {s.image_url ? <img src={s.image_url} alt="" /> : null}
                <div>
                  <div className="list-item__title">{s.name}</div>
                  <div className="list-item__sub">เริ่ม {formatPrice(s.price_from)} · {formatDuration(s.duration_min, s.duration_max)} · {s.steps.length} ขั้นตอน</div>
                  <div className="list-item__sub">คิว {s.queueCount} · ผลงาน {s.galleryCount}</div>
                  <div className="row" style={{ gap: 6 }}>
                    <span className={`badge ${s.is_open ? 'badge--mint' : 'badge--rose'}`}>{s.is_open ? 'เปิดรับ' : 'ปิดรับ'}</span>
                    {!s.is_visible && <span className="badge badge--grey">ซ่อนอยู่</span>}
                  </div>
                </div>
              </div>
              <div className="actions">
                <OrderButtons index={i} length={list.length} busy={actBusy} onMove={(d) => act(() => reorderRows('services', move(list, i, d).map((x) => x.id)))} />
                <Button small disabled={actBusy} onClick={() => act(async () => unwrap(await supabase.from('services').update({ is_open: !s.is_open }).eq('id', s.id)))}>{s.is_open ? 'ปิดรับ' : 'เปิดรับ'}</Button>
                <Button small disabled={actBusy} icon={s.is_visible ? 'eyeOff' : 'eye'} onClick={() => act(async () => unwrap(await supabase.from('services').update({ is_visible: !s.is_visible }).eq('id', s.id)))}>{s.is_visible ? 'ซ่อน' : 'แสดง'}</Button>
                <IconButton icon="edit" label={`แก้ไข ${s.name}`} onClick={() => setForm(s)} />
                <IconButton icon="trash" label={`ลบ ${s.name}`} onClick={() => setDel(s)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {form && <ServiceForm service={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await refresh(); }} />}
      {del && (
        <ConfirmDialog
          title={`ลบ “${del.name}”?`} busy={delBusy} error={delError} onCancel={() => setDel(null)} onConfirm={doDelete}
          message={`คิวงาน ${del.queueCount} รายการจะยังอยู่ (เก็บชื่อประเภทงานไว้ตามเดิม) และผลงานในแกลลอรี่ ${del.galleryCount} ชิ้นจะยังอยู่แต่กลายเป็นหมวด “อื่น ๆ” ถ้าแค่ไม่อยากให้ลูกค้าเห็น แนะนำให้กด “ซ่อน” หรือ “ปิดรับ” แทน`}
        />
      )}
    </AdminPanel>
  );
}
