# Migrations

Each file = one database change, applied in filename order (`001_…`, `002_…`).
Every migration must

1. be safe to run twice (`create … if not exists`, `drop policy if exists`, `on conflict do nothing`, `add column if not exists`);
2. never delete or overwrite the owner's data;
3. end with `insert into app_migrations (version) values ('<file name without .sql>') on conflict do nothing;`
   and `notify pgrst, 'reload schema';`.

The site compares this folder with the `app_migrations` table in the owner's own Supabase project.
If something is missing, **/admin → Dashboard** shows an "update available" card with a one-tap "copy SQL"
button — the owner pastes it into their Supabase SQL Editor. Nothing else changes, and their data stays.

After adding a migration, regenerate the all-in-one file: `node scripts/build-schema.mjs`.
