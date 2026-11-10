// ตรวจว่าข้อมูล "ไม่เข้าจริง" — เตือนเฉพาะเคสที่ต้องตามจริง ไม่เตือนตาม pattern ปกติของธุรกิจ
// ทดสอบย้อนหลัง ม.ค. 2025 – พ.ย. 2026 (รันสมมติทุกเช้า): เตือนผิด 0 ครั้ง · จำลองข้อมูลหาย 2 วันจับได้ทุกกรณี
//
//   1. บริษัทไหนไม่มีบรรทัดขายเลย ติดกัน ≥ 2 วันที่จบแล้ว → ข้อมูลบริษัทนั้นไม่เข้า (ทุกบริษัท = ไม่เข้าเลย)
//      ไม่นับวันที่ยอดเป็น 0 ได้ตามปกติ: วันที่ 1–3 ของเดือน (ปิดเดือน) / 28 ธ.ค.–5 ม.ค. / 10–18 เม.ย. / 1–3 พ.ค.
//      ไม่นับวันนี้ (SDO ออกบิลล่วงหน้าลงวันที่วันนี้ แต่ PDC / DC ยังไม่เริ่มขาย)
//   2. รอบอัปเดตอัตโนมัติ (refresh) ไม่สำเร็จเกิน 14 ชม. (ปกติห่างสุด 17:40 → 06:40 = 13 ชม.) → ตัวเลขบนเว็บค้าง
// ไม่ใช้ "ยอด / จำนวนบรรทัดต่ำกว่าปกติ" เป็นเกณฑ์: ช่วงปิดเดือน PDC / DC บรรทัดลดเหลือ 20–40% ทุกเดือน (เตือนผิด ~290 ครั้ง)
import 'server-only';
import { addDays, getCompanyTotals, getCronStatus } from '@/app/lib/api';

export type HealthIssue = { level: 'warn' | 'bad'; text: string };
export type Health = {
  latestDate: string;
  checkDay: string; // วันที่จบแล้วล่าสุดที่ใช้ตรวจ (เมื่อวาน)
  today: string;
  // ข้อมูลประกอบในหน้าสถานะระบบ (ไม่ใช้เตือน ยกเว้น streak)
  weekly: { company: string; last7: number; avgWeek: number; ratio: number | null; lastDay: number; giv7: number; streak: number }[];
  issues: HealthIssue[];
};

const COMPANIES = ['SDO', 'PDC', 'DC'];
const STREAK_DAYS = 2;
const LOOKBACK = 14;
const REFRESH_MAX_HOURS = 14;
const thDate = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return `${dd}/${m}/${y}`; };

// วันที่ยอดเป็น 0 ได้ตามปกติ → ไม่นับในการตรวจ (ข้ามไป ไม่ตัดช่วง)
function normalOff(d: string) {
  const md = d.slice(5);
  return Number(d.slice(8)) <= 3 || md >= '12-28' || md <= '01-05' || (md >= '04-10' && md <= '04-18') || (md >= '05-01' && md <= '05-03');
}

export async function checkHealth(latestDate: string): Promise<Health> {
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // วันนี้ตามเวลาไทย
  const checkDay = addDays(today, -1);
  const end = addDays(checkDay, 1);
  const days = Array.from({ length: LOOKBACK }, (_, i) => addDays(checkDay, -i));

  const [daily, last7, prev28, jobs] = await Promise.all([
    Promise.all(days.map((d) => getCompanyTotals(d, addDays(d, 1)))),
    getCompanyTotals(addDays(end, -7), end),
    getCompanyTotals(addDays(end, -35), addDays(end, -7)),
    getCronStatus().catch(() => null),
  ]);
  const lines = (i: number, co: string) => daily[i][co]?.lines ?? 0;

  // จำนวนวัน (ที่นับ) ติดกันล่าสุดที่บริษัทนั้นไม่มีบรรทัดขายเลย
  const streakOf = (co: string) => {
    let n = 0;
    for (let i = 0; i < days.length; i++) {
      if (normalOff(days[i])) continue;
      if (lines(i, co) > 0) break;
      n++;
    }
    return n;
  };

  const weekly = COMPANIES.map((co) => {
    const l7 = last7[co]?.lines ?? 0;
    const avgWeek = (prev28[co]?.lines ?? 0) / 4;
    return {
      company: co, last7: l7, avgWeek, ratio: avgWeek ? (l7 / avgWeek) * 100 : null,
      lastDay: lines(0, co), giv7: last7[co]?.giv ?? 0, streak: streakOf(co),
    };
  });

  const issues: HealthIssue[] = [];
  const missing = weekly.filter((w) => w.streak >= STREAK_DAYS);
  if (missing.length === COMPANIES.length) {
    issues.push({ level: 'bad', text: `ไม่มีข้อมูลขายเข้าเลยทุกบริษัท ${Math.min(...missing.map((w) => w.streak))} วันติดกัน (ถึง ${thDate(checkDay)}) — ตรวจการดึงข้อมูลหลังบ้าน (ERP → Supabase)` });
  } else {
    for (const w of missing) {
      issues.push({ level: 'warn', text: `${w.company} ไม่มีข้อมูลขายเข้า ${w.streak} วันติดกัน (ถึง ${thDate(checkDay)}) ทั้งที่บริษัทอื่นมี — ตรวจการดึงข้อมูล ${w.company} หลังบ้าน` });
    }
  }

  // รอบอัปเดตอัตโนมัติของเรา (ข้อมูลเข้าแล้วแต่ตัวเลขบนเว็บไม่ขยับ)
  const now = Date.now();
  for (const j of (jobs ?? []).filter((x) => x.active && x.jobname.endsWith('-refresh'))) {
    const okAt = j.last_ok ? Date.parse(j.last_ok) : 0;
    if (now - okAt > REFRESH_MAX_HOURS * 3600_000) {
      const since = okAt ? `ตั้งแต่ ${new Date(okAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' })}` : '';
      issues.push({ level: 'bad', text: `รอบอัปเดตอัตโนมัติ ${j.jobname} ไม่สำเร็จ${since} — ตัวเลขบนเว็บอาจค้าง ดูรายละเอียดในหน้าสถานะระบบ` });
    }
  }

  return { latestDate, checkDay, today, weekly, issues };
}
