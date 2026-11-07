-- RSM Sales Dashboard — หน้ายอดขายรายร้าน: ยอดรายเดือน (กราฟแนวโน้ม) + วันที่ซื้อล่าสุด
-- กฎ GIV / series / ของแถม / ไม่นับ GSM เหมือน store_sales (princ_store.sql)
-- รันทั้งไฟล์ใน Supabase › SQL Editor (รันซ้ำได้ · ไม่กี่วินาที)

drop function if exists public.store_monthly(text[], date, date);
create or replace function public.store_monthly(p_keys text[], p_from date, p_to date)
returns table (ym text, company_code varchar, giv numeric, niv numeric, bills bigint, last_d date)
language sql
stable
as $$
  select to_char(v.document_date, 'YYYY-MM'),
    v.company_code::varchar,
    sum(
      case
        when coalesce(line_total, 0) = 0 then 0
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
    and trim(v.seller) not ilike '%GSM%'
  group by 1, 2
  order by 1, 2;
$$;

revoke execute on function public.store_monthly(text[], date, date) from public, anon, authenticated;
grant execute on function public.store_monthly(text[], date, date) to service_role;

notify pgrst, 'reload schema';
