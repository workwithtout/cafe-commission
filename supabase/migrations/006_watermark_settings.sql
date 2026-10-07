-- Watermark settings. One row per shop (site_settings already holds each shop's own settings),
-- so every shop has its own configuration. Only the CURRENT configuration is stored (no history).
-- The watermark is applied in the owner's browser when an image is uploaded.
alter table site_settings add column if not exists watermark_gallery   boolean not null default false;
alter table site_settings add column if not exists watermark_services  boolean not null default false;
alter table site_settings add column if not exists watermark_type      text    not null default 'text';
alter table site_settings add column if not exists watermark_text      text    not null default '';
alter table site_settings add column if not exists watermark_image_url  text;
alter table site_settings add column if not exists watermark_image_path text;
alter table site_settings add column if not exists watermark_opacity   int     not null default 40;
alter table site_settings add column if not exists watermark_position  text    not null default 'bottom-right';
alter table site_settings add column if not exists watermark_size      int     not null default 22;

alter table site_settings drop constraint if exists site_settings_watermark_type_check;
alter table site_settings add constraint site_settings_watermark_type_check check (watermark_type in ('text','image'));
alter table site_settings drop constraint if exists site_settings_watermark_text_check;
alter table site_settings add constraint site_settings_watermark_text_check check (char_length(watermark_text) <= 80);
alter table site_settings drop constraint if exists site_settings_watermark_opacity_check;
alter table site_settings add constraint site_settings_watermark_opacity_check check (watermark_opacity between 5 and 100);
alter table site_settings drop constraint if exists site_settings_watermark_size_check;
alter table site_settings add constraint site_settings_watermark_size_check check (watermark_size between 5 and 60);
alter table site_settings drop constraint if exists site_settings_watermark_position_check;
alter table site_settings add constraint site_settings_watermark_position_check check (watermark_position in (
  'top-left','top-center','top-right','middle-left','center','middle-right','bottom-left','bottom-center','bottom-right'));

insert into app_migrations (version) values ('006_watermark_settings') on conflict do nothing;
notify pgrst, 'reload schema';
