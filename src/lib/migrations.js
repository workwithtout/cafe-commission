// The database setup files travel inside the website itself, so the owner never has to open GitHub
// or a terminal: the site can hand them the exact SQL to paste (one tap "copy").
//   supabase/migrations/NNN_name.sql  -> database changes, applied in order
//   supabase/seed.sql                 -> OPTIONAL demo data
const files = import.meta.glob('/supabase/migrations/*.sql', { query: '?raw', import: 'default' });
const seedFiles = import.meta.glob('/supabase/seed.sql', { query: '?raw', import: 'default' });

const stem = (path) => path.split('/').pop().replace(/\.sql$/, '');

/** e.g. ['001_initial', '002_something'] — known without loading any SQL text. */
export const MIGRATION_VERSIONS = Object.keys(files).map(stem).sort();

/** Joined SQL for the given migration versions (default: all), in order. */
export async function loadMigrationSql(versions = MIGRATION_VERSIONS) {
  const wanted = new Set(versions);
  const paths = Object.keys(files).filter((p) => wanted.has(stem(p))).sort();
  const parts = await Promise.all(paths.map(async (p) => `-- >>>>>>>>>> ${stem(p)} <<<<<<<<<<\n${(await files[p]()).trimEnd()}\n`));
  return parts.join('\n');
}

export async function loadSeedSql() {
  const loader = seedFiles['/supabase/seed.sql'];
  return loader ? loader() : '';
}
