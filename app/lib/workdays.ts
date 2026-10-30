// Time gone = วันทำงานที่ผ่านไปแล้ว ÷ วันทำงานทั้งเดือน
//   - วันทำงาน = จันทร์–เสาร์ (หยุดวันอาทิตย์) เช่น ต.ค. 2026 ถึงวันที่ 28 = 24 วันทำงาน
//   - นับถึงวันที่ของข้อมูลล่าสุด (dashboard_latest_date) รวมวันนั้นด้วย
//   - วันหยุดนักขัตฤกษ์ที่ไม่นับเป็นวันทำงาน ใส่เพิ่มใน HOLIDAYS ได้ ("YYYY-MM-DD")
export const HOLIDAYS: string[] = [];

export type TimeGone = { elapsed: number; total: number; pct: number };

function isWorkday(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCDay() === 0) return false; // อาทิตย์
  return !HOLIDAYS.includes(date.toISOString().slice(0, 10));
}

// วันทำงานของเดือน ym ตั้งแต่วันที่ 1 ถึงวันที่ uptoDay (ไม่ระบุ = ทั้งเดือน)
function workdays(ym: string, uptoDay?: number): number {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= Math.min(uptoDay ?? last, last); d++) if (isWorkday(y, m, d)) n++;
  return n;
}

// Time gone ของหลายเดือนรวมกัน: เดือนที่จบแล้ว = 100%, เดือนของข้อมูลล่าสุด = นับถึงวันนั้น
export function timeGone(months: string[], latestDate: string): TimeGone {
  const latestYM = latestDate.slice(0, 7);
  const latestDay = Number(latestDate.slice(8, 10));
  let elapsed = 0;
  let total = 0;
  for (const ym of months) {
    const t = workdays(ym);
    total += t;
    if (ym < latestYM) elapsed += t;
    else if (ym === latestYM) elapsed += workdays(ym, latestDay);
  }
  return { elapsed, total, pct: total ? (elapsed / total) * 100 : 0 };
}
