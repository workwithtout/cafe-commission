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
