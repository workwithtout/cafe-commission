// Storage logic that does not need a live Supabase connection (so it can be tested with a fake client).
// storage.js binds it to the real client.

/** Storage path from a public URL of this bucket (for old rows that kept only the URL). */
export function pathFromUrl(url, bucket) {
  if (!url || typeof url !== 'string') return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const rest = url.slice(i + marker.length).split(/[?#]/)[0];
  try { return decodeURIComponent(rest) || null; } catch { return rest || null; }
}

/** [table, path column, url column] for every table that points at a stored picture. */
export const FILE_REFERENCES = [
  ['services', 'image_path', 'image_url'],
  ['gallery_items', 'image_path', 'image_url'],
  ['profiles', 'avatar_path', 'avatar_url'],
  ['site_settings', 'watermark_image_path', 'watermark_image_url'],
  ['gallery_item_images', 'image_path', 'image_url'],
];

const MISSING_COLUMN = new Set(['42703', 'PGRST204', 'PGRST200', '42P01', 'PGRST205']);   // table not migrated yet: nothing can point there

/**
 * Storage helpers bound to one Supabase client (the real one below; a fake one in the tests).
 */
export function makeStorage(client, bucket) {
  /** Is some record still using this file? Unknown (query failed) counts as "yes": a file is never deleted on a guess. */
  async function isReferenced(path) {
    for (const [table, pathCol, urlCol] of FILE_REFERENCES) {
      const { data, error } = await client.from(table).select('id').or(`${pathCol}.eq.${path},${urlCol}.ilike.*${path}*`).limit(1);
      if (error) {
        if (MISSING_COLUMN.has(error.code) || /column .* does not exist/i.test(error.message || '')) continue;
        return { used: true, by: table, unknown: true, error: error.message };
      }
      if (data && data.length) return { used: true, by: table };
    }
    const themes = await client.from('themes').select('id, config');
    if (themes.error) return { used: true, by: 'themes', unknown: true, error: themes.error.message };
    for (const t of themes.data || []) {
      if (JSON.stringify(t.config || {}).includes(path)) return { used: true, by: 'themes' };
    }
    return { used: false };
  }

  async function exists(path) {
    const slash = path.lastIndexOf('/');
    const dir = slash === -1 ? '' : path.slice(0, slash);
    const name = path.slice(slash + 1);
    const { data, error } = await client.storage.from(bucket).list(dir, { search: name, limit: 100 });
    if (error) return null;
    return (data || []).some((o) => o.name === name);
  }

  /**
   * Deletes the real file from Storage, but only when no record uses it any more, and checks that it is really gone.
   * Call it AFTER the database row has been deleted / updated. Never throws.
   * status: 'removed' | 'kept' (still used) | 'missing' (already gone) | 'failed' | 'skipped'
   */
  async function removeFile(pathOrUrl) {
    const path = pathFromUrl(pathOrUrl, bucket) || (pathOrUrl && !/^https?:/i.test(pathOrUrl) ? pathOrUrl : null);
    if (!path) return { ok: true, status: 'skipped' };
    try {
      const ref = await isReferenced(path);
      if (ref.used) return ref.unknown ? { ok: false, status: 'failed', path, error: ref.error } : { ok: true, status: 'kept', path, by: ref.by };
      const { data, error } = await client.storage.from(bucket).remove([path]);
      if (error) return { ok: false, status: 'failed', path, error: error.message };
      if (data && data.length) return { ok: true, status: 'removed', path };
      const still = await exists(path);                  // empty answer = already gone OR blocked by a policy
      if (still === false) return { ok: true, status: 'missing', path };
      return { ok: false, status: 'failed', path, error: 'Storage ไม่ยอมลบไฟล์ (ตรวจสิทธิ์ของ bucket)' };
    } catch (e) {
      return { ok: false, status: 'failed', path, error: e?.message || String(e) };
    }
  }

  return { isReferenced, removeFile, exists };
}

/** Throws a Thai message when a removeFile() result says the real file could not be deleted. */
export function assertRemoved(results, what = 'รูป') {
  const bad = [].concat(results).filter((r) => r && !r.ok);
  if (bad.length) throw new Error(`ลบข้อมูลแล้ว แต่ลบไฟล์${what}ออกจาก Storage ไม่สำเร็จ (${bad[0].error || 'ไม่ทราบสาเหตุ'}) ไฟล์อาจยังค้างอยู่ใน bucket`);
}

