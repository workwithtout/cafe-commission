import { useState } from 'react';
import { supabase, unwrap } from '../../lib/supabase.js';
import { useAsync, useSubmit } from '../../lib/hooks.js';
import { Alert, Button, ConfirmDialog, Empty, ErrorState, IconButton, Loading, Stars } from '../../components/ui.jsx';
import { AdminPanel, deleteRows } from './common.jsx';
import { ReviewSummary } from '../Reviews.jsx';

const LABEL = { pending: 'รอตรวจสอบ', approved: 'อนุมัติ', hidden: 'ซ่อน' };
const TONE = { pending: 'butter', approved: 'mint', hidden: 'grey' };

export default function ReviewsAdmin() {
  const q = useAsync(async () => {
    const [list, stats] = await Promise.all([
      supabase.from('reviews').select('*').order('created_at', { ascending: false }).then(unwrap),
      supabase.rpc('get_review_stats').then(unwrap),
    ]);
    return { list, stats };
  }, []);
  const [tab, setTab] = useState('pending');
  const [del, setDel] = useState(null);
  const [setStatus, busy, err] = useSubmit(async (id, status) => {
    unwrap(await supabase.from('reviews').update({ status }).eq('id', id));
    await q.reload();     // stats are recomputed by the database from approved rows only
  });
  const [doDelete, delBusy, delErr] = useSubmit(async () => {
    await deleteRows('reviews', del.id);
    setDel(null);
    await q.reload();
  });

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  const { list, stats } = q.data;
  const shown = list.filter((r) => tab === 'all' || r.status === tab);
  const n = (s) => list.filter((r) => r.status === s).length;

  return (
    <>
      <AdminPanel label="Stats" title="คะแนนรีวิว (คำนวณอัตโนมัติ)">
        <ReviewSummary stats={stats} />
        <small>คำนวณจากรีวิวที่ “อนุมัติ” เท่านั้น — รีวิวที่ซ่อนหรือรอตรวจสอบไม่ถูกนำมาคิด</small>
      </AdminPanel>
      <AdminPanel label="Moderation" title="จัดการรีวิว">
        <div className="filters" role="group" aria-label="กรองสถานะรีวิว">
          {[['pending', `รอตรวจสอบ (${n('pending')})`], ['approved', `อนุมัติ (${n('approved')})`], ['hidden', `ซ่อน (${n('hidden')})`], ['all', 'ทั้งหมด']].map(([k, l]) => (
            <button key={k} type="button" className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {err && <Alert kind="error">{err}</Alert>}
        {shown.length === 0 ? <Empty title="ไม่มีรีวิวในหมวดนี้" /> : (
          <div className="list">
            {shown.map((r) => (
              <div key={r.id} className="list-item">
                <div className="list-item__main" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <div className="row"><span className="list-item__title">{r.reviewer_name}</span><Stars value={r.rating} size={16} /><span className={`badge badge--${TONE[r.status]}`}>{LABEL[r.status]}</span></div>
                  <div style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{r.body}</div>
                  <small>{new Date(r.created_at).toLocaleString('th-TH')}</small>
                </div>
                <div className="actions">
                  {r.status !== 'approved' && <Button small variant="primary" icon="check" disabled={busy} onClick={() => setStatus(r.id, 'approved')}>อนุมัติ</Button>}
                  {r.status !== 'hidden' && <Button small icon="eyeOff" disabled={busy} onClick={() => setStatus(r.id, 'hidden')}>ซ่อน</Button>}
                  <IconButton icon="trash" label={`ลบรีวิวของ ${r.reviewer_name}`} onClick={() => setDel(r)} />
                </div>
              </div>
            ))}
          </div>
        )}
        {del && <ConfirmDialog title="ลบรีวิวนี้?" message={`รีวิวของ ${del.reviewer_name} จะถูกลบถาวร คะแนนเฉลี่ยจะคำนวณใหม่ให้อัตโนมัติ (ถ้าแค่ไม่อยากแสดง ใช้ “ซ่อน” แทนได้)`} busy={delBusy} error={delErr} onCancel={() => setDel(null)} onConfirm={doDelete} />}
      </AdminPanel>
    </>
  );
}
