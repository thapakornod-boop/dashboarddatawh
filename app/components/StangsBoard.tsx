'use client';

// หน้า STANGS KPI & Compliance (ทั้งหน้า): ตัวกรองชุดเดียว → การ์ดสรุป 3 แถบ → ตารางเซลล์ (ไม่ต้องเลื่อนซ้าย-ขวา) → รายละเอียดเซลล์ที่เลือก
// ทุกส่วนคำนวณจากตัวกรองเดียวกัน (lib/stangsCalc) เปลี่ยนตัวกรองแล้วตัวเลขเปลี่ยนตามทันที
import { Fragment, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  dayStats, hhmm, ISSUES, NEXT_ACTION, PLAN_LEVEL_LABEL, PLAN_TYPE_LABEL, PLAN_RULE, planLevel, planStandard, RULES, sellerRows, totals,
  type DayStat, type Metrics, type SellerRow, type StangsData,
} from '@/app/lib/stangsCalc';
import { COMPANY_COLORS, fmtInt } from '@/app/lib/format';
import { buildWorkbook, downloadBuffer, exportedAt, type XCell, type XSheet } from '@/app/lib/xlsx';
import { closeLoading, showError, showLoading, showToast } from '@/app/components/Loading';
import type { DayStore } from '@/app/dashboard/stangs/day/route';

type DaySales = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ok'; stores: DayStore[] };

const ALL = '';
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();
const pct = (a: number, b: number) => (b ? (a / b) * 100 : null);
const pctText = (a: number, b: number) => { const p = pct(a, b); return p == null ? '–' : `${p.toFixed(1)}%`; };
const per = (a: number, b: number) => (b ? (a / b).toLocaleString('th-TH', { maximumFractionDigits: 1 }) : '–');
const f2 = (n: number | null) => (n == null ? '–' : n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const dShort = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;
const dThai = (d: string) => (d ? `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}/${d.slice(0, 4)}` : '–');
const WEEKDAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const weekday = (d: string) => WEEKDAY[new Date(`${d}T00:00:00Z`).getUTCDay()];

function Band({ no, title, tone, items, note }: {
  no: string; title: string; tone: 'blue' | 'green' | 'orange';
  items: { label: string; value: string; sub?: string }[]; note: React.ReactNode;
}) {
  return (
    <section className={`stg-band stg-${tone}`}>
      <div className="stg-band-head"><b>{no}</b> {title}</div>
      <div className="stg-tiles">
        {items.map((it) => (
          <div key={it.label} className="stg-tile">
            <span className="stg-tile-label">{it.label}</span>
            <span className="stg-tile-val">{it.value}</span>
            {it.sub && <span className="stg-tile-sub">{it.sub}</span>}
          </div>
        ))}
      </div>
      <p className="stg-band-note">{note}</p>
    </section>
  );
}

export default function StangsBoard({ data }: { data: StangsData }) {
  const asOf = data.latest || data.lastDate;
  const from = data.rangeFrom;
  const to = data.rangeTo;
  const router = useRouter();
  const [loading, startLoading] = useTransition();
  useEffect(() => { if (!loading) closeLoading(); }, [loading]);
  // เปลี่ยนช่วงวันที่ = โหลดข้อมูลช่วงนั้นจาก server ใหม่ (ตัวกรองอื่นคงไว้)
  const setRange = (a: string, b: string) => {
    if (!a || !b || (a === from && b === to)) return;
    const [x, y] = a <= b ? [a, b] : [b, a];
    showLoading('กำลังโหลดข้อมูล', `${dThai(x)} – ${dThai(y)}`);
    startLoading(() => router.push(`?from=${x}&to=${y}`, { scroll: false }));
  };
  const [co, setCo] = useState(ALL);
  const [branch, setBranch] = useState(ALL);
  const [princ, setPrinc] = useState(ALL);
  const [manager, setManager] = useState(ALL);
  const [sup, setSup] = useState(ALL);
  const [seller, setSeller] = useState(ALL);
  const [onlyIssue, setOnlyIssue] = useState(false);
  const [openDay, setOpenDay] = useState('');
  const [daySales, setDaySales] = useState<Record<string, DaySales>>({});
  const toggleDay = (seller: string, company: string, d: string) => {
    if (openDay === d) { setOpenDay(''); return; }
    setOpenDay(d);
    const key = `${seller}|${d}`;
    if (daySales[key]?.state === 'ok' || daySales[key]?.state === 'loading') return;
    setDaySales((m) => ({ ...m, [key]: { state: 'loading' } }));
    fetch(`/dashboard/stangs/day?${new URLSearchParams({ company, seller, d })}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setDaySales((m) => ({ ...m, [key]: { state: 'ok', stores: j.stores as DayStore[] } }));
      })
      .catch((e: unknown) => setDaySales((m) => ({ ...m, [key]: { state: 'error', message: e instanceof Error ? e.message : String(e) } })));
  };

  // ตัวเลือกแต่ละช่องขึ้นกับช่องก่อนหน้า
  const s = data.sellers;
  const okCo = (x: (typeof s)[number]) => !co || x.company === co;
  const okBr = (x: (typeof s)[number]) => okCo(x) && (!branch || x.branch === branch);
  const okPr = (x: (typeof s)[number]) => okBr(x) && (!princ || x.principal === princ);
  const okMg = (x: (typeof s)[number]) => okPr(x) && (!manager || x.manager === manager);
  const okSp = (x: (typeof s)[number]) => okMg(x) && (!sup || x.supervisor === sup);
  const opts = {
    co: uniq(s.map((x) => x.company)),
    branch: uniq(s.filter(okCo).map((x) => x.branch)),
    princ: uniq(s.filter(okBr).map((x) => x.principal)),
    manager: uniq(s.filter(okPr).map((x) => x.manager)),
    sup: uniq(s.filter(okMg).map((x) => x.supervisor)),
    seller: s.filter(okSp).sort((a, b) => a.seller.localeCompare(b.seller)),
  };

  const allRows = useMemo(() => sellerRows(data, data.sellers.filter(okSp), from, to),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, from, to, co, branch, princ, manager, sup]);
  const rows = allRows.filter((r) => (!seller || r.seller === seller) && (!onlyIssue || r.totalIssues > 0));
  const t: Metrics = totals(rows);
  // วันสุดท้ายของทริปแต่ละเดือน = วันสุดท้ายที่มีแผนเยี่ยมของเดือนนั้น (server ส่งมา ดูทั้งเดือน)
  const tripEnd = useMemo(() => new Map(Object.entries(data.tripEnd)), [data.tripEnd]);
  const planStd = planStandard(from, to, tripEnd); // มาตรฐานร้านในแผนของช่วงนี้ (600 / ทริป ตามสัดส่วนวัน)
  const planOf = (r: SellerRow) => planLevel(r.plannedTrip, planStd);
  const planCount = (lv: string[]) => rows.filter((r) => lv.includes(planOf(r).level)).length;
  const noPlan = rows.filter((r) => r.plannedTrip === 0); // เซลล์ที่ไม่มีแผนใน tab Visit (ช่วงที่เลือก)
  const picked = seller ? rows.find((r) => r.seller === seller) ?? null : null;
  const days: DayStat[] = useMemo(() => (seller ? dayStats(data, seller, from, to) : []), [data, seller, from, to]);

  const pick = (code: string) => {
    setSeller(code);
    setOpenDay('');
    if (code) setTimeout(() => document.getElementById('stg-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const reset = () => { setCo(ALL); setBranch(ALL); setPrinc(ALL); setManager(ALL); setSup(ALL); setSeller(ALL); setOnlyIssue(false); };
  // ปุ่มลัด: อิงวันที่ล่าสุดที่มีข้อมูลใน Supabase
  const shift = (d: string, days: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + days); return x.toISOString().slice(0, 10); };
  const clip = (d: string) => (d < data.minDate ? data.minDate : d > data.maxDate ? data.maxDate : d);
  const lastOf = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const latestAll = data.latestAll || data.maxDate;
  const curYm = latestAll.slice(0, 7);
  const prevYm = shift(`${curYm}-01`, -1).slice(0, 7);
  const presets = [
    { key: 'cur', label: 'เดือนนี้', a: clip(`${curYm}-01`), b: clip(lastOf(curYm)) },
    { key: 'prev', label: 'เดือนก่อน', a: clip(`${prevYm}-01`), b: clip(lastOf(prevYm)) },
    { key: '7d', label: '7 วันล่าสุด', a: clip(shift(latestAll, -6)), b: latestAll },
    { key: '1d', label: 'วันล่าสุด', a: latestAll, b: latestAll },
  ].filter((p) => p.a <= p.b && !(p.key === 'prev' && prevYm < data.minDate.slice(0, 7)));
  const rangeText = `${dThai(from)} – ${dThai(to)}`;
  const toDateText = to > asOf ? `แผน / การเข้าพบนับถึง ${dThai(asOf)} (วันที่มีข้อมูลเข้าพบล่าสุด)` : '';

  const problemText = (r: SellerRow) => (r.problems.length ? r.problems.slice(0, 3).map((p) => `${p.label} ${fmtInt(p.n)} ${p.unit}`).join(' · ') : 'ไม่พบปัญหา');
  const actionText = (r: SellerRow) => (r.workDays === 0 ? 'ไม่มีข้อมูลเข้าพบ — ตรวจสอบการใช้แอป STANGS'
    : r.problems.length ? r.problems.slice(0, 2).map((p) => NEXT_ACTION[p.key]).join(' · ') : 'รักษามาตรฐาน');

  // ── Excel: scope 'filter' = เซลล์ตามตัวกรองที่เลือก · 'all' = ทุกเซลล์ในช่วงวันที่ (ไม่สนตัวกรองอื่น) ──
  const exportExcel = async (scope: 'filter' | 'all') => {
    showLoading('กำลังทำไฟล์ Excel', scope === 'all' ? 'ทุกเซลล์ในช่วงวันที่ที่เลือก' : 'ตามตัวกรองที่เลือก');
    try {
      const rowsX = scope === 'all' ? sellerRows(data, data.sellers, from, to) : rows;
      const tX = totals(rowsX);
      const sellerSet = new Set(rowsX.map((r) => r.seller));
      const filterText = scope === 'all' ? 'ทั้งหมด (ไม่ใช้ตัวกรอง)'
        : [co, branch, princ && `Princ ${princ}`, manager && `Manager ${manager}`, sup && `Sup ${sup}`, seller && `เซลล์ ${seller}`, onlyIssue && 'เฉพาะคนที่มีปัญหา'].filter(Boolean).join(' · ') || 'ทั้งหมด';
      const info: [string, string][] = [
        ['ช่วงวันที่', `${rangeText}${toDateText ? ` · ${toDateText}` : ''}`],
        ['ตัวกรอง', filterText],
        ['จำนวนเซลล์', `${rowsX.length} คน`],
        ['Export เมื่อ', exportedAt()],
      ];
      const nm = new Map(data.sellers.map((s) => [s.seller, s]));
      const pctN = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);

      // 1) Summary — 3 แถบ + วิธีคำนวณ
      const issue = (k: string) => ISSUES.find((x) => x.key === k)!;
      const sumRows: XCell[][] = [
        ['01 KPI COMPLIANCE', null, null],
        ['Planned Stores (Full Trip)', tX.plannedTrip, 'ร้านตามแผนเยี่ยม (tab Visit) ทุกวันในช่วงที่เลือก'],
        ['Planned Stores ถึงวันข้อมูลล่าสุด', tX.plannedToDate, 'แผนตั้งแต่ต้นช่วงถึงวันที่มีข้อมูลเข้าพบล่าสุด'],
        ['Actual Visits', tX.visits, 'จำนวนครั้งที่เข้าพบจริงทั้งหมด รวมโยก / นอกแผน (tab Compliance)'],
        ['Plan Compliance %', pctN(tX.planVisited, tX.plannedToDate) == null ? null : `${pctN(tX.planVisited, tX.plannedToDate)}%`, 'ร้านในแผนที่เข้าพบจริงในวันเดียวกัน ÷ แผนถึงวันข้อมูลล่าสุด'],
        ['Missed Visits', tX.missed, 'แผนถึงวันข้อมูลล่าสุด − ร้านในแผนที่เข้าพบจริง'],
        ['Adhoc Visits', tX.adhoc, 'เข้าพบที่ Adhoc Route = yes'],
        [`มาตรฐานแผนทริป`, planStd, `${PLAN_RULE.perTrip} ร้าน / ทริป (ตามสัดส่วนวันถ้าเลือกไม่เต็มทริป)`],
        ['02 SALES PERFORMANCE', null, null],
        ['Active Store (ร้านไม่ซ้ำ)', tX.buyingStores, 'ร้านที่มีบิล 1 ร้านนับ 1 ไม่ว่าซื้อกี่บิล / กี่วัน (vw_lg014)'],
        ['ร้านซื้อเฉลี่ย / วัน', tX.billDays ? (tX.buyStoreDays / tX.billDays).toFixed(1) : null, 'ร้านที่มีบิลแต่ละวันรวมกัน ÷ วันที่มีบิล'],
        ['Total Bills', tX.bills, 'จำนวนบิลขาย'],
        ['Total Sales (GIV)', Math.round(tX.sales), 'ยอดก่อนหักส่วนลด'],
        ['NIV', Math.round(tX.niv), 'ยอดสุทธิ'],
        ['SKU per Bill', tX.bills ? (tX.lines / tX.bills).toFixed(2) : null, 'บรรทัดสินค้า ÷ บิล'],
        ['Baht per Bill', tX.bills ? Math.round(tX.sales / tX.bills) : null, 'GIV ÷ บิล'],
        ['03 ISSUE MONITORING', null, null],
        ...(['lateStart', 'earlyFinish', 'shortHours', 'shortVisits', 'farCheckin'] as const).map((k): XCell[] => [
          `${issue(k).short} · ${issue(k).label}`, tX[k], `${issue(k).rule} (นับเป็น${issue(k).unit})`,
        ]),
        ['Total Issues', rowsX.reduce((n, r) => n + r.totalIssues, 0), 'รวม 5 ข้อด้านบน'],
      ];
      // สรุปรายสาขา
      const byBranch = new Map<string, SellerRow[]>();
      for (const r of rowsX) { const k = `${r.company}|${r.branch}`; byBranch.set(k, [...(byBranch.get(k) ?? []), r]); }
      const sheets: XSheet[] = [{
        name: 'Summary', title: 'SALES KPI & COMPLIANCE · STANGS · SUMMARY', info,
        cols: [{ header: 'หัวข้อ', width: 40 }, { header: 'ค่า', width: 18, fmt: 'int' }, { header: 'วิธีคำนวณ', width: 80 }],
        band: (r) => r[1] == null && r[2] == null,
        rows: sumRows,
        notes: [
          'เยี่ยม = ร้านอยู่ในแผนของวันนั้น · โยก = ร้านอยู่ในแผนของเซลล์คนนี้แต่เป็นแผนของวันอื่น (มาเยี่ยมคนละวันกับแผน) · นอกแผน = ร้านไม่อยู่ในแผนของเซลล์คนนี้เลยทั้งทริป',
          ...NOTES,
        ],
      }, {
        name: 'สรุปรายสาขา', title: 'สรุปรายบริษัท × สาขา', info,
        cols: [
          { header: 'บริษัท', width: 9 }, { header: 'สาขา', width: 8 }, { header: 'เซลล์', width: 8, fmt: 'int' },
          { header: 'Planned (ทริป)', width: 12, fmt: 'int' }, { header: 'Actual Visits', width: 11, fmt: 'int' }, { header: 'Plan Compliance %', width: 12, fmt: 'pct' },
          { header: 'Missed', width: 9, fmt: 'int' }, { header: 'Adhoc', width: 9, fmt: 'int' }, { header: 'Active Store', width: 11, fmt: 'int' },
          { header: 'บิล', width: 9, fmt: 'int' }, { header: 'GIV', width: 14, fmt: 'int', bar: true }, { header: 'NIV', width: 14, fmt: 'int' },
          { header: 'Late Start', width: 9, fmt: 'int' }, { header: 'Early Finish', width: 9, fmt: 'int' }, { header: 'Short Hours', width: 9, fmt: 'int' },
          { header: 'Quick Visits', width: 9, fmt: 'int' }, { header: 'Far Check-in', width: 10, fmt: 'int' }, { header: 'Total Issues', width: 10, fmt: 'int', bar: true },
        ],
        coColor: 0,
        rows: [...byBranch.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, list]) => {
          const m = totals(list);
          return [k.split('|')[0], k.split('|')[1], list.length, m.plannedTrip, m.visits, pctN(m.planVisited, m.plannedToDate), m.missed, m.adhoc,
            m.buyingStores, m.bills, Math.round(m.sales), Math.round(m.niv), m.lateStart, m.earlyFinish, m.shortHours, m.shortVisits, m.farCheckin,
            list.reduce((n, r) => n + r.totalIssues, 0)];
        }),
      }];

      // 2) Seller Monitoring
      sheets.push({
        name: 'Seller Monitoring', title: 'SALES KPI & COMPLIANCE · STANGS', info,
        cols: [
          { header: 'Rank', width: 6, fmt: 'int' }, { header: 'Company', width: 9 }, { header: 'Branch', width: 8 }, { header: 'Principal', width: 9 },
          { header: 'Supervisor Manager', width: 22 }, { header: 'Supervisor', width: 22 }, { header: 'Seller', width: 10 }, { header: 'ชื่อเซลล์', width: 24 },
          { header: 'Working Day (จริง)', width: 9, fmt: 'int' }, { header: 'Working Day (วันตามแผน)', width: 10, fmt: 'int' },
          { header: 'Avg Start', width: 9 }, { header: 'Avg Finish', width: 9 }, { header: 'Avg Work Hours', width: 10 }, { header: 'Avg Store Hours', width: 10 },
          { header: 'เยี่ยม / วัน', width: 9, fmt: 'dec1' },
          { header: 'Planned Stores (Full Trip)', width: 12, fmt: 'int' }, { header: `แผนเทียบมาตรฐาน (${PLAN_RULE.perTrip}/ทริป)`, width: 18 }, { header: 'Actual Visits', width: 10, fmt: 'int' },
          { header: 'เยี่ยมตามแผน', width: 10, fmt: 'int' }, { header: 'Plan Compliance %', width: 11, fmt: 'pct' }, { header: 'Missed Visits', width: 10, fmt: 'int' }, { header: 'Adhoc Visits', width: 10, fmt: 'int' },
          { header: 'Active Store (ร้านไม่ซ้ำ)', width: 11, fmt: 'int' }, { header: 'ร้านซื้อ / วัน', width: 10, fmt: 'dec1' }, { header: 'Total Bills', width: 10, fmt: 'int' },
          { header: 'Total Sales (GIV)', width: 14, fmt: 'int', bar: true }, { header: 'NIV', width: 14, fmt: 'int' },
          { header: 'SKU per Bill', width: 9, fmt: 'dec1' }, { header: 'Baht per Bill', width: 10, fmt: 'int' },
          { header: 'Late Start (วัน)', width: 9, fmt: 'int' }, { header: 'Early Finish (วัน)', width: 9, fmt: 'int' }, { header: 'Short Hours (วัน)', width: 9, fmt: 'int' },
          { header: 'Quick Visits (ครั้ง)', width: 10, fmt: 'int' }, { header: 'Far Check-in (ครั้ง)', width: 10, fmt: 'int' },
          { header: 'Total Issues', width: 10, fmt: 'int', bar: true }, { header: 'Main Problem', width: 44 }, { header: 'Next Action', width: 52 },
        ],
        coColor: 1,
        rows: rowsX.map((r, i) => [
          i + 1, r.company, r.branch, r.principal, r.manager, r.supervisor, r.seller, r.name || null, r.workDays, r.planDays,
          hhmm(r.avgStart), hhmm(r.avgFinish), hhmm(r.avgWork), hhmm(r.avgStore), r.workDays ? Math.round((r.visits / r.workDays) * 10) / 10 : null,
          r.plannedTrip, r.plannedTrip ? PLAN_LEVEL_LABEL[planOf(r).level] : 'ไม่มีแผน', r.visits, r.planVisited, pctN(r.planVisited, r.plannedToDate), r.missed, r.adhoc,
          r.buyingStores, r.billDays ? Math.round((r.buyStoreDays / r.billDays) * 10) / 10 : null, r.bills, Math.round(r.sales), Math.round(r.niv),
          r.bills ? Math.round((r.lines / r.bills) * 10) / 10 : null, r.bills ? Math.round(r.sales / r.bills) : null,
          r.lateStart, r.earlyFinish, r.shortHours, r.shortVisits, r.farCheckin, r.totalIssues, problemText(r), actionText(r),
        ]),
        notes: NOTES,
      });

      // 3) รายวัน ทุกเซลล์ × ทุกวัน
      const visitsX = data.visits.filter((v) => sellerSet.has(v.s) && v.d >= from && v.d <= to);
      const vCount = new Map<string, { moved: number; adhoc: number }>();
      for (const v of visitsX) { const k = `${v.s}|${v.d}`; const c = vCount.get(k) ?? { moved: 0, adhoc: 0 }; if (v.pt === 'moved') c.moved++; if (v.pt === 'adhoc') c.adhoc++; vCount.set(k, c); }
      sheets.push({
        name: 'รายวัน', title: 'รายวัน · ทุกเซลล์', info,
        cols: [
          { header: 'บริษัท', width: 8 }, { header: 'สาขา', width: 7 }, { header: 'Princ', width: 8 }, { header: 'เซลล์', width: 10 }, { header: 'ชื่อเซลล์', width: 22 },
          { header: 'วันที่', width: 13 }, { header: 'เข้าร้านแรก', width: 10 }, { header: 'ออกร้านสุดท้าย', width: 11 }, { header: 'ชม.ทำงาน', width: 9 }, { header: 'เวลาในร้าน', width: 9 },
          { header: 'แผน', width: 7, fmt: 'int' }, { header: 'เยี่ยมทั้งหมด', width: 9, fmt: 'int' }, { header: 'ตามแผน', width: 8, fmt: 'int' }, { header: 'โยก', width: 7, fmt: 'int' }, { header: 'นอกแผน', width: 8, fmt: 'int' },
          { header: 'เยี่ยมเร็วเกินไป', width: 10, fmt: 'int' }, { header: 'เช็คอินไกลร้าน', width: 10, fmt: 'int' },
          { header: 'บิล', width: 7, fmt: 'int' }, { header: 'ร้านที่ซื้อ', width: 9, fmt: 'int' }, { header: 'GIV', width: 12, fmt: 'int', bar: true }, { header: 'ปัญหาของวัน', width: 30 },
        ],
        coColor: 0,
        rows: rowsX.flatMap((r) => dayStats(data, r.seller, from, to).map((x): XCell[] => {
          const c = vCount.get(`${r.seller}|${x.d}`) ?? { moved: 0, adhoc: 0 };
          return [r.company, r.branch, r.principal, r.seller, r.name || null, `${weekday(x.d)} ${dThai(x.d)}`,
            x.start == null ? null : hhmm(x.start), x.end == null ? null : hhmm(x.end), x.work == null ? null : hhmm(x.work), x.start == null ? null : hhmm(x.store),
            x.planned, x.visits, x.planVisited, c.moved, c.adhoc, x.shortVisits, x.farCheckin, x.bills, x.storeDays, Math.round(x.giv),
            [x.late && 'เริ่มสาย', x.early && 'เลิกก่อนเวลา', x.shortHrs && 'ชม.น้อย'].filter(Boolean).join(' · ') || null];
        })),
      });

      // 4) การเข้าพบรายร้าน + ยอดขายของร้านวันนั้น (เลือกเซลล์คนเดียว → มีเลขที่ invoice / SKU)
      const saleOf = new Map<string, { b: number; g: number; n: number; l: number }>();
      for (const s of data.sales) {
        if (!sellerSet.has(s.s) || s.d < from || s.d > to) continue;
        const k = `${s.s}|${s.d}|${s.c}`; const x = saleOf.get(k) ?? { b: 0, g: 0, n: 0, l: 0 };
        x.b += s.b; x.g += s.g; x.n += s.n; x.l += s.l; saleOf.set(k, x);
      }
      const inv = new Map<string, { docs: string; skus: number }>();
      if (rowsX.length === 1) {
        const one = rowsX[0];
        const dates = [...new Set(visitsX.map((v) => v.d)), ...new Set(data.sales.filter((s) => s.s === one.seller && s.d >= from && s.d <= to).map((s) => s.d))];
        for (const d of [...new Set(dates)].sort()) {
          const r = await fetch(`/dashboard/stangs/day?${new URLSearchParams({ company: one.company, seller: one.seller, d })}`);
          if (!r.ok) continue;
          const j = (await r.json()) as { stores: DayStore[] };
          for (const st of j.stores) inv.set(`${one.seller}|${d}|${st.store}`, { docs: st.docs.map((x) => `${x.credit ? 'ลดหนี้ ' : ''}${x.no}`).join(', '), skus: st.skus });
        }
      }
      const withInv = rowsX.length === 1;
      sheets.push({
        name: 'การเข้าพบรายร้าน', title: 'การเข้าพบรายร้าน (tab Compliance) + ยอดขายของร้านวันนั้น', info,
        cols: [
          { header: 'บริษัท', width: 8 }, { header: 'สาขา', width: 7 }, { header: 'เซลล์', width: 10 }, { header: 'ชื่อเซลล์', width: 20 }, { header: 'วันที่', width: 12 },
          { header: 'เข้า', width: 7 }, { header: 'ออก', width: 7 }, { header: 'นาที', width: 7, fmt: 'int' }, { header: 'รหัสร้าน', width: 16 }, { header: 'ชื่อร้าน', width: 28 },
          { header: 'ประเภท', width: 9 }, { header: 'ห่างพิกัดร้าน (ม.)', width: 12, fmt: 'int' }, { header: 'Compliance', width: 10 }, { header: 'สถานะ', width: 20 },
          { header: 'ขายได้', width: 8 }, { header: 'บิล', width: 6, fmt: 'int' }, { header: 'GIV', width: 11, fmt: 'int' }, { header: 'NIV', width: 11, fmt: 'int' },
          ...(withInv ? [{ header: 'SKU', width: 6, fmt: 'int' as const }, { header: 'เลขที่เอกสาร', width: 34 }] : [{ header: 'บรรทัดสินค้า', width: 10, fmt: 'int' as const }]),
        ],
        coColor: 0,
        rows: [...visitsX].sort((a, b) => a.s.localeCompare(b.s) || a.d.localeCompare(b.d) || (a.start ?? 0) - (b.start ?? 0)).map((v): XCell[] => {
          const s = nm.get(v.s); const sale = saleOf.get(`${v.s}|${v.d}|${v.store}`); const iv = inv.get(`${v.s}|${v.d}|${v.store}`);
          return [s?.company ?? null, s?.branch ?? null, v.s, s?.name || null, dThai(v.d), hhmm(v.start), hhmm(v.end), v.dur, v.store, v.storeName || null,
            PLAN_TYPE_LABEL[v.pt], v.diff == null ? null : Math.round(v.diff), v.comp == null ? null : v.comp ? 'yes' : 'no', v.status || null,
            sale && sale.b > 0 ? 'ขายได้' : 'ไม่ได้ขาย', sale?.b ?? null, sale ? Math.round(sale.g) : null, sale ? Math.round(sale.n) : null,
            ...(withInv ? [iv?.skus ?? null, iv?.docs ?? null] : [sale?.l ?? null])];
        }),
        notes: [
          'ประเภท: เยี่ยม = ร้านในแผนวันนั้น · โยก = ร้านในแผนของเซลล์คนนี้แต่เป็นวันอื่น · นอกแผน = ร้านไม่อยู่ในแผนของเซลล์คนนี้ทั้งทริป',
          withInv ? 'SKU = รหัสสินค้าไม่ซ้ำที่ขายได้ในวันนั้น (ไม่นับของแถม / ใบลดหนี้) · เลขที่เอกสารจาก vw_lg014' : 'เลือกเซลล์คนเดียวแล้ว Export อีกครั้ง จะได้เลขที่ invoice และจำนวน SKU รายร้านด้วย',
        ],
      });

      // 5) บิลที่ไม่มีการเข้าพบในวันนั้น
      const visited = new Set(visitsX.map((v) => `${v.s}|${v.d}|${v.store}`));
      sheets.push({
        name: 'บิลไม่มีการเข้าพบ', title: 'ร้านที่มีบิลขาย แต่วันนั้นไม่มีการเข้าพบใน STANGS', info,
        cols: [
          { header: 'บริษัท', width: 8 }, { header: 'สาขา', width: 7 }, { header: 'เซลล์', width: 10 }, { header: 'ชื่อเซลล์', width: 20 }, { header: 'วันที่', width: 12 },
          { header: 'รหัสร้าน', width: 18 }, { header: 'บิล', width: 6, fmt: 'int' }, { header: 'GIV', width: 12, fmt: 'int', bar: true }, { header: 'NIV', width: 12, fmt: 'int' },
        ],
        coColor: 0,
        rows: [...saleOf.entries()].filter(([k, x]) => x.b > 0 && !visited.has(k)).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]): XCell[] => {
          const [sCode, d, store] = k.split('|'); const s = nm.get(sCode);
          return [s?.company ?? null, s?.branch ?? null, sCode, s?.name || null, dThai(d), store, x.b, Math.round(x.g), Math.round(x.n)];
        }),
      });

      downloadBuffer(await buildWorkbook(sheets), `STANGS-KPI-Compliance-${scope === 'all' ? 'ทั้งหมด' : 'ตามfilter'}-${from}_${to}${scope === 'filter' && seller ? `-${seller}` : ''}.xlsx`);
      closeLoading();
      showToast('ดาวน์โหลดไฟล์ Excel แล้ว');
    } catch (err) {
      closeLoading();
      showError('ทำไฟล์ไม่สำเร็จ', err instanceof Error ? err.message : String(err));
    }
  };

  const maxIssues = Math.max(1, ...rows.map((r) => r.totalIssues));

  return (
    <>
      {/* ── ตัวกรองหลัก (ชุดเดียวทั้งหน้า) ── */}
      <section className="card stg-filter">
        <div className="stg-filter-grid">
          <label className="field"><span className="field-label">ตั้งแต่วันที่</span>
            <input className="input" type="date" value={from} min={data.minDate} max={data.maxDate} disabled={loading} onChange={(e) => setRange(e.target.value, to)} /></label>
          <label className="field"><span className="field-label">ถึงวันที่</span>
            <input className="input" type="date" value={to} min={data.minDate} max={data.maxDate} disabled={loading} onChange={(e) => setRange(from, e.target.value)} /></label>
          <label className="field"><span className="field-label">บริษัท</span>
            <select value={co} onChange={(e) => { setCo(e.target.value); setBranch(ALL); setPrinc(ALL); setManager(ALL); setSup(ALL); setSeller(ALL); }}>
              <option value={ALL}>ทั้งหมด</option>{opts.co.map((v) => <option key={v} value={v}>{v}</option>)}
            </select></label>
          <label className="field"><span className="field-label">สาขา</span>
            <select value={branch} onChange={(e) => { setBranch(e.target.value); setPrinc(ALL); setManager(ALL); setSup(ALL); setSeller(ALL); }}>
              <option value={ALL}>ทั้งหมด ({opts.branch.length})</option>{opts.branch.map((v) => <option key={v} value={v}>{v}</option>)}
            </select></label>
          <label className="field"><span className="field-label">Princ</span>
            <select value={princ} onChange={(e) => { setPrinc(e.target.value); setManager(ALL); setSup(ALL); setSeller(ALL); }}>
              <option value={ALL}>ทั้งหมด ({opts.princ.length})</option>{opts.princ.map((v) => <option key={v} value={v}>{v}</option>)}
            </select></label>
          <label className="field"><span className="field-label">Supervisor Manager</span>
            <select value={manager} onChange={(e) => { setManager(e.target.value); setSup(ALL); setSeller(ALL); }}>
              <option value={ALL}>ทั้งหมด ({opts.manager.length})</option>{opts.manager.map((v) => <option key={v} value={v}>{v}</option>)}
            </select></label>
          <label className="field"><span className="field-label">Supervisor</span>
            <select value={sup} onChange={(e) => { setSup(e.target.value); setSeller(ALL); }}>
              <option value={ALL}>ทั้งหมด ({opts.sup.length})</option>{opts.sup.map((v) => <option key={v} value={v}>{v}</option>)}
            </select></label>
          <label className="field stg-seller-field"><span className="field-label">เซลล์ (เลือกเพื่อดูรายละเอียด)</span>
            <select value={seller} onChange={(e) => pick(e.target.value)}>
              <option value={ALL}>ทั้งหมด ({opts.seller.length})</option>
              {opts.seller.map((x) => <option key={x.seller} value={x.seller}>{x.seller}{x.name ? ` · ${x.name}` : ''}</option>)}
            </select></label>
        </div>
        <div className="stg-filter-bar">
          <div className="seg" role="group" aria-label="ช่วงวันที่">
            {presets.map((p) => (
              <button key={p.key} type="button" className={from === p.a && to === p.b ? 'on' : ''} disabled={loading} onClick={() => setRange(p.a, p.b)}>{p.label}</button>
            ))}
          </div>
          <button type="button" className={`clear-btn behind-btn${onlyIssue ? ' on' : ''}`} aria-pressed={onlyIssue} onClick={() => setOnlyIssue((v) => !v)}>
            {onlyIssue ? '✓ ' : ''}เฉพาะคนที่มีปัญหา
          </button>
          <button type="button" className="clear-btn" onClick={reset}>ล้างตัวกรอง</button>
          <span className="stg-export">
            <button type="button" className="btn btn-primary" onClick={() => exportExcel('filter')} disabled={!rows.length} title="เฉพาะเซลล์ตามตัวกรองที่เลือก">Excel ตาม filter</button>
            <button type="button" className="clear-btn" onClick={() => exportExcel('all')} title="ทุกเซลล์ในช่วงวันที่ที่เลือก ไม่ใช้ตัวกรองอื่น">Excel ทั้งหมด</button>
          </span>
        </div>
        <p className="stg-filter-note">
          {data.fromDb ? `ข้อมูลใน Supabase ${dThai(data.minDate)} – ${dThai(data.maxDate)}` : 'อ่านจาก Google Sheet โดยตรง (ยังไม่ได้รัน supabase/stangs.sql)'} · ช่วงที่เลือก {rangeText} ·
          เข้าพบล่าสุด {dThai(asOf)} · แสดง {rows.length} เซลล์
          {toDateText ? ` · ${toDateText}` : ''}
        </p>
      </section>

      {/* ── สรุป 3 แถบ (ตามตัวกรอง) ── */}
      <Band no="01" title="KPI COMPLIANCE" tone="blue"
        items={[
          { label: 'Planned Stores (Full Trip)', value: fmtInt(t.plannedTrip), sub: `ถึงวันข้อมูล ${fmtInt(t.plannedToDate)} · มาตรฐาน ${fmtInt(planStd)} / คน · เกิน ${planCount(['over', 'overHigh'])} คน · ต่ำกว่า ${planCount(['under', 'underLow'])} คน` },
          { label: 'Actual Visits', value: fmtInt(t.visits), sub: `ตามแผน ${fmtInt(t.planVisited)}` },
          { label: 'Plan Compliance %', value: pctText(t.planVisited, t.plannedToDate) },
          { label: 'Missed Visits', value: fmtInt(t.missed) },
          { label: 'Adhoc Visits', value: fmtInt(t.adhoc) },
        ]}
        note={<>
          {noPlan.length > 0 && (
            <span className="stg-warn">
              ⚠ ไม่มีแผนเยี่ยมใน tab Visit ของชีต STANGS {noPlan.length} จาก {rows.length} เซลล์ (เช่น {noPlan.slice(0, 4).map((r) => r.seller).join(', ')}{noPlan.length > 4 ? ' …' : ''})
              — Planned / Plan Compliance / Missed จึงนับเฉพาะคนที่มีแผน · เติมแผนในชีตแล้วหน้านี้อัปเดตเองภายใน 5 นาที
            </span>
          )}
          <b>Planned Stores</b> = ร้านตามแผนเยี่ยม (tab Visit) ทุกวันในช่วงที่เลือก · <b>Actual Visits</b> = จำนวนครั้งที่เข้าพบจริงทั้งหมด รวมนอกแผน (tab Compliance) ·
          <b> Plan Compliance %</b> = ร้านในแผนที่ไปเยี่ยมจริงในวันเดียวกัน ÷ แผนถึงวันข้อมูลล่าสุด · <b>Missed Visits</b> = แผนถึงวันข้อมูลล่าสุด − ร้านในแผนที่ไปจริง ·
          <b> Adhoc</b> = เข้าพบนอกแผน (Adhoc Route = yes) ·
          <b> แผนเทียบมาตรฐาน</b> = แผนทั้งทริปของเซลล์ ÷ {fmtInt(PLAN_RULE.perTrip)} ร้าน / เดือน (ช่วงนี้ {fmtInt(planStd)} ร้าน):
          เกิน = ส้ม · เกิน ≥ {Math.round(PLAN_RULE.high * 100)}% = แดง · ต่ำกว่า = ฟ้า · ต่ำกว่า ≤ {Math.round(PLAN_RULE.low * 100)}% = ม่วง
        </>} />
      <Band no="02" title="SALES PERFORMANCE" tone="green"
        items={[
          { label: 'Active Store (ร้านที่ซื้อ)', value: fmtInt(t.buyingStores), sub: `เฉลี่ย ${per(t.buyStoreDays, t.billDays)} ร้าน / วัน` },
          { label: 'Total Bills', value: fmtInt(t.bills) },
          { label: 'Total Sales (GIV)', value: f2(t.sales), sub: `NIV ${f2(t.niv)}` },
          { label: 'SKU per Bill', value: t.bills ? (t.lines / t.bills).toFixed(2) : '–' },
          { label: 'Baht per Bill', value: t.bills ? f2(t.sales / t.bills) : '–' },
        ]}
        note={<>
          ยอดจาก vw_lg014 (GIV) ของเซลล์ในตัวกรอง ช่วงวันเดียวกัน · <b>Active Store</b> = ร้านไม่ซ้ำที่มีบิล (1 ร้านนับ 1 ไม่ว่าซื้อกี่บิล / กี่วัน) · เฉลี่ยต่อวัน = ร้านที่มีบิลแต่ละวันรวมกัน ÷ วันที่มีบิล ·
          <b> Total Bills</b> = จำนวนบิลขาย · <b>SKU per Bill</b> = บรรทัดสินค้า ÷ บิล · <b>Baht per Bill</b> = ยอดขาย ÷ บิล
        </>} />
      <Band no="03" title="ISSUE MONITORING" tone="orange"
        items={(['lateStart', 'earlyFinish', 'shortHours', 'shortVisits', 'farCheckin'] as const).map((k) => {
          const it = ISSUES.find((x) => x.key === k)!;
          const share = it.unit === 'ครั้ง' ? ` · ${pctText(t[k], t.visits)} ของการเข้าพบ` : '';
          return { label: `${it.short} · ${it.label}`, value: `${fmtInt(t[k])} ${it.unit}`, sub: `${it.rule}${share}` };
        })}
        note={<>
          {ISSUES.map((it, i) => <span key={it.key}>{i ? ' · ' : ''}<b>{it.label}</b> = {it.rule} (นับเป็น{it.unit})</span>)}
        </>} />

      {/* ── ตารางเซลล์: 1 แถว = 1 เซลล์ · ตัวเลขหลักตัวใหญ่ · รายละเอียดอื่นอยู่ในหน้าต่างรายละเอียด ── */}
      <section className="card">
        <header className="card-head">
          <div>
            <h3 className="card-title">Seller Monitoring · Total Issues มากไปน้อย</h3>
            <p className="card-sub">
              เวลาเป็น<b>ค่าเฉลี่ยต่อวันทำงาน</b> · วันทำงาน = วันที่เข้าพบจริง / วันที่มีแผนเยี่ยมของเซลล์คนนั้น (tab Visit) · ยอดขายจาก vw_lg014 ·
              กด <b>ดูรายละเอียด</b> เพื่อดูรายวัน / รายร้านที่เข้าพบ · ป้ายแดง = มีปัญหา (ชี้ที่ป้ายเพื่อดูเกณฑ์)
            </p>
          </div>
        </header>
        {rows.length === 0 ? <p className="empty">ไม่มีเซลล์ตามตัวกรอง</p> : (
          <table className="rtable stg-table">
            <thead>
              <tr>
                <th className="c">#</th><th>เซลล์</th><th>การทำงาน (เฉลี่ยต่อวัน)</th><th>แผนเยี่ยม</th><th>ยอดขาย (vw_lg014)</th><th>ปัญหา (นับ)</th><th className="r">Total Issues</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const comp = pct(r.planVisited, r.plannedToDate);
                return (
                  <tr key={r.seller} className={`stg-row${seller === r.seller ? ' on' : ''}${r.workDays === 0 ? ' stg-idle' : ''}`} onClick={() => pick(seller === r.seller ? ALL : r.seller)}>
                    <td className="c stg-rank" data-label="#">{i + 1}</td>
                    <td data-label="เซลล์">
                      <div className="stg-cell">
                        <span className="stg-main">{r.seller}</span>
                        <span>{r.name || '—'}</span>
                        <span className="stg-sub"><span className="dot" style={{ background: COMPANY_COLORS[r.company] }} />{r.company} · {r.branch} · {r.principal}</span>
                      </div>
                    </td>
                    <td data-label="การทำงาน">
                      <dl className="stg-kv">
                        <dt>วันทำงาน</dt><dd><b>{r.workDays}</b> / {r.planDays || '–'} วัน</dd>
                        <dt>เข้า – ออก</dt>
                        <dd>
                          <span className={r.avgStart != null && r.avgStart > RULES.lateStart ? 'stg-red' : ''}>{hhmm(r.avgStart)}</span>
                          {' – '}
                          <span className={r.avgFinish != null && r.avgFinish < RULES.earlyFinish ? 'stg-red' : ''}>{hhmm(r.avgFinish)}</span>
                        </dd>
                        <dt>ชม.ทำงาน</dt><dd className={r.avgWork != null && r.avgWork < RULES.shortHours ? 'stg-red' : ''}>{hhmm(r.avgWork)}</dd>
                        <dt>อยู่ในร้าน</dt><dd>{hhmm(r.avgStore)}</dd>
                        <dt>เยี่ยม / วัน</dt><dd>{per(r.visits, r.workDays)} ร้าน</dd>
                      </dl>
                    </td>
                    <td data-label="แผนเยี่ยม">
                      <div className="stg-cell">
                        {r.plannedTrip > 0 && (
                          <>
                            <span className="stg-main">{comp == null ? '–' : `${comp.toFixed(0)}%`}<small> ตามแผน</small></span>
                            <span className="stg-meter"><span style={{ width: `${Math.min(comp ?? 0, 100)}%` }} className={comp != null && comp < 80 ? 'low' : ''} /></span>
                          </>
                        )}
                        <dl className="stg-kv">
                          {r.plannedTrip > 0 ? <>
                            <dt>เยี่ยมตามแผน</dt><dd><b>{fmtInt(r.planVisited)}</b> / {fmtInt(r.plannedToDate)}</dd>
                            <dt title="แผนเยี่ยมทั้งทริป เทียบมาตรฐาน">แผนทริป</dt>
                            <dd>
                              {(() => {
                                const p = planOf(r);
                                return (
                                  <span className={`stg-plan stg-plan-${p.level}`} title={`${PLAN_LEVEL_LABEL[p.level]} · มาตรฐาน ${fmtInt(planStd)} ร้าน`}>
                                    {fmtInt(r.plannedTrip)} ร้าน
                                  </span>
                                );
                              })()}
                            </dd>
                          </> : <>
                            <dt>แผน</dt><dd className="stg-sub">ไม่มีใน tab Visit</dd>
                          </>}
                          <dt>เข้าพบทั้งหมด</dt><dd>{fmtInt(r.visits)} ครั้ง</dd>
                          <dt>นอกแผน</dt><dd>{fmtInt(r.adhoc)} ครั้ง</dd>
                        </dl>
                        {r.plannedTrip > 0 && (() => {
                          const p = planOf(r);
                          return <span className={`stg-plan-note stg-plan-txt-${p.level}`}>※ แผนทริป{PLAN_LEVEL_LABEL[p.level]} (มาตรฐาน {fmtInt(planStd)} ร้าน)</span>;
                        })()}
                      </div>
                    </td>
                    <td data-label="ยอดขาย">
                      <dl className="stg-kv">
                        <dt>GIV</dt><dd><b className="stg-big">{fmtInt(r.sales)}</b></dd>
                        <dt>NIV</dt><dd>{fmtInt(r.niv)}</dd>
                        <dt>บิล</dt><dd>{fmtInt(r.bills)}</dd>
                        <dt>Active Store</dt><dd>{fmtInt(r.buyingStores)} ร้าน</dd>
                        <dt>ร้านซื้อ / วัน</dt><dd>{per(r.buyStoreDays, r.billDays)}</dd>
                        <dt>SKU · ฿ / บิล</dt><dd>{r.bills ? (r.lines / r.bills).toFixed(1) : '–'} · {r.bills ? fmtInt(r.sales / r.bills) : '–'}</dd>
                      </dl>
                    </td>
                    <td data-label="ปัญหา">
                      <div className="stg-chips">
                        {ISSUES.map((it) => {
                          const n = r[it.key];
                          return (
                            <span key={it.key} className={`stg-chip${n ? ' bad' : ''}`} title={it.rule}>
                              <span>{it.label}</span><span><b>{fmtInt(n)}</b> {it.unit}</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="r" data-label="Total Issues">
                      <div className="stg-total">
                        <b>{fmtInt(r.totalIssues)}</b>
                        <span className="stg-meter"><span className="bad" style={{ width: `${(r.totalIssues / maxIssues) * 100}%` }} /></span>
                        <button type="button" className={`stg-more${seller === r.seller ? ' on' : ''}`} onClick={(e) => { e.stopPropagation(); pick(seller === r.seller ? ALL : r.seller); }}>
                          {seller === r.seller ? 'ปิด ✕' : 'ดูรายละเอียด ›'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ── รายละเอียดเซลล์ที่เลือก ── */}
      {picked && (
        <section className="card stg-detail" id="stg-detail">
          <header className="card-head">
            <div>
              <h3 className="card-title">{picked.seller} · {picked.name || 'ไม่มีชื่อในชีต'}</h3>
              <p className="card-sub">
                <span className="dot" style={{ background: COMPANY_COLORS[picked.company] }} />{picked.company} · {picked.branch} · {picked.principal} ·
                {' '}{picked.manager}{picked.supervisor && picked.supervisor !== picked.manager ? ` › ${picked.supervisor}` : ''} · {rangeText}
              </p>
            </div>
            <button type="button" className="clear-btn" onClick={() => pick(ALL)}>✕ ปิด</button>
          </header>
          <div className="stg-facts">
            <div><span>วันทำงาน</span><b>{picked.workDays} / {picked.planDays || '–'} วัน</b></div>
            <div><span>เข้าร้านแรก – ออกร้านสุดท้าย (เฉลี่ย)</span><b>{hhmm(picked.avgStart)} – {hhmm(picked.avgFinish)}</b></div>
            <div><span>ชม.ทำงาน / อยู่ในร้าน (เฉลี่ย)</span><b>{hhmm(picked.avgWork)} / {hhmm(picked.avgStore)}</b></div>
            <div><span>เยี่ยมเฉลี่ย</span><b>{per(picked.visits, picked.workDays)} ร้าน / วัน</b></div>
            <div><span>เยี่ยมตามแผน / นอกแผน</span><b>{fmtInt(picked.planVisited)} / {fmtInt(picked.adhoc)} ครั้ง</b></div>
            <div><span>ยอดขาย GIV / NIV</span><b>{fmtInt(picked.sales)} / {fmtInt(picked.niv)}</b></div>
            <div><span>บิล · Active Store</span><b>{fmtInt(picked.bills)} บิล · {fmtInt(picked.buyingStores)} ร้าน</b></div>
            <div><span>ร้านซื้อเฉลี่ย · SKU / บิล · ฿ / บิล</span><b>{per(picked.buyStoreDays, picked.billDays)} ร้าน/วัน · {picked.bills ? (picked.lines / picked.bills).toFixed(1) : '–'} · {picked.bills ? fmtInt(picked.sales / picked.bills) : '–'}</b></div>
          </div>
          <div className="stg-chips stg-chips-row">
            {ISSUES.map((it) => {
              const n = picked[it.key];
              return <span key={it.key} className={`stg-chip${n ? ' bad' : ''}`} title={it.rule}><span>{it.label}</span><span><b>{fmtInt(n)}</b> {it.unit}</span></span>;
            })}
          </div>
          <div className="stg-advice">
            <div><span className="eyebrow">Main Problem</span><b>{problemText(picked)}</b></div>
            <div><span className="eyebrow">Next Action</span><b>{actionText(picked)}</b></div>
          </div>

          <h4 className="cg-title">รายวัน · กดปุ่ม <b>ดูร้าน</b> เพื่อดูร้านที่เข้าพบในวันนั้น · ตัวแดง = ผิดเกณฑ์</h4>
          {days.length === 0 ? <p className="empty">ไม่มีข้อมูลในช่วงที่เลือก</p> : (
            <table className="rtable stg-days">
              <thead>
                <tr>
                  <th>วันที่</th><th className="r">เข้า – ออก</th><th className="r">ชม.ทำงาน</th><th className="r">ในร้าน</th>
                  <th className="r">เยี่ยม / แผน</th><th className="r">โยก / นอกแผน</th><th className="r">เยี่ยมเร็วเกินไป</th><th className="r">เช็คอินไกลร้าน</th>
                  <th className="r">บิล</th><th className="r">ยอดขาย</th>
                </tr>
              </thead>
              <tbody>
                {days.map((x) => {
                  const dayVisits = data.visits.filter((v) => v.s === picked.seller && v.d === x.d);
                  const vs = openDay === x.d ? [...dayVisits].sort((a, b) => (a.start ?? 0) - (b.start ?? 0)) : [];
                  const moved = dayVisits.filter((v) => v.pt === 'moved').length;
                  const off = dayVisits.filter((v) => v.pt === 'adhoc').length;
                  const ds = daySales[`${picked.seller}|${x.d}`];
                  const sold = ds?.state === 'ok' ? new Map(ds.stores.map((s) => [s.store, s])) : null;
                  const visitedStores = new Set(dayVisits.map((v) => v.store));
                  const soldNoVisit = ds?.state === 'ok' ? ds.stores.filter((s) => !visitedStores.has(s.store)) : [];
                  return (
                    <Fragment key={x.d}>
                      <tr className={`stg-row${openDay === x.d ? ' on' : ''}${x.d > asOf ? ' stg-future' : ''}`} onClick={() => toggleDay(picked.seller, picked.company, x.d)}>
                        <td data-label="วันที่" className="strong">
                          <span className="stg-day">
                            {weekday(x.d)} {dShort(x.d)}
                            {x.visits > 0 && <button type="button" className={`stg-more${openDay === x.d ? ' on' : ''}`}>{openDay === x.d ? 'ซ่อน ▴' : `ดูร้าน (${x.visits}) ▾`}</button>}
                          </span>
                        </td>
                        <td className="r" data-label="เข้า – ออก">
                          <span className={x.late ? 'stg-red' : ''}>{hhmm(x.start)}</span> – <span className={x.early ? 'stg-red' : ''}>{hhmm(x.end)}</span>
                        </td>
                        <td className={`r ${x.shortHrs ? 'stg-red' : ''}`} data-label="ชม.ทำงาน">{hhmm(x.work)}</td>
                        <td className="r" data-label="ในร้าน">{x.start == null ? '—' : hhmm(x.store)}</td>
                        <td className="r" data-label="เยี่ยม / แผน">{x.visits} / {x.planned} <span className="muted">(ตามแผน {x.planVisited})</span></td>
                        <td className="r" data-label="โยก / นอกแผน">{moved || off ? `${moved} / ${off}` : '–'}</td>
                        <td className={`r ${x.shortVisits ? 'stg-red' : ''}`} data-label="เยี่ยมเร็วเกินไป">{x.shortVisits || '–'}</td>
                        <td className={`r ${x.farCheckin ? 'stg-red' : ''}`} data-label="เช็คอินไกลร้าน">{x.farCheckin || '–'}</td>
                        <td className="r" data-label="บิล">{x.bills || '–'}</td>
                        <td className="r strong" data-label="ยอดขาย">{x.giv ? fmtInt(x.giv) : '–'}</td>
                      </tr>
                      {openDay === x.d && (
                        <tr className="stg-visits-row">
                          <td colSpan={10}>
                            {vs.length === 0 ? <p className="muted">ไม่มีการเข้าพบในวันนี้</p> : (
                              <div className="stg-visits">
                                <div className="stg-vhead">
                                  <span>เวลา</span><span>ร้าน · ประเภท</span><span className="r">นาที</span><span className="r">ห่างร้าน</span><span>สถานะ</span><span>ขายได้ (vw_lg014)</span>
                                </div>
                                {vs.map((v, j) => {
                                  const s = sold?.get(v.store);
                                  return (
                                    <div key={j} className={`stg-vrow${v.comp === false || (v.dur != null && v.dur < RULES.shortVisit) ? ' warn' : ''}`}>
                                      <span className="t">{hhmm(v.start)}–{hhmm(v.end)}</span>
                                      <span className="n">
                                        <b>{v.storeName || v.store}</b> <span className="muted">{v.store}</span>{' '}
                                        <span className={`stg-pt stg-pt-${v.pt}`}>{PLAN_TYPE_LABEL[v.pt]}</span>
                                      </span>
                                      <span className={`r ${v.dur != null && v.dur < RULES.shortVisit ? 'stg-red' : ''}`}>{v.dur ?? '–'}</span>
                                      <span className={`r ${v.comp === false ? 'stg-red' : ''}`}>{v.diff == null ? '–' : `${fmtInt(v.diff)} ม.`}</span>
                                      <span className="muted">{v.status}</span>
                                      <span className="stg-sale">
                                        {!ds || ds.state === 'loading' ? <span className="muted">กำลังโหลด…</span>
                                          : ds.state === 'error' ? <span className="stg-red">โหลดไม่สำเร็จ</span>
                                          : !s ? <span className="muted">ไม่ได้ขาย</span>
                                          : <>
                                            <b>GIV {fmtInt(s.giv)}</b> · NIV {fmtInt(s.niv)} · <b>{s.skus}</b> SKU
                                            <span className="stg-docs">{s.docs.map((d) => `${d.credit ? 'ลดหนี้ ' : ''}${d.no}`).join(', ')}</span>
                                          </>}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {soldNoVisit.length > 0 && (
                              <div className="stg-visits stg-novisit">
                                <div className="stg-vhead"><span>ขายโดยไม่มีการเข้าพบวันนี้ ({soldNoVisit.length} ร้าน)</span></div>
                                {soldNoVisit.map((s) => (
                                  <div key={s.store} className="stg-vrow">
                                    <span className="t">—</span>
                                    <span className="n"><b>{s.name || s.store}</b> <span className="muted">{s.store}</span></span>
                                    <span /><span /><span />
                                    <span className="stg-sale">
                                      <b>GIV {fmtInt(s.giv)}</b> · NIV {fmtInt(s.niv)} · <b>{s.skus}</b> SKU
                                      <span className="stg-docs">{s.docs.map((d) => `${d.credit ? 'ลดหนี้ ' : ''}${d.no}`).join(', ')}</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}

const NOTES = [
  'Working Day = วันที่มีการเข้าพบจริง / วันที่มีแผนเยี่ยม (ถึงวันข้อมูลล่าสุด) · Avg Start / Finish = เข้าร้านแรก / ออกร้านสุดท้ายเฉลี่ยต่อวัน',
  'Avg Work Hours = ร้านแรก → ร้านสุดท้าย · Avg Store Hours = เวลาในร้านรวมต่อวัน',
  'Plan Compliance % = ร้านในแผนที่ไปจริงในวันเดียวกัน ÷ แผนถึงวันข้อมูลล่าสุด · Missed Visits = แผนถึงวันข้อมูลล่าสุด − ร้านในแผนที่ไปจริง',
  `เกณฑ์: Late Start > ${hhmm(RULES.lateStart)} · Early Finish < ${hhmm(RULES.earlyFinish)} · Short Hours < ${RULES.shortHours / 60} ชม. · Short Visits < ${RULES.shortVisit} นาที · Far Check-in = Compliance no (> ~${RULES.farCheckinM} ม.)`,
  'Total Issues = Late Start + Early Finish + Short Hours + Quick Visits + Far Check-in',
];
