-- =====================================================================
-- OPTIONAL DEMO DATA. Sample menu items only; nobody's real data.
-- Run it to see the site with a few example services before real use.
-- Skippable: you can add services from /#/admin instead.
-- Only inserts when there are no services yet (safe to run twice).
-- =====================================================================
do $$
declare s1 uuid; s2 uuid; s3 uuid;
begin
  if not exists (select 1 from services) then
    insert into services (name, description, price_from, duration_min, duration_max, sort_order)
      values ('Chibi (ตัวอย่าง)', 'ตัวอย่างเมนู: ตัวการ์ตูนหัวโต ลงสีเต็ม', 500, 3, 5, 1) returning id into s1;
    insert into services (name, description, price_from, duration_min, duration_max, sort_order)
      values ('Bust-up (ตัวอย่าง)', 'ตัวอย่างเมนู: ภาพครึ่งตัว', 900, 5, 7, 2) returning id into s2;
    insert into services (name, description, price_from, duration_min, duration_max, sort_order, is_open)
      values ('Illustration (ตัวอย่าง)', 'ตัวอย่างเมนู: ภาพประกอบตามบรีฟ', 2500, 7, 14, 3, false) returning id into s3;

    -- Default workflow: 5 example steps, each tagged with one of the status categories
    insert into service_steps (service_id, label, kind, category, sort_order)
    select sid, x.label, x.kind, x.category, x.ord
    from unnest(array[s1, s2, s3]) as sid,
         (values ('รับบรีฟ','normal','pending',1), ('ชำระเงิน','normal','confirmed',2), ('กำลังทำ','working','in_progress',3),
                 ('ตรวจงาน','waiting_revision','review',4), ('ส่งไฟล์','normal','review',5)) as x(label, kind, category, ord);
  end if;
end $$;
