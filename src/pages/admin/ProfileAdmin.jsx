import { useEffect, useState } from 'react';
import { supabase, unwrap } from '../../lib/supabase.js';
import { useAsync, useSubmit } from '../../lib/hooks.js';
import { useSite } from '../../lib/site.jsx';
import { Alert, Button, ErrorState, Field, Loading } from '../../components/ui.jsx';
import { PROFILE_STATUS } from '../../lib/logic.js';
import { AdminPanel, ImagePicker, SHAPES, commitImage, removeFile } from './common.jsx';
import { RichEditor } from '../../components/RichText.jsx';
import { cleanForSave, plainText } from '../../lib/richtext.js';
import { play } from '../../lib/sound.js';

export default function ProfileAdmin() {
  const site = useSite();
  const q = useAsync(async () => unwrap(await supabase.from('profiles').select('*').eq('id', 1).maybeSingle()), []);
  const [f, setF] = useState(null);
  const [img, setImg] = useState({ url: '' });
  const [errs, setErrs] = useState({});
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (q.data !== undefined && !q.loading) {
      const p = q.data || { display_name: '', handle: '', bio: '', tagline: '', status: 'open', welcome_title: '', welcome_text: '', avatar_path: null };
      setF(p); setImg({ url: p.avatar_url || '' });
    }
  }, [q.data, q.loading]);

  const [save, busy, error] = useSubmit(async () => {
    setOk(false);
    const e = {};
    if (!f.display_name?.trim()) e.display_name = 'ต้องมีชื่อ';
    if (plainText(f.bio).length > 1000) e.bio = 'Bio ยาวเกิน 1000 ตัวอักษร';
    setErrs(e);
    if (Object.keys(e).length) { play('error'); return; }

    const pic = await commitImage(img, 'avatar', f.avatar_path); // upload first; throws => nothing saved
    const row = {
      id: 1, display_name: f.display_name.trim(), handle: f.handle?.trim() || null, bio: cleanForSave(f.bio),
      tagline: f.tagline?.trim() || null, status: f.status, welcome_title: f.welcome_title?.trim() || null,
      welcome_text: f.welcome_text?.trim() || null, avatar_url: pic.url, avatar_path: pic.path, updated_at: new Date().toISOString(),
    };
    try {
      unwrap(await supabase.from('profiles').upsert(row));
    } catch (err) {
      if (img.file) await removeFile(pic.path);   // not saved: do not leave the new upload behind
      throw err;
    }
    if (pic.oldPath && pic.oldPath !== pic.path) await removeFile(pic.oldPath);
    setImg({ url: pic.url || '' });
    setF({ ...f, ...row });
    await site.reload();
    play('success');
    setOk(true);
  });

  if (q.loading || !f) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <AdminPanel label="Profile" title="โปรไฟล์">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <ImagePicker label="รูปโปรไฟล์" value={img} onChange={setImg} choices={[SHAPES.square]} round maxSide={800} hint="รูปโปรไฟล์แสดงเป็นวงกลม ลากรูปหรือซูมให้ส่วนสำคัญอยู่กลางวง" />
        <div className="cols-2">
          <Field label="ชื่อที่แสดง *" htmlFor="pf-name" error={errs.display_name}><input id="pf-name" type="text" maxLength={80} value={f.display_name || ''} onChange={set('display_name')} /></Field>
          <Field label="Username / Handle" htmlFor="pf-handle"><input id="pf-handle" type="text" maxLength={60} value={f.handle || ''} onChange={set('handle')} /></Field>
        </div>
        <Field label="Bio" htmlFor="pf-bio" error={errs.bio}><RichEditor id="pf-bio" value={f.bio || ''} onChange={(html) => setF((p) => ({ ...p, bio: html }))} maxText={1000} ariaLabel="Bio" /></Field>
        <Field label="คำอธิบายสั้น ๆ (แสดงใต้ชื่อร้าน)" htmlFor="pf-tag"><input id="pf-tag" type="text" maxLength={200} value={f.tagline || ''} onChange={set('tagline')} /></Field>
        <Field label="สถานะรับงาน" htmlFor="pf-status" hint="ถ้าตั้งเป็น “เปิดรับงาน” แต่ปิดทุก Service ไว้ หน้าเว็บจะแสดง “ปิดรับงาน” ให้เองอัตโนมัติ">
          <select id="pf-status" value={f.status} onChange={set('status')}>
            {Object.entries(PROFILE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <div className="cols-2">
          <Field label="หัวข้อต้อนรับหน้าแรก" htmlFor="pf-wt"><input id="pf-wt" type="text" maxLength={120} value={f.welcome_title || ''} onChange={set('welcome_title')} /></Field>
          <Field label="ข้อความต้อนรับ" htmlFor="pf-wx"><input id="pf-wx" type="text" maxLength={600} value={f.welcome_text || ''} onChange={set('welcome_text')} /></Field>
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        {ok && <Alert kind="ok">บันทึกโปรไฟล์แล้ว</Alert>}
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
      </form>
    </AdminPanel>
  );
}
