-- RSM Sales Dashboard — ให้ GIV ตรงกับรายงานหลังบ้าน (LineAmtBeforeDisc ตาม SO Seller)
-- เทียบ PDC ต.ค. 2026 แล้วต่างกันอยู่ 2 เรื่อง:
--   1. คูปองส่วนลด (เช่น FNT-CT00020 "คูปองส่วนลด คาร์เนชั่น 20บาท") ยอดสุทธิ 0 แต่หลังบ้านนับมูลค่าคูปองเป็น GIV
--      → นับ (ของแถมอื่นที่ยอดสุทธิ 0 เช่นชุด Power up ยังเป็น 0 เหมือนเดิม เพราะหลังบ้านไม่นับ — เทียบ ก.ย. แล้ว)
--   2. เอกสารพิเศษที่หลังบ้านไม่นับ (เช่นใบลดหนี้แก้ bug ที่ออกบิลประกบไว้แล้ว) → ใส่เลขเอกสารในตาราง doc_exclude
--      ตาราง doc_exclude ใช้ทุกจุดที่คิดยอด (ภาพรวม / Scorecard / รายสาขา / รายร้าน / ร้านเครดิต)
-- รันทั้งไฟล์ใน Supabase › SQL Editor ครั้งเดียว (รันซ้ำได้) — แล้วระบบคำนวณย้อนหลังใหม่ทีละเดือนเอง (นาทีละเดือน)

-- 0) เอกสารที่ไม่นับยอด ---------------------------------------------------------------------
create table if not exists public.doc_exclude (
  company_code varchar not null,
  series       varchar not null,
  document_no  bigint  not null,
  note         text,
  added_at     timestamptz not null default now(),
  primary key (company_code, series, document_no)
);
alter table public.doc_exclude enable row level security;
revoke all on public.doc_exclude from anon, authenticated;
grant select on public.doc_exclude to service_role;

insert into public.doc_exclude (company_code, series, document_no, note) values
  ('PDC', 'KK-RFC', 411002512, 'KKCC01 8 ต.ค. 2026 · ใบลดหนี้อ้างอิงส่วนลดผิด (bug log 05397) ออกบิล KK-SI 481487716 ประกบแล้ว · หลังบ้านไม่นับ')
on conflict do nothing;

-- 1) ฟังก์ชันคิดยอดทุกตัว: คูปองนับ GIV + ไม่นับเอกสารใน doc_exclude ---------------------------
-- dashboard_refresh
create or replace function public.dashboard_refresh(p_from date, p_to date)
returns void
language sql
as $$
  delete from public.sales_summary_daily where d >= p_from and d < p_to;

  insert into public.sales_summary_daily (company_code, seller, d, giv, niv, lines, bills)
  select
    company_code,
    trim(seller),
    document_date::date,
    sum(
      case
        when coalesce(line_total, 0) = 0 and coalesce(dscription, '') not like '%คูปอง%' then 0   -- ของแถม = 0 · คูปองส่วนลดนับ (เหมือนหลังบ้าน)
        when company_code = 'SDO' then
          (case when doc_type ilike '%credit%' then -1 else 1 end)
          * greatest(
              abs(coalesce(line_total, 0) + coalesce(total_disc, 0)),
              round(abs(coalesce(quantity, 0) * coalesce(price_bef_di, 0)), 2)
            )
        else coalesce(line_total, 0) + coalesce(total_disc, 0)
      end
    ),
    sum(coalesce(line_total, 0)),
    count(*) filter (where doc_type not ilike '%credit%'),
    count(distinct (doc_type, series, document_no)) filter (where doc_type not ilike '%credit%')
  from public.vw_lg014
  where company_code = any (array['SDO', 'PDC', 'DC'])
    and document_date >= p_from
    and document_date < p_to
    and series not like '%CMP'
    and series not like '%DMP'
    and series not like '%-VAT'
    and not exists (select 1 from public.doc_exclude x where x.company_code = vw_lg014.company_code and x.series = vw_lg014.series and x.document_no = vw_lg014.document_no)
  group by 1, 2, 3;
$$;

-- kpi_refresh
create or replace function public.kpi_refresh(p_from date, p_to date)
returns void
language sql
as $$
  delete from public.sales_store_daily where d >= p_from and d < p_to;

  insert into public.sales_store_daily
    (company_code, d, seller, cardcode, giv, niv, giv_ex_rfcca, bills, lines, lines_gt1)
  select
    company_code,
    document_date::date,
    trim(seller),
    coalesce(nullif(trim(cardcode), ''), '-'),
    sum(g.giv),
    sum(coalesce(line_total, 0)),
    coalesce(sum(g.giv) filter (where series not like '%RFCCA%'), 0),
    count(distinct (doc_type, series, document_no)) filter (where doc_type not ilike '%credit%'),
    count(*) filter (where doc_type not ilike '%credit%'),
    count(*) filter (where doc_type not ilike '%credit%' and coalesce(line_total, 0) > 1)
  from public.vw_lg014
  cross join lateral (
    select case
      when coalesce(line_total, 0) = 0 and coalesce(dscription, '') not like '%คูปอง%' then 0   -- ของแถม = 0 · คูปองส่วนลดนับ (เหมือนหลังบ้าน)
      when company_code = 'SDO' then
        (case when doc_type ilike '%credit%' then -1 else 1 end)
        * greatest(
            abs(coalesce(line_total, 0) + coalesce(total_disc, 0)),
            round(abs(coalesce(quantity, 0) * coalesce(price_bef_di, 0)), 2)
          )
      else coalesce(line_total, 0) + coalesce(total_disc, 0)
    end as giv
  ) g
  where company_code = any (array['SDO', 'PDC', 'DC'])
    and document_date >= p_from
    and document_date < p_to
    and series not like '%CMP'
    and series not like '%DMP'
    and series not like '%-VAT'
    and not exists (select 1 from public.doc_exclude x where x.company_code = vw_lg014.company_code and x.series = vw_lg014.series and x.document_no = vw_lg014.document_no)
  group by 1, 2, 3, 4;
$$;

-- branch_refresh
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
        when coalesce(line_total, 0) = 0 and coalesce(dscription, '') not like '%คูปอง%' then 0   -- ของแถม = 0 · คูปองส่วนลดนับ (เหมือนหลังบ้าน)
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
    and not exists (select 1 from public.doc_exclude x where x.company_code = vw_lg014.company_code and x.series = vw_lg014.series and x.document_no = vw_lg014.document_no)
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

-- store_sales
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
      and not exists (select 1 from public.doc_exclude x where x.company_code = v.company_code and x.series = v.series and x.document_no = v.document_no)
  )
  select l.company_code::varchar, l.cardcode::varchar,
    (case
      when l.company_code = 'SDO' then 'P&G'
      when l.pfx = any (sp.ps) then l.pfx
      else coalesce(sp.ps[1], l.pfx)   -- เซลล์ไม่อยู่ใน seller_principal → ใช้หัวรหัสสินค้า
    end)::text,
    sum(
      case
        when coalesce(line_total, 0) = 0 and coalesce(dscription, '') not like '%คูปอง%' then 0   -- ของแถม = 0 · คูปองส่วนลดนับ (เหมือนหลังบ้าน)
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

-- store_monthly
create or replace function public.store_monthly(p_keys text[], p_from date, p_to date)
returns table (ym text, company_code varchar, giv numeric, niv numeric, bills bigint, last_d date)
language sql
stable
as $$
  select to_char(v.document_date, 'YYYY-MM'),
    v.company_code::varchar,
    sum(
      case
        when coalesce(line_total, 0) = 0 and coalesce(dscription, '') not like '%คูปอง%' then 0   -- ของแถม = 0 · คูปองส่วนลดนับ (เหมือนหลังบ้าน)
        when v.company_code = 'SDO' then
          (case when doc_type ilike '%credit%' then -1 else 1 end)
          * greatest(
              abs(coalesce(line_total, 0) + coalesce(total_disc, 0)),
              round(abs(coalesce(quantity, 0) * coalesce(price_bef_di, 0)), 2)
            )
        else coalesce(line_total, 0) + coalesce(total_disc, 0)
      end
    )::numeric,
    sum(coalesce(line_total, 0))::numeric,
    count(distinct (doc_type, series, document_no)) filter (where doc_type not ilike '%credit%'),
    (max(v.document_date) filter (where doc_type not ilike '%credit%'))::date
  from public.vw_lg014 v
  where v.cardcode = any (array(select split_part(k, '|', 2) from unnest(p_keys) k))
    and v.company_code || '|' || v.cardcode = any (p_keys)
    and v.document_date >= p_from
    and v.document_date < p_to
    and v.series not like '%CMP'
    and v.series not like '%DMP'
    and v.series not like '%-VAT'
    and not exists (select 1 from public.doc_exclude x where x.company_code = v.company_code and x.series = v.series and x.document_no = v.document_no)
    and trim(v.seller) not ilike '%GSM%'
  group by 1, 2
  order by 1, 2;
$$;


-- 2) คำนวณย้อนหลังใหม่ทั้งหมด (เดือนนี้ → ย้อนหลัง) นาทีละเดือน แล้ว job หยุดเอง ---------------------
update public.dashboard_backfill set next_month = date_trunc('month', current_date)::date where id = 1;
update public.kpi_backfill       set next_month = date_trunc('month', current_date)::date where id = 1;
update public.branch_backfill    set next_month = date_trunc('month', current_date)::date where id = 1;
select cron.unschedule(jobid) from cron.job where jobname in ('dashboard-backfill', 'kpi-backfill', 'branch-backfill');
select cron.schedule('dashboard-backfill', '* * * * *', 'select public.dashboard_backfill_step()');
select cron.schedule('kpi-backfill',       '* * * * *', 'select public.kpi_backfill_step()');
select cron.schedule('branch-backfill',    '* * * * *', 'select public.branch_backfill_step()');

notify pgrst, 'reload schema';

-- ดูความคืบหน้าได้ที่หน้า "สถานะระบบ" (การ์ดคำนวณย้อนหลัง) · เดือนปัจจุบันกับเดือนก่อนเสร็จใน ~2 นาทีแรก
-- เพิ่มเอกสารที่ไม่นับทีหลัง: insert into public.doc_exclude (company_code, series, document_no, note) values ('PDC','KK-RFC',411002512,'เหตุผล');
--   แล้วกดปุ่ม "อัปเดตยอดขายตอนนี้" ในหน้าสถานะระบบ (หรือรอรอบอัปเดตถัดไป)
