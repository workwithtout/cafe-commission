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
