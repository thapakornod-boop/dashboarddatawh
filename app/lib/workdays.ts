// Time gone = วันทำงานที่ผ่านไปแล้ว ÷ วันทำงานทั้งเดือน (ตามวิธีนับในไฟล์ BEST ของฝ่ายขาย)
//   - วันทำงาน = จันทร์–เสาร์ (หยุดวันอาทิตย์) และ "เริ่มนับตั้งแต่วันที่ 3 ของเดือน" (วันที่ 1–2 ไม่นับ)
//       เช่น พ.ย. 2026: 3–30 พ.ย. ไม่รวมอาทิตย์ = 24 วัน
//   - นับถึง "เมื่อวาน" (ยอดขายเข้าระบบช้า 1 วัน) เช่น วันนี้ 12 พ.ย. → นับถึง 11 พ.ย. = 8 วัน → 8 ÷ 24 = 33.3%
//   - เดือนที่จบแล้ว = 100%
//   - วันหยุดนักขัตฤกษ์ที่ไม่นับเป็นวันทำงาน ใส่เพิ่มใน HOLIDAYS ได้ ("YYYY-MM-DD")
export const HOLIDAYS: string[] = [];
export const START_DAY = 3;

export type TimeGone = { elapsed: number; total: number; pct: number; asOf: string };

function isWorkday(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCDay() === 0) return false; // อาทิตย์
  return !HOLIDAYS.includes(date.toISOString().slice(0, 10));
}

// วันทำงานของเดือน ym ตั้งแต่วันที่ START_DAY ถึงวันที่ uptoDay (ไม่ระบุ = ทั้งเดือน)
function workdays(ym: string, uptoDay?: number): number {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let n = 0;
  for (let d = START_DAY; d <= Math.min(uptoDay ?? last, last); d++) if (isWorkday(y, m, d)) n++;
  return n;
}

// เมื่อวานตามเวลาไทย ("YYYY-MM-DD")
export function yesterdayBangkok(): string {
  return new Date(Date.now() + 7 * 3600_000 - 86_400_000).toISOString().slice(0, 10);
}

// Time gone ของหลายเดือนรวมกัน นับถึง asOf (ค่าเริ่มต้น = เมื่อวาน)
export function timeGone(months: string[], asOf: string = yesterdayBangkok()): TimeGone {
  const asOfYM = asOf.slice(0, 7);
  const asOfDay = Number(asOf.slice(8, 10));
  let elapsed = 0;
  let total = 0;
  for (const ym of months) {
    const t = workdays(ym);
    total += t;
    if (ym < asOfYM) elapsed += t;
    else if (ym === asOfYM) elapsed += workdays(ym, asOfDay);
  }
  return { elapsed, total, pct: total ? (elapsed / total) * 100 : 0, asOf };
}
