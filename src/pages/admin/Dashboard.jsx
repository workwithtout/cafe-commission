import { Link } from 'react-router-dom';
import { supabase, unwrap } from '../../lib/supabase.js';
import { useAsync } from '../../lib/hooks.js';
import { computeStatus } from '../../lib/logic.js';
import { ErrorState, Loading, Alert } from '../../components/ui.jsx';
import { AdminPanel } from './common.jsx';

export default function Dashboard() {
  const q = useAsync(async () => {
    const [queue, gallery, stats, pending] = await Promise.all([
      supabase.from('queue_items').select('*, steps:queue_steps(*)').then(unwrap),
      supabase.from('gallery_items').select('id', { count: 'exact', head: true }).then((r) => { if (r.error) throw r.error; return r.count; }),
      supabase.rpc('get_review_stats').then(unwrap),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending').then((r) => { if (r.error) throw r.error; return r.count; }),
    ]);
    const counts = { pending: 0, working: 0, done: 0, other: 0 };
    queue.forEach((it) => {
      const k = computeStatus(it, it.steps).key;
      if (k === 'pending') counts.pending += 1;
      else if (k === 'completed') counts.done += 1;
      else if (k === 'cancelled') counts.other += 1;
      else counts.working += 1; // confirmed / in progress / review / paused all count as "being handled"
    });
    return { counts, gallery, stats, pending };
  }, []);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  const { counts, gallery, stats, pending } = q.data;

  return (
    <AdminPanel label="Overview" title="สรุปภาพรวม">
      {pending > 0 && <Alert>มีรีวิวใหม่รอตรวจสอบ {pending} รายการ — <Link to="/admin/reviews">ไปอนุมัติ</Link></Alert>}
      <div className="stat-grid">
        <div className="stat"><b>{counts.working}</b>งานที่กำลังดำเนินการ</div>
        <div className="stat"><b>{counts.pending}</b>งานที่รอดำเนินการ</div>
        <div className="stat"><b>{counts.done}</b>งานเสร็จแล้ว</div>
        <div className="stat"><b>{gallery}</b>จำนวนผลงาน</div>
        <div className="stat"><b>{stats.count}</b>รีวิวที่อนุมัติ</div>
        <div className="stat"><b>{stats.count ? Number(stats.average).toFixed(1) : '-'}</b>คะแนนเฉลี่ย</div>
      </div>
      <p style={{ marginTop: 14, color: 'var(--muted)' }}>ตัวเลขทั้งหมดคำนวณจากข้อมูลจริงในฐานข้อมูล ไม่มีช่องให้กรอกเอง</p>
    </AdminPanel>
  );
}
