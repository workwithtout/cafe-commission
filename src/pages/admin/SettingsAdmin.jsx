import { useEffect, useState } from 'react';
import { supabase, unwrap } from '../../lib/supabase.js';
import { useAsync, useSubmit } from '../../lib/hooks.js';
import { useSite } from '../../lib/site.jsx';
import { Alert, Button, ErrorState, Field, Loading } from '../../components/ui.jsx';
import { fillTemplate } from '../../lib/logic.js';
import { AdminPanel } from './common.jsx';
import WatermarkSettings from './WatermarkSettings.jsx';
import { play } from '../../lib/sound.js';

export default function SettingsAdmin() {
  const site = useSite();
  const q = useAsync(async () => unwrap(await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()), []);
  const [f, setF] = useState(null);
  const [ok, setOk] = useState(false);
  const [errs, setErrs] = useState({});

  useEffect(() => { if (!q.loading && q.data !== undefined) setF(q.data || { shop_name: 'Artist Café', sfx_enabled: true, inquiry_template: 'สวัสดีค่ะ สนใจงาน {service} ค่ะ\nอยากสอบถามรายละเอียดเพิ่มเติมค่ะ' }); }, [q.data, q.loading]);

  const [save, busy, error] = useSubmit(async () => {
    setOk(false);
    const e = {};
    if (!f.shop_name?.trim()) e.shop = 'ต้องมีชื่อร้าน';
    if (!f.inquiry_template?.trim()) e.tpl = 'ข้อความต้องไม่ว่าง';
    else if (!f.inquiry_template.includes('{service}')) e.tpl = 'ต้องมี {service} อย่างน้อย 1 ที่ เพื่อให้ระบบแทนชื่อประเภทงานให้อัตโนมัติ';
    setErrs(e);
    if (Object.keys(e).length) { play('error'); return; }
    unwrap(await supabase.from('site_settings').upsert({
      id: 1, active_theme_id: f.active_theme_id || null, shop_name: f.shop_name.trim(), sfx_enabled: f.sfx_enabled,
      inquiry_template: f.inquiry_template, updated_at: new Date().toISOString(),
    }));
    await site.reload();
    play('success');
    setOk(true);
  });

  if (q.loading || !f) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;

  return (
    <>
    <AdminPanel label="Settings" title="ตั้งค่าร้าน">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <Field label="ชื่อร้าน (ป้ายหน้าร้าน) *" htmlFor="st-name" error={errs.shop}><input id="st-name" type="text" maxLength={60} value={f.shop_name} onChange={(e) => setF({ ...f, shop_name: e.target.value })} /></Field>
        <Field label="ข้อความตอนกด “สนใจงานนี้”" htmlFor="st-tpl" error={errs.tpl} hint="ใช้ {service} แทนชื่อประเภทงานที่ลูกค้ากำลังสนใจ">
          <textarea id="st-tpl" maxLength={600} value={f.inquiry_template} onChange={(e) => setF({ ...f, inquiry_template: e.target.value })} />
        </Field>
        <div className="panel panel--tinted" style={{ marginTop: 0, marginBottom: 14 }}>
          <b>ตัวอย่าง (Chibi Fullcolor):</b>
          <div style={{ whiteSpace: 'pre-line' }}>{fillTemplate(f.inquiry_template, 'Chibi Fullcolor')}</div>
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <label className="check"><input type="checkbox" checked={f.sfx_enabled} onChange={(e) => setF({ ...f, sfx_enabled: e.target.checked })} /> เปิดเสียงปุ่มบนหน้าเว็บ</label>
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        {ok && <Alert kind="ok">บันทึกการตั้งค่าแล้ว</Alert>}
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
      </form>
    </AdminPanel>
    <WatermarkSettings />
    </>
  );
}
