-- RSM Sales Dashboard — ตัวชี้วัดรายเซลล์ (Scorecard แยก Credit / Van) + หน้า "ร้านเครดิต"
-- ต้องรัน kpi_store.sql และ princ_store.sql มาก่อนแล้ว · รันทั้งไฟล์ใน Supabase › SQL Editor (รันซ้ำได้ · ไม่กี่วินาที)
-- ใช้ตารางสรุป sales_store_daily (บริษัท × วัน × เซลล์ × ร้าน) ที่มีอยู่แล้ว — ไม่มีตารางใหม่ ไม่ต้องคำนวณย้อนหลัง
-- ประเภทเซลล์ (Credit / Van / Presale) แยกที่ฝั่งเว็บ จากคอลัมน์ Channel ในชีต + รูปแบบรหัสเซลล์
-- ทุกฟังก์ชันรวมยอดด้วย group by ครั้งเดียวแล้ว join (ไม่มี subquery ต่อแถว — เวอร์ชันแรกช้าจนเกินเวลา)

-- 0) index ตาม บริษัท + เซลล์ + วันที่ → หน้าร้านเครดิตอ่านเฉพาะแถวของเซลล์ที่เลือก (ไม่ต้องอ่านทั้งช่วง)
--    ตาราง ~4 ล้านแถว สร้างนานเกิน timeout ของ SQL Editor → ให้ pg_cron สร้างเบื้องหลังแล้วลบ job ตัวเอง
select cron.unschedule(jobid) from cron.job where jobname = 'make-store-seller-idx';
select cron.schedule('make-store-seller-idx', '* * * * *', $$
  set statement_timeout = 0;
  create index if not exists sales_store_daily_seller_idx on public.sales_store_daily (company_code, seller, d);
  select cron.unschedule('make-store-seller-idx');
$$);

-- 1) ตัวชี้วัดรายเซลล์ ช่วง [p_from, p_to) — เฉพาะเซลล์ที่นับยอด (กฎเดียวกับ dashboard_sales)
--    work_days = จำนวนวันที่เซลล์คนนั้นมีบิล · stores = ร้านไม่ซ้ำที่ยอดรวม > 0
drop function if exists public.dashboard_kpi_seller(date, date);
create or replace function public.dashboard_kpi_seller(p_from date, p_to date)
returns table (company_code varchar, seller varchar, work_days bigint, bills bigint, lines bigint, lines_gt1 bigint,
               stores bigint, giv numeric, niv numeric)
language sql
stable
as $$
  with sp as (
    select seller, company_code, min(principal) as principal
    from public.seller_principal
    group by seller, company_code
  ),
  src as (
    select s.company_code, s.seller, s.cardcode, s.d, s.giv, s.niv, s.bills, s.lines, s.lines_gt1
    from public.sales_store_daily s
    left join sp on sp.seller = s.seller
      and coalesce(sp.company_code, s.company_code) = s.company_code
    where s.d >= p_from and s.d < p_to
      and public.dashboard_counts(s.company_code, s.seller, sp.principal)
  ),
  per_store as (
    select company_code, seller, cardcode, sum(giv) as giv
    from src group by 1, 2, 3
  ),
  st as (
    select company_code, seller, count(*) filter (where giv > 0 and cardcode <> '-') as stores
    from per_store group by 1, 2
  ),
  agg as (
    select company_code, seller,
      count(distinct d) filter (where bills > 0) as work_days,
      sum(bills) as bills, sum(lines) as lines, sum(lines_gt1) as lines_gt1,
      sum(giv) as giv, sum(niv) as niv
    from src group by 1, 2
  )
  select a.company_code::varchar, a.seller::varchar, a.work_days::bigint, a.bills::bigint, a.lines::bigint, a.lines_gt1::bigint,
         coalesce(st.stores, 0)::bigint, a.giv::numeric, a.niv::numeric
  from agg a
  left join st on st.company_code = a.company_code and st.seller = a.seller
  order by 1, 2;
$$;

-- 2) ร้านเครดิต: สรุปรายเซลล์ × เดือน ช่วง [p_from, p_to) สำหรับเซลล์ใน p_keys ('PDC|RCR001', ...)
--    ym = 'YYYY-MM' → stores = Active Store เดือนนั้น (ร้านไม่ซ้ำ ยอด > 0) · repeat_stores = ในนั้นเป็นร้านที่ซื้อเดือนก่อนหน้าด้วย
--                     bills = จำนวนบิล (ขายกี่ครั้งนับเท่านั้น)
--    ym = 'ALL'     → stores = ร้านไม่ซ้ำทั้งช่วง · repeat_stores = ร้านที่ซื้อทุกเดือนในช่วง (ร้านประจำ)
drop function if exists public.credit_summary(text[], date, date);
create or replace function public.credit_summary(p_keys text[], p_from date, p_to date)
returns table (company_code varchar, seller varchar, ym text, stores bigint, repeat_stores bigint,
               giv numeric, niv numeric, bills bigint)
language sql
stable
as $$
  with m as (
    select s.company_code, s.seller, s.cardcode, date_trunc('month', s.d)::date as mth,
           sum(s.giv) as giv, sum(s.niv) as niv, sum(s.bills) as bills
    from public.sales_store_daily s
    join (select split_part(k, '|', 1) as co, split_part(k, '|', 2) as se from unnest(p_keys) k) want
      on s.company_code = want.co and s.seller = want.se
    where s.d >= (date_trunc('month', p_from) - interval '1 month')::date and s.d < p_to
      and s.cardcode <> '-'
    group by 1, 2, 3, 4
  ),
  -- ร้านเดียวกัน เดือนก่อนหน้า (hash join ครั้งเดียว)
  f as (
    select m.company_code, m.seller, m.cardcode, m.mth, m.giv, m.niv, m.bills,
           coalesce(p.giv > 0, false) as rep
    from m
    left join m p on p.company_code = m.company_code and p.seller = m.seller and p.cardcode = m.cardcode
      and p.mth = (m.mth - interval '1 month')::date
    where m.mth >= date_trunc('month', p_from)::date
  ),
  n as (select count(distinct mth) as months from f),
  per_store as (
    select company_code, seller, cardcode, count(*) filter (where giv > 0) as active_months, sum(giv) as giv
    from f group by 1, 2, 3
  ),
  tot as (
    select company_code, seller, sum(giv) as giv, sum(niv) as niv, sum(bills) as bills
    from f group by 1, 2
  ),
  st as (
    select ps.company_code, ps.seller,
      count(*) filter (where ps.giv > 0) as stores,
      count(*) filter (where ps.active_months = n.months and n.months > 0) as regular
    from per_store ps cross join n
    group by 1, 2
  )
  select f.company_code::varchar, f.seller::varchar, to_char(f.mth, 'YYYY-MM'),
    count(*) filter (where f.giv > 0)::bigint, count(*) filter (where f.giv > 0 and f.rep)::bigint,
    sum(f.giv)::numeric, sum(f.niv)::numeric, sum(f.bills)::bigint
  from f group by 1, 2, 3
  union all
  select t.company_code::varchar, t.seller::varchar, 'ALL',
    coalesce(st.stores, 0)::bigint, coalesce(st.regular, 0)::bigint,
    t.giv::numeric, t.niv::numeric, t.bills::bigint
  from tot t
  left join st on st.company_code = t.company_code and st.seller = t.seller
  order by 1, 2, 3;
$$;

-- 3) ร้านของเซลล์คนหนึ่ง รายร้าน × เดือน ช่วง [p_from, p_to) — ดูว่าขายร้านเดิม ๆ ทุกเดือนไหม
drop function if exists public.credit_seller_stores(text, text, date, date);
create or replace function public.credit_seller_stores(p_company text, p_seller text, p_from date, p_to date)
returns table (cardcode varchar, card_name text, ym text, giv numeric, niv numeric, bills bigint)
language sql
stable
as $$
  select s.cardcode::varchar, n.card_name::text, to_char(date_trunc('month', s.d), 'YYYY-MM'),
         sum(s.giv)::numeric, sum(s.niv)::numeric, sum(s.bills)::bigint
  from public.sales_store_daily s
  left join public.store_names n on n.company_code = s.company_code and n.cardcode = s.cardcode
  where s.d >= p_from and s.d < p_to
    and s.company_code = p_company and s.seller = p_seller and s.cardcode <> '-'
  group by 1, 2, 3
  order by 1, 3;
$$;

revoke execute on function public.dashboard_kpi_seller(date, date) from public, anon, authenticated;
revoke execute on function public.credit_summary(text[], date, date) from public, anon, authenticated;
revoke execute on function public.credit_seller_stores(text, text, date, date) from public, anon, authenticated;
grant execute on function public.dashboard_kpi_seller(date, date) to service_role;
grant execute on function public.credit_summary(text[], date, date) to service_role;
grant execute on function public.credit_seller_stores(text, text, date, date) to service_role;

notify pgrst, 'reload schema';
