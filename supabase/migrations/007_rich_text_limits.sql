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
