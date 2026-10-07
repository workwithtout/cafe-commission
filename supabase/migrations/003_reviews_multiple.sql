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
