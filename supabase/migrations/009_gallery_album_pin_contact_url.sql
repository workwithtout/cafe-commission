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
