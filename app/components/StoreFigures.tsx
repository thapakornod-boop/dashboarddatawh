'use client';

// ตัวเลขของร้าน (KPI + ซื้อ Princ อะไรบ้าง) พร้อมปุ่มสลับ "ยอดรวม" / "เฉลี่ยต่อเดือน"
//   เฉลี่ยต่อเดือน = ทุกตัวเลข ÷ จำนวนเดือนในช่วงที่เลือก (GIV, NIV, บิล, ปีก่อน, ยอดราย Princ)
//   บิล = จำนวนครั้งที่ขาย (ใบ invoice) เช่น เดือนนี้ขาย 10 ครั้ง = 10 บิล
import { useState, type ReactNode } from 'react';
import { COMPANY_COLORS, fmtInt, fmtShort } from '@/app/lib/format';

type Mode = 'sum' | 'avg';
type Princ = { p: string; companies: string[]; giv: number };
type Co = { company: string; giv: number };

export default function StoreFigures({
  giv, niv, bills, prevGiv, nMonths, activeMonths, princs, cos, rangeLabel, chart,
}: {
  giv: number; niv: number; bills: number; prevGiv: number; nMonths: number; activeMonths: number | null;
  princs: Princ[]; cos: Co[]; rangeLabel: string; chart: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>(nMonths > 1 ? 'avg' : 'sum');
  const n = mode === 'avg' ? Math.max(nMonths, 1) : 1;
  const v = (x: number) => x / n;
  const unit = mode === 'avg' ? ' / เดือน' : '';
  const yago = prevGiv ? (giv / prevGiv) * 100 : null;
  const pct = (x: number) => (giv ? `${((x / giv) * 100).toFixed(1)}%` : '–');
  const maxPrinc = Math.max(...princs.map((x) => x.giv), 1);

  return (
    <>
      <div className="st-mode">
        <div className="seg" role="tablist" aria-label="แสดงเป็น">
          <button type="button" role="tab" aria-selected={mode === 'sum'} className={mode === 'sum' ? 'on' : ''} onClick={() => setMode('sum')}>ยอดรวม {rangeLabel}</button>
          <button type="button" role="tab" aria-selected={mode === 'avg'} className={mode === 'avg' ? 'on' : ''} onClick={() => setMode('avg')}>เฉลี่ยต่อเดือน ({nMonths} เดือน)</button>
        </div>
        <span className="muted">{mode === 'avg' ? `ทุกตัวเลข ÷ ${nMonths} เดือน` : 'ยอดรวมทั้งช่วงที่เลือก'}</span>
      </div>

      <section className="st-kpis st-kpis-6">
        <div className="st-kpi st-kpi-main">
          <span className="eyebrow">GIV{unit}</span>
          <span className="st-kpi-val">{fmtInt(v(giv))}</span>
          <span className="st-kpi-cap">{mode === 'avg' ? `รวม ${fmtInt(giv)} ÷ ${nMonths} เดือน` : rangeLabel}</span>
        </div>
        <div className="st-kpi">
          <span className="eyebrow">NIV{unit}</span>
          <span className="st-kpi-val">{fmtInt(v(niv))}</span>
          <span className="st-kpi-cap">ส่วนลด {giv ? `${(((giv - niv) / giv) * 100).toFixed(1)}%` : '–'} ของ GIV</span>
        </div>
        <div className="st-kpi">
          <span className="eyebrow">เทียบปีก่อน (ช่วงเดียวกัน)</span>
          <span className="st-kpi-val">
            {yago == null ? '–' : <span className={`sc-chip ${yago >= 100 ? 'up' : 'down'}`}>{yago >= 100 ? '▲' : '▼'} {yago.toFixed(1)}%</span>}
          </span>
          <span className="st-kpi-cap">{prevGiv ? `ปีก่อน ${fmtInt(v(prevGiv))}${unit}` : 'ปีก่อนไม่มียอด'}</span>
        </div>
        <div className="st-kpi">
          <span className="eyebrow">จำนวนบิล{unit}</span>
          <span className="st-kpi-val">{mode === 'avg' ? v(bills).toLocaleString('th-TH', { maximumFractionDigits: 1 }) : fmtInt(bills)}</span>
          <span className="st-kpi-cap">ขายกี่ครั้งนับกี่บิล (ใบ invoice)</span>
        </div>
        <div className="st-kpi">
          <span className="eyebrow">เฉลี่ยต่อบิล</span>
          <span className="st-kpi-val">{bills ? fmtInt(giv / bills) : '–'}</span>
          <span className="st-kpi-cap">GIV ÷ จำนวนบิล</span>
        </div>
        <div className="st-kpi">
          <span className="eyebrow">เดือนที่ซื้อ</span>
          <span className="st-kpi-val">{activeMonths == null ? '–' : `${activeMonths} / ${nMonths}`}</span>
          <span className="st-kpi-cap">เดือนที่มีบิล ÷ เดือนในช่วง</span>
        </div>
      </section>

      <div className="grid-2 st-grid">
        {chart}
        <section className="card">
          <h3 className="card-title">ซื้อ Princ อะไรบ้าง{unit}</h3>
          <p className="card-sub">เรียงตาม GIV · % = สัดส่วนจากยอดรวมของร้าน</p>
          {cos.length > 1 && (
            <div className="st-split" role="img" aria-label={cos.map((c) => `${c.company} ${pct(c.giv)}`).join(', ')}>
              <div className="st-split-bar">
                {cos.map((c) => <span key={c.company} style={{ flexGrow: Math.max(c.giv, 0), background: COMPANY_COLORS[c.company] }} />)}
              </div>
              <div className="st-split-legend">
                {cos.map((c) => (
                  <span key={c.company}><i style={{ background: COMPANY_COLORS[c.company] }} />{c.company} <b>{pct(c.giv)}</b> <span className="muted">{fmtShort(v(c.giv))}</span></span>
                ))}
              </div>
            </div>
          )}
          <ul className="st-princ">
            {princs.map((x) => (
              <li key={x.p}>
                <div className="st-princ-head">
                  <span className="st-princ-name">{x.p}<span className="muted"> · {x.companies.join(' / ')}</span></span>
                  <span><b>{fmtInt(v(x.giv))}</b> <span className="st-princ-pct">{pct(x.giv)}</span></span>
                </div>
                <span className="st-princ-track"><span style={{ width: `${Math.max((x.giv / maxPrinc) * 100, 0)}%` }} /></span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
