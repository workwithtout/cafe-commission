import { useState } from 'react';
import { useSite } from '../lib/site.jsx';
import { ContactButtons } from '../components/Layout.jsx';
import { Alert, Button, Empty, Field, useCopy } from '../components/ui.jsx';
import { SectionTitle } from '../components/Decor.jsx';
import { fillTemplate } from '../lib/logic.js';

export default function Contact() {
  const { contacts, services, settings, theme } = useSite();
  const open = services.filter((s) => s.is_open);
  const [svc, setSvc] = useState('');
  const { copy, copied, failed } = useCopy();
  const name = open.find((s) => s.id === svc)?.name || 'งาน';
  const message = fillTemplate(settings?.inquiry_template, name);

  return (
    <section className="panel" aria-labelledby="ct-h">
      <span className="panel__label">Contact</span>
      <div style={{ marginTop: 10 }}>
        <SectionTitle motif={theme.motif} sub="ทักมาคุยงานได้ทุกช่องทางเลย">
          <span id="ct-h">ช่องทางติดต่อ</span>
        </SectionTitle>
      </div>

      {contacts.length === 0 ? (
        <Empty title="ยังไม่มีช่องทางติดต่อ">เจ้าของร้านยังไม่ได้เพิ่มช่องทาง ลองแวะมาใหม่นะ</Empty>
      ) : (
        <div className="contact-grid"><ContactButtons contacts={contacts} /></div>
      )}

      <div className="stitch" />
      <h3>ข้อความสำหรับทักมาคุยงาน</h3>
      {open.length > 0 && (
        <Field label="สนใจงานประเภทไหน?" htmlFor="ct-svc">
          <select id="ct-svc" value={svc} onChange={(e) => setSvc(e.target.value)}>
            <option value="">ยังไม่แน่ใจ</option>
            {open.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      )}
      <div className="clipboard__msg" tabIndex={0} aria-label="ข้อความที่จะคัดลอก">{message}</div>
      <Button variant="primary" icon="copy" sfx={null} onClick={() => copy(message)}>{copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}</Button>
      {failed && <Alert kind="error">คัดลอกอัตโนมัติไม่ได้ ลองเลือกข้อความแล้วคัดลอกเองนะ</Alert>}
    </section>
  );
}
