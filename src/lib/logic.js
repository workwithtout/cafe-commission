// Pure business logic. Everything the UI shows about progress/status/ratings is derived here —
// admins never type a percentage or an average.

export const STATUS = {
  pending:     { label: 'รอดำเนินการ', tone: 'butter' },
  confirmed:   { label: 'ยืนยันงาน', tone: 'lilac' },
  in_progress: { label: 'กำลังดำเนินการ', tone: 'sky' },
  review:      { label: 'รอตรวจสอบ', tone: 'peach' },
  completed:   { label: 'เสร็จสิ้น', tone: 'mint' },
  paused:      { label: 'พักงาน', tone: 'grey' },
  cancelled:   { label: 'ยกเลิก', tone: 'rose' },
};

// Filter list shown on the public queue page: the 5 standard statuses (+ cancelled).
export const STATUS_FILTERS = ['pending', 'confirmed', 'in_progress', 'review', 'completed', 'cancelled'];

// The 4 categories a workflow step can belong to. The 5th status ("completed") is automatic:
// it happens only when every step is done, so it is not selectable for a step.
// Step NAMES are free text; the category only says what the job's status means while that step is current.
export const STEP_CATEGORIES = {
  pending:     'รอดำเนินการ (เช่น รับบรีฟ รอข้อมูล รอคิว)',
  confirmed:   'ยืนยันงาน (เช่น ชำระเงินแล้ว พร้อมเริ่มงาน)',
  in_progress: 'กำลังดำเนินการ (ลงมือทำงานจริง)',
  review:      'รอตรวจสอบ (เช่น รอลูกค้าตรวจ รอแก้ไข รออนุมัติ)',
};
/** Short names for the 4 step categories (used in lists). */
export const STATUS_CATEGORY_LABEL = { pending: 'รอดำเนินการ', confirmed: 'ยืนยันงาน', in_progress: 'กำลังดำเนินการ', review: 'รอตรวจสอบ' };
const isCategory = (c) => Object.prototype.hasOwnProperty.call(STEP_CATEGORIES, c);

/** Category of a step. Rows saved before categories existed fall back to their old "kind". */
export function stepCategory(step) {
  if (!step) return 'pending';
  if (isCategory(step.category)) return step.category;
  if (step.kind === 'working') return 'in_progress';
  if (step.kind === 'waiting_info') return 'pending';
  if (step.kind === 'waiting_revision') return 'review';
  return 'in_progress';
}

/** Old "kind" column is still written (it has a check constraint) so older data and tools keep working. */
export const kindForCategory = (c) => (c === 'in_progress' ? 'working' : c === 'review' ? 'waiting_revision' : c === 'pending' ? 'waiting_info' : 'normal');

// Statuses an admin may force by hand. "completed" is deliberately NOT here,
// so "เสร็จสิ้น + progress 30%" can never exist.
export const OVERRIDES = ['cancelled', 'paused', 'pending', 'confirmed', 'in_progress', 'review'];

export const sortSteps = (steps = []) => [...steps].sort((a, b) => a.sort_order - b.sort_order);

export function computeProgress(steps = []) {
  const total = steps.length;
  const done = steps.filter((s) => s.is_done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, percent };
}

/**
 * Status is derived from the workflow. Priority:
 *   1. cancelled / paused override  (always wins)
 *   2. 100% of steps done           -> completed (a forced status is ignored: nothing is left to do)
 *   3. a forced category override   (pending / confirmed / in_progress / review)
 *   4. the category of the first unfinished step
 *   5. no steps at all              -> pending
 * Finished steps never change the status by themselves, so "brief received" or "paid"
 * is NOT counted as "in progress".
 */
export function computeStatus(item, steps = []) {
  const ordered = sortSteps(steps);
  const { total, percent } = computeProgress(ordered);
  const ov = item?.status_override || null;
  const next = ordered.find((s) => !s.is_done) || null;

  let key;
  if (ov === 'cancelled' || ov === 'paused') key = ov;
  else if (total > 0 && percent === 100) key = 'completed';
  else if (isCategory(ov)) key = ov;
  else if (next) key = stepCategory(next);
  else key = 'pending';

  return {
    key,
    ...STATUS[key],
    overridden: Boolean(ov) && (ov === 'cancelled' || ov === 'paused' || percent < 100),
    currentStep: next,
  };
}

/**
 * Profile status shown to visitors.
 * If the owner says "open" but every visible service is closed -> show closed.
 * If only some are open while owner says "open" -> show partial.
 * The owner's "ask first" and explicit "closed" are always respected.
 */
export function effectiveProfileStatus(profile, services = []) {
  const manual = profile?.status || 'open';
  if (manual === 'closed' || manual === 'ask') return manual;
  const visible = services.filter((s) => s.is_visible !== false);
  if (visible.length === 0) return manual;
  const open = visible.filter((s) => s.is_open).length;
  if (open === 0) return 'closed';
  if (open < visible.length && manual === 'open') return 'partial';
  return manual;
}

export const PROFILE_STATUS = {
  open:    { label: 'เปิดรับงาน', tone: 'mint' },
  closed:  { label: 'ปิดรับงาน', tone: 'rose' },
  partial: { label: 'เปิดรับบางประเภท', tone: 'butter' },
  ask:     { label: 'กรุณาสอบถามก่อน', tone: 'lilac' },
};

export function fillTemplate(tpl, serviceName) {
  return String(tpl || '').replaceAll('{service}', serviceName || '');
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export function formatThaiDate(d) {
  if (!d) return '';
  const dt = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getDate()} ${TH_MONTHS[dt.getMonth()]}`;
}

export function formatPrice(n) {
  return `฿${Number(n || 0).toLocaleString('th-TH')}`;
}

export function formatDuration(min, max) {
  if (min == null && max == null) return '';
  return min === max ? `${min} วัน` : `${min}–${max} วัน`;
}

/** Queue "contact link": one free URL (any site, or mailto:). Same check as the database. */
export function isContactUrl(u) {
  const v = String(u || '').trim();
  return v.length > 0 && v.length <= 300 && isValidUrl(v);
}

export function isFacebookUrl(u) {
  try {
    const x = new URL(String(u || '').trim());
    return x.protocol === 'https:' && /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i.test(x.hostname);
  } catch { return false; }
}

export function isValidUrl(u) {
  return /^(https?:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/i.test(String(u || '').trim());
}


/**
 * Gallery order: pinned items first (pin slot 1, 2, 3), then newest first. Used by the public site AND the admin list,
 * so what the owner sees in the admin is the order visitors get.
 */
export function sortGallery(items) {
  const slot = (g) => (g.pinned_order == null ? 99 : g.pinned_order);
  return [...items].sort((a, b) => slot(a) - slot(b)
    || String(b.art_date || '').localeCompare(String(a.art_date || ''))
    || String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

/** Pictures of one item for the viewer: the cover first, then the extra pictures in their order. */
export function galleryPictures(item) {
  const extra = [...(item.images || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  return [{ key: 'cover', url: item.image_url }, ...extra.map((x) => ({ key: x.id || x.image_url, url: x.image_url }))].filter((p) => p.url);
}

