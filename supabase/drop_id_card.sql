-- RSM Sales Dashboard — ลบเลขบัตรประชาชนตัวจริงออก เหลือแต่ hash (id_hash)
-- รันหลัง security.sql และเช็คแล้วว่าเข้าสู่ระบบได้ · รันทั้งไฟล์ใน Supabase › SQL Editor (รันซ้ำได้)
-- (ระบบนามบัตรดิจิทัลยังไม่ได้ใช้ตารางนี้ — ถ้าจะใช้ในอนาคต ต้องตรวจรหัสผ่านผ่าน RPC employee_login แทน id_card)

-- 1) กันไว้ก่อน: ทุกแถวต้องมี hash แล้ว (ถ้ามีแถวที่ยังไม่มี hash จะหยุด ไม่ลบอะไร)
do $$
begin
  if exists (select 1 from public.employees where id_hash is null and id_card is not null) then
    raise exception 'ยังมีพนักงานที่ไม่มี id_hash — รัน security.sql ก่อน';
  end if;
end $$;

-- 2) import จาก HR ครั้งต่อไปยังส่ง id_card มาได้ → trigger ทำ hash แล้วล้างเลขจริงทิ้งทันที
create or replace function public.employees_hash_id()
returns trigger language plpgsql as $$
begin
  if new.id_card is not null then
    new.id_hash := extensions.crypt(new.id_card, extensions.gen_salt('bf', 10));
    new.id_card := null;
  end if;
  return new;
end $$;

-- 3) ลบเลขบัตรตัวจริงของทุกคน
alter table public.employees alter column id_card drop not null;
update public.employees set id_card = null where id_card is not null;

-- ตรวจ: ต้องได้ 0 แถว
-- select count(*) from public.employees where id_card is not null;
