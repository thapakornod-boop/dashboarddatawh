-- RSM Sales Dashboard — ยอดขายรายสาขา (RSM / UTH / KKC / RCB / BON / PSL / PTT / SRT / HDY)
-- สาขามาจาก vw_lg014.bplname เช่น "7 RSM (Nakhon Ratchasima)", "1. PDCRSM (Nakhon Ratchasima)", "4. DCHDY (Hat Yai)"
-- กฎ GIV / NIV / series / ของแถม / เซลล์ที่นับ เหมือน dashboard_refresh + dashboard_sales ทุกอย่าง
-- รันทั้งไฟล์ใน Supabase › SQL Editor ครั้งเดียว (รันซ้ำได้)

-- 1) ตารางสรุป: 1 แถว = บริษัท × วัน × สาขา × เซลล์ --------------------------------
create table if not exists public.sales_branch_daily (
  company_code varchar not null,
  d            date    not null,
  branch       varchar not null,
  seller       varchar not null,
  giv          numeric not null default 0,
  niv          numeric not null default 0,
  primary key (company_code, d, branch, seller)
);
create index if not exists sales_branch_daily_d_idx on public.sales_branch_daily (d);
alter table public.sales_branch_daily enable row level security;
revoke all on public.sales_branch_daily from anon, authenticated;
grant select on public.sales_branch_daily to service_role;

-- 2) คำนวณช่วง [p_from, p_to) ใหม่ ----------------------------------------------------
create or replace function public.branch_refresh(p_from date, p_to date)
returns void
language sql
as $$
  delete from public.sales_branch_daily where d >= p_from and d < p_to;

  insert into public.sales_branch_daily (company_code, d, branch, seller, giv, niv)
  select
    company_code,
    document_date::date,
    coalesce(substring(bplname from '([A-Z]{3})\s*\('), '-'),
    trim(seller),
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
  group by 1, 2, 3, 4;
$$;

-- 3) RPC: ยอดช่วง [p_from, p_to) แยก บริษัท × สาขา × principal เฉพาะเซลล์ที่นับยอด --------
drop function if exists public.dashboard_branch(date, date);
create or replace function public.dashboard_branch(p_from date, p_to date)
returns table (company_code varchar, branch varchar, principal text, giv numeric, niv numeric)
language sql
stable
as $$
  with sp as (
    select seller, company_code, string_agg(principal, '/' order by principal) as principal
    from public.seller_principal
    group by seller, company_code
  )
  select s.company_code, s.branch, coalesce(sp.principal, 'P&G'), sum(s.giv), sum(s.niv)
  from public.sales_branch_daily s
  left join sp on sp.seller = s.seller
    and coalesce(sp.company_code, s.company_code) = s.company_code
  where s.d >= p_from and s.d < p_to
    and public.dashboard_counts(s.company_code, s.seller, sp.principal)
  group by 1, 2, 3
  order by 1, 2, 3;
$$;

revoke execute on function public.branch_refresh(date, date) from public, anon, authenticated;
revoke execute on function public.dashboard_branch(date, date) from public, anon, authenticated;
grant execute on function public.dashboard_branch(date, date) to service_role;

-- 4) อัปเดตอัตโนมัติ ตามรอบเดียวกับ refresh_schedule.sql: 06:40 / 12:40 / 17:40 เวลาไทย -------
select cron.unschedule(jobid) from cron.job where jobname in ('branch-refresh', 'branch-backfill');
select cron.schedule('branch-refresh', '40 23,5,10 * * *', $$
  select public.branch_refresh(
    (date_trunc('month', now() at time zone 'Asia/Bangkok') - interval '1 month')::date,
    (now() at time zone 'Asia/Bangkok')::date + 1)
$$);

-- 5) เติมข้อมูลย้อนหลังทีละเดือน (เดือนนี้ → ม.ค. 2 ปีก่อน) นาทีละเดือน แล้วหยุดเอง --------------
create table if not exists public.branch_backfill (id int primary key default 1, next_month date not null);
alter table public.branch_backfill enable row level security;
revoke all on public.branch_backfill from anon, authenticated;
grant select on public.branch_backfill to service_role;
insert into public.branch_backfill (id, next_month)
values (1, date_trunc('month', current_date)::date)
on conflict (id) do update set next_month = excluded.next_month;

create or replace function public.branch_backfill_step()
returns void
language plpgsql
as $$
declare
  m date;
begin
  select next_month into m from public.branch_backfill where id = 1;
  if m < (date_trunc('year', current_date) - interval '2 years')::date then
    perform cron.unschedule('branch-backfill');
    return;
  end if;
  perform public.branch_refresh(m, (m + interval '1 month')::date);
  update public.branch_backfill set next_month = (m - interval '1 month')::date where id = 1;
end;
$$;
revoke execute on function public.branch_backfill_step() from public, anon, authenticated;

select cron.schedule('branch-backfill', '* * * * *', 'select public.branch_backfill_step()');

notify pgrst, 'reload schema';

-- ดูความคืบหน้า: select next_month from public.branch_backfill;  (ต่ำกว่า ม.ค. 2024 = เสร็จ)
