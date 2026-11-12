-- RSM Sales Dashboard — เพิ่มรหัสเซลล์ใหม่ (PDC / DC) เข้า seller_principal อัตโนมัติจากยอดขาย
-- ต้องรัน princ_store.sql มาก่อน (ใช้ sales_branch_daily ที่มีหัวรหัสสินค้า) · รันทั้งไฟล์ใน Supabase › SQL Editor (รันซ้ำได้)
--
-- ทำไม: PDC / DC นับยอดเฉพาะเซลล์ที่อยู่ใน seller_principal → เซลล์ใหม่ที่ยังไม่มีใครเพิ่ม ยอดจะหายจาก dashboard
-- กติกา (ทุกรอบหลังอัปเดตข้อมูล 06:45 / 12:45 / 17:45 เวลาไทย):
--   1. เซลล์ PDC / DC ที่มียอดใน 45 วันล่าสุด แต่ยังไม่มีใน seller_principal (ของบริษัทนั้น)
--   2. ไม่ใช่รหัสระบบ: ADMIN… / ADS… / …GSM… / -No Sales Employee- / รหัสว่าง
--   3. ยอด GIV รวมในช่วงนั้น ≥ 1,000 บาท (กันรหัสที่มีแค่ใบลดหนี้ / ยอดหลงมา)
--   4. Princ = หัวรหัสสินค้าที่เซลล์คนนั้นขาย (เช่น KAO-xxxx → KAO) ที่เป็น Princ ที่มีอยู่แล้วในระบบ
--      และมีสัดส่วน ≥ 10% ของยอดเซลล์คนนั้น (ของแถม / สินค้าหลงข้าม Princ ไม่นับ)
--   5. ใส่ company_code ของบริษัทนั้นไว้ด้วย → ไม่ไปกระทบรหัสเดียวกันในบริษัทอื่น
-- เพิ่มแล้วมีผลทันที (dashboard กรองเซลล์ตอนดึงข้อมูล ไม่ต้องคำนวณตารางสรุปใหม่)
-- ทุกครั้งที่เพิ่มจะบันทึกไว้ใน seller_auto_log → ดูได้ที่หน้า "สถานะระบบ" · ถ้าเพิ่มผิด ลบแถวใน seller_principal ได้เลย

-- 1) บันทึกการเพิ่มอัตโนมัติ ---------------------------------------------------------------------
create table if not exists public.seller_auto_log (
  id           bigserial primary key,
  added_at     timestamptz not null default now(),
  company_code varchar not null,
  seller       varchar not null,
  principals   text    not null,
  branch       varchar,
  giv          numeric not null,
  first_d      date,
  last_d       date
);
alter table public.seller_auto_log enable row level security;
revoke all on public.seller_auto_log from anon, authenticated;
grant select on public.seller_auto_log to service_role;

-- 2) เซลล์ที่ยังไม่มีใน seller_principal (ใช้ทั้งตอนเพิ่มอัตโนมัติ และแสดงในหน้าสถานะระบบ) ------------
--    can_add = เพิ่มอัตโนมัติได้ (ผ่านทุกกติกา) · ไม่ได้ = ยอดน้อย หรือหา Princ ไม่ได้ → ให้คนเพิ่มเอง
drop function if exists public.seller_unmapped(int);
create or replace function public.seller_unmapped(p_days int default 45)
returns table (company_code varchar, seller varchar, branch varchar, giv numeric, first_d date, last_d date,
               principals text, can_add boolean)
language sql
stable
as $$
  with known as (
    select distinct principal from public.seller_principal where principal <> 'P&G'
  ),
  s as (
    select b.company_code, b.seller, b.item_prefix, b.branch, b.d, b.giv
    from public.sales_branch_daily b
    where b.company_code in ('PDC', 'DC')
      and b.d >= (now() at time zone 'Asia/Bangkok')::date - p_days
      and coalesce(trim(b.seller), '') <> ''
      and b.seller not ilike '%GSM%'
      and b.seller not ilike 'ADMIN%'
      and b.seller not ilike 'ADS%'
      and b.seller not ilike '%No Sales%'
      and not exists (
        select 1 from public.seller_principal sp
        where sp.seller = b.seller and coalesce(sp.company_code, b.company_code) = b.company_code
      )
  ),
  tot as (
    select company_code, seller, sum(giv) as giv, min(d) as first_d, max(d) as last_d,
           mode() within group (order by branch) as branch
    from s group by 1, 2
  ),
  pf as (
    select company_code, seller, item_prefix, sum(giv) as giv
    from s where item_prefix in (select principal from known)
    group by 1, 2, 3
    having sum(giv) > 0
  ),
  ok as (
    select pf.company_code, pf.seller, string_agg(pf.item_prefix, '/' order by pf.giv desc) as principals
    from pf join tot using (company_code, seller)
    where pf.giv >= 0.1 * tot.giv
    group by 1, 2
  )
  select t.company_code::varchar, t.seller::varchar, t.branch::varchar, round(t.giv, 2), t.first_d, t.last_d,
         ok.principals, (t.giv >= 1000 and ok.principals is not null)
  from tot t
  left join ok using (company_code, seller)
  order by t.giv desc;
$$;

-- 3) เพิ่มอัตโนมัติ: คืนจำนวนเซลล์ที่เพิ่ม ---------------------------------------------------------
create or replace function public.seller_auto_add(p_days int default 45)
returns int
language plpgsql
as $$
declare
  r record;
  n int := 0;
begin
  for r in select * from public.seller_unmapped(p_days) where can_add loop
    insert into public.seller_principal (seller, principal, company_code)
    select r.seller, p, r.company_code from unnest(string_to_array(r.principals, '/')) p;
    insert into public.seller_auto_log (company_code, seller, principals, branch, giv, first_d, last_d)
    values (r.company_code, r.seller, r.principals, r.branch, r.giv, r.first_d, r.last_d);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- 4) ให้หน้าสถานะระบบอ่าน (service_role เท่านั้น) -----------------------------------------------
create or replace function public.seller_auto_recent(p_limit int default 50)
returns setof public.seller_auto_log
language sql
stable
as $$
  select * from public.seller_auto_log order by added_at desc, id desc limit p_limit;
$$;

revoke execute on function public.seller_unmapped(int) from public, anon, authenticated;
revoke execute on function public.seller_auto_add(int) from public, anon, authenticated;
revoke execute on function public.seller_auto_recent(int) from public, anon, authenticated;
grant execute on function public.seller_unmapped(int) to service_role;
grant execute on function public.seller_auto_recent(int) to service_role;

-- 5) รันอัตโนมัติ 5 นาทีหลัง branch-refresh (06:45 / 12:45 / 17:45 เวลาไทย) -------------------------
select cron.unschedule(jobid) from cron.job where jobname = 'seller-auto-add';
select cron.schedule('seller-auto-add', '45 23,5,10 * * *', $$ select public.seller_auto_add(45) $$);

-- 6) รอบแรก: ย้อน 120 วัน ให้รวมเซลล์ที่ขายช่วง ส.ค. ด้วย แล้วดูว่าเพิ่มใครไปบ้าง ---------------------
select public.seller_auto_add(120) as added;
select company_code, seller, principals, branch, giv, first_d, last_d from public.seller_auto_log order by id desc;

notify pgrst, 'reload schema';
