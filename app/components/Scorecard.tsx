'use client';

// Scorecard รายบริษัท — ตารางแบบเดียวกับ "ยอดขายรายสาขา": 1 แถว = 1 บริษัท (+ Group) · คอลัมน์ = ตัวเลขจริงสองฝั่ง + %
//   หัวคอลัมน์เป็นภาษาอังกฤษตามไฟล์ KPI ฝ่ายขาย พร้อมคำอธิบายภาษาไทยตัวเล็กใต้หัว · ใต้ชื่อตารางมีวิธีคิด
import { useState, type ReactNode } from 'react';
import type { Scorecard as ScorecardData, CompanyScore } from '@/app/lib/scorecard';
import type { TimeGone } from '@/app/lib/workdays';
import { COMPANY_COLORS, fmtInt } from '@/app/lib/format';
import { SELLER_TYPE_LABEL, type SellerType } from '@/app/lib/sellerType';

export type TypeStat = { type: SellerType; sellers: number; sellerDays: number; bills: number; lines: number; giv: number; niv: number };
type Metric = 'giv' | 'niv';
type Col = { head: string; note: string; cell: (co: string) => ReactNode; total?: () => ReactNode };

const fmt1 = (n: number | null) => (n == null ? '–' : n.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const div = (a: number | undefined | null, b: number | undefined | null) => (a != null && b ? a / b : null);
const num = (n: number | null | undefined) => (n == null ? '–' : fmtInt(n));

// % เทียบฐาน: ≥ 100 เขียว ▲ / ต่ำกว่า แดง ▼ (เป็นตัวเดียวที่มีสี)
function Index({ cur, base }: { cur: number | null | undefined; base: number | null | undefined }) {
  if (cur == null || !base) return <span className="muted">–</span>;
  const p = (cur / base) * 100;
  return <b className={`sc-chip ${p >= 100 ? 'up' : 'down'}`}>{p >= 100 ? '▲' : '▼'} {p.toFixed(1)}%</b>;
}

function ScoreTable({ title, desc, companies, cols, group = true }: {
  title: string; desc: ReactNode; companies: string[]; cols: Col[]; group?: boolean;
}) {
  return (
    <div className="sc3">
      <div className="sc3-head"><b>{title}</b><span>{desc}</span></div>
      <table className="rtable sc3-table">
        <thead>
          <tr>
            <th>Company</th>
            {cols.map((c) => <th key={c.head} className="r"><span className="sc3-th">{c.head}<small>{c.note}</small></span></th>)}
          </tr>
        </thead>
        <tbody>
          {companies.map((co) => (
            <tr key={co}>
              <td className="strong"><span className="dot" style={{ background: COMPANY_COLORS[co] }} />{co}</td>
              {cols.map((c) => <td key={c.head} className="r" data-label={c.head}>{c.cell(co)}</td>)}
            </tr>
          ))}
        </tbody>
        {group && companies.length > 1 && (
          <tfoot>
            <tr>
              <td className="strong">Group</td>
              {cols.map((c) => <td key={c.head} className="r strong" data-label={c.head}>{c.total ? c.total() : ''}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default function Scorecard({
  sc, companies, targets, tg, monthLabel, rangeLabel, labels, typeStats, maxRangeMonths, baseFull = {},
}: {
  baseFull?: Record<string, { giv: number; niv: number }>;
  sc: ScorecardData; companies: string[]; targets: Record<string, { target: number; be: number }>;
  tg: TimeGone; monthLabel: string; rangeLabel: string;
  labels: { cy: string; fy: string; p3: string; p6: string; storesP3: string };
  typeStats: Record<string, TypeStat[]> | null; maxRangeMonths: number;
}) {
  const [metric, setMetric] = useState<Metric>('giv');
  const M = metric.toUpperCase();
  const S = (co: string): CompanyScore | undefined => sc.byCompany[co];
  // รวม Group จากทุกบริษัท
  const sum = (get: (s: CompanyScore) => number | undefined | null) =>
    companies.reduce((t, co) => t + (S(co) ? get(S(co)!) ?? 0 : 0), 0);
  const avgOf = (s: CompanyScore, p: 'p3' | 'p6') => {
    const n = p === 'p3' ? s.p3Months : s.p6Months;
    return s[p] && n ? s[p]![metric] / n : null;
  };
  const wait = <span className="muted">{sc.kpiReady ? '–' : 'รอข้อมูล'}</span>;

  // ── 1. Sales vs Target (Target ตั้งเป็น GIV เสมอ) ──
  const tgt = (co: string) => targets[co]?.target ?? 0;
  // % vs Target เทียบ Time gone: มากกว่า = เขียว · ไม่ถึง = สีปกติ
  const vsTg = (p: number | null) => p == null ? '–' : <b className={p * 100 >= tg.pct ? 'sc-good' : undefined}>{(p * 100).toFixed(1)}%</b>;
  const vsTarget: Col[] = [
    { head: 'Target', note: 'เป้าทั้งเดือน (GIV)', cell: (co) => num(tgt(co)), total: () => num(companies.reduce((t, co) => t + tgt(co), 0)) },
    { head: 'Sales MTD', note: 'GIV เดือนนี้ถึงวันล่าสุด', cell: (co) => <b>{num(S(co)?.month?.giv)}</b>, total: () => num(sum((s) => s.month?.giv)) },
    { head: 'Time gone', note: 'วันทำงานที่ผ่านไป ÷ ทั้งเดือน', cell: () => <span className="muted">{tg.pct.toFixed(1)}%</span>, total: () => `${tg.pct.toFixed(1)}%` },
    {
      head: '% vs Target', note: 'เขียว = มากกว่า Time gone',
      cell: (co) => vsTg(div(S(co)?.month?.giv, tgt(co))),
      total: () => vsTg(div(sum((s) => s.month?.giv), companies.reduce((a, co) => a + tgt(co), 0))),
    },
  ];

  // ── 2. Sales vs Base / YA ──
  const yoy = (title: string, desc: ReactNode, cur: (s: CompanyScore) => number | undefined, base: (s: CompanyScore) => number | undefined, onlySdo = false, extra: Col[] = []) => {
    const cos = onlySdo ? companies.filter((c) => c === 'SDO') : companies;
    return cos.length === 0 ? null : (
      <ScoreTable title={title} desc={desc} companies={cos} group={!onlySdo} cols={[
        ...extra,
        { head: 'Base (ปีก่อน)', note: 'ช่วงเดียวกันของปีก่อน', cell: (co) => num(S(co) ? base(S(co)!) : null), total: () => num(sum(base)) },
        { head: `Sales ${M}`, note: 'ปีนี้', cell: (co) => <b>{num(S(co) ? cur(S(co)!) : null)}</b>, total: () => num(sum(cur)) },
        { head: 'Index', note: 'ปีนี้ ÷ ปีก่อน × 100', cell: (co) => <Index cur={S(co) ? cur(S(co)!) : null} base={S(co) ? base(S(co)!) : null} />, total: () => <Index cur={sum(cur)} base={sum(base)} /> },
      ]} />
    );
  };
  // Base ทั้งเดือนของปีก่อน (ไว้ดูว่าทั้งเดือนต้องทำได้เท่าไร)
  const baseFullCol: Col = {
    head: 'Base (ทั้งเดือน)', note: 'เดือนเดียวกันปีก่อน ทั้งเดือน',
    cell: (co) => num(baseFull[co]?.[metric] || null),
    total: () => num(companies.reduce((t, co) => t + (baseFull[co]?.[metric] ?? 0), 0)),
  };

  // ── 3. Sales vs ค่าเฉลี่ย 3 / 6 เดือนก่อน ──
  const vsAvg: Col[] = [
    { head: 'Avg P3', note: `เฉลี่ย/เดือน ${labels.p3}`, cell: (co) => num(S(co) ? avgOf(S(co)!, 'p3') : null), total: () => num(companies.reduce((t, co) => t + (S(co) ? avgOf(S(co)!, 'p3') ?? 0 : 0), 0)) },
    { head: 'Avg P6', note: `เฉลี่ย/เดือน ${labels.p6}`, cell: (co) => num(S(co) ? avgOf(S(co)!, 'p6') : null), total: () => num(companies.reduce((t, co) => t + (S(co) ? avgOf(S(co)!, 'p6') ?? 0 : 0), 0)) },
    { head: `Sales ${M} MTD`, note: 'เดือนนี้ถึงวันล่าสุด', cell: (co) => <b>{num(S(co)?.month?.[metric])}</b>, total: () => num(sum((s) => s.month?.[metric])) },
    { head: '% vs P3', note: 'เดือนนี้ ÷ Avg P3 × 100', cell: (co) => <Index cur={S(co)?.month?.[metric]} base={S(co) ? avgOf(S(co)!, 'p3') : null} />, total: () => <Index cur={sum((s) => s.month?.[metric])} base={companies.reduce((t, co) => t + (S(co) ? avgOf(S(co)!, 'p3') ?? 0 : 0), 0)} /> },
    { head: '% vs P6', note: 'เดือนนี้ ÷ Avg P6 × 100', cell: (co) => <Index cur={S(co)?.month?.[metric]} base={S(co) ? avgOf(S(co)!, 'p6') : null} />, total: () => <Index cur={sum((s) => s.month?.[metric])} base={companies.reduce((t, co) => t + (S(co) ? avgOf(S(co)!, 'p6') ?? 0 : 0), 0)} /> },
  ];

  // ── 4. Active Stores ──
  const stores: Col[] = [
    {
      head: 'Active Stores', note: 'SDO นับ 3 เดือน · PDC/DC นับเดือนนี้',
      cell: (co) => S(co)?.storesActive ? <b>{fmtInt(S(co)!.storesActive!.active_stores)}</b> : wait,
    },
    {
      head: 'Active Stores (ช่วงที่เลือก)', note: `ร้านที่ยอดรวม > 0 ใน ${rangeLabel}`,
      cell: (co) => sc.rangeTooLong ? <span className="muted">เกิน {maxRangeMonths} เดือน</span> : S(co)?.storesRange ? <b>{fmtInt(S(co)!.storesRange!.active_stores)}</b> : wait,
    },
    { head: 'Bills', note: 'จำนวนบิลขายเดือนนี้', cell: (co) => num(S(co)?.month?.bills), total: () => num(sum((s) => s.month?.bills)) },
  ];

  // ── 5. การเข้าพบ แยกประเภทเซลล์ ──
  const visitRows = companies.flatMap((co) => (typeStats?.[co] ?? []).filter((t) => t.bills > 0).map((t) => ({ co, t })));

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h3 className="card-title">Scorecard รายบริษัท · {monthLabel}</h3>
          <p className="card-sub">
            ทุกตารางแสดงตัวเลขจริงทั้งสองฝั่ง แล้วค่อยเป็น % · ▲ เขียว = ถึง / เกินฐาน · ▼ แดง = ต่ำกว่าฐาน ·
            Time gone {tg.pct.toFixed(1)}% ({tg.elapsed} จาก {tg.total} วันทำงาน)
          </p>
        </div>
        <div className="seg" role="tablist" aria-label="ตัวชี้วัด">
          {(['giv', 'niv'] as Metric[]).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={metric === m} className={metric === m ? 'on' : ''} onClick={() => setMetric(m)}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <div className="sc3-list">
        <ScoreTable title="1. Sales vs Target" companies={companies} cols={vsTarget}
          desc={<>ยอดขายเดือนนี้เทียบเป้าทั้งเดือนจาก Google Sheet · % สีเขียว = ถึง Time gone แล้ว (ใช้ GIV เสมอ เพราะ Target ตั้งเป็น GIV)</>} />

        {yoy('2. Sales vs Base', <>{M} เดือนนี้ เทียบเดือนเดียวกันของปีก่อน <b>นับถึงวันที่เดียวกัน</b> ({monthLabel})</>, (s) => s.month?.[metric], (s) => s.base?.[metric], false, [baseFullCol])}

        {yoy('3. Sales vs YA (CY)', <>{M} สะสมตั้งแต่ ม.ค. ถึงปัจจุบัน ({labels.cy}) เทียบช่วงเดียวกันของปีก่อน</>, (s) => s.cy.cur?.[metric], (s) => s.cy.prev?.[metric])}

        {yoy('4. Sales vs YA (FYTD) · SDO', <>{M} สะสมตามปีงบ P&amp;G เริ่ม ก.ค. ({labels.fy}) เทียบช่วงเดียวกันของปีก่อน · ใช้กับ SDO เท่านั้น</>, (s) => s.fy.cur?.[metric], (s) => s.fy.prev?.[metric], true)}

        <ScoreTable title="5. Sales P3 / P6" companies={companies} cols={vsAvg}
          desc={<>Avg = ยอดรวม 3 / 6 เดือนก่อนหน้า ÷ จำนวนเดือน · % = เดือนนี้ ÷ Avg × 100 (เดือนที่ยังไม่จบจะต่ำกว่า 100% เป็นปกติ)</>} />

        <ScoreTable title="6. Active Stores" companies={companies} cols={stores}
          desc={<>จำนวนร้านไม่ซ้ำที่ยอดซื้อรวม &gt; 0 (1 ร้านนับ 1 ไม่ว่าซื้อกี่บิล) · SDO นับ 3 เดือน ({labels.storesP3}) · PDC / DC นับเดือนนี้ ไม่รวมเอกสาร RFCCA</>} />

        <div className="sc3">
          <div className="sc3-head">
            <b>7. Productivity · แยกประเภทเซลล์</b>
            <span>
              Credit / Van / Presale วันทำงานไม่เท่ากัน จึงคิดแยก ·
              <b> Avg Work Days</b> = วันที่เซลล์แต่ละคนมีบิล รวมกัน ÷ จำนวนเซลล์ ·
              <b> Call/Day</b> = บิล ÷ วันทำงานรวม ·
              <b> Line/Bill</b> = บรรทัดสินค้า ÷ บิล (PDC / DC นับเฉพาะบรรทัด &gt; 1 บาท) ·
              <b> Baht/Bill</b> = {M} ÷ บิล
            </span>
          </div>
          {!typeStats ? (
            <p className="empty">รอข้อมูลรายเซลล์ — รัน supabase/seller_kpi.sql ใน Supabase ก่อน</p>
          ) : (
            <table className="rtable sc3-table">
              <thead>
                <tr>
                  <th>Company · Type</th>
                  <th className="r"><span className="sc3-th">Sellers<small>เซลล์ที่มีบิล</small></span></th>
                  <th className="r"><span className="sc3-th">Avg Work Days<small>วันทำงานเฉลี่ย/คน</small></span></th>
                  <th className="r"><span className="sc3-th">Bills<small>จำนวนบิล</small></span></th>
                  <th className="r"><span className="sc3-th">Call/Day<small>บิล/คน/วัน</small></span></th>
                  <th className="r"><span className="sc3-th">Line/Bill<small>บรรทัด/บิล</small></span></th>
                  <th className="r"><span className="sc3-th">Baht/Bill<small>{M}/บิล</small></span></th>
                </tr>
              </thead>
              <tbody>
                {visitRows.map(({ co, t }, i) => (
                  <tr key={`${co}|${t.type}`} className={i > 0 && visitRows[i - 1].co !== co ? 'sc3-break' : ''}>
                    <td className="strong"><span className="dot" style={{ background: COMPANY_COLORS[co] }} />{co} · {SELLER_TYPE_LABEL[t.type]}</td>
                    <td className="r" data-label="Sellers">{fmtInt(t.sellers)}</td>
                    <td className="r" data-label="Avg Work Days">{fmt1(div(t.sellerDays, t.sellers))}</td>
                    <td className="r" data-label="Bills">{fmtInt(t.bills)}</td>
                    <td className="r strong" data-label="Call/Day">{fmt1(div(t.bills, t.sellerDays))}</td>
                    <td className="r strong" data-label="Line/Bill">{fmt1(div(t.lines, t.bills))}</td>
                    <td className="r" data-label="Baht/Bill">{t.bills ? fmtInt(t[metric] / t.bills) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {!sc.kpiReady && (
        <p className="note" style={{ marginTop: 12 }}>
          ช่อง &quot;รอข้อมูล&quot; (Active Stores) จะขึ้นหลังรัน supabase/kpi_store.sql และรอคำนวณย้อนหลังเสร็จ
        </p>
      )}
    </section>
  );
}
