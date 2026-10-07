import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync } from '../lib/hooks.js';
import { fetchGallery } from '../lib/data.js';
import { GalleryTile } from '../components/Cards.jsx';
import { Empty, ErrorState, Loading, Modal } from '../components/ui.jsx';
import { SectionTitle } from '../components/Decor.jsx';
import { useSite } from '../lib/site.jsx';
import { formatThaiDate } from '../lib/logic.js';
import { play } from '../lib/sound.js';
import { Pin } from '../components/Layout.jsx';
import { RichText } from '../components/RichText.jsx';
import PictureViewer from '../components/PictureViewer.jsx';

export default function Gallery() {
  const { services, theme } = useSite();
  const q = useAsync(fetchGallery, []);
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(null);

  const filter = params.get('service') || 'all';
  const itemParam = params.get('item');
  const items = q.data || [];

  // filters are built from the real Service records (no hard-coded categories)
  const hasUncategorised = items.some((g) => !g.service_id || !services.some((s) => s.id === g.service_id));

  // deep link from the queue: ?item=<id> opens that artwork (and selects its category)
  useEffect(() => {
    if (!itemParam || !q.data) return;
    const found = q.data.find((g) => g.id === itemParam);
    if (found) {
      setOpen(found);
      if (found.service_id && !params.get('service')) setParams({ service: found.service_id }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemParam, q.data]);

  const shown = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'other') return items.filter((g) => !g.service_id || !services.some((s) => s.id === g.service_id));
    return items.filter((g) => g.service_id === filter);
  }, [items, filter, services]);

  const serviceName = (id) => services.find((s) => s.id === id)?.name;
  const choose = (v) => { play('tap'); v === 'all' ? setParams({}) : setParams({ service: v }); };
  const close = () => { setOpen(null); if (itemParam) { const p = new URLSearchParams(params); p.delete('item'); setParams(p, { replace: true }); } };

  return (
    <section className="panel" aria-labelledby="gal-h">
      <span className="panel__label">Gallery</span>
      <div style={{ marginTop: 10 }}>
        <SectionTitle motif={theme.motif} sub="ผลงานที่ผ่านมา กรองตามประเภทงานได้">
          <span id="gal-h">แกลลอรี่</span>
        </SectionTitle>
      </div>

      <div className="filters" role="group" aria-label="กรองตามประเภทงาน">
        <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => choose('all')}>ทั้งหมด</button>
        {services.map((s) => (
          <button key={s.id} type="button" className="chip" aria-pressed={filter === s.id} onClick={() => choose(s.id)}>{s.name}</button>
        ))}
        {hasUncategorised && <button type="button" className="chip" aria-pressed={filter === 'other'} onClick={() => choose('other')}>อื่น ๆ</button>}
      </div>

      {q.loading && !q.data ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : shown.length === 0 ? (
        <Empty title="ยังไม่มีผลงานในหมวดนี้">เจ้าของร้านจะนำผลงานมาแปะเพิ่มเร็ว ๆ นี้</Empty>
      ) : (
        <div className="grid grid--gallery" style={{ paddingTop: 10 }}>
          {shown.map((g) => <GalleryTile key={g.id} item={g} onOpen={setOpen} />)}
        </div>
      )}
      <Pin index={0} size={44} className="float-c" style={{ right: 10, bottom: -18 }} />

      {open && (
        <Modal title={open.title} onClose={close} wide>
          <div className="lightbox">
            <PictureViewer item={open} />
            <div>
              <div className="row">
                {serviceName(open.service_id) && <span className="badge badge--sky">{serviceName(open.service_id)}</span>}
                {open.owner_name && <span>สั่งโดย <b>{open.owner_name}</b></span>}
                {open.art_date && <span style={{ color: 'var(--muted)' }}>{formatThaiDate(open.art_date)}</span>}
              </div>
              <RichText value={open.description} className="lightbox__desc" />
              {open.kind === 'album' && /^https?:\/\//i.test(open.album_url || '') && (
                <a className="btn btn--primary" href={open.album_url} target="_blank" rel="noopener noreferrer">ดูอัลบั้มนี้</a>
              )}
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
