// STANGS KPI & Compliance — อ่านข้อมูลจาก Google Sheet (แชร์แบบลิงก์) แล้วจัดเป็นราย เซลล์ × วัน ส่งให้หน้าเว็บคำนวณ
//   Seller     : บริษัท / สาขา / Princ / Supervisor Manager / Supervisor / รหัสเซลล์ (รายชื่อเซลล์ที่ติดตาม)
//   Visit      : แผนเยี่ยมร้าน (รหัสเซลล์ × ร้าน × วันที่ × รูท) — ทั้งทริป
//   Compliance : การเข้าพบจริง (เวลาเข้า-ออกร้าน / ระยะเช็คอินจากพิกัดร้าน / Compliance yes-no / สถานะ)
// ยอดขายราย เซลล์ × วัน จาก sales_store_daily (vw_lg014) · อ่านชีตใหม่ทุก 5 นาที (หรือกดปุ่มในหน้าสถานะระบบ)
import 'server-only';
import { parseCsv } from '@/app/lib/targets';
import { addDays, deleteRows, insertRows, selectAll, selectTable } from '@/app/lib/api';
import type { SPlanDay, SSale, SSeller, SVisit, StangsData } from '@/app/lib/stangsCalc';

const SHEET_ID = process.env.STANGS_SHEET_ID || '1cbBj3KA5-1NGs8vyXk9ovhh7ocF_nRFhP2qZrWiX1h4';
const TABS = { seller: '0', visit: '1222415386', compliance: '268169504' };
const CACHE_MS = 5 * 60 * 1000;

type Sheet = Omit<StangsData, 'sales' | 'rangeFrom' | 'rangeTo' | 'minDate' | 'maxDate' | 'fromDb' | 'latestAll' | 'tripEnd'>;
let cache: { at: number; data: Sheet } | null = null;

// export CSV = ได้ทุกแถวของ tab แม้มีคนเปิด filter ค้างไว้ในชีต (gviz จะซ่อนแถวที่ถูก filter)
async function tab(gid: string) {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Google Sheet STANGS (gid ${gid}): HTTP ${res.status}`);
  const [header, ...rows] = parseCsv(await res.text());
  const idx = (name: string) => (header ?? []).findIndex((h) => h.trim() === name);
  return { rows: rows.filter((r) => r.some((c) => c.trim())), idx };
}

// "8:47" → 527 นาที
const hm = (s: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
// "20261104" / "1/11/2026" / "01/11/2026" → "2026-11-04"
const ymd = (s: string) => {
  const t = s.trim();
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
};

async function loadSheet(): Promise<Sheet> {
  const [s, v, c] = await Promise.all([tab(TABS.seller), tab(TABS.visit), tab(TABS.compliance)]);
  const at = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');

  const cI = {
    code: c.idx('Seller Code'), name: c.idx('Seller Name'), date: c.idx('Date'), adhoc: c.idx('Adhoc Route'), store: c.idx('Store Code'),
    storeName: c.idx('Store Name'), diff: c.idx('Diff (m)'), comp: c.idx('Compliance'), start: c.idx('Start (HH:MM)'), end: c.idx('End (HH:MM)'),
    dur: c.idx('Dur (HH:MM)'), status: c.idx('Status'),
  };
  const names = new Map<string, string>();
  const visits: SVisit[] = c.rows.map((r) => {
    const comp = at(r, cI.comp).toLowerCase();
    const diff = Number(at(r, cI.diff));
    const s = at(r, cI.code);
    if (s && at(r, cI.name)) names.set(s, at(r, cI.name));
    return {
      s, d: ymd(at(r, cI.date)), store: at(r, cI.store), storeName: at(r, cI.storeName),
      start: hm(at(r, cI.start)), end: hm(at(r, cI.end)), dur: hm(at(r, cI.dur)),
      diff: at(r, cI.diff) && Number.isFinite(diff) ? diff : null,
      comp: comp === 'yes' ? true : comp === 'no' ? false : null,
      adhoc: at(r, cI.adhoc).toLowerCase() === 'yes', status: at(r, cI.status),
    };
  }).filter((x) => x.s && x.d);

  const sI = { co: s.idx('Company'), br: s.idx('Branch'), p: s.idx('Principal'), m: s.idx('Supervisor Manager'), sup: s.idx('Supervisor'), code: s.idx('Sales Code') };
  const seen = new Set<string>();
  const sellers: SSeller[] = s.rows.map((r) => ({
    company: at(r, sI.co).toUpperCase(), branch: at(r, sI.br), principal: at(r, sI.p),
    manager: at(r, sI.m), supervisor: at(r, sI.sup), seller: at(r, sI.code), name: names.get(at(r, sI.code)) ?? '',
  })).filter((x) => x.seller && !seen.has(x.seller) && seen.add(x.seller));

  // แผนราย เซลล์ × วัน + ร้านในแผนที่เข้าพบจริงในวันเดียวกัน
  const visited = new Set(visits.map((x) => `${x.s}|${x.d}|${x.store}`));
  const vI = { code: v.idx('Sales Code'), store: v.idx('Customer Code'), date: v.idx('Date') };
  const planMap = new Map<string, SPlanDay>();
  for (const r of v.rows) {
    const sCode = at(r, vI.code), d = ymd(at(r, vI.date)), store = at(r, vI.store);
    if (!sCode || !d) continue;
    const k = `${sCode}|${d}`;
    const p = planMap.get(k) ?? { s: sCode, d, planned: 0, planVisited: 0 };
    p.planned++;
    if (visited.has(`${sCode}|${d}|${store}`)) p.planVisited++;
    planMap.set(k, p);
  }
  const plan = [...planMap.values()];

  const dates = [...plan.map((p) => p.d), ...visits.map((x) => x.d)].sort();
  return {
    sellers, plan, visits,
    firstDate: dates[0] ?? '', lastDate: dates[dates.length - 1] ?? '',
    latest: visits.reduce((m, x) => (x.d > m ? x.d : m), ''),
  };
}

async function getSheet() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const data = await loadSheet();
  cache = { at: Date.now(), data };
  return data;
}

export function clearStangsCache() {
  cache = null;
}

// หน้าสถานะระบบ: อ่านชีต STANGS ล่าสุดเมื่อไร + จำนวนข้อมูลแต่ละ tab
export async function stangsInfo() {
  const d = await getSheet();
  return {
    loadedAt: cache?.at ?? Date.now(),
    sellers: d.sellers.length,
    planRows: d.plan.reduce((n, p) => n + p.planned, 0),
    planSellers: new Set(d.plan.map((p) => p.s)).size,
    visits: d.visits.length,
    firstDate: d.firstDate, lastDate: d.lastDate, latest: d.latest,
  };
}

// ยอดขายราย เซลล์ × ร้าน × วัน จาก sales_store_daily (หน้าเว็บนับ Active Store ไม่ซ้ำ / ร้านซื้อต่อวันเอง)
async function salesRows(sellers: SSeller[], from: string, toExcl: string): Promise<SSale[]> {
  if (!sellers.length || !from) return [];
  const coOf = new Map(sellers.map((s) => [s.seller, s.company]));
  const list = encodeURIComponent(sellers.map((s) => `"${s.seller.replace(/"/g, '')}"`).join(','));
  const out: SSale[] = [];
  for (let o = 0; ; o += 1000) {
    const rows = await selectTable<{ company_code: string; seller: string; cardcode: string; d: string; giv: number; niv: number; bills: number; lines: number }>(
      `sales_store_daily?select=company_code,seller,cardcode,d,giv,niv,bills,lines&seller=in.(${list})&d=gte.${from}&d=lt.${toExcl}&cardcode=neq.-&order=d,seller,cardcode&limit=1000&offset=${o}`
    );
    for (const r of rows) {
      if (coOf.get(r.seller) !== r.company_code) continue; // รหัสเดียวกันคนละบริษัท ไม่นับ
      out.push({ s: r.seller, d: r.d, c: r.cardcode, b: Number(r.bills), l: Number(r.lines), g: Math.round(Number(r.giv) * 100) / 100, n: Math.round(Number(r.niv) * 100) / 100 });
    }
    if (rows.length < 1000) break;
  }
  return out;
}

// ── บันทึกชีต → Supabase (supabase/stangs.sql) ─────────────────────────────────────
// แทนที่เฉพาะช่วงวันที่ที่มีในชีตตอนนั้น: ใส่เดือนย้อนหลังในชีตแล้วบันทึก = เพิ่ม / อัปเดตเดือนนั้น · เดือนอื่นไม่ถูกแตะ
const SYNC_EVERY_MS = 60 * 60 * 1000; // เปิดหน้า STANGS แล้วบันทึกล่าสุดเกิน 1 ชม. → บันทึกใหม่ก่อน

export type StangsSync = { at: string; ok: boolean; date_from: string | null; date_to: string | null; sellers: number | null; plan_rows: number | null; visits: number | null; message: string | null };

const monthsBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`); d.toISOString().slice(0, 7) <= to.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) out.push(d.toISOString().slice(0, 7));
  return out;
};

let syncing: Promise<StangsSync> | null = null;

export function syncStangs(): Promise<StangsSync> {
  syncing ??= (async () => {
    try {
      const sheet = await loadSheet();
      cache = { at: Date.now(), data: sheet };
      if (!sheet.firstDate) throw new Error('ไม่พบข้อมูลวันที่ใน tab Visit / Compliance');
      const from = sheet.firstDate, to = sheet.lastDate;
      const yms = monthsBetween(from, to);
      await deleteRows(`stangs_plan_day?d=gte.${from}&d=lte.${to}`);
      await deleteRows(`stangs_visit?d=gte.${from}&d=lte.${to}`);
      await deleteRows(`stangs_seller?ym=in.(${yms.map((m) => `"${m}"`).join(',')})`);
      await insertRows('stangs_seller', yms.flatMap((ym) => sheet.sellers.map((s) => ({
        ym, seller: s.seller, company: s.company, branch: s.branch, principal: s.principal, manager: s.manager, supervisor: s.supervisor, name: s.name,
      }))));
      await insertRows('stangs_plan_day', sheet.plan.map((p) => ({ seller: p.s, d: p.d, planned: p.planned, plan_visited: p.planVisited })));
      await insertRows('stangs_visit', sheet.visits.map((v) => ({
        seller: v.s, d: v.d, store: v.store || null, store_name: v.storeName || null, start_min: v.start, end_min: v.end, dur_min: v.dur,
        diff_m: v.diff, compliant: v.comp, adhoc: v.adhoc, status: v.status || null,
      })));
      const log = {
        ok: true, date_from: from, date_to: to, sellers: sheet.sellers.length,
        plan_rows: sheet.plan.reduce((n, p) => n + p.planned, 0), visits: sheet.visits.length,
        message: `บันทึก ${from} ถึง ${to} (${yms.join(', ')})`,
      };
      await insertRows('stangs_sync', [log]);
      return { at: new Date().toISOString(), ...log };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await insertRows('stangs_sync', [{ ok: false, message: message.slice(0, 500) }]).catch(() => {});
      throw err;
    }
  })().finally(() => { syncing = null; });
  return syncing;
}

export async function lastStangsSync(): Promise<StangsSync | null> {
  const [row] = await selectTable<StangsSync>('stangs_sync?select=at,ok,date_from,date_to,sellers,plan_rows,visits,message&order=id.desc&limit=1');
  return row ?? null;
}
async function lastOkSyncAt(): Promise<number | null> {
  const [row] = await selectTable<{ at: string }>('stangs_sync?select=at&ok=is.true&order=id.desc&limit=1');
  return row ? Date.parse(row.at) : null;
}

// ── อ่านจาก Supabase ตามช่วงวันที่ ─────────────────────────────────────────────────────
const lastDayOf = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10);

async function bounds() {
  const one = async (t: string, dir: 'asc' | 'desc') => (await selectTable<{ d: string }>(`${t}?select=d&order=d.${dir}&limit=1`))[0]?.d ?? '';
  const [p0, p1, v0, v1] = await Promise.all([one('stangs_plan_day', 'asc'), one('stangs_plan_day', 'desc'), one('stangs_visit', 'asc'), one('stangs_visit', 'desc')]);
  const all = [p0, p1, v0, v1].filter(Boolean).sort();
  return { min: all[0] ?? '', max: all[all.length - 1] ?? '', latest: v1 };
}

// from / to (YYYY-MM-DD) ไม่ส่งมา → เดือนล่าสุดที่มีข้อมูล (ต้นเดือน → วันสุดท้ายที่มีแผน / เข้าพบในเดือนนั้น)
export async function getStangs(latestSalesDate: string, req: { from?: string; to?: string } = {}): Promise<StangsData> {
  let fromDb = true;
  try {
    const last = await lastOkSyncAt();
    if (!last || Date.now() - last > SYNC_EVERY_MS) await syncStangs().catch(() => {});
  } catch {
    fromDb = false; // ยังไม่ได้รัน supabase/stangs.sql → อ่านจากชีตสด ๆ แบบเดิม
  }

  if (!fromDb) {
    const sheet = await getSheet();
    const end = sheet.lastDate && sheet.lastDate < latestSalesDate ? sheet.lastDate : latestSalesDate;
    const sales = await salesRows(sheet.sellers, sheet.firstDate, addDays(end, 1)).catch(() => []);
    return { ...sheet, sales, rangeFrom: sheet.firstDate, rangeTo: sheet.lastDate, minDate: sheet.firstDate, maxDate: sheet.lastDate, fromDb: false, latestAll: sheet.latest,
      tripEnd: Object.fromEntries([...sheet.plan.reduce((m, p) => { const ym = p.d.slice(0, 7); if (!m.has(ym) || p.d > m.get(ym)!) m.set(ym, p.d); return m; }, new Map<string, string>())]) };
  }

  const b = await bounds();
  if (!b.max) return { sellers: [], plan: [], visits: [], sales: [], firstDate: '', lastDate: '', latest: '', rangeFrom: '', rangeTo: '', minDate: '', maxDate: '', fromDb: true, latestAll: '', tripEnd: {} };
  const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '');
  const latestYm = (b.latest || b.max).slice(0, 7);
  let from = valid(req.from) || `${latestYm}-01`;
  let to = valid(req.to) || (lastDayOf(latestYm) < b.max ? lastDayOf(latestYm) : b.max);
  if (from < b.min) from = b.min;
  if (to > b.max) to = b.max;
  if (to < from) to = from;

  const yms = monthsBetween(from, to);
  const [sellerRows, planRows, visitRows] = await Promise.all([
    selectAll<{ ym: string; seller: string; company: string; branch: string | null; principal: string | null; manager: string | null; supervisor: string | null; name: string | null }>(
      `stangs_seller?select=*&ym=in.(${yms.map((m) => `"${m}"`).join(',')})&order=ym,seller`),
    selectAll<{ seller: string; d: string; planned: number; plan_visited: number }>(`stangs_plan_day?select=seller,d,planned,plan_visited&d=gte.${from}&d=lte.${to}&order=d,seller`),
    selectAll<{ seller: string; d: string; store: string | null; store_name: string | null; start_min: number | null; end_min: number | null; dur_min: number | null; diff_m: number | null; compliant: boolean | null; adhoc: boolean; status: string | null }>(
      `stangs_visit?select=seller,d,store,store_name,start_min,end_min,dur_min,diff_m,compliant,adhoc,status&d=gte.${from}&d=lte.${to}&order=d,seller,id`),
  ]);
  // ทีมของเซลล์: เดือนล่าสุดในช่วงชนะ
  const bySeller = new Map<string, SSeller>();
  for (const r of sellerRows) {
    bySeller.set(r.seller, {
      company: r.company, branch: r.branch ?? '', principal: r.principal ?? '', manager: r.manager ?? '', supervisor: r.supervisor ?? '', seller: r.seller, name: r.name ?? '',
    });
  }
  const sellers = [...bySeller.values()];
  const plan: SPlanDay[] = planRows.map((p) => ({ s: p.seller, d: p.d, planned: p.planned, planVisited: p.plan_visited }));
  const visits: SVisit[] = visitRows.map((v) => ({
    s: v.seller, d: v.d, store: v.store ?? '', storeName: v.store_name ?? '', start: v.start_min, end: v.end_min, dur: v.dur_min,
    diff: v.diff_m == null ? null : Number(v.diff_m), comp: v.compliant, adhoc: v.adhoc, status: v.status ?? '',
  }));
  const end = to < latestSalesDate ? to : latestSalesDate;
  const [sales, tripEndList] = await Promise.all([
    salesRows(sellers, from, addDays(end, 1)).catch(() => []),
    // วันสุดท้ายที่มีแผนของแต่ละเดือนในช่วง (ดูทั้งเดือน)
    Promise.all(yms.map(async (ym) => {
      const [r] = await selectTable<{ d: string }>(`stangs_plan_day?select=d&d=gte.${ym}-01&d=lte.${lastDayOf(ym)}&order=d.desc&limit=1`);
      return [ym, r?.d ?? ''] as const;
    })),
  ]);
  return {
    sellers, plan, visits, sales,
    firstDate: from, lastDate: to, latest: b.latest && b.latest < to ? b.latest : visits.reduce((m, x) => (x.d > m ? x.d : m), ''),
    rangeFrom: from, rangeTo: to, minDate: b.min, maxDate: b.max, fromDb: true, latestAll: b.latest,
    tripEnd: Object.fromEntries(tripEndList.filter(([, d]) => d)),
  };
}
