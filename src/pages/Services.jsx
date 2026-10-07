import { useState } from 'react';
import { useSite } from '../lib/site.jsx';
import { useAsync } from '../lib/hooks.js';
import { fetchGallery } from '../lib/data.js';
import { ServiceCard } from '../components/Cards.jsx';
import InterestModal from '../components/InterestModal.jsx';
import { Empty, ErrorState, Loading } from '../components/ui.jsx';
import { SectionTitle } from '../components/Decor.jsx';
import { Pin } from '../components/Layout.jsx';

export function useGalleryServiceIds() {
  const q = useAsync(fetchGallery, []);
  const ids = new Set((q.data || []).map((g) => g.service_id).filter(Boolean));
  return { ...q, ids };
}

export default function Services() {
  const { services, theme } = useSite();
  const gal = useGalleryServiceIds();
  const [picked, setPicked] = useState(null);

  return (
    <section className="panel" aria-labelledby="services-h">
      <span className="panel__label">Menu</span>
      <div style={{ marginTop: 10 }}>
        <SectionTitle motif={theme.motif} sub="เลือกเมนูงานที่ถูกใจ แล้วกด “สนใจงานนี้” ได้เลย">
          <span id="services-h">เมนูงาน</span>
        </SectionTitle>
      </div>
      {gal.loading && !gal.data ? <Loading /> : gal.error ? <ErrorState error={gal.error} onRetry={gal.reload} /> : services.length === 0 ? (
        <Empty title="ยังไม่มีเมนูงาน">เจ้าของร้านกำลังเตรียมเมนูอยู่นะ</Empty>
      ) : (
        <div className="grid grid--services">
          {services.map((s, i) => (
            <ServiceCard key={s.id} service={s} index={i} hasGallery={gal.ids.has(s.id)} onInterest={setPicked} />
          ))}
        </div>
      )}
      <Pin index={1} size={46} className="float-b" style={{ right: 8, bottom: -18 }} />
      {picked && <InterestModal serviceName={picked.name} onClose={() => setPicked(null)} />}
    </section>
  );
}
