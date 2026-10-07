import { useMemo, useState } from 'react';
import { supabase, unwrap } from '../../lib/supabase.js';
import { useAsync, useSubmit } from '../../lib/hooks.js';
import { Alert, Button, ConfirmDialog, Empty, ErrorState, Field, IconButton, Loading, Modal, Progress, StatusBadge } from '../../components/ui.jsx';
import { OVERRIDES, STATUS, STATUS_CATEGORY_LABEL, STATUS_FILTERS, computeStatus, formatThaiDate, isContactUrl, kindForCategory, sortSteps, stepCategory } from '../../lib/logic.js';
import { AdminPanel, deleteRows, OrderButtons, StepsEditor, reorderRows, syncSteps, validateSteps } from './common.jsx';
import { Icon } from '../../components/Decor.jsx';
import { play } from '../../lib/sound.js';

function QueueForm({ item, services, gallery, onClose, onSaved }) {
  const contact = Array.isArray(item?.contact) ? item.contact[0] : item?.contact;
  const creating = !item;
  const [f, setF] = useState({
    service_id: item?.service_id || '', customer_name: item?.customer_name || '', description: item?.description || '',
    duration_days: item?.duration_days ?? '', due_date: item?.due_date || '', is_public: item?.is_public ?? true,
    status_override: item?.status_override || '', gallery_service_id: item?.gallery_service_id || '',
    facebook_url: contact?.facebook_url || '', facebook_public: contact?.facebook_public ?? false,
  });
  const [steps, setSteps] = useState(() => sortSteps(item?.steps || []));
  const [replaceSteps, setReplaceSteps] = useState(false);
  const [errs, setErrs] = useState({});

  const svc = services.find((s) => s.id === f.service_id);
  const serviceChanged = !creating && f.service_id !== (item.service_id || '');
  const previewSteps = creating ? sortSteps(svc?.steps || []).map((s) => ({ ...s, is_done: false })) : steps;
  const live = computeStatus({ status_override: f.status_override || null }, previewSteps);

  const onService = (id) => {
    const s = services.find((x) => x.id === id);
    setF((p) => ({ ...p, service_id: id, duration_days: creating && s ? s.duration_max : p.duration_days }));
  };

  const [save, busy, error] = useSubmit(async () => {
    const e = {};
    if (!f.service_id) e.service = 'ต้องเลือกประเภทงาน';
    if (!f.customer_name.trim()) e.customer = 'ต้องมีชื่อลูกค้า';
    const days = f.duration_days === '' ? null : Number(f.duration_days);
    if (days !== null && (!Number.isInteger(days) || days < 0)) e.days = 'ระยะเวลาต้องเป็นจำนวนเต็มวัน';
    if (f.due_date && Number.isNaN(new Date(f.due_date).getTime())) e.due = 'วันที่ไม่ถูกต้อง';
    if (f.facebook_url.trim() && !isContactUrl(f.facebook_url)) e.fb = 'ต้องเป็นลิงก์ที่ขึ้นต้นด้วย https://, http:// หรือ mailto: (ไม่เกิน 300 ตัวอักษร)';
    if (!creating && !(serviceChanged && replaceSteps)) { const se = validateSteps(steps); if (se) e.steps = se; }
    if (creating && previewSteps.length === 0) e.steps = 'ประเภทงานนี้ยังไม่มีขั้นตอน ไปเพิ่ม Workflow ที่หน้า Services ก่อนนะ';
    setErrs(e);
    if (Object.keys(e).length) { play('error'); return; }

    const common = {
      customer_name: f.customer_name.trim(), description: f.description.trim() || null, duration_days: days,
      due_date: f.due_date || null, is_public: f.is_public, status_override: f.status_override || null,
      gallery_service_id: f.gallery_service_id || null,
    };
    const fbUrl = f.facebook_url.trim();
    const saveContact = async (queueId) => {
      if (fbUrl) unwrap(await supabase.from('queue_item_contacts').upsert({ queue_item_id: queueId, facebook_url: fbUrl, facebook_public: f.facebook_public }));
      else if (contact) unwrap(await supabase.from('queue_item_contacts').delete().eq('queue_item_id', queueId));
    };

    if (creating) {
      // The database function copies the service's CURRENT workflow into this item (frozen snapshot).
      const id = unwrap(await supabase.rpc('create_queue_item', {
        p_service: f.service_id, p_customer: common.customer_name, p_description: common.description,
        p_days: days, p_due: common.due_date, p_public: common.is_public,
      }));
      if (common.status_override || common.gallery_service_id) {
        unwrap(await supabase.from('queue_items').update({ status_override: common.status_override, gallery_service_id: common.gallery_service_id }).eq('id', id));
      }
      await saveContact(id);
    } else {
      const patch = { ...common };
      if (serviceChanged) { patch.service_id = f.service_id; patch.service_name = svc.name; }
      unwrap(await supabase.from('queue_items').update(patch).eq('id', item.id));
      await saveContact(item.id);
      if (serviceChanged && replaceSteps) {
        unwrap(await supabase.from('queue_steps').delete().eq('queue_item_id', item.id));
        const fresh = sortSteps(svc.steps).map((s, i) => ({ queue_item_id: item.id, label: s.label, kind: kindForCategory(stepCategory(s)), category: stepCategory(s), sort_order: i + 1 }));
        if (fresh.length) unwrap(await supabase.from('queue_steps').insert(fresh));
      } else {
        await syncSteps('queue_steps', 'queue_item_id', item.id, sortSteps(item.steps), steps);
      }
    }
    play('success');
    onSaved();
  });

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const galleryCount = (id) => gallery.filter((g) => g.service_id === id).length;

  return (
    <Modal title={creating ? 'เพิ่มคิวงาน' : `แก้ไขคิว: ${item.customer_name}`} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <div className="cols-2">
          <Field label="ประเภทงาน *" htmlFor="qf-svc" error={errs.service}>
            <select id="qf-svc" value={f.service_id} onChange={(e) => onService(e.target.value)} data-autofocus>
              <option value="">เลือกประเภทงาน…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}{!s.is_open ? ' (ปิดรับ)' : ''}</option>)}
              {!creating && !item.service_id && null}
            </select>
          </Field>
          <Field label="ชื่อลูกค้า (Display Name) *" htmlFor="qf-cust" error={errs.customer}><input id="qf-cust" type="text" maxLength={80} value={f.customer_name} onChange={set('customer_name')} /></Field>
        </div>
        {!creating && !item.service_id && <Alert>ประเภทงานเดิมถูกลบไปแล้ว (ชื่อที่เก็บไว้: {item.service_name}) เลือกประเภทใหม่ได้ถ้าต้องการ</Alert>}
        <Field label="รายละเอียดสั้น ๆ" htmlFor="qf-desc"><input id="qf-desc" type="text" maxLength={500} value={f.description} onChange={set('description')} /></Field>
        <div className="cols-2">
          <Field label="ระยะเวลา (วัน)" htmlFor="qf-days" error={errs.days}><input id="qf-days" type="number" min="0" step="1" value={f.duration_days} onChange={set('duration_days')} /></Field>
          <Field label="กำหนดส่ง" htmlFor="qf-due" error={errs.due}><input id="qf-due" type="date" value={f.due_date} onChange={set('due_date')} /></Field>
        </div>
        <div className="cols-2">
          <Field label="สถานะพิเศษ (ตั้งเอง)" htmlFor="qf-ov" hint="เว้นไว้ = ให้ระบบคำนวณจากขั้นตอนเอง งานที่ติ๊กครบทุกขั้นจะเป็น “เสร็จสิ้น” เสมอ">
            <select id="qf-ov" value={f.status_override} onChange={set('status_override')}>
              <option value="">อัตโนมัติ (คำนวณจากขั้นตอน)</option>
              {OVERRIDES.map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
            </select>
          </Field>
          <Field label="หมวดผลงานในแกลลอรี่ที่เชื่อมอยู่" htmlFor="qf-gal" hint="ใช้กับปุ่ม “ดูตัวอย่างผลงาน” จะพาไปแกลลอรี่ของหมวดนี้ทั้งหมด ไม่ใช่รูปเดียว">
            <select id="qf-gal" value={f.gallery_service_id} onChange={set('gallery_service_id')}>
              <option value="">ตามประเภทงานของคิวนี้ (อัตโนมัติ)</option>
              {services.map((sv) => <option key={sv.id} value={sv.id}>{sv.name} ({galleryCount(sv.id)} ผลงาน)</option>)}
            </select>
          </Field>
        </div>
        <Field label="ลิงก์การติดต่อ (ไม่บังคับ)" htmlFor="qf-fb" error={errs.fb} hint="ใส่ลิงก์อะไรก็ได้ แล้วกดที่ชื่อลูกค้าเพื่อเปิดลิงก์นั้น">
          <input id="qf-fb" type="text" inputMode="url" autoCapitalize="off" placeholder="https://..." value={f.facebook_url} onChange={set('facebook_url')} />
        </Field>
        <label className="check" style={{ marginBottom: 8 }}><input type="checkbox" checked={f.facebook_public} disabled={!f.facebook_url.trim()} onChange={(e) => setF({ ...f, facebook_public: e.target.checked })} /> แสดงลิงก์นี้บนหน้าเว็บสาธารณะ (ถ้าไม่ติ๊ก ลูกค้าคนอื่นจะไม่เห็น เห็นเฉพาะในหลังบ้าน)</label>
        <label className="check" style={{ marginBottom: 12 }}><input type="checkbox" checked={f.is_public} onChange={(e) => setF({ ...f, is_public: e.target.checked })} /> แสดงคิวนี้บนหน้าเว็บ</label>

        <h4>ขั้นตอนของงานนี้</h4>
        {creating ? (
          previewSteps.length ? (
            <>
              <Alert>ระบบจะคัดลอกขั้นตอนของประเภทงานนี้มาเก็บเป็นของงานนี้โดยเฉพาะ (Snapshot) แก้ Workflow ของประเภทงานทีหลังจะไม่กระทบงานนี้</Alert>
              <ol>{previewSteps.map((s) => <li key={s.id}>{s.label} <small>({STATUS_CATEGORY_LABEL[stepCategory(s)]})</small></li>)}</ol>
            </>
          ) : <Alert>{svc ? 'ประเภทงานนี้ยังไม่มีขั้นตอน' : 'เลือกประเภทงานเพื่อดูขั้นตอน'}</Alert>
        ) : (
          <>
            {serviceChanged && (
              <label className="check" style={{ marginBottom: 10 }}><input type="checkbox" checked={replaceSteps} onChange={(e) => setReplaceSteps(e.target.checked)} /> ใช้ขั้นตอนของประเภทงานใหม่แทน (ขั้นตอนเดิมและที่ติ๊กไว้จะหายไป)</label>
            )}
            {!(serviceChanged && replaceSteps) && <StepsEditor steps={steps} onChange={setSteps} showDone />}
          </>
        )}
        {errs.steps && <span className="error">{errs.steps}</span>}

        {previewSteps.length > 0 && !(serviceChanged && replaceSteps) && (
          <div className="panel panel--tinted" style={{ marginTop: 14 }}>
            <div className="row" style={{ marginBottom: 8 }}><b>ตัวอย่างที่ลูกค้าจะเห็น:</b> <StatusBadge status={live} showOverride /></div>
            <Progress item={{ status_override: f.status_override || null }} steps={previewSteps} />
          </div>
        )}
        {error && <Alert kind="error">{error}</Alert>}
        <div className="row row--end" style={{ marginTop: 12 }}>
          <Button onClick={onClose} sfx="close" disabled={busy}>ยกเลิก</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function QueueAdmin() {
  const q = useAsync(async () => {
    const [queue, services, gallery] = await Promise.all([
      supabase.from('queue_items').select('*, steps:queue_steps(*), contact:queue_item_contacts(*)').order('sort_order').then((r) => (r.error ? supabase.from('queue_items').select('*, steps:queue_steps(*)').order('sort_order').then(unwrap) : r.data)),
      supabase.from('services').select('*, steps:service_steps(*)').order('sort_order').then(unwrap),
      supabase.from('gallery_items').select('id, title, service_id').order('created_at', { ascending: false }).then(unwrap),
    ]);
    return {
      queue: queue.map((r) => {
        const c = Array.isArray(r.contact) ? r.contact[0] : r.contact;
        return { ...r, steps: sortSteps(r.steps), facebook_url_admin: isContactUrl(c?.facebook_url) ? c.facebook_url : null, facebook_public_admin: Boolean(c?.facebook_public) };
      }),
      services, gallery,
    };
  }, []);
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [status, setStatus] = useState('all');
  const [term, setTerm] = useState('');
  const [act, busy, err] = useSubmit(async (fn) => { await fn(); await q.reload(); });
  const [doDelete, delBusy, delErr] = useSubmit(async () => { await deleteRows('queue_items', del.id); setDel(null); await q.reload(); });

  const all = q.data?.queue || [];
  const shown = useMemo(() => {
    const t = term.trim().toLowerCase();
    return all.filter((it) => (status === 'all' || computeStatus(it, it.steps).key === status) && (!t || it.customer_name.toLowerCase().includes(t)));
  }, [all, status, term]);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  const { services, gallery } = q.data;

  // reorder inside the filtered view but persist a full, consistent order
  const moveItem = (it, dir) => {
    const pos = shown.findIndex((x) => x.id === it.id);
    const neighbour = shown[pos + dir];
    if (!neighbour) return;
    const ids = all.map((x) => x.id);
    const a = ids.indexOf(it.id); const b = ids.indexOf(neighbour.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    act(() => reorderRows('queue_items', ids));
  };

  const toggleStep = (s) => act(async () => unwrap(await supabase.from('queue_steps').update({ is_done: !s.is_done, done_at: s.is_done ? null : new Date().toISOString() }).eq('id', s.id)));

  return (
    <AdminPanel label="Queue" title="คิวงาน" actions={<Button variant="primary" icon="plus" disabled={services.length === 0} onClick={() => setForm('new')}>เพิ่มคิว</Button>}>
      {services.length === 0 && <Alert>ต้องสร้างประเภทงาน (Services) อย่างน้อย 1 อย่างก่อนถึงจะเพิ่มคิวได้</Alert>}
      <div className="filters">
        <div className="field" style={{ margin: 0, flex: '1 1 180px' }}>
          <label className="sr-only" htmlFor="qa-status">กรองสถานะ</label>
          <select id="qa-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">สถานะทั้งหมด</option>
            {STATUS_FILTERS.concat(['paused']).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0, flex: '2 1 220px' }}>
          <label className="sr-only" htmlFor="qa-search">ค้นหาชื่อลูกค้า</label>
          <input id="qa-search" type="search" placeholder="ค้นหาชื่อลูกค้า..." value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
      </div>
      {err && <Alert kind="error">{err}</Alert>}
      {shown.length === 0 ? <Empty title={all.length ? 'ไม่พบคิวที่ตรงกับตัวกรอง' : 'ตอนนี้โต๊ะทำงานยังว่างอยู่'} /> : (
        <div className="list">
          {shown.map((it, i) => {
            const st = computeStatus(it, it.steps);
            return (
              <div key={it.id} className={`list-item ${!it.is_public ? 'list-item--off' : ''}`} style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    {it.facebook_url_admin
                      ? <a className="list-item__title queue-card__link" href={it.facebook_url_admin} target="_blank" rel="noopener noreferrer" title="เปิดลิงก์การติดต่อของลูกค้า">{it.customer_name}<Icon name="external" size={14} className="queue-card__ext" /></a>
                      : <span className="list-item__title">{it.customer_name}</span>}
                    <StatusBadge status={st} showOverride />
                    {!it.is_public && <span className="badge badge--grey">ซ่อนจากสาธารณะ</span>}
                    {it.facebook_url_admin && <span className={`badge ${it.facebook_public_admin ? 'badge--mint' : 'badge--grey'}`}>{it.facebook_public_admin ? 'ลิงก์: สาธารณะ' : 'ลิงก์: เฉพาะแอดมิน'}</span>}
                  </div>
                  <div className="list-item__sub">{it.service_name}{it.due_date ? ` · ส่ง ${formatThaiDate(it.due_date)}` : ''}</div>
                  <div style={{ margin: '8px 0' }}><Progress item={it} steps={it.steps} /></div>
                  <div className="row" style={{ gap: 6 }} role="group" aria-label={`ขั้นตอนของ ${it.customer_name}`}>
                    {it.steps.map((s) => (
                      <label key={s.id} className="check badge" style={{ cursor: busy ? 'wait' : 'pointer', background: s.is_done ? 'var(--status-mint)' : 'var(--paper)' }}>
                        <input type="checkbox" checked={s.is_done} disabled={busy} onChange={() => toggleStep(s)} /> {s.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="actions">
                  <OrderButtons index={i} length={shown.length} busy={busy} onMove={(d) => moveItem(it, d)} />
                  <Button small disabled={busy} icon={it.is_public ? 'eyeOff' : 'eye'} onClick={() => act(async () => unwrap(await supabase.from('queue_items').update({ is_public: !it.is_public }).eq('id', it.id)))}>{it.is_public ? 'ซ่อน' : 'แสดง'}</Button>
                  <IconButton icon="edit" label={`แก้ไขคิวของ ${it.customer_name}`} onClick={() => setForm(it)} />
                  <IconButton icon="trash" label={`ลบคิวของ ${it.customer_name}`} onClick={() => setDel(it)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {form && <QueueForm item={form === 'new' ? null : form} services={services} gallery={gallery} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await q.reload(); }} />}
      {del && <ConfirmDialog title={`ลบคิวของ “${del.customer_name}”?`} message="คิวนี้และขั้นตอนทั้งหมดจะถูกลบถาวร ถ้าแค่ไม่อยากให้แสดง ใช้ “ซ่อน” หรือสถานะ “ยกเลิก” แทนได้" busy={delBusy} error={delErr} onCancel={() => setDel(null)} onConfirm={doDelete} />}
    </AdminPanel>
  );
}
