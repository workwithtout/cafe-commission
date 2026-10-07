-- =====================================================================
-- Artist Café — migration 002_remove_bgm
-- Background music was removed from the template. UI button sounds are unaffected.
-- For databases created before this change: removes the BGM-only setting column and the
-- BGM keys stored in theme configs. Nothing else is touched. Safe to run more than once.
-- (Audio files an owner may have uploaded earlier stay in Storage; delete them there if you wish.)
-- =====================================================================
alter table site_settings drop column if exists bgm_enabled;

update themes
set config = (config - 'bgm_url') #- '{paths,bgm}'
where config ? 'bgm_url' or (config #> '{paths,bgm}') is not null;

insert into app_migrations (version) values ('002_remove_bgm') on conflict do nothing;
notify pgrst, 'reload schema';
