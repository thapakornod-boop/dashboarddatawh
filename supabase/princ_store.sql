-- RSM Sales Dashboard — ยอดขาย สาขา × Princ (หน้ายอดขายรายทีม) + ค้นหายอดขายรายร้าน (หน้ายอดขายรายร้าน)
-- ต้องรัน branch_sales.sql มาก่อนแล้ว  · รันทั้งไฟล์ใน Supabase › SQL Editor ครั้งเดียว (รันซ้ำได้)
--
-- Princ ของแต่ละบรรทัด (PDC / DC): ดูจากหัวรหัสสินค้า เช่น "FNT-1113023" → FNT
--   ถ้าหัวรหัสไม่ใช่ princ ของเซลล์คนนั้น (เช่นของแถม F1MAS028) → ใช้ princ แรกของเซลล์ใน seller_principal
--   SDO = P&G ทั้งหมด

-- 1) sales_branch_daily: เพิ่มหัวรหัสสินค้า (แยก princ ของเซลล์ที่ขายหลาย princ) ----------------
alter table public.sales_branch_daily add column if not exists item_prefix varchar not null default '';
alter table public.sales_branch_daily drop constraint if exists sales_branch_daily_pkey;
alter table public.sales_branch_daily add primary key (company_code, d, branch, seller, item_prefix);

-- 2) รายชื่อร้านค้า (ไว้ค้นด้วยชื่อ) — ชื่อล่าสุดของแต่ละ cardcode ---------------------------------
create table if not exists public.store_names (
  company_code varchar not null,
  cardcode     varchar not null,
  card_name    text,
  last_d       date    not null,
  primary key (company_code, cardcode)
);
create index if not exists store_names_cardcode_idx on public.store_names (cardcode);
alter table public.store_names enable row level security;
revoke all on public.store_names from anon, authenticated;
grant select on public.store_names to service_role;

-- 3) branch_refresh: เก็บหัวรหัสสินค้า + อัปเดตรายชื่อร้าน ------------------------------------
create or replace function public.branch_refresh(p_from date, p_to date)
returns void
language sql
as $$
  delete from public.sales_branch_daily where d >= p_from and d < p_to;

  insert into public.sales_branch_daily (company_code, d, branch, seller, item_prefix, giv, niv)
  select
    company_code,
    document_date::date,
    coalesce(substring(bplname from '([A-Z]{3})\s*\('), '-'),
    trim(seller),
    case when company_code = 'SDO' then '' else upper(split_part(trim(item_code), '-', 1)) end,
    sum(
      case
        when coalesce(line_total, 0) = 0 then 0   -- ของแถม
        when company_code = 'SDO' then
          (case when doc_type ilike '%credit%' then -1 else 1 end)
          * greatest(
              abs(coalesce(line_total, 0) + coalesce(total_disc, 0)),
              round(abs(coalesce(quantity, 0) * coalesce(price_bef_di, 0)), 2)
            )
        else coalesce(line_total, 0) + coalesce(total_disc, 0)
      end
    ),
    sum(coalesce(line_total, 0))
  from public.vw_lg014
  where company_code = any (array['SDO', 'PDC', 'DC'])
    and document_date >= p_from
    and document_date < p_to
    and series not like '%CMP'
    and series not like '%DMP'
    and series not like '%-VAT'
  group by 1, 2, 3, 4, 5;

  insert into public.store_names (company_code, cardcode, card_name, last_d)
  select distinct on (company_code, trim(cardcode))
    company_code, trim(cardcode), trim(card_name), document_date::date
  from public.vw_lg014
  where company_code = any (array['SDO', 'PDC', 'DC'])
    and document_date >= p_from
    and document_date < p_to
    and coalesce(trim(cardcode), '') <> ''
  order by company_code, trim(cardcode), document_date desc
  on conflict (company_code, cardcode) do update
    set card_name = excluded.card_name, last_d = excluded.last_d
    where public.store_names.last_d <= excluded.last_d;
$$;

-- 4) RPC: ยอด GIV / NIV ราย บริษัท × สาขา × เซลล์ × princ (เฉพาะเซลล์ที่นับยอด) --------------------
drop function if exists public.dashboard_branch_princ(date, date);
create or replace function public.dashboard_branch_princ(p_from date, p_to date)
returns table (company_code varchar, branch varchar, seller varchar, principal text, giv numeric, niv numeric)
language sql
stable
as $$
  with sp as (
    select seller, company_code, array_agg(principal order by principal) as ps
    from public.seller_principal
    group by seller, company_code
  )
  select s.company_code::varchar, s.branch::varchar, s.seller::varchar,
    (case
      when s.company_code = 'SDO' then 'P&G'
      when s.item_prefix = any (sp.ps) then s.item_prefix
      else sp.ps[1]
    end)::text,
    sum(s.giv)::numeric, sum(s.niv)::numeric
  from public.sales_branch_daily s
  left join sp on sp.seller = s.seller
    and coalesce(sp.company_code, s.company_code) = s.company_code
  where s.d >= p_from and s.d < p_to
    and public.dashboard_counts(s.company_code, s.seller, sp.ps[1])
  group by 1, 2, 3, 4
  order by 1, 2, 3, 4;
$$;

-- 5) ค้นหายอดรายร้าน: อ่านจาก vw_lg014 ตรง ๆ ตามรหัสร้าน (สดตามข้อมูลล่าสุด) ---------------------
--    ต้องมี index ตาม cardcode ไม่งั้นค้นทีละร้านก็เกินเวลา (vw_lg014 ~10 ล้านแถว)
--    สร้าง index นานเกิน timeout ของ SQL Editor → ให้ pg_cron สร้างเบื้องหลัง (ไม่จำกัดเวลา) เสร็จแล้วลบ job ตัวเอง
select cron.unschedule(jobid) from cron.job where jobname = 'make-cardcode-idx';
select cron.schedule('make-cardcode-idx', '* * * * *', $$
  set statement_timeout = 0;
  create index if not exists vw_lg014_cardcode_date_idx on public.vw_lg014 (cardcode, document_date);
  select cron.unschedule('make-cardcode-idx');
$$);

-- ค้นร้าน: รหัสร้าน / RSM code / ชื่อร้าน → รายการร้าน (สูงสุด 60 ร้าน)
drop function if exists public.store_search(text);
create or replace function public.store_search(p_q text)
returns table (rsmcode varchar, company_code varchar, cardcode varchar, card_name text)
language sql
stable
as $$
  with q as (select trim(p_q) as q),
  hit as (
    select n.company_code, n.cardcode from public.store_names n, q
      where n.cardcode ilike q.q || '%' or n.card_name ilike '%' || q.q || '%'
    union
    select r.company_code, r.cardcode from public.vw_rsmcode r, q
      where r.rsmcode ilike q.q || '%' or r.cardcode ilike q.q || '%'
  ),
  -- ร้านที่มี RSM code เดียวกัน = ร้านเดียวกันในบริษัทอื่น ดึงมาด้วย
  grp as (
    select distinct r.rsmcode from hit join public.vw_rsmcode r
      on r.company_code = hit.company_code and r.cardcode = hit.cardcode
  ),
  allc as (
    select company_code, cardcode from hit
    union
    select r.company_code, r.cardcode from grp join public.vw_rsmcode r on r.rsmcode = grp.rsmcode
  )
  select (select min(r.rsmcode) from public.vw_rsmcode r where r.company_code = a.company_code and r.cardcode = a.cardcode)::varchar,
         a.company_code::varchar, a.cardcode::varchar, n.card_name::text
  from allc a
  left join public.store_names n on n.company_code = a.company_code and n.cardcode = a.cardcode
  where length(trim(p_q)) >= 2
  order by 1 nulls last, 2, 3
  limit 60;
$$;

-- ยอดของร้านที่เลือก (p_keys = 'SDO|10100004' ...) ช่วง [p_from, p_to) ราย บริษัท × ร้าน × princ
drop function if exists public.store_sales(text[], date, date);
create or replace function public.store_sales(p_keys text[], p_from date, p_to date)
returns table (company_code varchar, cardcode varchar, principal text, giv numeric, niv numeric, bills bigint)
language sql
stable
as $$
  with sp as (
    select seller, company_code, array_agg(principal order by principal) as ps
    from public.seller_principal
    group by seller, company_code
  ),
  l as (
    select v.*, trim(v.seller) as s, upper(split_part(trim(v.item_code), '-', 1)) as pfx
    from public.vw_lg014 v
    where v.cardcode = any (array(select split_part(k, '|', 2) from unnest(p_keys) k))
      and v.company_code || '|' || v.cardcode = any (p_keys)
      and v.document_date >= p_from
      and v.document_date < p_to
      and v.series not like '%CMP'
      and v.series not like '%DMP'
      and v.series not like '%-VAT'
  )
  select l.company_code::varchar, l.cardcode::varchar,
    (case
      when l.company_code = 'SDO' then 'P&G'
      when l.pfx = any (sp.ps) then l.pfx
      else coalesce(sp.ps[1], l.pfx)   -- เซลล์ไม่อยู่ใน seller_principal → ใช้หัวรหัสสินค้า
    end)::text,
    sum(
      case
        when coalesce(line_total, 0) = 0 then 0
        when l.company_code = 'SDO' then
          (case when doc_type ilike '%credit%' then -1 else 1 end)
          * greatest(
              abs(coalesce(line_total, 0) + coalesce(total_disc, 0)),
              round(abs(coalesce(quantity, 0) * coalesce(price_bef_di, 0)), 2)
            )
        else coalesce(line_total, 0) + coalesce(total_disc, 0)
      end
    )::numeric,
    sum(coalesce(line_total, 0))::numeric,
    count(distinct (doc_type, series, document_no)) filter (where doc_type not ilike '%credit%')
  from l
  left join sp on sp.seller = l.s
    and coalesce(sp.company_code, l.company_code) = l.company_code
  where l.s not ilike '%GSM%'   -- ยอดรายร้าน: ทุกเซลล์ใน vw_lg014 ยกเว้น GSM (ไม่จำกัดตาม seller_principal)
  group by 1, 2, 3
  order by 1, 2, 3;
$$;

revoke execute on function public.dashboard_branch_princ(date, date) from public, anon, authenticated;
revoke execute on function public.store_search(text) from public, anon, authenticated;
revoke execute on function public.store_sales(text[], date, date) from public, anon, authenticated;
grant execute on function public.dashboard_branch_princ(date, date) to service_role;
grant execute on function public.store_search(text) to service_role;
grant execute on function public.store_sales(text[], date, date) to service_role;

-- 6) คำนวณย้อนหลังใหม่ทั้งหมด (เดือนนี้ → ม.ค. 2 ปีก่อน นาทีละเดือน แล้วหยุดเอง) -----------------
update public.branch_backfill set next_month = date_trunc('month', current_date)::date where id = 1;
select cron.unschedule(jobid) from cron.job where jobname = 'branch-backfill';
select cron.schedule('branch-backfill', '* * * * *', 'select public.branch_backfill_step()');

notify pgrst, 'reload schema';

-- ดูความคืบหน้า: select next_month from public.branch_backfill;  (ต่ำกว่า ม.ค. 2024 = เสร็จ)
--                select indexname from pg_indexes where indexname = 'vw_lg014_cardcode_date_idx';  (มีแถว = index เสร็จ)
