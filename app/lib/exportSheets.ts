// ชีต Excel ของหน้า ร้านเครดิต / ยอดขายรายร้าน — ใช้ทั้งปุ่ม "Export ตาม filter" (browser) และ "Export ภาพรวม" (server)
import type { XCell, XCol, XSheet } from '@/app/lib/xlsx';
import { formatThaiMonth, monthAbbr } from '@/app/lib/period';

const COS = ['SDO', 'PDC', 'DC'];
const mLabel = (ym: string) => `${monthAbbr(ym)} ${ym.slice(2, 4)}`;
const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const per = (a: number, b: number) => (b ? r1((a / b) * 100) : null);

// ── ร้านเครดิต ─────────────────────────────────────────────
export type CreditSellerX = {
  company: string; seller: string; name: string; branch: string; princ: string;
  stores: number; giv: number; bills: number;
  months: Record<string, { stores: number; bills: number; giv: number; repeat: number }>;
};

const creditNotes = (n: number) => [
  'Active Store = จำนวนร้านไม่ซ้ำที่ซื้อในเดือนนั้น (ร้านเดียวซื้อกี่บิลก็นับ 1)',
  'บิล = จำนวนครั้งที่ขาย (ร้านเดียวขาย 10 ครั้ง = 10 บิล)',
  `เฉลี่ย / เดือน = รวมทุกเดือน ÷ ${n} เดือน · บิลต่อร้าน = บิลรวม ÷ Active Store รวมทุกเดือน`,
  '% ร้านเดิม = ร้านที่ซื้อเดือนนั้น และเดือนก่อนหน้าก็ซื้อจากเซลล์คนเดียวกัน ÷ Active Store ของเดือนนั้น',
  'เซลล์เครดิต = Channel ในชีต BEST - Estimate เป็น Credit / MAS หรือรหัส MS / ASM / DSM / CR',
];

export function creditSheets(sellers: CreditSellerX[], months: string[], info: [string, string][]): XSheet[] {
  const n = Math.max(months.length, 1);
  const sumM = (s: CreditSellerX, k: 'stores' | 'bills' | 'giv' | 'repeat') => months.reduce((t, ym) => t + (s.months[ym]?.[k] ?? 0), 0);

  // 1) สรุปรายบริษัท
  const byCo = COS.map((co) => {
    const list = sellers.filter((s) => s.company === co);
    const ms = list.reduce((t, s) => t + sumM(s, 'stores'), 0);
    const mr = list.reduce((t, s) => t + sumM(s, 'repeat'), 0);
    const bills = list.reduce((t, s) => t + s.bills, 0);
    const giv = list.reduce((t, s) => t + s.giv, 0);
    return { co, list, ms, mr, bills, giv };
  }).filter((x) => x.list.length);
  const all = byCo.reduce((t, x) => ({ n: t.n + x.list.length, ms: t.ms + x.ms, mr: t.mr + x.mr, bills: t.bills + x.bills, giv: t.giv + x.giv }), { n: 0, ms: 0, mr: 0, bills: 0, giv: 0 });
  const summary: XSheet = {
    name: 'สรุป', title: 'ร้านเครดิต · สรุปรายบริษัท', info,
    cols: [
      { header: 'บริษัท', width: 12 }, { header: 'เซลล์เครดิต (คน)', fmt: 'int', width: 16 },
      { header: 'Active Store เฉลี่ย / เดือน', fmt: 'int', width: 22 }, { header: 'บิลเฉลี่ย / เดือน', fmt: 'int', width: 18 },
      { header: 'บิลต่อร้าน', fmt: 'dec1', width: 12 }, { header: '% ร้านเดิมจากเดือนก่อน', fmt: 'pct', width: 22 },
      { header: 'GIV รวม', fmt: 'int', width: 18, bar: true }, { header: 'GIV เฉลี่ย / คน', fmt: 'int', width: 18 },
    ],
    coColor: 0,
    rows: byCo.map((x) => [x.co, x.list.length, r0(x.ms / n), r0(x.bills / n), x.ms ? r1(x.bills / x.ms) : null, per(x.mr, x.ms), r0(x.giv), r0(x.giv / x.list.length)]),
    total: ['รวม', all.n, r0(all.ms / n), r0(all.bills / n), all.ms ? r1(all.bills / all.ms) : null, per(all.mr, all.ms), r0(all.giv), all.n ? r0(all.giv / all.n) : null],
    notes: creditNotes(months.length),
  };

  // 2) รายเซลล์ × เดือน: Active / บิล
  const idCols: XCol[] = [
    { header: 'บริษัท', width: 9 }, { header: 'รหัสเซลล์', width: 12 }, { header: 'ชื่อเซลล์', width: 24 },
    { header: 'สาขา', width: 8 }, { header: 'Princ', width: 16 },
  ];
  const id = (s: CreditSellerX): XCell[] => [s.company, s.seller, s.name || null, s.branch || null, s.princ || null];
  const monthly: XSheet = {
    name: 'Active Store และบิล', title: 'เซลล์เครดิต · Active Store และจำนวนบิลรายเดือน', info,
    groups: [{ label: '', span: idCols.length }, ...months.map((ym) => ({ label: formatThaiMonth(ym), span: 2 })), { label: 'เฉลี่ย / เดือน', span: 2 }, { label: 'ทั้งช่วง', span: 4 }],
    cols: [
      ...idCols,
      ...months.flatMap((ym): XCol[] => [{ header: `Active ${mLabel(ym)}`, fmt: 'int', width: 11 }, { header: `บิล ${mLabel(ym)}`, fmt: 'int', width: 10 }]),
      { header: 'Active เฉลี่ย', fmt: 'dec1', width: 11 }, { header: 'บิลเฉลี่ย', fmt: 'dec1', width: 10 },
      { header: 'Active Store ทั้งช่วง', fmt: 'int', width: 14 }, { header: 'บิลต่อร้าน', fmt: 'dec1', width: 11 },
      { header: '% ร้านเดิม', fmt: 'pct', width: 11 }, { header: 'GIV รวม', fmt: 'int', width: 16, bar: true },
    ],
    coColor: 0,
    rows: sellers.map((s) => [
      ...id(s),
      ...months.flatMap((ym) => [s.months[ym]?.stores ?? null, s.months[ym]?.bills ?? null]),
      r1(sumM(s, 'stores') / n), r1(sumM(s, 'bills') / n),
      s.stores, sumM(s, 'stores') ? r1(s.bills / sumM(s, 'stores')) : null, per(sumM(s, 'repeat'), sumM(s, 'stores')), r0(s.giv),
    ]),
    total: [
      `รวม ${sellers.length} คน`, null, null, null, null,
      ...months.flatMap((ym) => [sellers.reduce((t, s) => t + (s.months[ym]?.stores ?? 0), 0), sellers.reduce((t, s) => t + (s.months[ym]?.bills ?? 0), 0)]),
      r1(all.ms / n), r1(all.bills / n), sellers.reduce((t, s) => t + s.stores, 0), all.ms ? r1(all.bills / all.ms) : null, per(all.mr, all.ms), r0(all.giv),
    ],
    notes: creditNotes(months.length),
  };

  // 3) GIV รายเดือน
  const giv: XSheet = {
    name: 'GIV รายเดือน', title: 'เซลล์เครดิต · GIV รายเดือน', info,
    cols: [
      ...idCols,
      ...months.map((ym): XCol => ({ header: mLabel(ym), fmt: 'int', width: 14 })),
      { header: 'GIV รวม', fmt: 'int', width: 16, bar: true }, { header: 'เฉลี่ย / เดือน', fmt: 'int', width: 14 },
      { header: 'GIV / Active Store', fmt: 'int', width: 16 },
    ],
    coColor: 0,
    rows: sellers.map((s) => [...id(s), ...months.map((ym) => (s.months[ym] ? r0(s.months[ym].giv) : null)), r0(s.giv), r0(s.giv / n), sumM(s, 'stores') ? r0(s.giv / sumM(s, 'stores')) : null]),
    total: [`รวม ${sellers.length} คน`, null, null, null, null, ...months.map((ym) => r0(sellers.reduce((t, s) => t + (s.months[ym]?.giv ?? 0), 0))), r0(all.giv), r0(all.giv / n), all.ms ? r0(all.giv / all.ms) : null],
  };

  return [summary, monthly, giv];
}

// ร้านของเซลล์: 1 แถว = เซลล์ × ร้าน · ยอด GIV รายเดือน
export type CreditStoreX = { company: string; seller: string; sellerName: string; cardcode: string; name: string; giv: number[]; bills: number };

export function creditStoreSheet(stores: CreditStoreX[], months: string[], info: [string, string][], title: string): XSheet {
  const n = Math.max(months.length, 1);
  return {
    name: 'รายร้าน', title, info,
    cols: [
      { header: 'บริษัท', width: 9 }, { header: 'รหัสเซลล์', width: 12 }, { header: 'ชื่อเซลล์', width: 22 },
      { header: 'รหัสร้าน', width: 14 }, { header: 'ชื่อร้าน', width: 34 },
      ...months.map((ym): XCol => ({ header: mLabel(ym), fmt: 'int', width: 13 })),
      { header: 'GIV รวม', fmt: 'int', width: 15, bar: true }, { header: 'เฉลี่ย / เดือน', fmt: 'int', width: 13 },
      { header: 'บิล', fmt: 'int', width: 9 }, { header: 'เดือนที่ซื้อ', fmt: 'int', width: 11 },
    ],
    coColor: 0,
    rows: stores.map((s) => {
      const total = s.giv.reduce((a, b) => a + b, 0);
      return [s.company, s.seller, s.sellerName || null, s.cardcode, s.name || null, ...s.giv.map((v) => (v ? r0(v) : null)), r0(total), r0(total / n), s.bills, s.giv.filter((v) => v > 0).length];
    }),
    total: [`รวม ${stores.length} ร้าน`, null, null, null, null,
      ...months.map((_, i) => r0(stores.reduce((t, s) => t + s.giv[i], 0))),
      r0(stores.reduce((t, s) => t + s.giv.reduce((a, b) => a + b, 0), 0)), r0(stores.reduce((t, s) => t + s.giv.reduce((a, b) => a + b, 0), 0) / n),
      stores.reduce((t, s) => t + s.bills, 0), null],
    notes: ['ช่องว่าง = เดือนนั้นร้านไม่ได้ซื้อจากเซลล์คนนี้', 'เดือนที่ซื้อ = จำนวนเดือนที่มียอด GIV > 0 ในช่วงที่เลือก'],
  };
}

// ── ยอดขายรายร้าน ─────────────────────────────────────────
// ทุกร้าน: 1 แถว = บริษัท × รหัสร้าน
export type StoreAllX = {
  company: string; cardcode: string; rsmcode: string | null; name: string | null;
  giv: number[]; niv: number; bills: number; lastD: string | null;
};

export function storeOverviewSheets(stores: StoreAllX[], months: string[], info: [string, string][]): XSheet[] {
  const n = Math.max(months.length, 1);
  const tot = (s: StoreAllX) => s.giv.reduce((a, b) => a + b, 0);

  const byCo = COS.map((co) => {
    const list = stores.filter((s) => s.company === co);
    const giv = list.reduce((t, s) => t + tot(s), 0);
    const active = months.map((_, i) => list.filter((s) => s.giv[i] > 0).length);
    return { co, list, giv, niv: list.reduce((t, s) => t + s.niv, 0), bills: list.reduce((t, s) => t + s.bills, 0), active };
  }).filter((x) => x.list.length);
  const sumAll = (k: 'giv' | 'niv' | 'bills') => byCo.reduce((t, x) => t + x[k], 0);
  const allActive = months.map((_, i) => byCo.reduce((t, x) => t + x.active[i], 0));
  const avgActive = (a: number[]) => r0(a.reduce((x, y) => x + y, 0) / n);

  const summary: XSheet = {
    name: 'สรุป', title: 'ยอดขายรายร้าน · สรุปรายบริษัท', info,
    groups: [{ label: '', span: 7 }, { label: 'Active Store รายเดือน (ร้านที่ซื้อ)', span: months.length }],
    cols: [
      { header: 'บริษัท', width: 12 }, { header: 'ร้านที่ซื้อทั้งช่วง', fmt: 'int', width: 16 },
      { header: 'Active Store เฉลี่ย / เดือน', fmt: 'int', width: 20 },
      { header: 'GIV รวม', fmt: 'int', width: 18, bar: true }, { header: 'NIV รวม', fmt: 'int', width: 18 },
      { header: 'บิล', fmt: 'int', width: 12 }, { header: 'GIV เฉลี่ย / ร้าน', fmt: 'int', width: 16 },
      ...months.map((ym): XCol => ({ header: mLabel(ym), fmt: 'int', width: 11 })),
    ],
    coColor: 0,
    rows: byCo.map((x) => [x.co, x.list.length, avgActive(x.active), r0(x.giv), r0(x.niv), x.bills, r0(x.giv / x.list.length), ...x.active]),
    total: ['รวม', stores.length, avgActive(allActive), r0(sumAll('giv')), r0(sumAll('niv')), sumAll('bills'), stores.length ? r0(sumAll('giv') / stores.length) : null, ...allActive],
    notes: [
      'ยอดจากทุกเซลล์ ยกเว้น GSM (เหมือนหน้า ยอดขายรายร้าน)',
      'ร้านที่ซื้อ / Active Store = ร้านไม่ซ้ำที่มีบิลขาย (ซื้อกี่บิลก็นับ 1) · ร้านเดียวกันคนละบริษัทนับแยกกัน',
    ],
  };

  const list: XSheet = {
    name: 'ร้านทั้งหมด', title: 'ยอดขายรายร้าน · ทุกร้านในช่วง (เรียงตาม GIV)', info,
    cols: [
      { header: 'บริษัท', width: 9 }, { header: 'รหัสร้าน', width: 14 }, { header: 'RSM code', width: 12 }, { header: 'ชื่อร้าน', width: 36 },
      ...months.map((ym): XCol => ({ header: mLabel(ym), fmt: 'int', width: 13 })),
      { header: 'GIV รวม', fmt: 'int', width: 15, bar: true }, { header: 'NIV รวม', fmt: 'int', width: 15 },
      { header: 'บิล', fmt: 'int', width: 9 }, { header: 'เดือนที่ซื้อ', fmt: 'int', width: 11 },
      { header: 'เฉลี่ย / เดือน', fmt: 'int', width: 13 }, { header: 'ซื้อล่าสุด', width: 12 },
    ],
    coColor: 0,
    rows: [...stores].sort((a, b) => tot(b) - tot(a)).map((s) => [
      s.company, s.cardcode, s.rsmcode, s.name, ...s.giv.map((v) => (v ? r0(v) : null)),
      r0(tot(s)), r0(s.niv), s.bills, s.giv.filter((v) => v > 0).length, r0(tot(s) / n), s.lastD ? thaiDate(s.lastD) : null,
    ]),
    total: [`รวม ${stores.length} ร้าน`, null, null, null, ...months.map((_, i) => r0(stores.reduce((t, s) => t + s.giv[i], 0))),
      r0(sumAll('giv')), r0(sumAll('niv')), sumAll('bills'), null, r0(sumAll('giv') / n), null],
    notes: ['ช่องว่าง = เดือนนั้นร้านไม่ได้ซื้อ · เดือนที่ซื้อ = จำนวนเดือนที่มียอด GIV > 0', 'กดปุ่มลูกศรที่หัวตารางเพื่อกรอง / เรียงข้อมูลได้'],
  };
  return [summary, list];
}

// ร้านที่เลือก (ตาม filter): สรุป / รายเดือน / ราย Princ / รายละเอียด
export type StoreOneX = {
  name: string; rsmcode: string | null; codes: { company: string; cardcode: string }[];
  rangeLabel: string; lastBuy: string | null;
  sales: { company: string; cardcode: string; principal: string; giv: number; niv: number; bills: number }[];
  monthly: { ym: string; company: string; giv: number; niv: number; bills: number }[];
  months: string[]; prevGiv: number | null;
};

export function storeOneSheets(x: StoreOneX, info: [string, string][]): XSheet[] {
  const n = Math.max(x.months.length, 1);
  const giv = x.sales.reduce((t, r) => t + r.giv, 0);
  const niv = x.sales.reduce((t, r) => t + r.niv, 0);
  const bills = x.monthly.length ? x.monthly.reduce((t, r) => t + r.bills, 0) : x.sales.reduce((t, r) => t + r.bills, 0);
  const cos = COS.filter((c) => x.sales.some((r) => r.company === c));
  const activeMonths = x.months.filter((ym) => x.monthly.some((r) => r.ym === ym && r.bills > 0)).length;

  const summary: XSheet = {
    name: 'สรุปร้าน', title: `ยอดขายรายร้าน · ${x.name}`, info,
    cols: [{ header: 'หัวข้อ', width: 30 }, { header: 'ค่า', fmt: 'int', width: 22 }, { header: 'หมายเหตุ', width: 44 }],
    rows: [
      ['GIV รวม', r0(giv), x.rangeLabel],
      ['NIV รวม', r0(niv), null],
      ['จำนวนบิล', bills, 'บิลเดียวหลาย Princ นับครั้งเดียว'],
      ['GIV เฉลี่ย / เดือน', r0(giv / n), `÷ ${x.months.length} เดือน`],
      ['เดือนที่ซื้อ', activeMonths, `จาก ${x.months.length} เดือน`],
      ['GIV ช่วงเดียวกันปีก่อน', x.prevGiv == null ? null : r0(x.prevGiv), null],
      ...cos.map((c): XCell[] => [`GIV ${c}`, r0(x.sales.filter((r) => r.company === c).reduce((t, r) => t + r.giv, 0)), null]),
    ],
  };

  const monthly: XSheet = {
    name: 'รายเดือน', title: `${x.name} · ยอดรายเดือน`, info,
    cols: [{ header: 'เดือน', width: 14 }, ...cos.map((c): XCol => ({ header: `GIV ${c}`, fmt: 'int', width: 15 })),
      { header: 'GIV รวม', fmt: 'int', width: 16, bar: true }, { header: 'NIV รวม', fmt: 'int', width: 16 }, { header: 'บิล', fmt: 'int', width: 10 }],
    rows: x.months.map((ym) => {
      const rows = x.monthly.filter((r) => r.ym === ym);
      return [formatThaiMonth(ym), ...cos.map((c) => { const v = rows.filter((r) => r.company === c).reduce((t, r) => t + r.giv, 0); return v ? r0(v) : null; }),
        r0(rows.reduce((t, r) => t + r.giv, 0)), r0(rows.reduce((t, r) => t + r.niv, 0)), rows.reduce((t, r) => t + r.bills, 0)];
    }),
    total: ['รวม', ...cos.map((c) => r0(x.monthly.filter((r) => r.company === c).reduce((t, r) => t + r.giv, 0))),
      r0(x.monthly.reduce((t, r) => t + r.giv, 0)), r0(x.monthly.reduce((t, r) => t + r.niv, 0)), x.monthly.reduce((t, r) => t + r.bills, 0)],
  };

  const princMap = new Map<string, { companies: Set<string>; giv: number; niv: number; bills: number }>();
  for (const r of x.sales) {
    const p = princMap.get(r.principal) ?? { companies: new Set<string>(), giv: 0, niv: 0, bills: 0 };
    p.companies.add(r.company); p.giv += r.giv; p.niv += r.niv; p.bills += r.bills;
    princMap.set(r.principal, p);
  }
  const princ: XSheet = {
    name: 'ราย Princ', title: `${x.name} · ซื้อ Princ อะไรบ้าง`, info,
    cols: [{ header: 'Princ', width: 20 }, { header: 'บริษัท', width: 14 }, { header: 'GIV', fmt: 'int', width: 16, bar: true },
      { header: 'NIV', fmt: 'int', width: 16 }, { header: 'บิล', fmt: 'int', width: 10 }, { header: 'สัดส่วน GIV', fmt: 'pct', width: 13 }, { header: 'เฉลี่ย / เดือน', fmt: 'int', width: 14 }],
    rows: [...princMap].sort((a, b) => b[1].giv - a[1].giv).map(([p, v]) => [p, [...v.companies].join(' / '), r0(v.giv), r0(v.niv), v.bills, per(v.giv, giv), r0(v.giv / n)]),
    total: ['รวม', null, r0(giv), r0(niv), x.sales.reduce((t, r) => t + r.bills, 0), giv ? 100 : null, r0(giv / n)],
    notes: ['บิลรายราย Princ: บิลเดียวที่มีหลาย Princ จะนับในทุก Princ ของบิลนั้น'],
  };

  const detail: XSheet = {
    name: 'รายละเอียด', title: `${x.name} · บริษัท × รหัสร้าน × Princ`, info,
    cols: [{ header: 'บริษัท', width: 10 }, { header: 'รหัสร้าน', width: 14 }, { header: 'Princ', width: 20 },
      { header: 'GIV', fmt: 'int', width: 16, bar: true }, { header: 'NIV', fmt: 'int', width: 16 }, { header: 'บิล', fmt: 'int', width: 10 }, { header: 'สัดส่วน GIV', fmt: 'pct', width: 13 }],
    coColor: 0,
    rows: [...x.sales].sort((a, b) => COS.indexOf(a.company) - COS.indexOf(b.company) || b.giv - a.giv)
      .map((r) => [r.company, r.cardcode, r.principal, r0(r.giv), r0(r.niv), r.bills, per(r.giv, giv)]),
    total: ['รวม', null, null, r0(giv), r0(niv), x.sales.reduce((t, r) => t + r.bills, 0), giv ? 100 : null],
  };
  return [summary, monthly, princ, detail];
}

function thaiDate(d: string) {
  const [y, m, dd] = d.slice(0, 10).split('-');
  return `${dd}/${m}/${y}`;
}
