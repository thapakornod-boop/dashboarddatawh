// ข้อมูลยอดขายมาจาก Supabase โดยตรง (ไม่ต้องต่อ VPN)
// ใช้ตารางสรุป sales_summary_daily ผ่าน RPC dashboard_sales_by_seller
// ซึ่งคิด GIV / NIV ตามกฎเดียวกับรายงาน Excel แล้ว:
//   - ตัด series ที่ลงท้าย CMP / DMP / -VAT
//   - SDO นับทุกเซลล์ยกเว้นรหัสที่มี GSM, PDC / DC นับเฉพาะเซลล์ใน seller_principal
// อัปเดตทุกชั่วโมง (pg_cron) — ใช้ฝั่ง server เท่านั้น ห้ามใช้ key นี้ใน client
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

// ── Summary types ─────────────────────────────────────────────────
export type LG014SellerRow = {
  Company: string;
  Princ: string;
  Seller: string;
  GIV: number;
  NIV: number;
  totalDocs: number;
  totalRows: number;
};

export type LG014CompanyRow = {
  Company: string;
  GIV: number;
  NIV: number;
  totalDocs: number;
  totalRows: number;
};

export type LG014PrincRow = {
  Princ: string;
  GIV: number;
  NIV: number;
  totalDocs: number;
  totalRows: number;
};

export type LG014SummaryBlock = {
  summary: {
    totalGIV: number;
    totalNIV: number;
    totalDocs: number;
    totalRows: number;
  };
  bySeller: LG014SellerRow[];
  byCompany: LG014CompanyRow[];
  byPrinc: LG014PrincRow[];
  period: { startDate: string; endDate: string };
};

export type LG014SummaryResponse = LG014SummaryBlock;

export type LG014SummaryBaseResponse = {
  current: LG014SummaryBlock;
  previous: LG014SummaryBlock;
  growth: {
    nivDiff: number;
    nivGrowthPct: number | null;
  };
};

// ── Month / date helpers ──────────────────────────────────────────
export function monthToRange(ym: string): { startDate: string; endDate: string } {
  const [y, m] = ym.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDayNum = new Date(y, m, 0).getDate();
  return {
    startDate: `${y}-${pad(m)}-01`,
    endDate:   `${y}-${pad(m)}-${pad(lastDayNum)}`,
  };
}

function getCurrentYM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// "2026-08-31" + 1 วัน → "2026-09-01" (RPC ใช้ช่วง [from, to) )
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// ย้อนปี โดย 29 ก.พ. → 28 ก.พ.
export function shiftYears(date: string, years: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y - years, m, 0)).getUTCDate();
  return new Date(Date.UTC(y - years, m - 1, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

// ── Supabase RPC ──────────────────────────────────────────────────
type SellerRpcRow = {
  company_code: string;
  seller: string;
  principal: string | null;
  counted: boolean;
  giv: number | string;
  niv: number | string;
};

function supabaseHeaders() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error('ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_SECRET_KEY ใน .env.local');
  }
  return {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
}

// RPC ที่คืนค่าเดียว (ไม่ใช่ตาราง) เช่น dashboard_latest_date / dashboard_sales
async function rpcScalar<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase ${fn}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const headers = supabaseHeaders();
  // PostgREST ส่งได้ครั้งละ 1000 แถว จึงไล่หน้าจนหมด
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/${fn}?limit=1000&offset=${offset}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(args),
        // ไม่ cache — ไม่งั้นค่าว่าง/ค่าเก่าจะค้าง (ตารางสรุปอัปเดตทุกชั่วโมงอยู่แล้ว)
        cache: 'no-store',
      }
    );
    if (!res.ok) throw new Error(`Supabase ${fn}: ${res.status} ${await res.text()}`);
    const page = (await res.json()) as T[];
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

// อ่านตารางตรง ๆ เช่น "seller_principal?select=seller,principal"
export async function selectTable<T>(query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: supabaseHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase ${query}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

// cache ในหน่วยความจำ 5 นาที — ตารางสรุปอัปเดตทุกชั่วโมงอยู่แล้ว
// เปิดซ้ำ / เปลี่ยน filter ไปมาจะไม่ต้องยิง Supabase ใหม่ทุกครั้ง (เก็บ Promise กันยิงซ้ำตอนโหลดพร้อมกัน)
const CACHE_MS = 5 * 60 * 1000;
const memo = new Map<string, { at: number; value: Promise<unknown> }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as Promise<T>;
  const value = load();
  memo.set(key, { at: Date.now(), value });
  value.catch(() => memo.delete(key)); // error ไม่ต้องจำ
  return value;
}

// วันที่เอกสารล่าสุดในตารางสรุป เช่น "2026-10-29"
export function getLatestDate(): Promise<string> {
  return cached('latest', async () => {
    const latest = await rpcScalar<string | null>('dashboard_latest_date', {});
    if (!latest) throw new Error('ไม่พบข้อมูลใน sales_summary_daily');
    return latest;
  });
}

// ── ยอดรวมรายบริษัท (Scorecard) ──────────────────────────────────
// ช่วง [from, to) (to ไม่รวม) เฉพาะเซลล์ที่นับยอด — มาจาก RPC dashboard_sales ที่มีอยู่แล้ว
export type CompanyTotal = { giv: number; niv: number; lines: number; bills: number };

export function getCompanyTotals(from: string, to: string): Promise<Record<string, CompanyTotal>> {
  return cached(`co|${from}|${to}`, async () => {
    const res = await rpcScalar<{ byCompany: { company: string; giv: number; niv: number; lines: number; bills: number }[] }>(
      'dashboard_sales', { p_from: from, p_to: to }
    );
    return Object.fromEntries(res.byCompany.map((c) => [c.company, {
      giv: Number(c.giv), niv: Number(c.niv), lines: Number(c.lines), bills: Number(c.bills),
    }]));
  });
}

// ตัวชี้วัดระดับร้านค้า (Active Stores / วันทำงานจริง / Line ที่ยอด > 1 บาท) จาก RPC dashboard_kpi
// ต้องรัน supabase/kpi_store.sql ก่อน — ยังไม่ได้รันจะคืน null (หน้าเว็บแสดง "รอข้อมูล")
export type CompanyKpi = { active_stores: number; work_days: number; bills: number; lines: number; lines_gt1: number };

export function getCompanyKpi(from: string, to: string): Promise<Record<string, CompanyKpi> | null> {
  return cached(`kpi|${from}|${to}`, async () => {
    try {
      const rows = await rpc<CompanyKpi & { company_code: string }>('dashboard_kpi', { p_from: from, p_to: to });
      return Object.fromEntries(rows.map((r) => [r.company_code, {
        active_stores: Number(r.active_stores), work_days: Number(r.work_days),
        bills: Number(r.bills), lines: Number(r.lines), lines_gt1: Number(r.lines_gt1),
      }]));
    } catch (err) {
      // ยังไม่ได้สร้างฟังก์ชันในฐานข้อมูล → ไม่ถือเป็น error ของหน้า
      if (err instanceof Error && /PGRST202|: 404 /.test(err.message)) return null;
      throw err;
    }
  });
}

// เดือนที่มีข้อมูลจริง (เก่า → ใหม่) ไว้ทำตัวเลือก filter
// ตัดเดือนที่มีแค่เอกสารหลงมาไม่กี่ใบ (ยอด < 1% ของเดือนที่สูงสุด) เช่น 2025-01 ที่มี 587 บาท
export function getAvailableMonths(): Promise<string[]> {
  return cached('months', loadAvailableMonths);
}

async function loadAvailableMonths(): Promise<string[]> {
  // p_to = ต้นเดือนหน้า ไม่ต้องรอ getLatestDate ก่อน
  const now = new Date();
  const res = await rpcScalar<{ byMonth: { ym: string; giv: number }[] }>('dashboard_sales', {
    p_from: '2024-01-01',
    p_to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10),
  });
  const max = Math.max(...res.byMonth.map((m) => Math.abs(Number(m.giv))), 0);
  return res.byMonth
    .filter((m) => Math.abs(Number(m.giv)) >= max * 0.01)
    .map((m) => m.ym)
    .sort();
}

function buildBlock(rows: SellerRpcRow[], startDate: string, endDate: string): LG014SummaryBlock {
  // เอาเฉพาะเซลล์ที่นับยอด → ยอดรวมตรงกับรายงาน
  const bySeller: LG014SellerRow[] = rows
    .filter((r) => r.counted)
    .map((r) => ({
      Company: r.company_code,
      Princ: r.principal ?? (r.company_code === 'SDO' ? 'P&G' : ''),
      Seller: r.seller,
      GIV: Number(r.giv),
      NIV: Number(r.niv),
      totalDocs: 0,
      totalRows: 0,
    }));

  const group = <K extends 'Company' | 'Princ'>(key: K) => {
    const map = new Map<string, { GIV: number; NIV: number }>();
    for (const r of bySeller) {
      const cur = map.get(r[key]) ?? { GIV: 0, NIV: 0 };
      cur.GIV += r.GIV;
      cur.NIV += r.NIV;
      map.set(r[key], cur);
    }
    return Array.from(map, ([k, v]) => ({ [key]: k, ...v, totalDocs: 0, totalRows: 0 })) as
      (Record<K, string> & { GIV: number; NIV: number; totalDocs: number; totalRows: number })[];
  };

  return {
    summary: {
      totalGIV: bySeller.reduce((s, r) => s + r.GIV, 0),
      totalNIV: bySeller.reduce((s, r) => s + r.NIV, 0),
      totalDocs: 0,
      totalRows: 0,
    },
    bySeller,
    byCompany: group('Company'),
    byPrinc: group('Princ'),
    period: { startDate, endDate },
  };
}

// startDate / endDate รวมทั้งสองวัน (เหมือน API เดิม)
async function fetchBlock(startDate?: string, endDate?: string): Promise<LG014SummaryBlock> {
  const range = monthToRange(getCurrentYM());
  const from = startDate ?? range.startDate;
  const to = endDate ?? range.endDate;
  const rows = await cached(`seller|${from}|${to}`, () =>
    rpc<SellerRpcRow>('dashboard_sales_by_seller', { p_from: from, p_to: addDays(to, 1) })
  );
  return buildBlock(rows, from, to);
}

// ── getLG014Summary (trend months) ───────────────────────────────
export async function getLG014Summary({
  startDate,
  endDate,
}: {
  startDate?: string;
  endDate?: string;
}): Promise<LG014SummaryResponse> {
  return fetchBlock(startDate, endDate);
}

// ── getLG014SummaryBase (ช่วงที่เลือก เทียบช่วงเดียวกันของปีก่อน) ──
export async function getLG014SummaryBase({
  startDate,
  endDate,
  yearsBack = 1,
}: {
  startDate?: string;
  endDate?: string;
  yearsBack?: number;
}): Promise<LG014SummaryBaseResponse> {
  const current = await fetchBlock(startDate, endDate);
  const previous = await fetchBlock(
    shiftYears(current.period.startDate, yearsBack),
    shiftYears(current.period.endDate, yearsBack)
  );
  const nivDiff = current.summary.totalNIV - previous.summary.totalNIV;
  return {
    current,
    previous,
    growth: {
      nivDiff,
      nivGrowthPct: previous.summary.totalNIV
        ? Number(((nivDiff / Math.abs(previous.summary.totalNIV)) * 100).toFixed(2))
        : null,
    },
  };
}
