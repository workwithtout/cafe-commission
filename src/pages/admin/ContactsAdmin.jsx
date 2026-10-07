import { useState } from 'react';
import { supabase, unwrap } from '../../lib/supabase.js';
import { useAsync, useSubmit } from '../../lib/hooks.js';
import { useSite } from '../../lib/site.jsx';
import { Alert, Button, ConfirmDialog, Empty, ErrorState, Field, IconButton, Loading, Modal } from '../../components/ui.jsx';
import { CONTACT_ICON_KEYS, Icon } from '../../components/Decor.jsx';
import { isValidUrl } from '../../lib/logic.js';
import { AdminPanel, deleteRows, OrderButtons, move, reorderRows } from './common.jsx';
import { play } from '../../lib/sound.js';

const ICON_LABEL = { link: 'ลิงก์ทั่วไป', twitter: 'Twitter / X', facebook: 'Facebook', instagram: 'Instagram', discord: 'Discord', email: 'Email', tiktok: 'TikTok', line: 'LINE', web: 'เว็บไซต์' };

function ContactForm({ link, onClose, onSaved }) {
  const [f, setF] = useState({ name: link?.name || '', icon: link?.icon || 'link', url: link?.url || '', is_active: link?.is_active ?? true });
  const [errs, setErrs] = useState({});
  const [save, busy, error] = useSubmit(async () => {
    const e = {};
    if (!f.name.trim()) e.name = 'ต้องมีชื่อช่องทาง';
    if (!isValidUrl(f.url)) e.url = 'URL ต้องขึ้นต้นด้วย https:// , http:// หรือ mailto:';
    setErrs(e);
    if (Object.keys(e).length) { play('error'); return; }
    const row = { name: f.name.trim(), icon: f.icon, url: f.url.trim(), is_active: f.is_active };
    if (link) unwrap(await supabase.from('contact_links').update(row).eq('id', link.id));
    else {
      const max = unwrap(await supabase.from('contact_links').select('sort_order').order('sort_order', { ascending: false }).limit(1));
      unwrap(await supabase.from('contact_links').insert({ ...row, sort_order: (max[0]?.sort_order || 0) + 1 }));
    }
    play('success');
    onSaved();
  });
  return (
    <Modal title={link ? 'แก้ไขช่องทางติดต่อ' : 'เพิ่มช่องทางติดต่อ'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <Field label="ชื่อที่แสดงบนปุ่ม *" htmlFor="ct-name" error={errs.name}><input id="ct-name" type="text" maxLength={40} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-autofocus /></Field>
        <Field label="ไอคอน" htmlFor="ct-icon">
          <div className="row">
            <span className="icon-btn" aria-hidden="true"><Icon name={f.icon} size={22} /></span>
            <select id="ct-icon" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} style={{ flex: 1 }}>
              {CONTACT_ICON_KEYS.map((k) => <option key={k} value={k}>{ICON_LABEL[k]}</option>)}
            </select>
          </div>
        </Field>
        <Field label="URL *" htmlFor="ct-url" error={errs.url} hint="เช่น https://x.com/yourname หรือ mailto:you@example.com"><input id="ct-url" type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></Field>
        <label className="check" style={{ marginBottom: 12 }}><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> เปิดใช้งาน (แสดงบนหน้าเว็บ)</label>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="row row--end">
          <Button onClick={onClose} sfx="close" disabled={busy}>ยกเลิก</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ContactsAdmin() {
  const site = useSite();
  const q = useAsync(async () => unwrap(await supabase.from('contact_links').select('*').order('sort_order')), []);
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const refresh = async () => { await q.reload(); await site.reload(); };
  const [act, busy, err] = useSubmit(async (fn) => { await fn(); await refresh(); });
  const [doDelete, delBusy, delErr] = useSubmit(async () => { await deleteRows('contact_links', del.id); setDel(null); await refresh(); });

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  const list = q.data;

  return (
    <AdminPanel label="Contact" title="ช่องทางติดต่อ" actions={<Button variant="primary" icon="plus" onClick={() => setForm('new')}>เพิ่มช่องทาง</Button>}>
      <p>ช่องทางที่เปิดใช้งานจะแสดงในโปรไฟล์ หน้าติดต่อ และใต้คลิปบอร์ดตอนลูกค้ากด “สนใจงานนี้”</p>
      {err && <Alert kind="error">{err}</Alert>}
      {list.length === 0 ? <Empty title="ยังไม่มีช่องทางติดต่อ">ลูกค้าจะไม่เห็นปุ่มติดต่อจนกว่าจะเพิ่มอย่างน้อย 1 ช่องทาง</Empty> : (
        <div className="list">
          {list.map((c, i) => (
            <div key={c.id} className={`list-item ${!c.is_active ? 'list-item--off' : ''}`}>
              <div className="list-item__main">
                <span className="icon-btn" aria-hidden="true"><Icon name={c.icon} size={22} /></span>
                <div><div className="list-item__title">{c.name}</div><div className="list-item__sub">{c.url}</div>{!c.is_active && <span className="badge badge--grey">ปิดใช้งาน</span>}</div>
              </div>
              <div className="actions">
                <OrderButtons index={i} length={list.length} busy={busy} onMove={(d) => act(() => reorderRows('contact_links', move(list, i, d).map((x) => x.id)))} />
                <Button small disabled={busy} onClick={() => act(async () => unwrap(await supabase.from('contact_links').update({ is_active: !c.is_active }).eq('id', c.id)))}>{c.is_active ? 'ปิด' : 'เปิด'}</Button>
                <IconButton icon="edit" label={`แก้ไข ${c.name}`} onClick={() => setForm(c)} />
                <IconButton icon="trash" label={`ลบ ${c.name}`} onClick={() => setDel(c)} />
              </div>
            </div>
          ))}
        </div>
      )}
      {form && <ContactForm link={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await refresh(); }} />}
      {del && <ConfirmDialog title={`ลบ “${del.name}”?`} message="ปุ่มช่องทางนี้จะหายไปจากหน้าเว็บทันที" busy={delBusy} error={delErr} onCancel={() => setDel(null)} onConfirm={doDelete} />}
    </AdminPanel>
  );
}
