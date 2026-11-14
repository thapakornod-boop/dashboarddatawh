// STANGS KPI & Compliance — สูตรคำนวณ (ใช้ได้ทั้ง server และหน้าเว็บ: เปลี่ยนตัวกรองแล้วคำนวณใหม่ทันที)
// ข้อมูลรายวันจาก lib/stangs.ts (แผน / การเข้าพบ / ยอดขาย ราย เซลล์ × วัน)

// เกณฑ์ (ปรับได้ที่นี่ที่เดียว — หน้าเว็บและหมายเหตุใช้ค่าเหล่านี้)
export const RULES = {
  lateStart: 8 * 60 + 45,    // เข้าร้านแรกหลัง 08:45 = เริ่มงานสาย
  earlyFinish: 15 * 60 + 30, // ออกร้านสุดท้ายก่อน 15:30 = เลิกงานก่อนเวลา
  shortHours: 6 * 60,     // ร้านแรก → ร้านสุดท้าย น้อยกว่า 6 ชม. = ชั่วโมงทำงานน้อย
  shortVisit: 10,         // อยู่ร้านน้อยกว่า 10 นาที = เยี่ยมเร็วเกินไป
  farCheckinM: 150,       // ช่อง Compliance = no (เช็คอินห่างพิกัดร้านเกิน ~150 ม.) = เช็คอินไกล
};

export type SSeller = { company: string; branch: string; principal: string; manager: string; supervisor: string; seller: string; name: string };
export type SPlanDay = { s: string; d: string; planned: number; planVisited: number }; // แผนของวัน + ร้านในแผนที่ไปจริงวันนั้น
export type SVisit = {
  s: string; d: string; store: string; storeName: string; start: number | null; end: number | null; dur: number | null;
  diff: number | null; comp: boolean | null; adhoc: boolean; status: string;
};
// ยอดขายราย เซลล์ × ร้าน × วัน (c = รหัสร้าน · b = บิล · l = บรรทัด · g = GIV · n = NIV)
export type SSale = { s: string; d: string; c: string; b: number; l: number; g: number; n: number };
export type StangsData = {
  sellers: SSeller[]; plan: SPlanDay[]; visits: SVisit[]; sales: SSale[];
  firstDate: string; lastDate: string; latest: string; // วันแรก / วันสุดท้ายของช่วงที่โหลด · วันที่มีการเข้าพบล่าสุด
  rangeFrom: string; rangeTo: string;   // ช่วงวันที่ที่เลือก (โหลดมาแค่ช่วงนี้)
  minDate: string; maxDate: string;     // ข้อมูลที่มีทั้งหมดใน Supabase (ไว้จำกัดตัวเลือกวันที่)
  fromDb: boolean;                      // true = อ่านจาก Supabase · false = ยังไม่ได้รัน stangs.sql อ่านชีตสด
  latestAll: string;                    // วันที่มีการเข้าพบล่าสุดในข้อมูลทั้งหมด (ปุ่มลัด เดือนนี้ / 7 วันล่าสุด)
  tripEnd: Record<string, string>;      // วันสุดท้ายที่มีแผนของแต่ละเดือน (ทั้งเดือน ไม่ใช่แค่ช่วงที่เลือก) — คิดมาตรฐานแผน 600 / ทริป
};

export type Metrics = {
  plannedTrip: number; plannedToDate: number; visits: number; planVisited: number; missed: number; adhoc: number;
  buyingStores: number; buyStoreDays: number; billDays: number; bills: number; sales: number; niv: number; lines: number; workDays: number;
  lateStart: number; earlyFinish: number; shortHours: number; shortVisits: number; farCheckin: number;
};
export type DayStat = {
  d: string; start: number | null; end: number | null; work: number | null; store: number;
  planned: number; planVisited: number; visits: number; adhoc: number; shortVisits: number; farCheckin: number;
  bills: number; giv: number; storeDays: number;
  late: boolean; early: boolean; shortHrs: boolean;
};
export type SellerRow = SSeller & Metrics & {
  planDays: number; avgStart: number | null; avgFinish: number | null; avgWork: number | null; avgStore: number | null;
  totalIssues: number; problems: { key: string; label: string; n: number; unit: string }[];
};

const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// ปัญหา 6 ข้อ: ชื่อไทย + หน่วยนับ (ครั้ง / วัน / บิล) + เกณฑ์
export const ISSUES = [
  { key: 'farCheckin', label: 'เช็คอินไกลร้าน', short: 'Far Check-in', unit: 'ครั้ง', rule: `เช็คอินห่างพิกัดร้าน > ~${RULES.farCheckinM} ม.` },
  { key: 'shortVisits', label: 'เยี่ยมเร็วเกินไป', short: 'Quick Visits', unit: 'ครั้ง', rule: `อยู่ร้าน < ${RULES.shortVisit} นาที` },
  { key: 'lateStart', label: 'เริ่มงานสาย', short: 'Late Start', unit: 'วัน', rule: `เข้าร้านแรกหลัง ${clock(RULES.lateStart)}` },
  { key: 'shortHours', label: 'ชั่วโมงทำงานน้อย', short: 'Short Hours', unit: 'วัน', rule: `ร้านแรก → ร้านสุดท้าย < ${RULES.shortHours / 60} ชม.` },
  { key: 'earlyFinish', label: 'เลิกงานก่อนเวลา', short: 'Early Finish', unit: 'วัน', rule: `ออกร้านสุดท้ายก่อน ${clock(RULES.earlyFinish)}` },
] as const;

export const NEXT_ACTION: Record<string, string> = {
  farCheckin: 'เช็คอินที่หน้าร้าน / ตรวจพิกัดร้านใน Master',
  shortVisits: `อยู่ร้านให้ครบ ≥ ${RULES.shortVisit} นาที (เช็คสต๊อก / เสนอสินค้า)`,
  lateStart: 'ออกรูทให้ทัน 08:45',
  shortHours: 'วางรูทให้ทำงานครบ 6 ชม.ขึ้นไป',
  earlyFinish: 'ทำรูทช่วงบ่ายให้ถึง 15:30',
};

export const hhmm = (m: number | null) =>
  m == null ? '—' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// รายวันของเซลล์คนเดียว ในช่วง [from, to] (วันที่ถึง asOf = วันที่มีการเข้าพบล่าสุด)
export function dayStats(data: StangsData, seller: string, from: string, to: string): DayStat[] {
  const days = new Map<string, DayStat>();
  const at = (d: string) => {
    let x = days.get(d);
    if (!x) days.set(d, (x = {
      d, start: null, end: null, work: null, store: 0, planned: 0, planVisited: 0, visits: 0, adhoc: 0, shortVisits: 0, farCheckin: 0,
      bills: 0, giv: 0, storeDays: 0, late: false, early: false, shortHrs: false,
    }));
    return x;
  };
  const inR = (d: string) => d >= from && d <= to;
  for (const p of data.plan) if (p.s === seller && inR(p.d)) { const x = at(p.d); x.planned += p.planned; x.planVisited += p.planVisited; }
  for (const v of data.visits) {
    if (v.s !== seller || !inR(v.d)) continue;
    const x = at(v.d);
    x.visits++;
    if (v.adhoc) x.adhoc++;
    if (v.dur != null && v.dur < RULES.shortVisit) x.shortVisits++;
    if (v.comp === false) x.farCheckin++;
    if (v.start != null) {
      x.start = x.start == null ? v.start : Math.min(x.start, v.start);
      x.end = Math.max(x.end ?? v.start, v.end ?? v.start);
    }
    x.store += v.dur ?? 0;
  }
  for (const s of data.sales) {
    if (s.s !== seller || !inR(s.d)) continue;
    const x = at(s.d);
    x.bills += s.b; x.giv += s.g;
    if (s.b > 0) x.storeDays++;
  }
  for (const x of days.values()) {
    if (x.start != null && x.end != null) {
      x.work = x.end - x.start;
      x.late = x.start > RULES.lateStart;
      x.early = x.end < RULES.earlyFinish;
      x.shortHrs = x.work < RULES.shortHours;
    }
  }
  return [...days.values()].sort((a, b) => a.d.localeCompare(b.d));
}

export function sellerRows(data: StangsData, sellers: SSeller[], from: string, to: string): SellerRow[] {
  const asOf = data.latest && data.latest < to ? data.latest : to;
  const salesBy = new Map<string, SSale[]>();
  for (const s of data.sales) if (s.d >= from && s.d <= to) { const l = salesBy.get(s.s); if (l) l.push(s); else salesBy.set(s.s, [s]); }
  const tripDays = tripCalendarDays(data, from, to);

  return sellers.map((s) => {
    const ds = dayStats(data, s.seller, from, to);
    const worked = ds.filter((x) => x.start != null);
    const toDate = ds.filter((x) => x.d <= asOf);
    const sum = (k: keyof DayStat, xs = ds) => xs.reduce((t, x) => t + (Number(x[k]) || 0), 0);
    const sl = (salesBy.get(s.seller) ?? []).filter((x) => x.b > 0);
    const m: Metrics = {
      plannedTrip: sum('planned'), plannedToDate: sum('planned', toDate), visits: sum('visits'), planVisited: sum('planVisited'),
      missed: Math.max(sum('planned', toDate) - sum('planVisited'), 0), adhoc: sum('adhoc'),
      buyingStores: new Set(sl.map((x) => x.c)).size, buyStoreDays: sl.length, billDays: new Set(sl.map((x) => x.d)).size,
      bills: sl.reduce((t, x) => t + x.b, 0), sales: sl.reduce((t, x) => t + x.g, 0), niv: sl.reduce((t, x) => t + x.n, 0), lines: sl.reduce((t, x) => t + x.l, 0),
      workDays: worked.length,
      lateStart: worked.filter((x) => x.late).length, earlyFinish: worked.filter((x) => x.early).length,
      shortHours: worked.filter((x) => x.shortHrs).length, shortVisits: sum('shortVisits'), farCheckin: sum('farCheckin'),
    };
    const problems = ISSUES.map((i) => ({ key: i.key, label: i.label, n: m[i.key], unit: i.unit as string })).filter((p) => p.n > 0).sort((a, b) => b.n - a.n);
    return {
      ...s, ...m,
      // วันตามแผนเยี่ยมของเซลล์คนนี้ใน tab Visit (ทั้งช่วง) · ไม่มีแผนเลย → วันตามปฏิทินทริป
      planDays: ds.filter((x) => x.planned > 0).length || tripDays,
      avgStart: avg(worked.map((x) => x.start!)), avgFinish: avg(worked.map((x) => x.end!)),
      avgWork: avg(worked.map((x) => x.work!)), avgStore: avg(worked.map((x) => x.store)),
      totalIssues: m.lateStart + m.earlyFinish + m.shortHours + m.shortVisits + m.farCheckin,
      problems,
    };
  }).sort((a, b) => b.totalIssues - a.totalIssues || a.seller.localeCompare(b.seller));
}

// รวมทุกเซลล์ที่กรอง (การ์ดสรุป 3 แถบ)
export function totals(rows: SellerRow[]): Metrics {
  const keys: (keyof Metrics)[] = ['plannedTrip', 'plannedToDate', 'visits', 'planVisited', 'missed', 'adhoc', 'buyingStores', 'buyStoreDays', 'billDays', 'bills', 'sales', 'niv', 'lines', 'workDays',
    'lateStart', 'earlyFinish', 'shortHours', 'shortVisits', 'farCheckin'];
  return Object.fromEntries(keys.map((k) => [k, rows.reduce((t, r) => t + r[k], 0)])) as Metrics;
}

// วันตามปฏิทินทริปในช่วง [from, to]: วันที่มีแผนเยี่ยม (tab Visit) ของเซลล์คนใดก็ได้ · ไม่มีแผนเลย → วันที่มีการเข้าพบ
export function tripCalendarDays(data: StangsData, from: string, to: string): number {
  const inR = (d: string) => d >= from && d <= to;
  const plan = new Set(data.plan.filter((p) => inR(p.d)).map((p) => p.d));
  return plan.size || new Set(data.visits.filter((v) => inR(v.d)).map((v) => v.d)).size;
}

// ── แผนเยี่ยมเทียบมาตรฐาน (RULES ด้านล่าง) ─────────────────────────────────────────
export const PLAN_RULE = {
  perTrip: 600, // มาตรฐานร้านในแผนต่อทริป (1 เดือน) ต่อเซลล์
  high: 1.2,    // ≥ 120% ของมาตรฐาน = เกินมาก
  low: 0.8,     // ≤ 80% ของมาตรฐาน = ต่ำกว่ามาก
};
export type PlanLevel = 'overHigh' | 'over' | 'ok' | 'under' | 'underLow' | 'none';
export const PLAN_LEVEL_LABEL: Record<PlanLevel, string> = {
  overHigh: 'เกินมาตรฐานมาก', over: 'เกินมาตรฐาน', ok: 'ตามมาตรฐาน', under: 'ต่ำกว่ามาตรฐาน', underLow: 'ต่ำกว่ามาตรฐานมาก', none: 'ไม่มีแผน',
};

// มาตรฐานของช่วง [from, to] ทีละเดือน: ช่วงครอบคลุมทั้งทริปของเดือนนั้น (วันที่ 1 → วันสุดท้ายที่มีแผนของเดือน) = 600
//   ไม่เต็มทริป → ตามสัดส่วนวัน (600 × วันที่เลือก ÷ วันของทริป) เช่นเลือก 7 วันของทริป 27 วัน ≈ 156
export function planStandard(from: string, to: string, tripEnd: Map<string, string> = new Map()): number {
  if (!from || !to || to < from) return 0;
  const span = (x: string, y: string) => Math.round((Date.parse(y) - Date.parse(x)) / 86_400_000) + 1;
  let total = 0;
  for (let d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`); d.toISOString().slice(0, 7) <= to.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) {
    const ym = d.toISOString().slice(0, 7);
    const first = `${ym}-01`;
    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    const end = tripEnd.get(ym) ?? monthEnd; // วันสุดท้ายของทริปเดือนนี้
    const a = from > first ? from : first;
    const b = to < end ? to : end;
    if (b < a) continue;
    total += PLAN_RULE.perTrip * Math.min(1, span(a, b) / span(first, end));
  }
  return Math.round(total);
}

export function planLevel(planned: number, standard: number): { level: PlanLevel; diff: number; pct: number | null } {
  if (!planned || !standard) return { level: 'none', diff: 0, pct: null };
  const ratio = planned / standard;
  const level: PlanLevel = ratio >= PLAN_RULE.high ? 'overHigh' : planned > standard ? 'over' : planned === standard ? 'ok'
    : ratio <= PLAN_RULE.low ? 'underLow' : 'under';
  return { level, diff: planned - standard, pct: ratio * 100 };
}
