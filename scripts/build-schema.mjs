// Maintainer tool (end users never run this).
// supabase/schema.sql is GENERATED from supabase/migrations/*.sql so there is a single source of truth.
//   node scripts/build-schema.mjs          -> rewrite supabase/schema.sql
//   node scripts/build-schema.mjs --check  -> exit 1 if schema.sql is out of date (used by `npm test`)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

const header = `-- =====================================================================
-- Artist Café — FULL DATABASE SETUP (generated file — do not edit by hand)
-- = every file in supabase/migrations/ joined in order.
-- Paste the whole thing into Supabase -> SQL Editor and press Run.
-- Safe to run again: it never overwrites data you already entered.
-- =====================================================================
`;
const out = header + files.map((f) => `\n-- >>>>>>>>>> ${f} <<<<<<<<<<\n${fs.readFileSync(path.join(dir, f), 'utf8').trimEnd()}\n`).join('');
const target = path.join(root, 'supabase', 'schema.sql');

if (process.argv.includes('--check')) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current !== out) { console.error('supabase/schema.sql is out of date. Run: node scripts/build-schema.mjs'); process.exit(1); }
  console.log('schema.sql is up to date');
} else {
  fs.writeFileSync(target, out);
  console.log(`wrote supabase/schema.sql from ${files.length} migration(s)`);
}
