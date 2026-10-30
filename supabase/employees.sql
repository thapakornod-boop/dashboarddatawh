-- RSM Sales Dashboard — ตารางพนักงานสำหรับเข้าสู่ระบบ
-- รันทั้งไฟล์ใน Supabase › SQL Editor (รันซ้ำได้ ไม่ลบข้อมูลเดิม)
--
-- เข้าสู่ระบบด้วย รหัสพนักงาน (code) + เลขบัตรประชาชน 13 หลัก (id_card)
-- คอลัมน์ HR ตรงกับตาราง employees ของระบบนามบัตรดิจิทัล → ใช้ไฟล์ CSV / script import ชุดเดียวกันได้

-- 1) ตารางพนักงาน -------------------------------------------------------------
create table if not exists public.employees (
  code        text primary key,                                   -- รหัสพนักงาน (username) ตัวพิมพ์ใหญ่ เช่น SDO0586
  id_card     text not null check (id_card ~ '^[0-9]{13}$'),       -- เลขบัตรประชาชน (password) ห้ามส่งไปฝั่ง client
  full_name   text not null,                                      -- ชื่อ-นามสกุล รวมคำนำหน้า
  phone       text not null default '',                           -- เบอร์โทร รูปแบบ 0XX-XXX-XXXX ('' = ไม่มี)
  supervisor  text,                                               -- หัวหน้างาน
  branch      text,                                               -- สังกัด เช่น SDO, PDC, DC
  company     text,                                               -- สาขา เช่น RSM, UTH, KKC
  department  text,                                               -- แผนก
  "position"  text,                                               -- ตำแหน่ง
  start_date  date,                                               -- วันเริ่มงาน
  products    text,                                               -- สินค้าที่ขาย
  role        text not null default 'employee'
              check (role in ('employee', 'admin')),              -- สิทธิ์ในระบบ dashboard
  is_active   boolean not null default true,                      -- false = ปิดสิทธิ์เข้าระบบ (ไม่ต้องลบแถว)
  last_login_at timestamptz,                                      -- เข้าระบบล่าสุด
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ใช้กรณีจับคู่หัวหน้า / สังกัด
create index if not exists employees_branch_idx on public.employees (branch);

-- updated_at อัปเดตเองทุกครั้งที่แก้แถว
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists employees_updated_at on public.employees;
create trigger employees_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

-- 2) ความปลอดภัย ---------------------------------------------------------------
-- เปิด RLS แต่ไม่มี policy → key สาธารณะ (anon) อ่านอะไรไม่ได้เลย
-- เว็บอ่านตารางนี้จากฝั่ง server ด้วย secret key (service_role) เท่านั้น
alter table public.employees enable row level security;
revoke all on public.employees from anon, authenticated;
grant select, insert, update, delete on public.employees to service_role;

-- 3) ตัวอย่างการใช้งาน (ไม่รันอัตโนมัติ — คัดลอกไปใช้ทีละคำสั่ง) -----------------
-- เพิ่ม / แก้พนักงาน 1 คน:
--   insert into public.employees (code, id_card, full_name, phone, branch, company, department, "position")
--   values ('SDO0000', '0000000000000', 'นายตัวอย่าง ทดสอบ', '081-234-5678', 'SDO', 'RSM', 'ฝ่ายขาย', 'Sales')
--   on conflict (code) do update set
--     id_card = excluded.id_card, full_name = excluded.full_name, phone = excluded.phone,
--     branch = excluded.branch, company = excluded.company,
--     department = excluded.department, "position" = excluded."position";
--
-- ให้สิทธิ์แอดมิน:      update public.employees set role = 'admin' where code = 'SDO0000';
-- ปิดสิทธิ์เข้าระบบ:     update public.employees set is_active = false where code = 'SDO0000';
-- พนักงานลาออก:        delete from public.employees where code = 'SDO0000';
