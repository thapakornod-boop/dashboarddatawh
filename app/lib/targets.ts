// Target / BE รายเซลล์รายเดือน อ่านจาก Google Sheet (BEST - Estimate)
// (port มาจากโปรเจ็ค dashboardsale: lib/targets.ts)
//   - tab "Estimate" = เดือนปัจจุบัน
//   - tab "YYYY-MM"  = เดือนก่อน ๆ เช่น 2026-03
// เดือนของแต่ละ tab ดูจากหัวคอลัมน์ "Target Oct ‘26" เสมอ
// (ถ้าขอ tab ที่ไม่มี Google จะส่ง tab แรกมาแทน จึงต้องเช็คเดือนจากหัวคอลัมน์)
import { rpc, selectTable } from '@/app/lib/api';

export type TargetRow = {
  ym: string;
  company: string;
  seller: string;
  principal: string;
  target: number;
  be: number;
};

// อ่านใหม่ทุก 5 นาที แก้ในชีตแล้วไม่เกิน 5 นาทีหน้าเว็บจะเห็น
const CACHE_MS = 5 * 60 * 1000;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

let cache: { at: number; byMonth: Map<string, TargetRow[]> } | null = null;
let loading: Promise<Map<string, TargetRow[]>> | null = null;

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// "1,234,567" / "(1,234)" / "-" / "" → ตัวเลข
function toNumber(s: string | undefined) {
  const t = (s ?? '').trim().replace(/,/g, '');
  if (!t || t === '-') return 0;
  const neg = /^\(.*\)$/.test(t);
  const n = Number(t.replace(/[()]/g, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

type SheetRow = { seller: string; principal: string; branch: string; target: number; be: number };

async function fetchTab(sheetId: string, tab: string) {
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=` +
    encodeURIComponent(tab);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Google Sheet "${tab}": HTTP ${res.status}`);
  const [header, ...body] = parseCsv(await res.text());
  if (!header) return null;

  const col = (test: (h: string) => boolean) => header.findIndex((h) => test(h.trim()));
  const iTarget = col((h) => /^target\b/i.test(h));
  const iSeller = col((h) => h === 'รหัสพนักงานขาย');
  const iPrinc = col((h) => h === 'Princ');
  const iBranch = col((h) => h === 'Branch');
  const iBe = col((h) => h === 'BE');
  if ([iTarget, iSeller, iPrinc, iBe].some((i) => i < 0)) return null;

  // "Target Oct ‘26" → 2026-10
  const m = header[iTarget].match(/target\s+([a-z]{3})\D*(\d{2})/i);
  const mi = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (!m || mi < 0) return null;
  const ym = `20${m[2]}-${String(mi + 1).padStart(2, '0')}`;

  // เอาเฉพาะแถวที่มีรหัสเซลล์ (แถว total ไม่มีรหัส)
  const rows: SheetRow[] = body
    .filter((r) => r[iSeller]?.trim() && r[iPrinc]?.trim())
    .map((r) => ({
      seller: r[iSeller].trim(),
      principal: r[iPrinc].trim(),
      branch: iBranch >= 0 ? (r[iBranch] ?? '').trim() : '',
      target: toNumber(r[iTarget]),
      be: toNumber(r[iBe]),
    }));
  return { ym, rows };
}

// บริษัทของเซลล์ (ชีตไม่มีคอลัมน์บริษัท)
//   1. P&G → SDO
//   2. seller_principal ระบุบริษัทไว้ (เช่น RCR001 / KCR001)
//   3. บริษัทที่เซลล์คนนั้นมียอดขายมากที่สุดใน 12 เดือนล่าสุด
//   4. ยังไม่มียอดเลย → บริษัทส่วนใหญ่ของ Branch + Principal เดียวกัน
async function companyResolver() {
  const to = new Date();
  const from = new Date(Date.UTC(to.getUTCFullYear() - 1, to.getUTCMonth(), 1));
  const [sales, mapping] = await Promise.all([
    rpc<{ company_code: string; seller: string; giv: number | string }>('dashboard_sales_by_seller', {
      p_from: from.toISOString().slice(0, 10),
      p_to: new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 1)).toISOString().slice(0, 10),
    }),
    selectTable<{ seller: string; principal: string; company_code: string }>(
      'seller_principal?select=seller,principal,company_code&company_code=not.is.null'
    ),
  ]);

  const fixed = new Map(mapping.map((r) => [`${r.seller}|${r.principal}`, r.company_code]));
  const bySales = new Map<string, { company: string; giv: number }>();
  for (const r of sales) {
    if (r.company_code === 'SDO') continue;
    const giv = Math.abs(Number(r.giv));
    const cur = bySales.get(r.seller);
    if (!cur || cur.giv < giv) bySales.set(r.seller, { company: r.company_code, giv });
  }

  return (rows: SheetRow[]) => {
    const known = rows.map((r) =>
      r.principal === 'P&G'
        ? 'SDO'
        : fixed.get(`${r.seller}|${r.principal}`) ?? bySales.get(r.seller)?.company ?? null
    );
    const votes = new Map<string, Map<string, number>>();
    rows.forEach((r, i) => {
      if (!known[i]) return;
      const k = `${r.branch}|${r.principal}`;
      const v = votes.get(k) ?? new Map<string, number>();
      v.set(known[i]!, (v.get(known[i]!) ?? 0) + 1);
      votes.set(k, v);
    });
    const majority = (k: string) =>
      [...(votes.get(k)?.entries() ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0];
    return rows.map((r, i) => known[i] ?? majority(`${r.branch}|${r.principal}`) ?? 'PDC');
  };
}

async function loadAll(): Promise<Map<string, TargetRow[]>> {
  const sheetId = process.env.TARGET_SHEET_ID;
  if (!sheetId) throw new Error('ยังไม่ได้ตั้งค่า TARGET_SHEET_ID ใน .env.local');

  // Estimate = เดือนปัจจุบัน แล้วไล่ tab ย้อนหลัง 24 เดือน
  const now = new Date();
  const tabs = ['Estimate'];
  for (let i = 0; i < 24; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    tabs.push(d.toISOString().slice(0, 7));
  }
  const [resolve, ...sheets] = await Promise.all([
    companyResolver(),
    ...tabs.map((t) => fetchTab(sheetId, t)),
  ]);

  const byMonth = new Map<string, TargetRow[]>();
  sheets.forEach((sheet, i) => {
    if (!sheet) return;
    // tab YYYY-MM ต้องเป็นเดือนเดียวกับหัวคอลัมน์ (กัน Google ส่ง tab แรกมาแทน)
    if (tabs[i] !== 'Estimate' && tabs[i] !== sheet.ym) return;
    // Estimate มาก่อนเสมอ ถ้ามี tab เดือนเดียวกันอีกให้ใช้ Estimate
    if (byMonth.has(sheet.ym)) return;
    const companies = resolve(sheet.rows);
    byMonth.set(
      sheet.ym,
      sheet.rows.map((r, j) => ({
        ym: sheet.ym,
        company: companies[j],
        seller: r.seller,
        principal: r.principal,
        target: r.target,
        be: r.be,
      }))
    );
  });
  return byMonth;
}

async function allTargets() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.byMonth;
  loading ??= loadAll()
    .then((byMonth) => {
      cache = { at: Date.now(), byMonth };
      return byMonth;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

// เริ่มโหลดชีตล่วงหน้า (ชีต ~1 วินาที) ระหว่างรอข้อมูลอื่น — getTargets จะใช้ Promise เดียวกัน
export function preloadTargets() {
  allTargets().catch(() => {}); // error จะไปโผล่ตอนเรียก getTargets
}

// Target / BE รายเซลล์ ของเดือนในช่วง fromYm ถึง toYm (รวมทั้งสองเดือน)
// พร้อมรายชื่อเดือนในช่วงที่มี Target ในชีต (ไว้บอกผู้ใช้ว่าเดือนไหนไม่มี)
export async function getTargets(
  fromYm: string,
  toYm: string
): Promise<{ rows: TargetRow[]; months: string[] }> {
  const byMonth = await allTargets();
  const inRange = [...byMonth.entries()].filter(([ym]) => ym >= fromYm && ym <= toYm);
  return {
    rows: inRange.flatMap(([, rows]) => rows),
    months: inRange.map(([ym]) => ym).sort(),
  };
}
