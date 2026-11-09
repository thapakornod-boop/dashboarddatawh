// ตรวจความครบของข้อมูล: ข้อมูลไม่อัปเดต / บริษัทไหนข้อมูลเข้าไม่ครบ
//   - ล่าสุดเก่ากว่าเมื่อวาน (เวลาไทย) → ข้อมูลไม่อัปเดต
//   - วันล่าสุดบริษัทไหนไม่มีบรรทัดขายเลย ทั้งที่ปกติมี → ข้อมูลวันนั้นยังไม่เข้า
//   - จำนวนบรรทัดขาย 7 วันล่าสุด ต่ำกว่า 60% ของค่าเฉลี่ยต่อสัปดาห์ 4 สัปดาห์ก่อน → ข้อมูลอาจเข้าไม่ครบ
// ใช้ "จำนวนบรรทัด" ไม่ใช้ยอดเงิน: ยอดเงินขึ้นลงตามรอบเดือน (ต้นเดือนต่ำ / ปลายเดือนมีบิลร้านส่งก้อนใหญ่)
// แต่จำนวนบรรทัดต่อวันค่อนข้างคงที่ ถ้าหายไปมากแปลว่าข้อมูลเข้าไม่ครบจริง
import 'server-only';
import { addDays, getCompanyTotals } from '@/app/lib/api';

export type HealthIssue = { level: 'warn' | 'bad'; text: string };
export type Health = {
  latestDate: string;
  today: string;
  weekly: { company: string; last7: number; avgWeek: number; ratio: number | null; lastDay: number; giv7: number }[];
  issues: HealthIssue[];
};

const COMPANIES = ['SDO', 'PDC', 'DC'];
const MIN_RATIO = 60;
const thDate = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return `${dd}/${m}/${y}`; };
const fmtN = (n: number) => Math.round(n).toLocaleString('th-TH');

export async function checkHealth(latestDate: string): Promise<Health> {
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // วันนี้ตามเวลาไทย
  const end = addDays(latestDate, 1);
  const [last7, prev28, lastDay] = await Promise.all([
    getCompanyTotals(addDays(end, -7), end),
    getCompanyTotals(addDays(end, -35), addDays(end, -7)),
    getCompanyTotals(latestDate, end),
  ]);

  const weekly = COMPANIES.map((co) => {
    const l7 = last7[co]?.lines ?? 0;
    const avgWeek = (prev28[co]?.lines ?? 0) / 4;
    return {
      company: co, last7: l7, avgWeek, ratio: avgWeek ? (l7 / avgWeek) * 100 : null,
      lastDay: lastDay[co]?.lines ?? 0, giv7: last7[co]?.giv ?? 0,
    };
  });

  const issues: HealthIssue[] = [];
  if (latestDate < addDays(today, -1)) {
    issues.push({ level: 'bad', text: `ข้อมูลไม่อัปเดต — ล่าสุดถึง ${thDate(latestDate)} (เกิน 1 วัน) ตรวจรอบดึงข้อมูลหลังบ้าน / รอบอัปเดตอัตโนมัติ` });
  }
  for (const w of weekly) {
    if (w.avgWeek > 0 && w.lastDay === 0) {
      issues.push({ level: 'warn', text: `${w.company} ยังไม่มีบรรทัดขายของวันที่ ${thDate(latestDate)} — ข้อมูลวันนั้นอาจยังไม่เข้า` });
    }
    if (w.ratio !== null && w.ratio < MIN_RATIO) {
      issues.push({
        level: 'warn',
        text: `${w.company} 7 วันล่าสุดมี ${fmtN(w.last7)} บรรทัด จากปกติ ~${fmtN(w.avgWeek)} บรรทัด/สัปดาห์ (${w.ratio.toFixed(0)}%) — ข้อมูลอาจเข้าไม่ครบ`,
      });
    }
  }
  return { latestDate, today, weekly, issues };
}
