import assert from 'node:assert/strict';
import { makeStorage, pathFromUrl, assertRemoved } from '../src/lib/storageCore.js';
import { checkSourceFile, compressionAttempts, TARGET_BYTES, HARD_LIMIT_BYTES } from '../src/lib/imageTools.js';

let n = 0; const t = async (name, fn) => { await fn(); n += 1; console.log('ok -', name); };
const BUCKET = 'cafe-media';
const URL_OF = (p) => `https://x.supabase.co/storage/v1/object/public/${BUCKET}/${p}`;

/** In-memory stand-in for the parts of supabase-js that storageCore uses: tables + one bucket. */
function fake({ tables = {}, files = [], blockDelete = false, failTable = null, missingColumnTable = null } = {}) {
  const db = { services: [], gallery_items: [], gallery_item_images: [], profiles: [], site_settings: [], themes: [], ...tables };
  const objects = new Set(files);
  const from = (table) => {
    const q = { _or: null };
    const run = () => {
      if (failTable === table) return { data: null, error: { code: '500', message: 'boom' } };
      if (missingColumnTable === table) return { data: null, error: { code: '42703', message: 'column watermark_image_path does not exist' } };
      let rows = db[table] || [];
      if (q._or) {
        const conds = q._or.split(',').map((c) => c.split('.'));
        rows = rows.filter((r) => conds.some(([col, op, ...v]) => {
          const val = v.join('.');
          if (op === 'eq') return r[col] === val;
          if (op === 'ilike') { const needle = val.replace(/^\*|\*$/g, '').toLowerCase(); return String(r[col] || '').toLowerCase().includes(needle); }
          return false;
        }));
      }
      return { data: rows, error: null };
    };
    const api = {
      select: () => api, or: (s) => { q._or = s; return api; }, limit: () => api,
      then: (res, rej) => Promise.resolve(run()).then(res, rej),
    };
    return api;
  };
  const storage = { from: () => ({
    remove: async (paths) => {
      if (blockDelete) return { data: [], error: null };                    // RLS-blocked delete: empty answer, no error
      const gone = paths.filter((p) => objects.delete(p)).map((name) => ({ name }));
      return { data: gone, error: null };
    },
    list: async (dir, { search }) => ({ data: [...objects].filter((p) => p.startsWith(dir ? `${dir}/` : '') && p.endsWith(search)).map((p) => ({ name: p.split('/').pop() })), error: null }),
  }) };
  return { client: { from, storage }, db, objects };
}

await t('pathFromUrl reads the storage path out of a public URL', () => {
  assert.equal(pathFromUrl(URL_OF('gallery/1-ab.webp'), BUCKET), 'gallery/1-ab.webp');
  assert.equal(pathFromUrl(URL_OF('themes/my-theme/1-ab.png') + '?v=2', BUCKET), 'themes/my-theme/1-ab.png');
  assert.equal(pathFromUrl('https://elsewhere.com/a.png', BUCKET), null);
  assert.equal(pathFromUrl(null, BUCKET), null);
});

await t('delete: unused file is really removed from Storage', async () => {
  const f = fake({ files: ['gallery/a.webp'] });
  const r = await makeStorage(f.client, BUCKET).removeFile('gallery/a.webp');
  assert.equal(r.status, 'removed'); assert.ok(!f.objects.has('gallery/a.webp'));
});

await t('delete: a file another record still uses is NOT removed (by path)', async () => {
  const f = fake({ files: ['gallery/a.webp'], tables: { gallery_items: [{ id: 2, image_path: 'gallery/a.webp', image_url: URL_OF('gallery/a.webp') }] } });
  const r = await makeStorage(f.client, BUCKET).removeFile('gallery/a.webp');
  assert.equal(r.status, 'kept'); assert.equal(r.by, 'gallery_items'); assert.ok(f.objects.has('gallery/a.webp'));
});

await t('delete: still-used check also works for old rows that kept only the URL', async () => {
  const f = fake({ files: ['services/s.webp'], tables: { services: [{ id: 1, image_path: null, image_url: URL_OF('services/s.webp') }] } });
  assert.equal((await makeStorage(f.client, BUCKET).removeFile('services/s.webp')).status, 'kept');
});

await t('delete: an extra picture of a gallery item counts as a reference', async () => {
  const f = fake({ files: ['gallery/x.webp'], tables: { gallery_item_images: [{ id: 1, image_path: 'gallery/x.webp', image_url: URL_OF('gallery/x.webp') }] } });
  assert.equal((await makeStorage(f.client, BUCKET).removeFile('gallery/x.webp')).status, 'kept');
  const f2 = fake({ files: ['gallery/x.webp'], missingColumnTable: 'gallery_item_images' });      // release 009 not applied: no such table
  assert.equal((await makeStorage(f2.client, BUCKET).removeFile('gallery/x.webp')).status, 'removed');
});

await t('delete: profile avatar and watermark picture count as references', async () => {
  const a = fake({ files: ['avatar/x.webp'], tables: { profiles: [{ id: 1, avatar_path: 'avatar/x.webp' }] } });
  assert.equal((await makeStorage(a.client, BUCKET).removeFile('avatar/x.webp')).status, 'kept');
  const w = fake({ files: ['watermark/w.png'], tables: { site_settings: [{ id: 1, watermark_image_path: 'watermark/w.png' }] } });
  assert.equal((await makeStorage(w.client, BUCKET).removeFile('watermark/w.png')).status, 'kept');
});

await t('delete: a theme and its copy share files; the file goes only with the LAST one', async () => {
  const cfg = { paths: { bg_image: 'themes/t/bg.webp' }, bg_image_url: URL_OF('themes/t/bg.webp') };
  const f = fake({ files: ['themes/t/bg.webp'], tables: { themes: [{ id: 'orig', config: cfg }, { id: 'copy', config: cfg }] } });
  const s = makeStorage(f.client, BUCKET);
  f.db.themes = f.db.themes.filter((x) => x.id !== 'orig');                  // original deleted (DB first)
  assert.equal((await s.removeFile('themes/t/bg.webp')).status, 'kept'); assert.ok(f.objects.has('themes/t/bg.webp'));
  f.db.themes = [];                                                           // copy deleted too
  assert.equal((await s.removeFile('themes/t/bg.webp')).status, 'removed'); assert.ok(!f.objects.has('themes/t/bg.webp'));
});

await t('replace picture: the old file is removed once the row points at the new one, new file stays', async () => {
  const f = fake({ files: ['gallery/old.webp', 'gallery/new.webp'], tables: { gallery_items: [{ id: 1, image_path: 'gallery/new.webp', image_url: URL_OF('gallery/new.webp') }] } });
  const s = makeStorage(f.client, BUCKET);
  assert.equal((await s.removeFile('gallery/old.webp')).status, 'removed');
  assert.ok(f.objects.has('gallery/new.webp') && !f.objects.has('gallery/old.webp'));
});

await t('delete given only a public URL (row without a path) still removes the file', async () => {
  const f = fake({ files: ['gallery/u.webp'] });
  assert.equal((await makeStorage(f.client, BUCKET).removeFile(URL_OF('gallery/u.webp'))).status, 'removed');
});

await t('a delete that Storage silently refuses is reported as failed, never as success', async () => {
  const f = fake({ files: ['gallery/a.webp'], blockDelete: true });
  const r = await makeStorage(f.client, BUCKET).removeFile('gallery/a.webp');
  assert.equal(r.status, 'failed'); assert.equal(r.ok, false);
  assert.throws(() => assertRemoved(r), /ลบไฟล์รูปออกจาก Storage ไม่สำเร็จ/);
});

await t('file already gone = fine (missing), not an error', async () => {
  const f = fake({ files: [] });
  const r = await makeStorage(f.client, BUCKET).removeFile('gallery/zzz.webp');
  assert.equal(r.status, 'missing'); assert.equal(r.ok, true); assertRemoved(r);
});

await t('if the "is it used?" check fails, nothing is deleted', async () => {
  const f = fake({ files: ['gallery/a.webp'], failTable: 'gallery_items' });
  const r = await makeStorage(f.client, BUCKET).removeFile('gallery/a.webp');
  assert.equal(r.ok, false); assert.ok(f.objects.has('gallery/a.webp'));
});

await t('a table that is not migrated yet (no watermark column) cannot block or break the check', async () => {
  const f = fake({ files: ['gallery/a.webp'], missingColumnTable: 'site_settings' });
  assert.equal((await makeStorage(f.client, BUCKET).removeFile('gallery/a.webp')).status, 'removed');
});

await t('nothing to remove (no path / foreign url) is a no-op', async () => {
  const f = fake({});
  const s = makeStorage(f.client, BUCKET);
  assert.equal((await s.removeFile(null)).status, 'skipped');
  assert.equal((await s.removeFile('https://elsewhere.com/a.png')).status, 'skipped');
});

const file = (size, type = 'image/jpeg') => ({ size, type, name: 'a.jpg' });
await t('size policy: under 5 MB passes, 12 MB passes (it will be compressed), 50 MB passes, over 50 MB is refused', () => {
  assert.equal(checkSourceFile(file(2 * 1024 * 1024)), null);
  assert.equal(checkSourceFile(file(12 * 1024 * 1024)), null);
  assert.equal(checkSourceFile(file(HARD_LIMIT_BYTES)), null);
  assert.match(checkSourceFile(file(HARD_LIMIT_BYTES + 1)), /ไม่เกิน 50 MB/);
  assert.match(checkSourceFile({ size: 10, type: 'application/pdf' }), /ไฟล์รูปภาพ/);
  assert.equal(TARGET_BYTES, 5 * 1024 * 1024);
});

await t('compression: quality first (never below 0.74), then smaller pixels, gently; stops before tiny', () => {
  const a = compressionAttempts({ w: 6000, h: 4000 });
  assert.deepEqual(a.slice(0, 3), [{ quality: 0.9, scale: 1 }, { quality: 0.82, scale: 1 }, { quality: 0.74, scale: 1 }]);
  assert.ok(a.every((x) => x.quality >= 0.74));
  const scales = a.map((x) => x.scale);
  assert.ok(scales.every((s, i) => i === 0 || s <= scales[i - 1]));
  assert.ok(Math.min(...a.map((x) => Math.min(6000 * x.scale, 4000 * x.scale))) >= 640 * 0.85);
  assert.ok(a.length > 3 && a.length < 40);
});

await t('compression: lossless (watermark PNG) never lowers quality, only pixel size', () => {
  const a = compressionAttempts({ lossless: true, w: 4000, h: 4000 });
  assert.ok(a.every((x) => x.quality === 1)); assert.ok(a.length > 1);
});

console.log(`\n${n} storage tests passed`);
