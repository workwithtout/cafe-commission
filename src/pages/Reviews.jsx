import { useState } from 'react';
import { useAsync, useSubmit } from '../lib/hooks.js';
import { fetchApprovedReviews, fetchReviewStats } from '../lib/data.js';
import { supabase } from '../lib/supabase.js';
import { Alert, Button, Empty, ErrorState, Field, Loading, StarInput, Stars } from '../components/ui.jsx';
import { SectionTitle } from '../components/Decor.jsx';
import { useSite } from '../lib/site.jsx';
import { play } from '../lib/sound.js';

export function ReviewSummary({ stats }) {
  const total = stats?.count || 0;
  if (total === 0) return <p style={{ margin: 0 }}>ยังไม่มีรีวิวที่อนุมัติ เป็นคนแรกที่รีวิวร้านนี้ได้นะ</p>;
  const dist = stats.dist || {};
  return (
    <div className="review-summary">
      <div className="review-summary__big">
        <div className="review-summary__score">{Number(stats.average).toFixed(1)} <small style={{ fontSize: '1.1rem' }}>/ 5</small></div>
        <Stars value={Number(stats.average)} size={26} />
        <div>จาก {total} รีวิว</div>
      </div>
      <div className="dist" aria-label="การกระจายคะแนน">
        {[5, 4, 3, 2, 1].map((n) => (
          <div className="dist__row" key={n}>
            <span>{n} ดาว</span>
            <div className="dist__bar"><i style={{ width: `${total ? ((dist[n] || 0) / total) * 100 : 0}%` }} /></div>
            <span>{dist[n] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewForm({ onDone }) {
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [errs, setErrs] = useState({});

  const [submit, busy, error] = useSubmit(async () => {
    const e = {};
    if (!name.trim()) e.name = 'ใส่ชื่อก่อนนะ';
    else if (name.trim().length > 60) e.name = 'ชื่อยาวเกินไป (ไม่เกิน 60 ตัวอักษร)';
    if (rating < 1 || rating > 5) e.rating = 'เลือกคะแนน 1–5 ดาว';
    if (!body.trim()) e.body = 'เขียนข้อความรีวิวสั้น ๆ หน่อยนะ';
    else if (body.trim().length > 800) e.body = 'ข้อความยาวเกินไป (ไม่เกิน 800 ตัวอักษร)';
    setErrs(e);
    if (Object.keys(e).length) { play('error'); return; }

    const { error: err } = await supabase.from('reviews').insert({
      reviewer_name: name.trim(), rating, body: body.trim(),
    });
    if (err) throw new Error('ส่งรีวิวไม่สำเร็จ ลองใหม่อีกครั้งนะ');
    setName(''); setRating(0); setBody(''); setErrs({});
    play('success');
    onDone();
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
      <Field label="ชื่อของคุณ" htmlFor="rv-name" error={errs.name}>
        <input id="rv-name" type="text" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errs.name)} />
      </Field>
      <Field label="ให้คะแนน" error={errs.rating}>
        <StarInput value={rating} onChange={setRating} />
      </Field>
      <Field label="ข้อความรีวิว" htmlFor="rv-body" error={errs.body} hint="รีวิวจะแสดงหลังเจ้าของร้านตรวจสอบแล้ว">
        <textarea id="rv-body" value={body} maxLength={800} onChange={(e) => setBody(e.target.value)} aria-invalid={Boolean(errs.body)} />
      </Field>
      {error && <Alert kind="error">{error}</Alert>}
      <Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังส่ง…' : 'ส่งรีวิว'}</Button>
    </form>
  );
}

export default function Reviews() {
  const { theme } = useSite();
  const q = useAsync(async () => {
    const [stats, list] = await Promise.all([fetchReviewStats(), fetchApprovedReviews()]);
    return { stats, list };
  }, []);
  const [sent, setSent] = useState(false);

  return (
    <>
      <section className="panel" aria-labelledby="rv-h">
        <span className="panel__label">Reviews</span>
        <div style={{ marginTop: 10 }}>
          <SectionTitle motif={theme.motif}><span id="rv-h">รีวิวจากลูกค้า</span></SectionTitle>
        </div>
        {q.loading && !q.data ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
          <>
            <ReviewSummary stats={q.data.stats} />
            <div className="stitch" />
            {q.data.list.length === 0 ? <Empty title="ยังไม่มีรีวิว" /> : (
              <div className="list">
                {q.data.list.map((r) => (
                  <article className="review-card" key={r.id}>
                    <div className="row"><span className="review-card__name">{r.reviewer_name}</span><Stars value={r.rating} size={18} /></div>
                    <p>{r.body}</p>
                    <small>{new Date(r.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</small>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel panel--tinted" aria-labelledby="rv-form-h">
        <span className="panel__label">Write</span>
        <h3 id="rv-form-h" style={{ marginTop: 10 }}>เขียนรีวิวให้ร้านนี้</h3>
        {sent && <Alert kind="ok">ขอบคุณสำหรับรีวิวนะ! รีวิวจะขึ้นหลังเจ้าของร้านตรวจสอบแล้ว</Alert>}
        <ReviewForm onDone={() => setSent(true)} />
      </section>
    </>
  );
}
