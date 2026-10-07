import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sortGallery, galleryPictures, isContactUrl } from '../src/lib/logic.js';
import { PALETTES, MOTIF_KEYS, THEME_DEFAULTS } from '../src/themes/palettes.js';

let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('ok -', name); };
const g = (id, date, pin, extra = {}) => ({ id, art_date: date, created_at: `${date}T00:00:00Z`, pinned_order: pin ?? null, ...extra });

t('gallery order: pinned first in slot order, then newest first', () => {
  const out = sortGallery([g('old', '2026-01-01'), g('p2', '2026-01-02', 2), g('new', '2026-09-01'), g('p1', '2026-01-03', 1)]);
  assert.deepEqual(out.map((x) => x.id), ['p1', 'p2', 'new', 'old']);
});
t('gallery order: a gap in the pin slots keeps the order (1 and 3)', () => {
  assert.deepEqual(sortGallery([g('b', '2026-01-01', 3), g('a', '2026-01-01', 1), g('c', '2026-05-01')]).map((x) => x.id), ['a', 'b', 'c']);
});
t('gallery order does not modify the input', () => { const a = [g('x', '2026-01-01'), g('y', '2026-02-01')]; sortGallery(a); assert.equal(a[0].id, 'x'); });
t('pictures of an item: cover first, extras in their order; single picture = just the cover', () => {
  const it = { image_url: 'cover', images: [{ id: 'b', image_url: 'two', sort_order: 2 }, { id: 'a', image_url: 'one', sort_order: 1 }] };
  assert.deepEqual(galleryPictures(it).map((p) => p.url), ['cover', 'one', 'two']);
  assert.deepEqual(galleryPictures({ image_url: 'only' }).map((p) => p.url), ['only']);
});
t('contact link: any http(s) / mailto link, nothing else', () => {
  for (const ok of ['https://facebook.com/x', 'https://line.me/ti/p/abc', 'https://instagram.com/x', 'https://discord.com/users/1', 'https://x.com/a', 'http://my-site.example', 'mailto:me@example.com']) assert.ok(isContactUrl(ok), ok);
  for (const bad of ['', 'javascript:alert(1)', 'data:text/html,hi', 'ftp://x.com', 'not a url', 'https://', `https://a.com/${'x'.repeat(300)}`]) assert.ok(!isContactUrl(bad), bad);
});

const lum = (h) => { const c = h.replace('#', ''); const [r, gg, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * gg + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
t('built-in themes: blue / yellow / oreo are registered everywhere a theme must be', () => {
  const sql = readFileSync('supabase/migrations/009_gallery_album_pin_contact_url.sql', 'utf8');
  for (const k of ['blue', 'yellow', 'oreo']) {
    assert.ok(MOTIF_KEYS.includes(k) && PALETTES[k] && THEME_DEFAULTS[k], k);
    assert.ok(new RegExp(`\\('${k}',\\s+'[^']+',\\s+true`).test(sql), `${k} row in migration 009`);
    assert.deepEqual(Object.keys(PALETTES[k]).sort(), Object.keys(PALETTES.strawberry).sort(), `${k} defines every variable`);
  }
});
t('new themes: readable text (WCAG AA 4.5:1) on every surface the text sits on', () => {
  const pairs = [['text', 'paper'], ['text', 'paper2'], ['text', 'c-main-soft'], ['text', 'c-cream'], ['ink', 'paper'], ['muted', 'paper'], ['muted', 'paper2'], ['muted', 'c-cream'], ['link', 'paper'], ['link', 'paper2'], ['on-main', 'c-main'], ['ink', 'status-butter'], ['ink', 'status-sky'], ['ink', 'status-mint'], ['ink', 'status-rose'], ['ink', 'status-grey']];
  for (const k of ['blue', 'yellow', 'oreo']) for (const [a, b] of pairs) {
    const r = ratio(PALETTES[k][`--${a}`], PALETTES[k][`--${b}`]);
    assert.ok(r >= 4.5, `${k}: ${a} on ${b} = ${r.toFixed(2)}`);
  }
});
console.log(`\n${n} gallery/theme tests passed`);
