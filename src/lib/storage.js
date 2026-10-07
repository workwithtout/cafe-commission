import { supabase, BUCKET } from './supabase.js';
import { makeStorage, pathFromUrl, assertRemoved, FILE_REFERENCES } from './storageCore.js';
import { HARD_LIMIT_BYTES, TARGET_BYTES, checkSourceFile, fmtBytes, shrinkToTarget } from './imageTools.js';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

function extOf(file) {
  const fromName = file.name?.split('.').pop()?.toLowerCase();
  return (fromName && fromName.length <= 5 ? fromName : 'bin').replace(/[^a-z0-9]/g, '');
}

/**
 * Where pictures are stored (checked against the code, not guessed):
 *   bucket  cafe-media (public read, admin write)
 *   path    <folder>/<timestamp>-<id>.<ext>
 *   folders services/  gallery/  avatar/  watermark/  themes/<slug>/
 * A row keeps the path in *_path (services.image_path, gallery_items.image_path, profiles.avatar_path,
 * site_settings.watermark_image_path, themes.config.paths.*) and the public URL next to it.
 * Reviews and queue items have no pictures.
 */

const real = makeStorage(supabase, BUCKET);
export const isFileReferenced = real.isReferenced;
export const removeFile = real.removeFile;

/**
 * Upload to Supabase Storage. Returns { url, path }. Throws on any failure,
 * so callers never create a DB row that points at a missing file.
 * Pictures from the editor are already under 5 MB; a bigger raw file is shrunk here before it is sent.
 */
export async function uploadFile(file, folder = 'misc', { lossless = false } = {}) {
  if (!file) throw new Error('ยังไม่ได้เลือกไฟล์');
  const bad = checkSourceFile(file);
  if (bad) throw new Error(bad);
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('รองรับไฟล์ภาพ png / jpg / webp / gif / svg เท่านั้น');
  const body = file.size > TARGET_BYTES ? await shrinkToTarget(file, { lossless }) : file;
  if (body.size > TARGET_BYTES) throw new Error(`ไฟล์ยังใหญ่เกิน ${fmtBytes(TARGET_BYTES)} หลังบีบอัด`);

  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extOf(body)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    cacheControl: '31536000',
    contentType: body.type,
    upsert: false,
  });
  if (error) throw new Error(`อัปโหลดไม่สำเร็จ: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export { HARD_LIMIT_BYTES, TARGET_BYTES, assertRemoved, pathFromUrl, FILE_REFERENCES };
