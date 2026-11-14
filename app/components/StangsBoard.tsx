'use client';

// หน้า STANGS KPI & Compliance (ทั้งหน้า): ตัวกรองชุดเดียว → การ์ดสรุป 3 แถบ → ตารางเซลล์ (ไม่ต้องเลื่อนซ้าย-ขวา) → รายละเอียดเซลล์ที่เลือก
// ทุกส่วนคำนวณจากตัวกรองเดียวกัน (lib/stangsCalc) เปลี่ยนตัวกรองแล้วตัวเลขเปลี่ยนตามทันที
import { Fragment, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  dayStats, hhmm, ISSUES, NEXT_ACTION, PLAN_LEVEL_LABEL, PLAN_RULE, planLevel, planStandard, RULES, sellerRows, totals,
  type DayStat, type Metrics, type SellerRow, type StangsData,
} from '@/app/lib/stangsCalc';
import { COMPANY_COLORS, fmtInt } from '@/app/lib/format';
import { buildWorkbook, downloadBuffer, exportedAt, type XSheet } from '@/app/lib/xlsx';
import { closeLoading, showError, showLoading, showToast } from '@/app/components/Loading';

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

  // ── Excel (ตามตัวกรอง) ──
  const exportExcel = async () => {
    showLoading('กำลังทำไฟล์ Excel', 'รอสักครู่');
    try {
      const info: [string, string][] = [
        ['ช่วงวันที่', `${rangeText}${toDateText ? ` · ${toDateText}` : ''}`],
        ['ตัวกรอง', [co, branch, princ && `Princ ${princ}`, manager && `Manager ${manager}`, sup && `Sup ${sup}`, seller && `เซลล์ ${seller}`, onlyIssue && 'เฉพาะคนที่มีปัญหา'].filter(Boolean).join(' · ') || 'ทั้งหมด'],
        ['Export เมื่อ', exportedAt()],
      ];
      const sheets: XSheet[] = [{
        name: 'Seller Monitoring', title: 'SALES KPI & COMPLIANCE · STANGS', info,
        cols: [
          { header: 'Rank', width: 6, fmt: 'int' }, { header: 'Company', width: 9 }, { header: 'Branch', width: 8 }, { header: 'Principal', width: 9 },
          { header: 'Supervisor Manager', width: 22 }, { header: 'Supervisor', width: 22 }, { header: 'Seller', width: 10 }, { header: 'ชื่อเซลล์', width: 24 },
          { header: 'Working Day (จริง)', width: 9, fmt: 'int' }, { header: 'Working Day (วันตามแผน)', width: 10, fmt: 'int' },
          { header: 'Avg Start', width: 9 }, { header: 'Avg Finish', width: 9 }, { header: 'Avg Work Hours', width: 10 }, { header: 'Avg Store Hours', width: 10 },
          { header: 'Planned Stores (Full Trip)', width: 12, fmt: 'int' }, { header: `แผนเทียบมาตรฐาน (${PLAN_RULE.perTrip}/เดือน)`, width: 18 }, { header: 'Actual Visits', width: 10, fmt: 'int' }, { header: 'Plan Compliance %', width: 11, fmt: 'pct' },
          { header: 'Missed Visits', width: 10, fmt: 'int' }, { header: 'Adhoc Visits', width: 10, fmt: 'int' },
          { header: 'Active Store (ร้านไม่ซ้ำ)', width: 11, fmt: 'int' }, { header: 'Total Bills', width: 10, fmt: 'int' }, { header: 'Total Sales (GIV)', width: 14, fmt: 'int', bar: true }, { header: 'NIV', width: 14, fmt: 'int' },
          { header: 'SKU per Bill', width: 9, fmt: 'dec1' }, { header: 'Baht per Bill', width: 10, fmt: 'int' },
          { header: 'Late Start', width: 9, fmt: 'int' }, { header: 'Early Finish', width: 9, fmt: 'int' }, { header: 'Short Hours', width: 9, fmt: 'int' },
          { header: 'Quick Visits (< 10 นาที)', width: 10, fmt: 'int' }, { header: 'Far Check-in', width: 10, fmt: 'int' },
          { header: 'Total Issues', width: 10, fmt: 'int', bar: true }, { header: 'Main Problem', width: 44 }, { header: 'Next Action', width: 52 },
        ],
        coColor: 1,
        rows: rows.map((r, i) => [
          i + 1, r.company, r.branch, r.principal, r.manager, r.supervisor, r.seller, r.name || null, r.workDays, r.planDays,
          hhmm(r.avgStart), hhmm(r.avgFinish), hhmm(r.avgWork), hhmm(r.avgStore),
          r.plannedTrip, r.plannedTrip ? PLAN_LEVEL_LABEL[planOf(r).level] : 'ไม่มีแผน', r.visits, pct(r.planVisited, r.plannedToDate), r.missed, r.adhoc,
          r.buyingStores, r.bills, Math.round(r.sales), Math.round(r.niv), r.bills ? Math.round((r.lines / r.bills) * 10) / 10 : null, r.bills ? Math.round(r.sales / r.bills) : null,
          r.lateStart, r.earlyFinish, r.shortHours, r.shortVisits, r.farCheckin, r.totalIssues, problemText(r), actionText(r),
        ]),
        notes: NOTES,
      }];
      if (picked) {
        sheets.push({
          name: `รายวัน ${picked.seller}`, title: `${picked.seller} ${picked.name} · รายวัน`, info,
          cols: [
            { header: 'วันที่', width: 12 }, { header: 'เข้าร้านแรก', width: 10 }, { header: 'ออกร้านสุดท้าย', width: 11 }, { header: 'ชม.ทำงาน', width: 9 },
            { header: 'เวลาในร้าน', width: 9 }, { header: 'แผน', width: 8, fmt: 'int' }, { header: 'เยี่ยม', width: 8, fmt: 'int' }, { header: 'ตามแผน', width: 8, fmt: 'int' },
            { header: 'Adhoc', width: 8, fmt: 'int' }, { header: 'เยี่ยมสั้น', width: 9, fmt: 'int' }, { header: 'เช็คอินไกล', width: 10, fmt: 'int' },
            { header: 'บิล', width: 8, fmt: 'int' }, { header: 'ยอดขาย', width: 12, fmt: 'int', bar: true }, { header: 'ปัญหาของวัน', width: 34 },
          ],
          rows: days.map((x) => [
            `${weekday(x.d)} ${dThai(x.d)}`, hhmm(x.start), hhmm(x.end), hhmm(x.work), x.start == null ? null : hhmm(x.store),
            x.planned, x.visits, x.planVisited, x.adhoc, x.shortVisits, x.farCheckin, x.bills, Math.round(x.giv),
            [x.late && 'เริ่มสาย', x.early && 'เลิกเร็ว', x.shortHrs && 'ชม.น้อย'].filter(Boolean).join(' · ') || null,
          ]),
        });
        const vs = data.visits.filter((v) => v.s === picked.seller && v.d >= from && v.d <= to).sort((a, b) => a.d.localeCompare(b.d) || (a.start ?? 0) - (b.start ?? 0));
        sheets.push({
          name: `การเข้าพบ ${picked.seller}`, title: `${picked.seller} ${picked.name} · การเข้าพบรายร้าน`, info,
          cols: [
            { header: 'วันที่', width: 12 }, { header: 'เข้า', width: 8 }, { header: 'ออก', width: 8 }, { header: 'นาที', width: 7, fmt: 'int' },
            { header: 'รหัสร้าน', width: 16 }, { header: 'ชื่อร้าน', width: 30 }, { header: 'ห่างพิกัดร้าน (ม.)', width: 13, fmt: 'int' },
            { header: 'Compliance', width: 11 }, { header: 'Adhoc', width: 8 }, { header: 'สถานะ', width: 22 },
          ],
          rows: vs.map((v) => [dThai(v.d), hhmm(v.start), hhmm(v.end), v.dur, v.store, v.storeName || null, v.diff, v.comp == null ? null : v.comp ? 'yes' : 'no', v.adhoc ? 'yes' : 'no', v.status || null]),
        });
      }
      downloadBuffer(await buildWorkbook(sheets), `STANGS-KPI-Compliance-${from}_${to}${seller ? `-${seller}` : ''}.xlsx`);
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
          <button type="button" className="btn btn-primary stg-export" onClick={exportExcel} disabled={!rows.length}>Export Excel</button>
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
                  <th className="r">เยี่ยม / แผน</th><th className="r">Adhoc</th><th className="r">เยี่ยมเร็วเกินไป</th><th className="r">เช็คอินไกลร้าน</th>
                  <th className="r">บิล</th><th className="r">ยอดขาย</th>
                </tr>
              </thead>
              <tbody>
                {days.map((x) => {
                  const vs = openDay === x.d ? data.visits.filter((v) => v.s === picked.seller && v.d === x.d).sort((a, b) => (a.start ?? 0) - (b.start ?? 0)) : [];
                  return (
                    <Fragment key={x.d}>
                      <tr className={`stg-row${openDay === x.d ? ' on' : ''}${x.d > asOf ? ' stg-future' : ''}`} onClick={() => setOpenDay(openDay === x.d ? '' : x.d)}>
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
                        <td className="r" data-label="Adhoc">{x.adhoc || '–'}</td>
                        <td className={`r ${x.shortVisits ? 'stg-red' : ''}`} data-label="เยี่ยมเร็วเกินไป">{x.shortVisits || '–'}</td>
                        <td className={`r ${x.farCheckin ? 'stg-red' : ''}`} data-label="เช็คอินไกลร้าน">{x.farCheckin || '–'}</td>
                        <td className="r" data-label="บิล">{x.bills || '–'}</td>
                        <td className="r strong" data-label="ยอดขาย">{x.giv ? fmtInt(x.giv) : '–'}</td>
                      </tr>
                      {openDay === x.d && (
                        <tr className="stg-visits-row">
                          <td colSpan={10}>
                            {vs.length === 0 ? <p className="muted">ไม่มีการเข้าพบในวันนี้</p> : (
                              <ul className="stg-visits">
                                {vs.map((v, j) => (
                                  <li key={j} className={v.comp === false || (v.dur != null && v.dur < RULES.shortVisit) ? 'warn' : ''}>
                                    <span className="t">{hhmm(v.start)}–{hhmm(v.end)}</span>
                                    <span className="n"><b>{v.storeName || v.store}</b><span className="muted"> {v.store}{v.adhoc ? ' · นอกแผน' : ''}</span></span>
                                    <span className={v.dur != null && v.dur < RULES.shortVisit ? 'stg-red' : ''}>{v.dur ?? '–'} นาที</span>
                                    <span className={v.comp === false ? 'stg-red' : ''}>{v.diff == null ? '–' : `${fmtInt(v.diff)} ม.`}</span>
                                    <span className="muted">{v.status}</span>
                                  </li>
                                ))}
                              </ul>
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
