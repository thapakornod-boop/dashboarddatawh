-- RSM Sales Dashboard — ความปลอดภัยการเข้าสู่ระบบ + หน้าสถานะระบบ
-- รันทั้งไฟล์ใน Supabase › SQL Editor (รันซ้ำได้)
--
-- 1) เลขบัตรประชาชนเก็บแบบ hash (bcrypt) ในคอลัมน์ id_hash — เว็บตรวจรหัสผ่านจาก hash เท่านั้น
-- 2) นับการกรอกผิดในฐานข้อมูล (ไม่หายเมื่อเซิร์ฟเวอร์รีสตาร์ต): ต่อรหัสพนักงาน 5 ครั้ง / ต่อ IP 20 ครั้ง ใน 10 นาที
-- 3) RPC สถานะรอบอัปเดต (pg_cron) + ความคืบหน้าคำนวณย้อนหลัง สำหรับหน้า "สถานะระบบ"

create extension if not exists pgcrypto with schema extensions;

-- 1) hash เลขบัตร ---------------------------------------------------------------
alter table public.employees add column if not exists id_hash text;

-- เติม hash ให้ทุกแถวที่ยังไม่มี (bcrypt cost 10 · ~1,300 แถวใช้ไม่กี่วินาที)
update public.employees
set id_hash = extensions.crypt(id_card, extensions.gen_salt('bf', 10))
where id_hash is null and id_card is not null;

-- import จาก HR (เขียน id_card มา) → ทำ hash ให้อัตโนมัติ
create or replace function public.employees_hash_id()
returns trigger language plpgsql as $$
begin
  if new.id_card is not null and (tg_op = 'INSERT' or new.id_card is distinct from old.id_card) then
    new.id_hash := extensions.crypt(new.id_card, extensions.gen_salt('bf', 10));
  end if;
  return new;
end $$;
drop trigger if exists employees_hash_id on public.employees;
create trigger employees_hash_id
  before insert or update on public.employees
  for each row execute function public.employees_hash_id();

-- 2) บันทึกการเข้าสู่ระบบที่ผิด ---------------------------------------------------------
create table if not exists public.login_attempts (
  id    bigserial primary key,
  code  text not null,
  ip    text not null default '',
  at    timestamptz not null default now()
);
create index if not exists login_attempts_code_idx on public.login_attempts (code, at);
create index if not exists login_attempts_ip_idx on public.login_attempts (ip, at);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;
grant select, insert, delete on public.login_attempts to service_role;
grant usage on sequence public.login_attempts_id_seq to service_role;

-- ตรวจรหัสพนักงาน + เลขบัตร ในฐานข้อมูลครั้งเดียว (ไม่ส่ง hash ออกไปไหน)
--   status: ok / bad (ผิด) / locked (ผิดเกินกำหนด รอ 10 นาที) / inactive (ถูกปิดสิทธิ์)
drop function if exists public.employee_login(text, text, text);
create or replace function public.employee_login(p_code text, p_id text, p_ip text)
returns table (status text, code text, full_name text)
language plpgsql
as $$
declare
  e record;
begin
  delete from public.login_attempts where at < now() - interval '1 day';

  if (select count(*) from public.login_attempts a where a.code = p_code and a.at > now() - interval '10 minutes') >= 5
     or (coalesce(p_ip, '') <> '' and
         (select count(*) from public.login_attempts a where a.ip = p_ip and a.at > now() - interval '10 minutes') >= 20) then
    return query select 'locked'::text, null::text, null::text;
    return;
  end if;

  select x.code, x.full_name, x.is_active, x.id_hash into e
  from public.employees x where x.code = p_code;

  if e.code is null or e.id_hash is null or e.id_hash <> extensions.crypt(p_id, e.id_hash) then
    insert into public.login_attempts (code, ip) values (p_code, coalesce(p_ip, ''));
    return query select 'bad'::text, null::text, null::text;
    return;
  end if;

  delete from public.login_attempts a where a.code = p_code;
  if not e.is_active then
    return query select 'inactive'::text, e.code::text, e.full_name::text;
    return;
  end if;
  update public.employees set last_login_at = now() where employees.code = e.code;
  return query select 'ok'::text, e.code::text, e.full_name::text;
end $$;
revoke execute on function public.employee_login(text, text, text) from public, anon, authenticated;
grant execute on function public.employee_login(text, text, text) to service_role;

-- 3) สถานะรอบอัปเดต (pg_cron) ------------------------------------------------------
--    อ่าน schema cron ต้องใช้สิทธิ์เจ้าของ (security definer) · เปิดให้ service_role เท่านั้น
drop function if exists public.cron_status();
create or replace function public.cron_status()
returns table (jobname text, schedule text, active boolean,
               last_status text, last_start timestamptz, last_end timestamptz, last_message text,
               last_ok timestamptz, fails_24h bigint)
language sql
stable
security definer
set search_path = cron, pg_catalog
as $$
  select j.jobname::text, j.schedule::text, j.active,
    r.status::text, r.start_time, r.end_time, left(r.return_message, 300),
    (select max(d.end_time) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'succeeded'),
    (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'failed' and d.start_time > now() - interval '24 hours')
  from cron.job j
  left join lateral (
    select d.status, d.start_time, d.end_time, d.return_message
    from cron.job_run_details d where d.jobid = j.jobid
    order by d.start_time desc limit 1
  ) r on true
  order by j.jobname;
$$;
revoke execute on function public.cron_status() from public, anon, authenticated;
grant execute on function public.cron_status() to service_role;

-- ความคืบหน้าคำนวณย้อนหลัง (เดือนถัดไปที่จะคำนวณ — ต่ำกว่าเดือนเริ่มต้นแล้ว = เสร็จ)
drop function if exists public.backfill_status();
create or replace function public.backfill_status()
returns table (name text, next_month date)
language sql
stable
as $$
  select 'dashboard', next_month from public.dashboard_backfill where id = 1
  union all select 'kpi', next_month from public.kpi_backfill where id = 1
  union all select 'branch', next_month from public.branch_backfill where id = 1;
$$;
revoke execute on function public.backfill_status() from public, anon, authenticated;
grant execute on function public.backfill_status() to service_role;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- ขั้นสุดท้าย (รันแยก หลังเว็บใหม่ขึ้นแล้ว และเช็คว่าเข้าสู่ระบบได้):
-- ลบเลขบัตรตัวจริงออก เหลือแต่ hash
--   ⚠ ถ้าระบบนามบัตรดิจิทัลใช้ตาราง employees นี้ด้วยและยังตรวจจาก id_card ห้ามรันจนกว่าระบบนั้นจะเปลี่ยนมาใช้ hash
--
--   alter table public.employees alter column id_card drop not null;
--   update public.employees set id_card = null;
--   -- import ครั้งต่อไปยังส่ง id_card มาได้ trigger จะทำ hash ให้ แล้วล้างทิ้งอัตโนมัติด้วยบรรทัดนี้:
--   create or replace function public.employees_hash_id() returns trigger language plpgsql as $f$
--   begin
--     if new.id_card is not null then
--       new.id_hash := extensions.crypt(new.id_card, extensions.gen_salt('bf', 10));
--       new.id_card := null;
--     end if;
--     return new;
--   end $f$;
