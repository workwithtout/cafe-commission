-- =====================================================================
-- Artist Café — FULL DATABASE SETUP (generated file — do not edit by hand)
-- = every file in supabase/migrations/ joined in order.
-- Paste the whole thing into Supabase -> SQL Editor and press Run.
-- Safe to run again: it never overwrites data you already entered.
-- =====================================================================

-- >>>>>>>>>> 001_initial.sql <<<<<<<<<<
-- =====================================================================
-- Artist Café — migration 001_initial
-- Tables, constraints, indexes, RLS policies, functions, storage bucket,
-- and the BLANK defaults the site needs in order to start.
--
-- * Contains NO personal data and NO demo content (demo = supabase/seed.sql).
-- * Safe to run more than once: it never overwrites data you already entered.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Admin allow-list (real authentication = Supabase Auth + this table)
-- ---------------------------------------------------------------------
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- Which migrations have been applied to THIS database (lets /admin tell the owner when an update is pending).
create table if not exists app_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- profiles (single row, id = 1)
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id            int primary key default 1 check (id = 1),
  display_name  text not null check (char_length(display_name) between 1 and 80),
  handle        text check (char_length(handle) <= 60),
  bio           text check (char_length(bio) <= 1000),
  tagline       text check (char_length(tagline) <= 200),
  avatar_url    text,
  avatar_path   text,
  status        text not null default 'open' check (status in ('open','closed','partial','ask')),
  welcome_title text check (char_length(welcome_title) <= 120),
  welcome_text  text check (char_length(welcome_text) <= 600),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- services + default workflow
-- ---------------------------------------------------------------------
create table if not exists services (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 80),
  description  text check (char_length(description) <= 600),
  price_from   numeric(10,2) not null default 0 check (price_from >= 0),
  duration_min int not null default 1 check (duration_min >= 0),
  duration_max int not null default 1,
  image_url    text,
  image_path   text,
  is_open      boolean not null default true,    -- accepting commissions
  is_visible   boolean not null default true,    -- shown on public site
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  constraint services_duration_ok check (duration_max >= duration_min)
);

-- kind: normal | working (the single "working" step) | waiting_info | waiting_revision
create table if not exists service_steps (
  id         uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 60),
  kind       text not null default 'normal' check (kind in ('normal','working','waiting_info','waiting_revision')),
  sort_order int not null default 0
);
create index if not exists service_steps_service_idx on service_steps(service_id, sort_order);

-- ---------------------------------------------------------------------
-- gallery
-- ---------------------------------------------------------------------
create table if not exists gallery_items (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid references services(id) on delete set null,  -- deleting a Service keeps the artwork (becomes "uncategorised")
  title       text not null check (char_length(title) between 1 and 120),
  owner_name  text check (char_length(owner_name) <= 80),
  description text check (char_length(description) <= 800),
  image_url   text not null,
  image_path  text,
  art_date    date not null default current_date,
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists gallery_service_idx on gallery_items(service_id);

-- ---------------------------------------------------------------------
-- queue + SNAPSHOT of workflow steps
-- ---------------------------------------------------------------------
create table if not exists queue_items (
  id              uuid primary key default gen_random_uuid(),
  service_id      uuid references services(id) on delete set null,
  service_name    text not null,   -- snapshot: stays correct if the Service is renamed/deleted
  customer_name   text not null check (char_length(customer_name) between 1 and 80),
  description     text check (char_length(description) <= 500),
  duration_days   int check (duration_days is null or duration_days >= 0),
  due_date        date,
  -- only exceptional states are stored; normal status is COMPUTED from steps
  status_override text check (status_override in ('cancelled','paused','waiting_info','waiting_revision')),
  is_public       boolean not null default true,
  gallery_item_id uuid references gallery_items(id) on delete set null,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists queue_sort_idx on queue_items(sort_order);

create table if not exists queue_steps (
  id            uuid primary key default gen_random_uuid(),
  queue_item_id uuid not null references queue_items(id) on delete cascade,
  label         text not null check (char_length(label) between 1 and 60),
  kind          text not null default 'normal' check (kind in ('normal','working','waiting_info','waiting_revision')),
  sort_order    int not null default 0,
  is_done       boolean not null default false,
  done_at       timestamptz
);
create index if not exists queue_steps_item_idx on queue_steps(queue_item_id, sort_order);

-- ---------------------------------------------------------------------
-- reviews (moderated; one per device to blunt spam)
-- ---------------------------------------------------------------------
create table if not exists reviews (
  id            uuid primary key default gen_random_uuid(),
  reviewer_name text not null check (char_length(btrim(reviewer_name)) between 1 and 60),
  rating        int  not null check (rating between 1 and 5),
  body          text not null check (char_length(btrim(body)) between 1 and 800),
  status        text not null default 'pending' check (status in ('pending','approved','hidden')),
  device_id     text check (char_length(device_id) <= 80),
  created_at    timestamptz not null default now()
);
create unique index if not exists reviews_one_per_device on reviews(device_id) where device_id is not null;

-- ---------------------------------------------------------------------
-- contact links, themes, settings
-- ---------------------------------------------------------------------
create table if not exists contact_links (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 40),
  icon       text not null default 'link',
  url        text not null check (url ~* '^(https?://|mailto:)'),
  is_active  boolean not null default true,
  sort_order int not null default 0
);

-- Theme = asset pack. Built-in packs (strawberry / matcha / chocolate) are drawn in code;
-- rows hold their config (palette, fonts, uploaded assets).
create table if not exists themes (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name       text not null check (char_length(name) between 1 and 60),
  config     jsonb not null default '{}'::jsonb,
  is_builtin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists site_settings (
  id               int primary key default 1 check (id = 1),
  active_theme_id  uuid references themes(id) on delete set null,
  sfx_enabled      boolean not null default true,
  shop_name        text not null default 'Artist Café' check (char_length(shop_name) <= 60),
  inquiry_template text not null default E'สวัสดีค่ะ สนใจงาน {service} ค่ะ\nอยากสอบถามรายละเอียดเพิ่มเติมค่ะ'
                   check (char_length(inquiry_template) <= 600),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------

-- Creates a queue item AND copies the service's current workflow as a frozen snapshot.
create or replace function create_queue_item(
  p_service     uuid,
  p_customer    text,
  p_description text,
  p_days        int,
  p_due         date,
  p_public      boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  v_name text;
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  select name into v_name from services where id = p_service;
  if v_name is null then raise exception 'service not found'; end if;

  insert into queue_items (service_id, service_name, customer_name, description, duration_days, due_date, is_public, sort_order)
  values (p_service, v_name, btrim(p_customer), p_description, p_days, p_due, p_public,
          coalesce((select max(sort_order) from queue_items), 0) + 1)
  returning id into v_id;

  insert into queue_steps (queue_item_id, label, kind, sort_order)
  select v_id, label, kind, sort_order from service_steps where service_id = p_service order by sort_order;

  return v_id;
end $$;

-- Review statistics computed ONLY from approved reviews.
create or replace function get_review_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'count',   count(*),
    'average', coalesce(round(avg(rating)::numeric, 1), 0),
    'dist', json_build_object(
      '1', count(*) filter (where rating = 1),
      '2', count(*) filter (where rating = 2),
      '3', count(*) filter (where rating = 3),
      '4', count(*) filter (where rating = 4),
      '5', count(*) filter (where rating = 5)
    )
  ) from reviews where status = 'approved';
$$;

grant execute on function get_review_stats() to anon, authenticated;
grant execute on function is_admin() to anon, authenticated;
grant execute on function create_queue_item(uuid, text, text, int, date, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table admins         enable row level security;
alter table app_migrations enable row level security;
alter table profiles       enable row level security;
alter table services       enable row level security;
alter table service_steps  enable row level security;
alter table gallery_items  enable row level security;
alter table queue_items    enable row level security;
alter table queue_steps    enable row level security;
alter table reviews        enable row level security;
alter table contact_links  enable row level security;
alter table themes         enable row level security;
alter table site_settings  enable row level security;

-- admins: an admin may read their own row; nobody can write from the client.
drop policy if exists admins_self on admins;
create policy admins_self on admins for select to authenticated using (user_id = auth.uid());

-- app_migrations: only the owner can read it; nobody can write from the client.
drop policy if exists app_migrations_admin_read on app_migrations;
create policy app_migrations_admin_read on app_migrations for select to authenticated using (is_admin());

-- profiles / settings / themes: public read, admin write
drop policy if exists profiles_read  on profiles;
drop policy if exists profiles_write on profiles;
create policy profiles_read  on profiles for select using (true);
create policy profiles_write on profiles for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists settings_read  on site_settings;
drop policy if exists settings_write on site_settings;
create policy settings_read  on site_settings for select using (true);
create policy settings_write on site_settings for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists themes_read  on themes;
drop policy if exists themes_write on themes;
create policy themes_read  on themes for select using (true);
create policy themes_write on themes for all to authenticated using (is_admin()) with check (is_admin());

-- services: public sees visible ones; admin sees/edits all
drop policy if exists services_read  on services;
drop policy if exists services_write on services;
create policy services_read  on services for select using (is_visible or is_admin());
create policy services_write on services for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists steps_read  on service_steps;
drop policy if exists steps_write on service_steps;
create policy steps_read  on service_steps for select using (true);
create policy steps_write on service_steps for all to authenticated using (is_admin()) with check (is_admin());

-- gallery
drop policy if exists gallery_read  on gallery_items;
drop policy if exists gallery_write on gallery_items;
create policy gallery_read  on gallery_items for select using (is_visible or is_admin());
create policy gallery_write on gallery_items for all to authenticated using (is_admin()) with check (is_admin());

-- queue (public sees only is_public items and their steps)
drop policy if exists queue_read  on queue_items;
drop policy if exists queue_write on queue_items;
create policy queue_read  on queue_items for select using (is_public or is_admin());
create policy queue_write on queue_items for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists qsteps_read  on queue_steps;
drop policy if exists qsteps_write on queue_steps;
create policy qsteps_read on queue_steps for select using (
  is_admin() or exists (select 1 from queue_items q where q.id = queue_item_id and q.is_public)
);
create policy qsteps_write on queue_steps for all to authenticated using (is_admin()) with check (is_admin());

-- reviews: anyone may INSERT a pending review; only approved are readable by the public
drop policy if exists reviews_read   on reviews;
drop policy if exists reviews_insert on reviews;
drop policy if exists reviews_admin  on reviews;
create policy reviews_read   on reviews for select using (status = 'approved' or is_admin());
create policy reviews_insert on reviews for insert to anon, authenticated with check (status = 'pending');
create policy reviews_admin  on reviews for all to authenticated using (is_admin()) with check (is_admin());

-- contact links: public sees active ones
drop policy if exists contact_read  on contact_links;
drop policy if exists contact_write on contact_links;
create policy contact_read  on contact_links for select using (is_active or is_admin());
create policy contact_write on contact_links for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- Storage bucket (public read, admin write)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('cafe-media', 'cafe-media', true)
on conflict (id) do nothing;

drop policy if exists "media public read"  on storage.objects;
drop policy if exists "media admin insert" on storage.objects;
drop policy if exists "media admin update" on storage.objects;
drop policy if exists "media admin delete" on storage.objects;
create policy "media public read"  on storage.objects for select using (bucket_id = 'cafe-media');
create policy "media admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'cafe-media' and is_admin());
create policy "media admin update" on storage.objects for update to authenticated using (bucket_id = 'cafe-media' and is_admin());
create policy "media admin delete" on storage.objects for delete to authenticated using (bucket_id = 'cafe-media' and is_admin());

-- ---------------------------------------------------------------------
-- Blank defaults the site needs to start (the owner edits all of this in /admin).
-- "on conflict do nothing" => re-running this file never overwrites the owner's data.
-- ---------------------------------------------------------------------
insert into profiles (id, display_name, status, welcome_title, welcome_text)
values (1, 'ชื่อของคุณ', 'open', 'ยินดีต้อนรับเข้าสู่ร้านของเรา',
        'แวะชมผลงาน เลือกเมนูงานที่ถูกใจ แล้วทักมาคุยงานกันได้เลยนะ')
on conflict (id) do nothing;

-- Built-in theme asset packs (default assets of the template, not personal data)
insert into themes (slug, name, is_builtin, config) values
 ('strawberry', 'Strawberry Café', true, '{"motif":"strawberry","fonts":{"display":"Mali","body":"Noto Sans Thai Looped","label":"Itim"},"sfx_pitch":1}'),
 ('matcha',     'Matcha Café',     true, '{"motif":"matcha","fonts":{"display":"Mali","body":"Noto Sans Thai Looped","label":"Mitr"},"sfx_pitch":0.84}'),
 ('chocolate',  'Chocolate Café',  true, '{"motif":"chocolate","fonts":{"display":"Sriracha","body":"Noto Sans Thai Looped","label":"Itim"},"sfx_pitch":0.7}')
on conflict (slug) do nothing;

insert into site_settings (id, active_theme_id)
select 1, (select id from themes where slug = 'strawberry')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Record this migration + refresh the API schema cache
-- ---------------------------------------------------------------------
insert into app_migrations (version) values ('001_initial') on conflict do nothing;
notify pgrst, 'reload schema';

-- >>>>>>>>>> 002_remove_bgm.sql <<<<<<<<<<
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

-- >>>>>>>>>> 003_reviews_multiple.sql <<<<<<<<<<
-- Reviews: allow any number of reviews per customer/device, and make the review time trustworthy.
-- * Drops the "one review per device" unique index (device_id column is kept, just unused).
-- * created_at is set by the database when the review is submitted. It is the submission time
--   (not the approval time) and can never be set by the visitor or changed later (e.g. on approve).
drop index if exists reviews_one_per_device;

create or replace function reviews_lock_created_at() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists reviews_lock_created_at on reviews;
create trigger reviews_lock_created_at before insert or update on reviews
  for each row execute function reviews_lock_created_at();

insert into app_migrations (version) values ('003_reviews_multiple') on conflict do nothing;
notify pgrst, 'reload schema';

-- >>>>>>>>>> 004_step_categories.sql <<<<<<<<<<
-- Workflow steps get one of 4 status categories; the 5th status (completed) is automatic
-- when every step is done. A step keeps its own custom name; the category only says what
-- "status" the job has while that step is the current one.
--   pending      Pending / waiting to start  (brief received, waiting for info, in queue)
--   confirmed    Confirmed                   (details confirmed, paid, ready to start)
--   in_progress  In progress                 (actually working on it)
--   review       Review                      (waiting for check / revision / feedback / approval)
-- Existing steps are mapped from their old kind / name; nothing is deleted.

alter table service_steps add column if not exists category text;
alter table queue_steps   add column if not exists category text;

update service_steps set category = case
  when kind = 'working'          then 'in_progress'
  when kind = 'waiting_info'     then 'pending'
  when kind = 'waiting_revision' then 'review'
  when label ~* '(ตรวจ|แก้ไข|อนุมัติ|feedback|ส่งไฟล์|ส่งงาน|ส่งมอบ)' then 'review'
  when label ~* '(บรีฟ|brief|รอข้อมูล|รอคิว|รอยืนยัน)'                then 'pending'
  when label ~* '(ชำระ|จ่าย|มัดจำ|ยืนยัน|พร้อมเริ่ม)'                  then 'confirmed'
  else 'in_progress'
end where category is null;

update queue_steps set category = case
  when kind = 'working'          then 'in_progress'
  when kind = 'waiting_info'     then 'pending'
  when kind = 'waiting_revision' then 'review'
  when label ~* '(ตรวจ|แก้ไข|อนุมัติ|feedback|ส่งไฟล์|ส่งงาน|ส่งมอบ)' then 'review'
  when label ~* '(บรีฟ|brief|รอข้อมูล|รอคิว|รอยืนยัน)'                then 'pending'
  when label ~* '(ชำระ|จ่าย|มัดจำ|ยืนยัน|พร้อมเริ่ม)'                  then 'confirmed'
  else 'in_progress'
end where category is null;

alter table service_steps alter column category set default 'in_progress';
alter table service_steps alter column category set not null;
alter table queue_steps   alter column category set default 'in_progress';
alter table queue_steps   alter column category set not null;

alter table service_steps drop constraint if exists service_steps_category_check;
alter table service_steps add constraint service_steps_category_check
  check (category in ('pending','confirmed','in_progress','review'));
alter table queue_steps drop constraint if exists queue_steps_category_check;
alter table queue_steps add constraint queue_steps_category_check
  check (category in ('pending','confirmed','in_progress','review'));

-- Manual status override: the old "waiting_*" values become the matching category.
-- ("completed" is never an override, so "completed with progress < 100%" stays impossible.)
alter table queue_items drop constraint if exists queue_items_status_override_check;
update queue_items set status_override = 'pending' where status_override = 'waiting_info';
update queue_items set status_override = 'review'  where status_override = 'waiting_revision';
alter table queue_items add constraint queue_items_status_override_check
  check (status_override is null or status_override in ('cancelled','paused','pending','confirmed','in_progress','review'));

-- New jobs snapshot the category of every step too.
create or replace function create_queue_item(
  p_service     uuid,
  p_customer    text,
  p_description text,
  p_days        int,
  p_due         date,
  p_public      boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  v_name text;
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  select name into v_name from services where id = p_service;
  if v_name is null then raise exception 'service not found'; end if;

  insert into queue_items (service_id, service_name, customer_name, description, duration_days, due_date, is_public, sort_order)
  values (p_service, v_name, btrim(p_customer), p_description, p_days, p_due, p_public,
          coalesce((select max(sort_order) from queue_items), 0) + 1)
  returning id into v_id;

  insert into queue_steps (queue_item_id, label, kind, category, sort_order)
  select v_id, label, kind, category, sort_order from service_steps where service_id = p_service order by sort_order;

  return v_id;
end $$;
grant execute on function create_queue_item(uuid, text, text, int, date, boolean) to authenticated;

insert into app_migrations (version) values ('004_step_categories') on conflict do nothing;
notify pgrst, 'reload schema';

-- >>>>>>>>>> 005_queue_customer_facebook.sql <<<<<<<<<<
-- Customer's Facebook link for a queue item, with its own public / admin-only switch.
-- Private by default: the owner must tick "show on the public site".
-- It lives in a separate table (not a column of queue_items) so a private link can never be
-- returned to visitors by "select *" on the public queue.
create table if not exists queue_item_contacts (
  queue_item_id   uuid primary key references queue_items(id) on delete cascade,
  facebook_url    text check (
    facebook_url is null or (
      char_length(facebook_url) <= 300
      and facebook_url ~* '^https://([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me)(/|\?|$)'
    )
  ),
  facebook_public boolean not null default false
);

alter table queue_item_contacts enable row level security;
grant select on queue_item_contacts to anon;
grant select, insert, update, delete on queue_item_contacts to authenticated;

drop policy if exists qcontacts_read  on queue_item_contacts;
drop policy if exists qcontacts_write on queue_item_contacts;
-- Visitors only see a link that the owner marked public AND whose queue item is public.
create policy qcontacts_read on queue_item_contacts for select using (
  is_admin() or (
    facebook_public and exists (select 1 from queue_items q where q.id = queue_item_id and q.is_public)
  )
);
create policy qcontacts_write on queue_item_contacts for all to authenticated using (is_admin()) with check (is_admin());

insert into app_migrations (version) values ('005_queue_customer_facebook') on conflict do nothing;
notify pgrst, 'reload schema';

-- >>>>>>>>>> 006_watermark_settings.sql <<<<<<<<<<
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

-- >>>>>>>>>> 007_rich_text_limits.sql <<<<<<<<<<
-- Bio / service description / gallery description can now contain basic formatting
-- (bold, italic, underline, lists), stored as a small set of HTML tags that is sanitised
-- on save and again when shown. The tags take space, so the length caps are raised.
-- The forms still limit the visible text to the previous sizes.
alter table profiles      drop constraint if exists profiles_bio_check;
alter table profiles      add  constraint profiles_bio_check check (char_length(bio) <= 6000);
alter table services      drop constraint if exists services_description_check;
alter table services      add  constraint services_description_check check (char_length(description) <= 4000);
alter table gallery_items drop constraint if exists gallery_items_description_check;
alter table gallery_items add  constraint gallery_items_description_check check (char_length(description) <= 4000);

insert into app_migrations (version) values ('007_rich_text_limits') on conflict do nothing;
notify pgrst, 'reload schema';

-- >>>>>>>>>> 008_queue_gallery_category.sql <<<<<<<<<<
-- A queue item now links to a gallery CATEGORY (a Service), not to one single picture.
-- The "view sample works" button opens the gallery filtered to that category.
--   gallery_service_id = null  -> automatic: use the queue item's own service category
-- The old per-picture link (gallery_item_id) is kept untouched so no data is lost; for items that
-- had one, its picture's category is copied over so their button keeps working as a category link.
alter table queue_items add column if not exists gallery_service_id uuid references services(id) on delete set null;

update queue_items q
   set gallery_service_id = g.service_id
  from gallery_items g
 where q.gallery_item_id = g.id
   and q.gallery_service_id is null
   and g.service_id is not null;

insert into app_migrations (version) values ('008_queue_gallery_category') on conflict do nothing;
notify pgrst, 'reload schema';

-- >>>>>>>>>> 009_gallery_album_pin_contact_url.sql <<<<<<<<<<
-- Release 009 (run it once on top of 001-008; fresh installs get it automatically with the rest):
--   1) Gallery "album" items: a normal gallery item that keeps ONE preview picture in Storage and ONE external link.
--      Only the link is stored; nothing is downloaded or copied from the external album.
--   2) Gallery items with several pictures (extra pictures in a child table; the cover stays in gallery_items).
--   3) Pinned gallery items (at most 3, each pin slot 1-3 used by one item at a time).
--   4) Queue "contact link": the existing queue_item_contacts.facebook_url column now accepts any http(s)/mailto link
--      (Facebook links already saved stay valid; no data is changed).
--   5) Three more built-in themes: blue, yellow, oreo.
-- Non-destructive: only adds columns / a table / rows and loosens one check.

-- 1) album --------------------------------------------------------------
alter table gallery_items add column if not exists kind      text not null default 'image';
alter table gallery_items add column if not exists album_url text;

alter table gallery_items drop constraint if exists gallery_items_kind_check;
alter table gallery_items add  constraint gallery_items_kind_check check (kind in ('image', 'album'));
alter table gallery_items drop constraint if exists gallery_items_album_url_check;
alter table gallery_items add  constraint gallery_items_album_url_check check (
  album_url is null or (char_length(album_url) <= 500 and album_url ~* '^https?://[^[:space:]]+$')
);
alter table gallery_items drop constraint if exists gallery_items_album_needs_url;
alter table gallery_items add  constraint gallery_items_album_needs_url check (kind <> 'album' or album_url is not null);

-- 3) pin (1..3 = pinned, in that order; null = not pinned) -----------------
alter table gallery_items add column if not exists pinned_order smallint;
alter table gallery_items drop constraint if exists gallery_items_pinned_order_check;
alter table gallery_items add  constraint gallery_items_pinned_order_check check (pinned_order is null or pinned_order between 1 and 3);
create unique index if not exists gallery_items_pin_slot on gallery_items(pinned_order) where pinned_order is not null;

-- 2) extra pictures of one gallery item ------------------------------------
create table if not exists gallery_item_images (
  id              uuid primary key default gen_random_uuid(),
  gallery_item_id uuid not null references gallery_items(id) on delete cascade,
  image_url       text not null,
  image_path      text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists gallery_item_images_item_idx on gallery_item_images(gallery_item_id, sort_order);

alter table gallery_item_images enable row level security;
grant select on gallery_item_images to anon;
grant select, insert, update, delete on gallery_item_images to authenticated;

drop policy if exists gallery_images_read  on gallery_item_images;
drop policy if exists gallery_images_write on gallery_item_images;
-- visible whenever the gallery item itself is visible (hidden items keep their pictures private)
create policy gallery_images_read on gallery_item_images for select using (
  is_admin() or exists (select 1 from gallery_items g where g.id = gallery_item_id and g.is_visible)
);
create policy gallery_images_write on gallery_item_images for all to authenticated using (is_admin()) with check (is_admin());

-- 4) queue contact link: any http(s) or mailto link, still ONE field --------
alter table queue_item_contacts drop constraint if exists queue_item_contacts_facebook_url_check;
alter table queue_item_contacts add  constraint queue_item_contacts_facebook_url_check check (
  facebook_url is null or (char_length(facebook_url) <= 300 and facebook_url ~* '^(https?://|mailto:)[^[:space:]]+$')
);

-- 5) themes (colours and decoration are drawn in code, like the first three) ----
insert into themes (slug, name, is_builtin, config) values
 ('blue',   'Blue Café',   true, '{"motif":"blue","fonts":{"display":"Mali","body":"Noto Sans Thai Looped","label":"Itim"},"sfx_pitch":1.1}'),
 ('yellow', 'Yellow Café', true, '{"motif":"yellow","fonts":{"display":"Mali","body":"Noto Sans Thai Looped","label":"Itim"},"sfx_pitch":1.2}'),
 ('oreo',   'Oreo Café',   true, '{"motif":"oreo","fonts":{"display":"Mali","body":"Noto Sans Thai Looped","label":"Mitr"},"sfx_pitch":0.9}')
on conflict (slug) do nothing;

insert into app_migrations (version) values ('009_gallery_album_pin_contact_url') on conflict do nothing;
notify pgrst, 'reload schema';
