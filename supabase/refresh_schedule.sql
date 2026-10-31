-- RSM Sales Dashboard — รอบอัปเดตตารางสรุป ให้ตามหลังรอบดึงข้อมูลของหลังบ้าน (06:10 / 12:10 / 17:10)
-- หน้าบ้านคำนวณใหม่ 20 นาทีหลังจากนั้น: 06:30 / 12:30 / 17:30 เวลาไทย (ไม่ต้องคำนวณทุกชั่วโมงแล้ว)
-- pg_cron ของ Supabase ใช้เวลา UTC → 06:30 = 23:30 UTC (ของวันก่อน), 12:30 = 05:30 UTC, 17:30 = 10:30 UTC
-- รันทั้งไฟล์ใน Supabase › SQL Editor (รันซ้ำได้)

select cron.unschedule(jobid) from cron.job where jobname in ('dashboard-refresh', 'kpi-refresh');

-- คำนวณใหม่ตั้งแต่วันที่ 1 ของเดือนก่อน ถึงวันนี้ (อิงวันที่ไทย — รอบ 06:30 ไทย ยังเป็นวันก่อนหน้าใน UTC)
-- ครอบคลุมทุกครั้งที่หลังบ้านดึงข้อมูลเดือนก่อนซ้ำ ถ้าแก้ข้อมูลเก่ากว่านั้น ให้รัน dashboard_refresh / kpi_refresh ของเดือนนั้นเอง
select cron.schedule('dashboard-refresh', '30 23,5,10 * * *', $$
  select public.dashboard_refresh(
    (date_trunc('month', now() at time zone 'Asia/Bangkok') - interval '1 month')::date,
    (now() at time zone 'Asia/Bangkok')::date + 1)
$$);
select cron.schedule('kpi-refresh', '35 23,5,10 * * *', $$
  select public.kpi_refresh(
    (date_trunc('month', now() at time zone 'Asia/Bangkok') - interval '1 month')::date,
    (now() at time zone 'Asia/Bangkok')::date + 1)
$$);

-- ตรวจ: select jobname, schedule, command from cron.job order by jobname;
