// Scorecard รายบริษัท (SDO / PDC / DC) ตามนิยามในไฟล์ KPI ของฝ่ายขาย
// ทุกตัวคิดจาก "เดือนปลายทาง" ของ filter (toYM) — เดือนที่ยังไม่จบนับถึงวันที่ข้อมูลล่าสุด (MTD)
// และเทียบปีก่อนถึงวันที่เดียวกันเสมอ
import 'server-only';
import { addDays, CompanyKpi, CompanyTotal, getCompanyKpi, getCompanyTotals, shiftYears } from '@/app/lib/api';

// ปีงบของ SDO (P&G) เริ่ม 1 ก.ค. — ใช้กับ Sales vs YA แบบ FYTD
export const FY_START_MONTH = 7;
// Active Stores ช่วงที่เลือก นับได้ยาวสุดกี่เดือน
export const MAX_RANGE_MONTHS = 12;

export type Range = { from: string; to: string }; // to ไม่รวม
export type Pair = { cur: CompanyTotal | null; prev: CompanyTotal | null };

export type CompanyScore = {
  month: CompanyTotal | null;      // เดือนที่เลือก (MTD)
  base: CompanyTotal | null;       // เดือนเดียวกันปีก่อน (ถึงวันเดียวกัน)
  cy: Pair;                        // ต้นปีปฏิทิน → ปัจจุบัน เทียบปีก่อน
  fy: Pair;                        // ต้นปีงบ (ก.ค.) → ปัจจุบัน เทียบปีก่อน
  p3: CompanyTotal | null;         // รวม 3 เดือนก่อนหน้า (เต็มเดือน)
  p6: CompanyTotal | null;         // รวม 6 เดือนก่อนหน้า
  p3Months: number;                // จำนวนเดือนที่มีข้อมูลจริงใน P3 / P6 (ไว้หารเฉลี่ย)
  p6Months: number;
  kpiMonth: CompanyKpi | null;     // วันทำงานจริง / บิล / line > 1 บาท ของเดือน
  storesActive: CompanyKpi | null; // Active Stores: SDO = P3 (2 เดือนก่อน + เดือนนี้), PDC/DC = P1 (MTD)
  storesRange: CompanyKpi | null;  // Active Stores ในช่วงเดือนของ filter
};

export type Scorecard = {
  ranges: { month: Range; base: Range; cy: Range; fy: Range; p3: Range; p6: Range; storesP3: Range; storesP1: Range; storesRange: Range };
  kpiReady: boolean; // รัน SQL ตาราง sales_store_daily แล้วหรือยัง
  rangeTooLong: boolean; // ช่วงที่เลือกยาวเกิน MAX_RANGE_MONTHS → ไม่นับ Active Stores ช่วงที่เลือก
  byCompany: Record<string, CompanyScore>;
};

const monthStart = (ym: string) => `${ym}-01`;
function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
// ย้อนช่วงไป 1 ปี: ใช้วันสุดท้ายแบบรวม แล้วค่อย +1 วัน (29 ก.พ. → 28 ก.พ.)
const lastYear = (r: Range): Range => ({ from: shiftYears(r.from, 1), to: addDays(shiftYears(addDays(r.to, -1), 1), 1) });

export async function loadScorecard({
  toYM, fromYM, latestDate, months, companies,
}: { toYM: string; fromYM: string; latestDate: string; months: string[]; companies: string[] }): Promise<Scorecard> {
  // ปลายช่วง = สิ้นเดือนที่เลือก หรือวันที่ข้อมูลล่าสุด ถ้าเดือนนั้นยังไม่จบ
  const monthEnd = monthStart(shiftMonth(toYM, 1));
  const end = latestDate < monthEnd ? addDays(latestDate, 1) : monthEnd;
  const [y, m] = toYM.split('-').map(Number);
  const fyYear = m >= FY_START_MONTH ? y : y - 1;

  const month: Range = { from: monthStart(toYM), to: end };
  const cy: Range = { from: `${y}-01-01`, to: end };
  const fy: Range = { from: `${fyYear}-${String(FY_START_MONTH).padStart(2, '0')}-01`, to: end };
  const p3: Range = { from: monthStart(shiftMonth(toYM, -3)), to: monthStart(toYM) };
  const p6: Range = { from: monthStart(shiftMonth(toYM, -6)), to: monthStart(toYM) };
  const storesP3: Range = { from: monthStart(shiftMonth(toYM, -2)), to: end };
  const storesRange: Range = { from: monthStart(fromYM), to: end };
  const base = lastYear(month);

  const t = (r: Range) => getCompanyTotals(r.from, r.to);
  const k = (r: Range) => getCompanyKpi(r.from, r.to);
  // นับร้านค้าไม่ซ้ำในช่วงยาว ๆ หนักเกินไป → ช่วงที่เลือกนับได้ไม่เกิน MAX_RANGE_MONTHS เดือน
  const rangeMonths = months.filter((x) => x >= fromYM && x <= toYM).length;
  const rangeTooLong = rangeMonths > MAX_RANGE_MONTHS;
  const [mo, ba, cyCur, cyPrev, fyCur, fyPrev, p3t, p6t, kMonth, kP3, kRange] = await Promise.all([
    t(month), t(base), t(cy), t(lastYear(cy)), t(fy), t(lastYear(fy)), t(p3), t(p6),
    k(month), k(storesP3), rangeTooLong ? Promise.resolve<Record<string, CompanyKpi>>({}) : k(storesRange),
  ]);

  // เฉลี่ยด้วยจำนวนเดือนที่มีข้อมูลจริง (ต้นข้อมูลอาจมีไม่ครบ 3 / 6 เดือน)
  const countMonths = (r: Range) => months.filter((x) => x >= r.from.slice(0, 7) && x < r.to.slice(0, 7)).length;

  const byCompany: Record<string, CompanyScore> = {};
  for (const co of companies) {
    byCompany[co] = {
      month: mo[co] ?? null,
      base: ba[co] ?? null,
      cy: { cur: cyCur[co] ?? null, prev: cyPrev[co] ?? null },
      fy: { cur: fyCur[co] ?? null, prev: fyPrev[co] ?? null },
      p3: p3t[co] ?? null,
      p6: p6t[co] ?? null,
      p3Months: countMonths(p3),
      p6Months: countMonths(p6),
      kpiMonth: kMonth?.[co] ?? null,
      storesActive: (co === 'SDO' ? kP3 : kMonth)?.[co] ?? null,
      storesRange: kRange?.[co] ?? null,
    };
  }
  return {
    ranges: { month, base, cy, fy, p3, p6, storesP3, storesP1: month, storesRange },
    kpiReady: kMonth !== null,
    rangeTooLong,
    byCompany,
  };
}
