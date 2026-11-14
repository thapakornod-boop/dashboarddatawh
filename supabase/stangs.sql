-- RSM Sales Dashboard — เก็บข้อมูล STANGS (Google Sheet 3 tab) ไว้ใน Supabase
-- หน้า STANGS KPI อ่านจากตารางเหล่านี้ · เว็บเป็นคนบันทึกจากชีต (ปุ่มในหน้าสถานะระบบ / อัตโนมัติถ้าเกิน 1 ชม.)
-- การบันทึกแต่ละครั้ง: แทนที่เฉพาะช่วงวันที่ที่มีอยู่ในชีตตอนนั้น → ใส่เดือนย้อนหลังในชีตแล้วบันทึก = เพิ่มเดือนนั้นถาวร
-- รันทั้งไฟล์ใน Supabase › SQL Editor ครั้งเดียว (รันซ้ำได้)

-- 1) รายชื่อเซลล์ + ทีม รายเดือน (tab Seller) ------------------------------------------------------
create table if not exists public.stangs_seller (
  ym          text not null,          -- '2026-11'
  seller      text not null,
  company     text not null,
  branch      text,
  principal   text,
  manager     text,
  supervisor  text,
  name        text,
  primary key (ym, seller)
);

-- 2) แผนเยี่ยม ราย เซลล์ × วัน (tab Visit) — planned = ร้านในแผน · plan_visited = ร้านในแผนที่เข้าพบจริงวันเดียวกัน ----
create table if not exists public.stangs_plan_day (
  seller       text not null,
  d            date not null,
  planned      int  not null,
  plan_visited int  not null default 0,
  primary key (seller, d)
);
create index if not exists stangs_plan_day_d_idx on public.stangs_plan_day (d);

-- 3) การเข้าพบรายร้าน (tab Compliance) -------------------------------------------------------------
create table if not exists public.stangs_visit (
  id          bigserial primary key,
  seller      text not null,
  d           date not null,
  store       text,
  store_name  text,
  start_min   int,           -- นาทีนับจากเที่ยงคืน (08:47 = 527)
  end_min     int,
  dur_min     int,
  diff_m      numeric,       -- ระยะเช็คอินจากพิกัดร้าน (ม.)
  compliant   boolean,       -- ช่อง Compliance yes / no
  adhoc       boolean not null default false,
  status      text
);
create index if not exists stangs_visit_d_idx on public.stangs_visit (d, seller);

-- 4) ประวัติการบันทึกจากชีต ------------------------------------------------------------------------
create table if not exists public.stangs_sync (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  ok          boolean not null,
  date_from   date,
  date_to     date,
  sellers     int,
  plan_rows   int,
  visits      int,
  message     text
);

-- ความปลอดภัย: เปิด RLS ไม่มี policy → อ่าน / เขียนได้เฉพาะ service_role (ฝั่ง server ของเว็บ)
alter table public.stangs_seller   enable row level security;
alter table public.stangs_plan_day enable row level security;
alter table public.stangs_visit    enable row level security;
alter table public.stangs_sync     enable row level security;
revoke all on public.stangs_seller, public.stangs_plan_day, public.stangs_visit, public.stangs_sync from anon, authenticated;
grant select, insert, update, delete on public.stangs_seller, public.stangs_plan_day, public.stangs_visit, public.stangs_sync to service_role;
grant usage on sequence public.stangs_visit_id_seq, public.stangs_sync_id_seq to service_role;

notify pgrst, 'reload schema';

-- ตรวจ: select count(*), min(d), max(d) from public.stangs_visit;
--       select * from public.stangs_sync order by id desc limit 5;
