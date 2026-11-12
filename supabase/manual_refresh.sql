-- RSM Sales Dashboard — ปุ่ม "อัปเดตยอดขายตอนนี้" ในหน้าสถานะระบบ (admin)
-- กดแล้วคำนวณตารางสรุปจาก vw_lg014 ใหม่ทันที (ไม่ต้องรอรอบ 06:30 / 12:30 / 17:30)
-- ช่วงที่คำนวณ = ต้นเดือนก่อน → วันนี้ (เหมือนรอบอัตโนมัติ) · ยอดขายรายเซลล์ / ระดับร้าน / รายสาขา + เพิ่มรหัสเซลล์ใหม่
-- ทำงานเบื้องหลังผ่าน pg_cron (ไม่ติด timeout ของ API) ใช้เวลาราว 1–3 นาที · กดซ้ำระหว่างทำงานจะไม่เริ่มใหม่
-- รันทั้งไฟล์ใน Supabase › SQL Editor ครั้งเดียว (รันซ้ำได้)

-- 1) สถานะการอัปเดตล่าสุด (แถวเดียว) -----------------------------------------------------------
create table if not exists public.manual_refresh (
  id           int primary key default 1,
  status       text not null default 'idle',   -- idle / queued / running / done / failed
  requested_at timestamptz,
  started_at   timestamptz,
  finished_at  timestamptz,
  message      text,
  constraint manual_refresh_one_row check (id = 1)
);
insert into public.manual_refresh (id) values (1) on conflict do nothing;
alter table public.manual_refresh enable row level security;
revoke all on public.manual_refresh from anon, authenticated;
grant select on public.manual_refresh to service_role;

-- 2) งานที่ทำจริง (cron เรียก) — error ก็บันทึกไว้ ไม่ค้าง -------------------------------------------
create or replace function public.manual_refresh_run()
returns void
language plpgsql
as $$
declare
  f date := (date_trunc('month', now() at time zone 'Asia/Bangkok') - interval '1 month')::date;
  t date := (now() at time zone 'Asia/Bangkok')::date + 1;
begin
  update public.manual_refresh set status = 'running', started_at = now(), finished_at = null, message = null where id = 1;
  begin
    perform public.dashboard_refresh(f, t);
    perform public.kpi_refresh(f, t);
    perform public.branch_refresh(f, t);
    if to_regprocedure('public.seller_auto_add(integer)') is not null then
      perform public.seller_auto_add(45);
    end if;
    update public.manual_refresh set status = 'done', finished_at = now(),
      message = format('คำนวณ %s ถึง %s', f, t - 1) where id = 1;
  exception when others then
    update public.manual_refresh set status = 'failed', finished_at = now(), message = sqlerrm where id = 1;
  end;
end;
$$;
revoke execute on function public.manual_refresh_run() from public, anon, authenticated;

-- 3) ปุ่มกด (service_role เรียกผ่าน API) → ตั้ง cron ครั้งเดียว ทำเสร็จแล้วลบตัวเอง ----------------------
--    security definer = ใช้สิทธิ์เจ้าของฟังก์ชัน (postgres) ในการตั้ง cron
create or replace function public.request_refresh()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.manual_refresh;
begin
  select * into st from public.manual_refresh where id = 1;
  -- กำลังทำอยู่ (ไม่เกิน 30 นาที) → ไม่เริ่มซ้ำ
  if st.status in ('queued', 'running') and st.requested_at > now() - interval '30 minutes' then
    return 'busy';
  end if;
  update public.manual_refresh set status = 'queued', requested_at = now(), started_at = null, finished_at = null, message = null where id = 1;
  perform cron.schedule('manual-refresh', '* * * * *',
    'select cron.unschedule(''manual-refresh''); set statement_timeout = 0; select public.manual_refresh_run();');
  return 'queued';
end;
$$;

create or replace function public.manual_refresh_status()
returns setof public.manual_refresh
language sql
stable
as $$ select * from public.manual_refresh where id = 1; $$;

revoke execute on function public.request_refresh() from public, anon, authenticated;
revoke execute on function public.manual_refresh_status() from public, anon, authenticated;
grant execute on function public.request_refresh() to service_role;
grant execute on function public.manual_refresh_status() to service_role;

notify pgrst, 'reload schema';
