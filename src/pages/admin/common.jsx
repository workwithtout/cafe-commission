import { supabase, unwrap } from '../../lib/supabase.js';
import { uploadFile, removeFile, assertRemoved } from '../../lib/storage.js';
import { Button, Alert, IconButton } from '../../components/ui.jsx';
import { STEP_CATEGORIES, kindForCategory, stepCategory } from '../../lib/logic.js';

/** Shared wrapper: cute panel with a label tab. */
export function AdminPanel({ label, title, actions, children }) {
  return (
    <section className="panel">
      {label ? <span className="panel__label">{label}</span> : null}
      <div className="row" style={{ justifyContent: 'space-between', marginTop: label ? 10 : 0, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div className="row">{actions}</div>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ images */
// The picture field (drag & drop / tap to choose, editor, preview) lives in components/ImagePicker.jsx.
// It keeps the finished picture in value.file; nothing is uploaded until the form is saved (see commitImage).
export { ImagePicker, SHAPES } from '../../components/ImagePicker.jsx';

/**
 * Turns an ImagePicker value into the final { url, path } to store.
 * Uploads first (throws on failure => caller aborts before touching the DB).
 * Returns { url, path, oldPath } where oldPath should be deleted AFTER the DB write succeeds.
 */
export async function commitImage(value, folder, oldPath) {
  if (value?.file) {
    const up = await uploadFile(value.file, folder);
    return { url: up.url, path: up.path, oldPath: oldPath || null };
  }
  if (value?.removed) return { url: null, path: null, oldPath: oldPath || null };
  return { url: value?.url || null, path: oldPath || null, oldPath: null };
}

export { removeFile, assertRemoved };

/**
 * Really deletes rows and PROVES it: Postgres answers "0 rows" (no error) when a row is missing or when the
 * security rules refuse the delete, which would look like success. We ask for the deleted ids back and throw
 * if any are missing, so the admin never sees "deleted" for something that is still in the database.
 * Never used for soft-delete flows (hide / status change), which are separate actions on purpose.
 */
export async function deleteRows(table, ids, column = 'id') {
  const want = [].concat(ids);
  if (!want.length) return [];
  const rows = unwrap(await supabase.from(table).delete().in(column, want).select(column)) || [];
  if (rows.length < want.length) throw new Error('ลบไม่สำเร็จ: ฐานข้อมูลไม่ได้ลบรายการนี้ (ไม่พบรายการ หรือไม่มีสิทธิ์) ลองโหลดหน้าใหม่แล้วทำอีกครั้ง');
  return rows;
}

/* ------------------------------------------------------------------ ordering */
export async function reorderRows(table, ids) {
  const results = await Promise.all(ids.map((id, i) => supabase.from(table).update({ sort_order: i + 1 }).eq('id', id)));
  const failed = results.find((r) => r.error);
  if (failed) throw new Error(failed.error.message);
}

export function move(list, index, dir) {
  const j = index + dir;
  if (j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[j]] = [copy[j], copy[index]];
  return copy;
}

export function OrderButtons({ index, length, onMove, busy }) {
  return (
    <span className="actions">
      <IconButton icon="up" label="เลื่อนขึ้น" onClick={() => onMove(-1)} disabled={busy || index === 0} />
      <IconButton icon="down" label="เลื่อนลง" onClick={() => onMove(1)} disabled={busy || index === length - 1} />
    </span>
  );
}

/* ------------------------------------------------------------------ steps editor (workflow) */
let tmp = 0;
export const newTempId = () => `new-${++tmp}`;

/**
 * Edits a list of workflow steps. Used for a Service's default workflow
 * and for a single queue item's own (snapshotted) steps.
 * Every step has a free NAME and one of 4 status categories; the 5th status (completed)
 * happens by itself when all steps are done.
 */
export function StepsEditor({ steps, onChange, showDone }) {
  const update = (i, patch) => onChange(steps.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  return (
    <div>
      {steps.length === 0 && <Alert>ยังไม่มีขั้นตอน — เพิ่มอย่างน้อย 1 ขั้นเพื่อให้ระบบคำนวณความคืบหน้าได้</Alert>}
      {steps.map((s, i) => (
        <div key={s.id} className={`step-edit ${showDone ? 'step-edit--queue' : ''}`}>
          {showDone && (
            <input type="checkbox" checked={Boolean(s.is_done)} onChange={(e) => update(i, { is_done: e.target.checked })} aria-label={`ทำ “${s.label}” เสร็จแล้ว`} />
          )}
          <input className="step-edit__name" type="text" value={s.label} maxLength={60} aria-label={`ชื่อขั้นตอนที่ ${i + 1}`} onChange={(e) => update(i, { label: e.target.value })} />
          <select className="step-edit__cat" value={stepCategory(s)} aria-label={`หมวดสถานะของขั้นตอนที่ ${i + 1}`} onChange={(e) => update(i, { category: e.target.value })}>
            {Object.entries(STEP_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <span className="actions step-edit__tools">
            <IconButton icon="up" label="เลื่อนขึ้น" disabled={i === 0} onClick={() => onChange(move(steps, i, -1))} sfx="tap" />
            <IconButton icon="down" label="เลื่อนลง" disabled={i === steps.length - 1} onClick={() => onChange(move(steps, i, 1))} sfx="tap" />
            <IconButton icon="trash" label="ลบขั้นตอน" onClick={() => onChange(steps.filter((_, k) => k !== i))} />
          </span>
        </div>
      ))}
      <div className="row">
        <Button small icon="plus" onClick={() => onChange([...steps, { id: newTempId(), label: 'ขั้นตอนใหม่', category: 'in_progress', is_done: false }])}>เพิ่มขั้นตอน</Button>
      </div>
      <small>ตั้งชื่อขั้นตอนได้เองตามงานของคุณ แล้วเลือกหมวดสถานะให้ตรงกับความหมาย เช่น “ร่างแรก” อยู่ในหมวดกำลังดำเนินการ ส่วน “ลูกค้าตรวจงาน” อยู่ในหมวดรอตรวจสอบ เมื่อติ๊กครบทุกขั้นระบบจะขึ้นสถานะ “เสร็จสิ้น” ให้เอง</small>
    </div>
  );
}

export function validateSteps(steps) {
  if (steps.some((s) => !s.label.trim())) return 'ชื่อขั้นตอนห้ามว่าง';
  return null;
}

/**
 * Saves an edited step list: updates changed rows, inserts new ones, deletes removed ones,
 * and rewrites sort_order. `table` = service_steps | queue_steps, `fk` = FK column name.
 */
export async function syncSteps(table, fk, parentId, original, edited) {
  const keepIds = new Set(edited.filter((s) => !String(s.id).startsWith('new-')).map((s) => s.id));
  const removed = original.filter((s) => !keepIds.has(s.id)).map((s) => s.id);
  if (removed.length) await deleteRows(table, removed);

  for (let i = 0; i < edited.length; i += 1) {
    const s = edited[i];
    const category = stepCategory(s);
    const base = { label: s.label.trim(), category, kind: kindForCategory(category), sort_order: i + 1 };
    if (table === 'queue_steps') {
      base.is_done = Boolean(s.is_done);
      base.done_at = s.is_done ? (s.done_at || new Date().toISOString()) : null;
    }
    if (String(s.id).startsWith('new-')) unwrap(await supabase.from(table).insert({ ...base, [fk]: parentId }));
    else unwrap(await supabase.from(table).update(base).eq('id', s.id));
  }
}
