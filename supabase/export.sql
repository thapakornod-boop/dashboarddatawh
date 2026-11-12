-- Export Excel "ภาพรวม" (หน้า ยอดขายรายร้าน / ร้านเครดิต)
-- คืน JSON ก้อนเดียว → ไม่ติดขีดจำกัด 1000 แถวต่อครั้งของ PostgREST และไม่ต้องคำนวณซ้ำทีละหน้า
-- เรียกจาก server เท่านั้น (service_role) · รันไฟล์นี้ใน Supabase SQL Editor ครั้งเดียว

-- 1) ทุกร้านในช่วง: ยอดราย ร้าน × เดือน (ไม่รวมเซลล์ GSM เหมือนหน้า ยอดขายรายร้าน) + ชื่อร้าน / RSM code
create or replace function public.store_export(p_from date, p_to date, p_companies text[])
returns json
language sql
stable
as $$
  with m as (
    select s.company_code, s.cardcode, to_char(date_trunc('month', s.d), 'YYYY-MM') as ym,
           sum(s.giv) as giv, sum(s.niv) as niv, sum(s.bills) as bills, max(s.d) as last_d
    from public.sales_store_daily s
    where s.d >= p_from and s.d < p_to
      and s.company_code = any(p_companies)
      and s.seller not ilike '%GSM%' and s.cardcode <> '-'
    group by 1, 2, 3
  ),
  st as (select distinct company_code, cardcode from m),
  rc as (
    select r.company_code, r.cardcode, min(r.rsmcode) as rsmcode
    from public.vw_rsmcode r
    join st on st.company_code = r.company_code and st.cardcode = r.cardcode
    group by 1, 2
  )
  select json_build_object(
    'rows', coalesce((
      select json_agg(json_build_array(m.company_code, m.cardcode, m.ym, round(m.giv, 2), round(m.niv, 2), m.bills, m.last_d))
      from m
    ), '[]'::json),
    'stores', coalesce((
      select json_agg(json_build_array(st.company_code, st.cardcode, rc.rsmcode, n.card_name))
      from st
      left join rc on rc.company_code = st.company_code and rc.cardcode = st.cardcode
      left join public.store_names n on n.company_code = st.company_code and n.cardcode = st.cardcode
    ), '[]'::json)
  );
$$;

-- 2) ร้านของเซลล์เครดิตทุกคน: ยอดราย เซลล์ × ร้าน × เดือน + ชื่อร้าน (p_keys = {"PDC|RCR001", ...})
create or replace function public.credit_export(p_keys text[], p_from date, p_to date)
returns json
language sql
stable
as $$
  with want as (
    select split_part(k, '|', 1) as co, split_part(k, '|', 2) as se from unnest(p_keys) k
  ),
  m as (
    select s.company_code, s.seller, s.cardcode, to_char(date_trunc('month', s.d), 'YYYY-MM') as ym,
           sum(s.giv) as giv, sum(s.bills) as bills
    from public.sales_store_daily s
    join want on s.company_code = want.co and s.seller = want.se
    where s.d >= p_from and s.d < p_to and s.cardcode <> '-'
    group by 1, 2, 3, 4
  ),
  st as (select distinct company_code, cardcode from m)
  select json_build_object(
    'rows', coalesce((
      select json_agg(json_build_array(m.company_code, m.seller, m.cardcode, m.ym, round(m.giv, 2), m.bills))
      from m
    ), '[]'::json),
    'names', coalesce((
      select json_agg(json_build_array(st.company_code, st.cardcode, n.card_name))
      from st
      left join public.store_names n on n.company_code = st.company_code and n.cardcode = st.cardcode
    ), '[]'::json)
  );
$$;

revoke execute on function public.store_export(date, date, text[]) from public, anon, authenticated;
revoke execute on function public.credit_export(text[], date, date) from public, anon, authenticated;
grant execute on function public.store_export(date, date, text[]) to service_role;
grant execute on function public.credit_export(text[], date, date) to service_role;

notify pgrst, 'reload schema';
