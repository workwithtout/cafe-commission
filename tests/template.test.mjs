import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const SKIP = new Set(['node_modules', 'dist', '.git']);
function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const files = walk('.').filter((f) => /\.(jsx?|mjs|css|html|sql|md|json|example)$/.test(f) && !f.endsWith('package-lock.json'));
const text = (f) => readFileSync(f, 'utf8');
let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log('ok -', name); };
const self = 'tests/template.test.mjs';

t('no hard-coded Supabase project URL or key in the repo', () => {
  for (const f of files) {
    if (f === self) continue;
    const s = text(f);
    assert.ok(!/https:\/\/[a-z0-9]{15,}\.supabase\.co/i.test(s), `project URL in ${f}`);
    assert.ok(!/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(s), `JWT in ${f}`);
    assert.ok(!/sb_(publishable|secret)_[A-Za-z0-9_-]{10,}/.test(s), `key in ${f}`);
  }
});

t('service_role is never used by the frontend (src)', () => {
  for (const f of files.filter((x) => x.startsWith('src/'))) {
    const s = text(f);
    assert.ok(!/SERVICE_ROLE/i.test(s.replace(/service_role/g, (m, i) => (s.slice(Math.max(0, i - 40), i + 40).match(/jwtRole|secret|refus/i) ? '' : m))), `service_role in ${f}`);
  }
  assert.ok(!existsSync('.env'), '.env must not be committed');
});

t('no admin UUID / owner data in the repo', () => {
  for (const f of files) {
    if (f === self) continue;
    const s = text(f);
    assert.ok(!/mollyhoney/i.test(s), `owner name in ${f}`);
    assert.ok(!/insert into admins[^;]*'[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s.replace(/--.*$/gm, '')), `admin UUID in ${f}`);
  }
});

t('BGM is fully removed', () => {
  for (const f of files) {
    if (f === self || f.includes('002_remove_bgm') || f === 'supabase/schema.sql') continue;
    assert.ok(!/bgm|background music/i.test(text(f)), `BGM leftover in ${f}`);
  }
  assert.ok(!/<audio|new Audio\(/.test(files.filter((f) => f.startsWith('src/')).map(text).join('\n')), 'audio element in src');
});

t('UI sound effects are still present', () => {
  const s = text('src/lib/sound.js');
  for (const k of ['export function play', 'configureSfx', 'setSfxPreference', 'AudioContext']) assert.ok(s.includes(k), k);
});

t('routing stays HashRouter and no vercel.json rewrite', () => {
  assert.ok(text('src/main.jsx').includes('HashRouter'));
  assert.ok(!existsSync('vercel.json'));
});

t('every migration registers itself and reloads the API schema', () => {
  const dir = 'supabase/migrations';
  const ms = readdirSync(dir).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
  assert.ok(ms.length >= 2);
  ms.forEach((f, i) => assert.ok(f.startsWith(String(i + 1).padStart(3, '0')), `gap before ${f}`));
  for (const f of ms) {
    const s = text(join(dir, f));
    assert.ok(s.includes(`'${f.replace(/\.sql$/, '')}'`) && /app_migrations/.test(s), `${f} not registered`);
    assert.ok(/notify pgrst/i.test(s), `${f} no schema reload`);
  }
});

t('schema.sql is up to date with the migrations', () => {
  execFileSync('node', ['scripts/build-schema.mjs', '--check'], { stdio: 'pipe' });
});

t('RLS is enabled on every table and admin writes use is_admin()', () => {
  const s = text('supabase/schema.sql');
  const tables = [...s.matchAll(/create table if not exists (\w+)/gi)].map((m) => m[1]);
  for (const tb of tables) assert.ok(new RegExp(`alter table ${tb}\\s+enable row level security`, 'i').test(s), `RLS missing on ${tb}`);
  assert.ok(/function is_admin\(\)/i.test(s));
});

t('seed contains only clearly-labelled sample data', () => {
  const s = text('supabase/seed.sql');
  assert.ok(/not exists \(select 1 from services\)/.test(s));
  assert.ok(!/insert into (reviews|queue_items|gallery_items|contact_links|admins)/i.test(s));
});

t('migrations are numbered contiguously from 001', () => {
  const files = readdirSync('supabase/migrations').filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
  files.forEach((f, i) => assert.equal(f.slice(0, 3), String(i + 1).padStart(3, '0'), f));
});

t('UI code is neutral (no hard-coded drawing wording)', () => {
  const bad = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (/\.(jsx?|css)$/.test(e.name) && /งานวาด|นักวาด/.test(readFileSync(p, 'utf8'))) bad.push(p); } };
  walk('src');
  assert.deepEqual(bad, []);
});

console.log(`\n${n} template checks passed`);
