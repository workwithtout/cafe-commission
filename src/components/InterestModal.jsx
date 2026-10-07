import { Modal, Button, Alert, useCopy } from './ui.jsx';
import { Icon } from './Decor.jsx';
import { useSite } from '../lib/site.jsx';
import { fillTemplate } from '../lib/logic.js';
import { play } from '../lib/sound.js';

/**
 * "สนใจงานนี้": a clipboard with the ready-to-copy message (service name auto-filled from the
 * editable template in site settings). The contact channels sit BELOW the clipboard so the
 * customer can copy, then jump straight to a channel to start the conversation.
 */
export default function InterestModal({ serviceName, onClose }) {
  const { settings, contacts = [] } = useSite();
  const message = fillTemplate(settings?.inquiry_template, serviceName);
  const { copy, copied, failed } = useCopy();

  return (
    <Modal title={null} onClose={onClose} labelledBy="interest-title">
      <div className="clipboard">
        <div className="clipboard__clip" aria-hidden="true" />
        <div className="clipboard__paper">
          <h3 id="interest-title">สนใจงาน {serviceName} ใช่ไหม?</h3>
          <span className="field__label" style={{ fontFamily: 'var(--font-label)' }}>ข้อความสำหรับส่งหาเรา</span>
          <div className="clipboard__msg" tabIndex={0} aria-label="ข้อความที่จะคัดลอก">{message}</div>
          <div className="row">
            <Button variant="primary" icon="copy" sfx={null} onClick={() => copy(message)} data-autofocus>
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}
            </Button>
            {copied && <span role="status" style={{ fontFamily: 'var(--font-label)' }}><Icon name="check" size={16} /> ใส่คลิปบอร์ดแล้ว ไปวางในแชทได้เลย</span>}
          </div>
          {failed && <Alert kind="error">คัดลอกอัตโนมัติไม่ได้ ลองกดค้างที่ข้อความด้านบนเพื่อเลือกแล้วคัดลอกเองนะ</Alert>}
        </div>
      </div>

      {/* contact channels: directly beneath the clipboard */}
      <div className="clipboard__after">
        <h4>แล้วติดต่อเราได้ทางนี้เลย</h4>
        {contacts.length === 0 ? (
          <Alert>เจ้าของร้านยังไม่ได้ใส่ช่องทางติดต่อ ลองกลับมาใหม่ภายหลังนะ</Alert>
        ) : (
          <div className="contact-grid">
            {contacts.map((c) => (
              <a
                key={c.id} className="btn btn--soft" href={c.url}
                target={c.url.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer"
                onClick={() => play('tap')}
              >
                <Icon name={c.icon} size={18} className="btn__icon" /> {c.name}
              </a>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
