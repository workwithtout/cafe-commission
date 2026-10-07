import { Link } from 'react-router-dom';
import { Bow, Icon, AccentSticker } from './Decor.jsx';
import { Button, Progress, StatusBadge } from './ui.jsx';
import { useSite } from '../lib/site.jsx';
import { computeStatus, formatDuration, formatPrice, formatThaiDate, isContactUrl } from '../lib/logic.js';
import { RichText } from './RichText.jsx';
import { play } from '../lib/sound.js';

/* ------------------------------------------------------------------ service */
export function ServiceCard({ service, hasGallery, onInterest, index = 0 }) {
  const { theme } = useSite();
  return (
    <article className="service-card">
      {index % 3 === 0 && <span className="service-card__ribbon" aria-hidden="true"><Bow size={50} /></span>}
      <div className="service-card__photo">
        {service.image_url
          ? <img src={service.image_url} alt={`ตัวอย่างงาน ${service.name}`} loading="lazy" />
          : <AccentSticker motif={theme.motif} size={64} />}
      </div>
      <h3 className="service-card__name">{service.name}</h3>
      <RichText value={service.description} className="service-card__desc" />
      <div className="service-card__meta">
        <span>เริ่มต้น <b>{formatPrice(service.price_from)}</b></span>
        <span><Icon name="clock" size={16} /> {formatDuration(service.duration_min, service.duration_max)}</span>
        {!service.is_open && <span className="badge badge--rose">ปิดรับงานประเภทนี้</span>}
      </div>
      <div className="service-card__actions">
        {hasGallery ? (
          <Link className="btn btn--soft" to={`/gallery?service=${service.id}`} onClick={() => play('gallery')}>
            <Icon name="image" size={18} className="btn__icon" /> ดูตัวอย่างผลงาน
          </Link>
        ) : (
          <Button disabled icon="image" aria-disabled="true">ยังไม่มีตัวอย่างผลงาน</Button>
        )}
        <Button variant="primary" onClick={() => onInterest(service)} disabled={!service.is_open} sfx="open">
          {service.is_open ? 'สนใจงานนี้' : 'ปิดรับชั่วคราว'}
        </Button>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ queue */
export function QueueCard({ item, previewTo }) {
  const status = computeStatus(item, item.steps);
  const next = status.currentStep;
  return (
    <article className="queue-card">
      <div className="queue-card__top">
        <div>
          <div className="queue-card__type">{item.service_name}</div>
          <h3 className="queue-card__name">
            {isContactUrl(item.facebook_url)
              ? (
                <a className="queue-card__link" href={item.facebook_url} target="_blank" rel="noopener noreferrer" title="เปิดลิงก์การติดต่อของลูกค้า" onClick={() => play('tap')}>
                  {item.customer_name}<Icon name="external" size={16} className="queue-card__ext" />
                </a>
              )
              : item.customer_name}
          </h3>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="queue-card__row">
        <Icon name="clock" size={18} />
        <span>
          <b>ระยะเวลา:</b> {item.duration_days != null ? `${item.duration_days} วัน` : '-'}
          {item.due_date ? ` (ส่ง ${formatThaiDate(item.due_date)})` : ''}
        </span>
      </div>
      {item.description ? <p className="queue-card__desc">{item.description}</p> : null}
      <Progress item={item} steps={item.steps} />
      {status.key !== 'completed' && status.key !== 'cancelled' && next ? (
        <div className="queue-card__step">ตอนนี้อยู่ที่: <b>{next.label}</b></div>
      ) : null}
      {previewTo ? (
        <Link className="btn btn--primary" to={previewTo} onClick={() => play('gallery')}>
          <Icon name="image" size={18} className="btn__icon" /> ดูตัวอย่างผลงานในแกลลอรี่
        </Link>
      ) : (
        <Button disabled icon="image" aria-disabled="true">ยังไม่มีตัวอย่างผลงาน</Button>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ gallery tile */
export function GalleryTile({ item, onOpen }) {
  const extra = item.images?.length || 0;
  if (item.kind === 'album' && /^https?:\/\//i.test(item.album_url || '')) {
    // An album keeps only a link: the whole tile opens it in a new tab (nothing is copied from the external album)
    return (
      <a className="tile tile--album" href={item.album_url} target="_blank" rel="noopener noreferrer" onClick={() => play('gallery')} aria-label={`ดูอัลบั้มนี้: ${item.title}`}>
        <span className="tile__tape" aria-hidden="true" />
        <img className="tile__img" src={item.image_url} alt={item.title} loading="lazy" />
        <p className="tile__title">{item.title}</p>
        {item.owner_name ? <p className="tile__by">สั่งโดย {item.owner_name}</p> : null}
        <p className="tile__album">ดูอัลบั้มนี้</p>
      </a>
    );
  }
  return (
    <button type="button" className="tile" onClick={() => { play('gallery'); onOpen(item); }} aria-label={`เปิดดู ${item.title}`}>
      <span className="tile__tape" aria-hidden="true" />
      <img className="tile__img" src={item.image_url} alt={item.title} loading="lazy" />
      {extra > 0 && <span className="tile__count" aria-label={`${extra + 1} รูป`}>{extra + 1} รูป</span>}
      <p className="tile__title">{item.title}</p>
      {item.owner_name ? <p className="tile__by">สั่งโดย {item.owner_name}</p> : null}
    </button>
  );
}
