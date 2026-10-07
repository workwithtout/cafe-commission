import { supabase, unwrap } from './supabase.js';
import { computeStatus, sortSteps } from './logic.js';

export { sortGallery, galleryPictures } from './logic.js';
import { sortGallery } from './logic.js';

/** Public gallery: only visible items (RLS enforces it too), with their extra pictures. */
export async function fetchGallery() {
  let res = await supabase.from('gallery_items').select('*, images:gallery_item_images(id, image_url, sort_order)').eq('is_visible', true);
  if (res.error) res = await supabase.from('gallery_items').select('*').eq('is_visible', true);   // release 009 not applied yet
  return sortGallery(unwrap(res));
}

/** Public queue (RLS returns only is_public rows). Active jobs first, then done, then cancelled. */
export async function fetchQueue() {
  // The queue contact link (stored in the older column facebook_url) lives in its own table; row-level security hides private ones from visitors.
  // If that table does not exist yet (migration 005 not run) the queue still loads without links.
  let res = await supabase.from('queue_items').select('*, steps:queue_steps(*), contact:queue_item_contacts(facebook_url, facebook_public)').order('sort_order');
  if (res.error) res = await supabase.from('queue_items').select('*, steps:queue_steps(*)').order('sort_order');
  const rows = unwrap(res);
  const rank = (r) => {
    const k = computeStatus(r, r.steps).key;
    return k === 'cancelled' ? 2 : k === 'completed' ? 1 : 0;
  };
  return rows
    .map((r) => {
      const c = Array.isArray(r.contact) ? r.contact[0] : r.contact;
      return { ...r, steps: sortSteps(r.steps), facebook_url: c?.facebook_public ? c.facebook_url : null };
    })
    .sort((a, b) => rank(a) - rank(b) || a.sort_order - b.sort_order);
}

export const fetchReviewStats = async () => unwrap(await supabase.rpc('get_review_stats'));

export const fetchApprovedReviews = async (limit = 50) =>
  unwrap(await supabase.from('reviews').select('id, reviewer_name, rating, body, created_at').eq('status', 'approved').order('created_at', { ascending: false }).limit(limit));

/**
 * Where should a queue card's "ดูตัวอย่างผลงาน" go? The link is to a gallery CATEGORY (a Service), never to one picture.
 *   1. the category chosen for this queue item (gallery_service_id)
 *   2. otherwise the queue item's own service
 *   3. old links that pointed at one picture use that picture's category
 * null => the button is disabled (never a fake link).
 */
export function queuePreviewTarget(item, gallery = []) {
  const has = (serviceId) => serviceId && gallery.some((g) => g.service_id === serviceId);
  if (has(item.gallery_service_id)) return `/gallery?service=${item.gallery_service_id}`;
  if (has(item.service_id)) return `/gallery?service=${item.service_id}`;
  const legacy = item.gallery_item_id && gallery.find((g) => g.id === item.gallery_item_id);
  if (legacy) return legacy.service_id ? `/gallery?service=${legacy.service_id}` : '/gallery?service=other';
  return null;
}
