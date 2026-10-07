import PictureViewer from '../components/PictureViewer.jsx';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../lib/site.jsx';
import { useAsync } from '../lib/hooks.js';
import { fetchGallery, fetchQueue, fetchReviewStats, queuePreviewTarget } from '../lib/data.js';
import { GalleryTile, QueueCard, ServiceCard } from '../components/Cards.jsx';
import InterestModal from '../components/InterestModal.jsx';
import { ReviewSummary } from './Reviews.jsx';
import { ContactButtons, Pin } from '../components/Layout.jsx';
import { Empty, Loading, Modal } from '../components/ui.jsx';
import { Bow, SectionTitle, Sparkle } from '../components/Decor.jsx';
import { computeStatus, formatThaiDate } from '../lib/logic.js';
import { play } from '../lib/sound.js';
import { RichText } from '../components/RichText.jsx';

function More({ to, children }) {
  return <p style={{ textAlign: 'right', margin: '12px 0 0' }}><Link className="btn btn--small" to={to} onClick={() => play('nav')}>{children}</Link></p>;
}

export default function Home() {
  const { profile, services, contacts, theme } = useSite();
  const q = useAsync(async () => {
    const [gallery, queue, stats] = await Promise.all([fetchGallery(), fetchQueue(), fetchReviewStats()]);
    return { gallery, queue, stats };
  }, []);
  const [picked, setPicked] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const gallery = q.data?.gallery || [];
  const galleryServiceIds = new Set(gallery.map((g) => g.service_id).filter(Boolean));
  const activeQueue = (q.data?.queue || []).filter((it) => !['completed', 'cancelled'].includes(computeStatus(it, it.steps).key)).slice(0, 3);
  const featured = services.filter((s) => s.is_open).slice(0, 3);

  return (
    <>
      {/* welcome */}
      <section className="panel panel--tinted" aria-labelledby="welcome-h">
        <span className="panel__label">Welcome</span>
        <div style={{ marginTop: 10, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="float-c" aria-hidden="true"><Bow size={64} /></span>
          <div style={{ flex: '1 1 240px' }}>
            <h2 id="welcome-h" style={{ marginBottom: 4 }}>{profile?.welcome_title || 'ยินดีต้อนรับเข้าสู่ร้านของเรา'}</h2>
            <p style={{ margin: 0 }}>{profile?.welcome_text || 'แวะชมผลงาน แล้วทักมาคุยงานกันได้เลย'}</p>
          </div>
          <span className="float-a" aria-hidden="true"><Sparkle size={36} /></span>
        </div>
        <Pin index={0} size={46} className="float-b" style={{ right: 12, top: -22 }} />
      </section>

      {/* menu */}
      <section className="panel" aria-labelledby="home-menu">
        <span className="panel__label">Menu</span>
        <div style={{ marginTop: 10 }}><SectionTitle motif={theme.motif}><span id="home-menu">เมนูงาน</span></SectionTitle></div>
        {featured.length === 0
          ? <Empty title="ตอนนี้ยังไม่มีเมนูที่เปิดรับ">ลองดูหน้าเมนูงานเพื่อดูเมนูทั้งหมดนะ</Empty>
          : <div className="grid grid--services">{featured.map((s, i) => <ServiceCard key={s.id} service={s} index={i} hasGallery={galleryServiceIds.has(s.id)} onInterest={setPicked} />)}</div>}
        <More to="/services">ดูเมนูทั้งหมด</More>
      </section>

      {/* queue */}
      <section className="panel panel--check" aria-labelledby="home-queue">
        <span className="panel__label">Orders</span>
        <div style={{ marginTop: 10 }}><SectionTitle motif={theme.motif}><span id="home-queue">คิวงานตอนนี้</span></SectionTitle></div>
        {q.loading && !q.data ? <Loading /> : activeQueue.length === 0
          ? <Empty title="ตอนนี้โต๊ะทำงานยังว่างอยู่">ยังไม่มีงานที่กำลังทำอยู่</Empty>
          : <div className="grid grid--queue">{activeQueue.map((it) => <QueueCard key={it.id} item={it} previewTo={queuePreviewTarget(it, gallery)} />)}</div>}
        <More to="/queue">ดูคิวทั้งหมด</More>
      </section>

      {/* gallery */}
      <section className="panel" aria-labelledby="home-gal">
        <span className="panel__label">Gallery</span>
        <div style={{ marginTop: 10 }}><SectionTitle motif={theme.motif}><span id="home-gal">ผลงานล่าสุด</span></SectionTitle></div>
        {q.loading && !q.data ? <Loading /> : gallery.length === 0
          ? <Empty title="ยังไม่มีผลงาน">เจ้าของร้านจะนำผลงานมาแปะเร็ว ๆ นี้</Empty>
          : <div className="grid grid--gallery" style={{ paddingTop: 10 }}>{gallery.slice(0, 6).map((g) => <GalleryTile key={g.id} item={g} onOpen={setLightbox} />)}</div>}
        <More to="/gallery">ดูแกลลอรี่ทั้งหมด</More>
      </section>

      {/* reviews */}
      <section className="panel panel--tinted" aria-labelledby="home-rv">
        <span className="panel__label">Reviews</span>
        <div style={{ marginTop: 10 }}><SectionTitle motif={theme.motif}><span id="home-rv">รีวิว</span></SectionTitle></div>
        {q.data ? <ReviewSummary stats={q.data.stats} /> : <Loading />}
        <More to="/reviews">อ่านรีวิวทั้งหมด</More>
      </section>

      {/* contact */}
      <section className="panel" aria-labelledby="home-ct">
        <span className="panel__label">Contact</span>
        <div style={{ marginTop: 10 }}><SectionTitle motif={theme.motif}><span id="home-ct">ช่องทางติดต่อ</span></SectionTitle></div>
        {contacts.length === 0
          ? <Empty title="ยังไม่มีช่องทางติดต่อ" />
          : <div className="contact-grid"><ContactButtons contacts={contacts} /></div>}
      </section>

      {picked && <InterestModal serviceName={picked.name} onClose={() => setPicked(null)} />}
      {lightbox && (
        <Modal title={lightbox.title} onClose={() => setLightbox(null)} wide>
          <div className="lightbox">
            <PictureViewer item={lightbox} />
            <div>
              {lightbox.owner_name ? <span>สั่งโดย <b>{lightbox.owner_name}</b> </span> : null}
              {lightbox.art_date ? <span style={{ color: 'var(--muted)' }}>· {formatThaiDate(lightbox.art_date)}</span> : null}
              <RichText value={lightbox.description} className="lightbox__desc" />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
