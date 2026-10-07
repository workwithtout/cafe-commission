import { useMemo, useState } from 'react';
import { useAsync } from '../lib/hooks.js';
import { fetchGallery, fetchQueue, queuePreviewTarget } from '../lib/data.js';
import { QueueCard } from '../components/Cards.jsx';
import { Empty, ErrorState, Loading } from '../components/ui.jsx';
import { SectionTitle } from '../components/Decor.jsx';
import { STATUS, STATUS_FILTERS, computeStatus } from '../lib/logic.js';
import { useSite } from '../lib/site.jsx';
import { play } from '../lib/sound.js';
import { Pin } from '../components/Layout.jsx';

export default function Queue() {
  const { theme } = useSite();
  const q = useAsync(async () => {
    const [queue, gallery] = await Promise.all([fetchQueue(), fetchGallery()]);
    return { queue, gallery };
  }, []);
  const [status, setStatus] = useState('all');
  const [term, setTerm] = useState('');

  const shown = useMemo(() => {
    const list = q.data?.queue || [];
    const t = term.trim().toLowerCase();
    return list.filter((it) => {
      if (status !== 'all' && computeStatus(it, it.steps).key !== status) return false;
      if (t && !it.customer_name.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [q.data, status, term]);

  return (
    <section className="panel" aria-labelledby="queue-h">
      <span className="panel__label">Orders</span>
      <div style={{ marginTop: 10 }}>
        <SectionTitle motif={theme.motif} sub="ดูความคืบหน้างานของทุกคนได้ที่นี่ ความคืบหน้าคำนวณจากขั้นตอนจริง">
          <span id="queue-h">คิวงาน</span>
        </SectionTitle>
      </div>

      <div className="filters">
        <div className="field" style={{ margin: 0, flex: '1 1 180px', minWidth: 160 }}>
          <label className="sr-only" htmlFor="q-status">กรองตามสถานะ</label>
          <select id="q-status" value={status} onChange={(e) => { play('tap'); setStatus(e.target.value); }}>
            <option value="all">สถานะทั้งหมด</option>
            {STATUS_FILTERS.map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0, flex: '2 1 220px' }}>
          <label className="sr-only" htmlFor="q-search">ค้นหาชื่อลูกค้า</label>
          <input id="q-search" type="search" placeholder="ค้นหาชื่อลูกค้า..." value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
      </div>

      {q.loading && !q.data ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : shown.length === 0 ? (
        (q.data?.queue.length || 0) === 0
          ? <Empty title="ตอนนี้โต๊ะทำงานยังว่างอยู่">ยังไม่มีคิวงานในตอนนี้ แวะมาดูใหม่ได้นะ</Empty>
          : <Empty title="ไม่พบคิวที่ตรงกับที่ค้นหา">ลองเปลี่ยนสถานะหรือคำค้นหาดูนะ</Empty>
      ) : (
        <div className="grid grid--queue">
          {shown.map((it) => <QueueCard key={it.id} item={it} previewTo={queuePreviewTarget(it, q.data.gallery)} />)}
        </div>
      )}
      <Pin index={2} size={44} className="float-a" style={{ left: 6, bottom: -18 }} />
    </section>
  );
}
