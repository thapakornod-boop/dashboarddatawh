-- RSM Sales Dashboard — หน้ายอดขายรายร้าน: คำแนะนำตอนพิมพ์ค้นหา + ร้านตัวอย่าง
-- ต้องรัน princ_store.sql มาก่อนแล้ว · รันทั้งไฟล์ใน Supabase › SQL Editor (รันซ้ำได้ · ใช้เวลาไม่กี่วินาที)

-- 1) index ค้นแบบ "มีคำนี้อยู่ตรงไหนก็ได้" (ilike '%คำ%') ให้เร็วพอสำหรับพิมพ์แล้วขึ้นทันที -----------
create extension if not exists pg_trgm with schema extensions;
create index if not exists store_names_name_trgm on public.store_names using gin (card_name extensions.gin_trgm_ops);
create index if not exists store_names_code_trgm on public.store_names using gin (cardcode extensions.gin_trgm_ops);

-- vw_rsmcode (~4 แสนแถว): ทำ index ได้เฉพาะถ้าเป็นตาราง (ถ้าเป็น view ข้ามไป — ยังใช้ได้แค่ช้ากว่า)
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'vw_rsmcode' and c.relkind in ('r', 'p', 'm')) then
    execute 'create index if not exists vw_rsmcode_rsm_trgm on public.vw_rsmcode using gin (rsmcode extensions.gin_trgm_ops)';
    execute 'create index if not exists vw_rsmcode_card_trgm on public.vw_rsmcode using gin (cardcode extensions.gin_trgm_ops)';
    execute 'create index if not exists vw_rsmcode_key on public.vw_rsmcode (company_code, cardcode)';
    execute 'create index if not exists vw_rsmcode_rsm on public.vw_rsmcode (rsmcode)';
  end if;
end $$;

-- 2) คำแนะนำตอนพิมพ์: สูงสุด 10 ร้าน — รหัสที่ขึ้นต้นด้วยคำค้นมาก่อน แล้วค่อยชื่อร้าน ------------------
drop function if exists public.store_suggest(text);
create or replace function public.store_suggest(p_q text)
returns table (rsmcode varchar, company_code varchar, cardcode varchar, card_name text)
language sql
stable
as $$
  with q as (select trim(p_q) as q),
  hit as (
    (select 1 as pri, n.company_code, n.cardcode from public.store_names n, q
      where n.cardcode ilike q.q || '%' limit 10)
    union all
    (select 1, r.company_code, r.cardcode from public.vw_rsmcode r, q
      where r.rsmcode ilike q.q || '%' limit 10)
    union all
    (select 2, n.company_code, n.cardcode from public.store_names n, q
      where n.card_name ilike '%' || q.q || '%' order by n.last_d desc limit 10)
  ),
  best as (
    select distinct on (company_code, cardcode) pri, company_code, cardcode
    from hit order by company_code, cardcode, pri
  )
  select (select min(r.rsmcode) from public.vw_rsmcode r where r.company_code = b.company_code and r.cardcode = b.cardcode)::varchar,
         b.company_code::varchar, b.cardcode::varchar, n.card_name::text
  from best b
  left join public.store_names n on n.company_code = b.company_code and n.cardcode = b.cardcode
  where length(trim(p_q)) >= 2
  order by b.pri, n.last_d desc nulls last
  limit 10;
$$;

-- 3) ร้านตัวอย่าง: ร้านยอด GIV สูงสุดของวันที่ระบุ (ตารางสรุป sales_store_daily) --------------------
drop function if exists public.store_top(date, int);
create or replace function public.store_top(p_d date, p_limit int default 8)
returns table (rsmcode varchar, company_code varchar, cardcode varchar, card_name text, giv numeric)
language sql
stable
as $$
  with t as (
    select s.company_code, s.cardcode, sum(s.giv) as giv
    from public.sales_store_daily s
    where s.d = p_d and s.seller not ilike '%GSM%' and s.cardcode <> '-'
    group by 1, 2
    order by 3 desc
    limit p_limit
  )
  select (select min(r.rsmcode) from public.vw_rsmcode r where r.company_code = t.company_code and r.cardcode = t.cardcode)::varchar,
         t.company_code::varchar, t.cardcode::varchar, n.card_name::text, t.giv::numeric
  from t
  left join public.store_names n on n.company_code = t.company_code and n.cardcode = t.cardcode
  order by t.giv desc;
$$;

revoke execute on function public.store_suggest(text) from public, anon, authenticated;
revoke execute on function public.store_top(date, int) from public, anon, authenticated;
grant execute on function public.store_suggest(text) to service_role;
grant execute on function public.store_top(date, int) to service_role;

notify pgrst, 'reload schema';
