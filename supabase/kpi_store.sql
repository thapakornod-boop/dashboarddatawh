-- RSM Sales Dashboard — ตารางสรุประดับร้านค้า สำหรับ Scorecard
-- (Active Stores / วันทำงานจริงจากวันที่ Invoice / Line ที่ยอด > 1 บาท)
-- รันทั้งไฟล์ใน Supabase › SQL Editor ครั้งเดียว (รันซ้ำได้)
-- ไม่แก้ตาราง / ฟังก์ชันเดิมของ dashboard (sales_summary_daily, dashboard_refresh ฯลฯ)

-- 1) ตารางสรุป: 1 แถว = บริษัท × วัน × เซลล์ × ร้านค้า --------------------------
create table if not exists public.sales_store_daily (
  company_code varchar not null,
  d            date    not null,
  seller       varchar not null,
  cardcode     varchar not null,
  giv          numeric not null default 0,
  niv          numeric not null default 0,
  giv_ex_rfcca numeric not null default 0,   -- GIV ไม่รวม series RS-RFCCA (นิยาม Active Stores ของ PDC / DC)
  bills        int     not null default 0,   -- จำนวนบิลขาย (ไม่รวมใบลดหนี้)
  lines        int     not null default 0,   -- จำนวนบรรทัดขาย
  lines_gt1    int     not null default 0,   -- จำนวนบรรทัดขายที่ยอด > 1 บาท (Line/Bill ของ PDC / DC)
  primary key (company_code, d, seller, cardcode)
);
-- ค้นตามช่วงวันที่ (dashboard_kpi) — ไม่มี index นี้จะอ่านทั้งตารางทุกครั้งจนเกิน statement timeout
create index if not exists sales_store_daily_d_idx on public.sales_store_daily (d, company_code);
alter table public.sales_store_daily enable row level security;
revoke all on public.sales_store_daily from anon, authenticated;
grant select on public.sales_store_daily to service_role;

-- 2) คำนวณช่วง [p_from, p_to) ใหม่ — กฎ GIV / NIV / series เดียวกับ dashboard_refresh -----
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

-- 3) RPC: ตัวชี้วัดรายบริษัทของช่วง [p_from, p_to) เฉพาะเซลล์ที่นับยอด (กฎเดียวกับ dashboard_sales) ----
--   active_stores : ร้านที่ยอดรวมในช่วง > 0 (PDC / DC ไม่นับ series RS-RFCCA)
--   work_days     : จำนวนวันที่มี Invoice (count distinct วันที่)
drop function if exists public.dashboard_kpi(date, date);
create or replace function public.dashboard_kpi(p_from date, p_to date)
returns table (company_code varchar, active_stores bigint, work_days bigint, bills bigint, lines bigint, lines_gt1 bigint)
language sql
stable
as $$
  with sp as (
    select seller, company_code, min(principal) as principal
    from public.seller_principal
    group by seller, company_code
  ),
  src as (
    select s.*
    from public.sales_store_daily s
    left join sp on sp.seller = s.seller
      and coalesce(sp.company_code, s.company_code) = s.company_code
    where s.d >= p_from and s.d < p_to
      and public.dashboard_counts(s.company_code, s.seller, sp.principal)
  ),
  stores as (
    select company_code, cardcode,
           sum(case when company_code = 'SDO' then giv else giv_ex_rfcca end) as sales
    from src
    group by 1, 2
  )
  select
    c.company_code,
    (select count(*) from stores st where st.company_code = c.company_code and st.sales > 0),
    count(distinct c.d),
    sum(c.bills),
    sum(c.lines),
    sum(c.lines_gt1)
  from src c
  group by c.company_code
  order by 1;
$$;

revoke execute on function public.kpi_refresh(date, date) from public, anon, authenticated;
revoke execute on function public.dashboard_kpi(date, date) from public, anon, authenticated;
grant execute on function public.dashboard_kpi(date, date) to service_role;

-- 4) อัปเดตอัตโนมัติ: รอบเวลาอยู่ใน refresh_schedule.sql (06:35 / 12:35 / 17:35 เวลาไทย) ----------
select cron.unschedule(jobid) from cron.job where jobname in ('kpi-backfill');

-- 5) เติมข้อมูลย้อนหลังทีละเดือน (เดือนปัจจุบัน → ม.ค. ปีที่แล้ว) นาทีละเดือน แล้วหยุดเอง --------
create table if not exists public.kpi_backfill (id int primary key default 1, next_month date not null);
alter table public.kpi_backfill enable row level security;
revoke all on public.kpi_backfill from anon, authenticated;
grant select on public.kpi_backfill to service_role;
insert into public.kpi_backfill (id, next_month)
values (1, date_trunc('month', current_date)::date)
on conflict (id) do update set next_month = excluded.next_month;

create or replace function public.kpi_backfill_step()
returns void
language plpgsql
as $$
declare
  m date;
begin
  select next_month into m from public.kpi_backfill where id = 1;
  if m < (date_trunc('year', current_date) - interval '1 year')::date then
    perform cron.unschedule('kpi-backfill');
    return;
  end if;
  perform public.kpi_refresh(m, (m + interval '1 month')::date);
  update public.kpi_backfill set next_month = (m - interval '1 month')::date where id = 1;
end;
$$;
revoke execute on function public.kpi_backfill_step() from public, anon, authenticated;

select cron.schedule('kpi-backfill', '* * * * *', 'select public.kpi_backfill_step()');

notify pgrst, 'reload schema';

-- ดูความคืบหน้า: select next_month from public.kpi_backfill;  (ต่ำกว่า ม.ค. ปีที่แล้ว = เสร็จ)
