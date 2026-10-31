-- RSM Sales Dashboard — ของแถม (NIV = line_total = 0) ไม่นับ GIV
-- เดิม PDC / DC คิด GIV = line_total + total_disc → ของแถมที่ลด 100% ได้ GIV เท่าราคาเต็ม
-- (เช่น 4A01 ก.ย. 2026 ชุด Power up / สินค้าฟรี รวม 704,814 บาท) ซึ่งหลังบ้านไม่นับ
-- รันทั้งไฟล์ใน Supabase › SQL Editor ครั้งเดียว — แล้วระบบจะคำนวณย้อนหลังใหม่ทีละเดือนเอง

-- 1) ตารางสรุปหน้าภาพรวม ------------------------------------------------------------
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
  group by 1, 2, 3;
$$;

-- 2) ตารางสรุประดับร้านค้า (Scorecard) ------------------------------------------------
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
      when coalesce(line_total, 0) = 0 then 0   -- ของแถม
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
  group by 1, 2, 3, 4;
$$;

-- 3) คำนวณย้อนหลังใหม่ทั้งหมด: นาทีละเดือน (เดือนนี้ → ย้อนหลัง) แล้ว job หยุดเอง ---------------
update public.dashboard_backfill set next_month = date_trunc('month', current_date)::date where id = 1;
update public.kpi_backfill       set next_month = date_trunc('month', current_date)::date where id = 1;
select cron.unschedule(jobid) from cron.job where jobname in ('dashboard-backfill', 'kpi-backfill');
select cron.schedule('dashboard-backfill', '* * * * *', 'select public.dashboard_backfill_step()');
select cron.schedule('kpi-backfill',       '* * * * *', 'select public.kpi_backfill_step()');

-- ดูความคืบหน้า: select (select next_month from public.dashboard_backfill) as summary,
--                       (select next_month from public.kpi_backfill) as kpi;
