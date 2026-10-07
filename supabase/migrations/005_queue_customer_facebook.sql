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
