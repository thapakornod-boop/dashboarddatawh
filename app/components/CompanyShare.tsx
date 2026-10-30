'use client';

import { useMemo, useState } from 'react';
import { COMPANY_COLORS, fmtNum, fmtShort } from '@/app/lib/format';

// สัดส่วนยอดขาย: ภาพรวมทั้งหมดก่อน → เลือกบริษัท → เห็น Principal ทั้งหมดของบริษัทนั้น (ไม่มี scroll)
// rows = 1 แถวต่อเซลล์ (นับจำนวนเซลล์จากจำนวนแถว)
export type CompanyPrincRow = { company: string; princ: string; giv: number; niv: number };

type Metric = 'giv' | 'niv';
const ALL = 'ทั้งหมด';

const R = 70;
const STROKE = 22;
const C = 2 * Math.PI * R;
const GAP = 2.5; // ช่องว่างระหว่างชิ้น (ตามเส้นรอบวง)

export default function CompanyShare({ rows, companies }: { rows: CompanyPrincRow[]; companies: string[] }) {
  const [metric, setMetric] = useState<Metric>('giv');
  const [selected, setSelected] = useState<string>(ALL);
  const sel = selected === ALL || companies.includes(selected) ? selected : ALL;

  const byCompany = useMemo(() => companies.map((co) => {
    const list = rows.filter((r) => r.company === co);
    return { company: co, value: list.reduce((s, r) => s + r[metric], 0), sellers: list.length };
  }), [rows, companies, metric]);
  const total = byCompany.reduce((s, c) => s + c.value, 0);

  const selRows = useMemo(() => (sel === ALL ? rows : rows.filter((r) => r.company === sel)), [rows, sel]);
  const princs = useMemo(() => {
    const map = new Map<string, { princ: string; value: number; companies: Set<string> }>();
    for (const r of selRows) {
      const k = r.princ || '(ไม่ระบุ)';
      const cur = map.get(k) ?? { princ: k, value: 0, companies: new Set<string>() };
      cur.value += r[metric];
      cur.companies.add(r.company);
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [selRows, metric]);
  const selTotal = princs.reduce((s, p) => s + p.value, 0);
  const maxPrinc = Math.max(...princs.map((p) => p.value), 1);

  const lens = byCompany.map((c) => (total > 0 ? (Math.max(c.value, 0) / total) * C : 0));
  const slices = byCompany.map((c, i) => ({
    ...c,
    len: lens[i],
    offset: lens.slice(0, i).reduce((s, l) => s + l, 0), // ความยาวสะสมของชิ้นก่อนหน้า
    pct: total ? (c.value / total) * 100 : 0,
  }));

  const label = metric.toUpperCase();

  return (
    <section className="card share">
      <header className="card-head">
        <div>
          <h3 className="card-title">สัดส่วนยอดขาย</h3>
          <p className="card-sub">ภาพรวม → เลือกบริษัทเพื่อดู Principal ทั้งหมดของบริษัทนั้น</p>
        </div>
        <div className="seg" role="tablist" aria-label="ตัวชี้วัด">
          {(['giv', 'niv'] as Metric[]).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={metric === m}
              className={metric === m ? 'on' : ''} onClick={() => setMetric(m)}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* ── ภาพรวม: วงล้อม + การ์ดบริษัท ── */}
      <div className="share-top">
        <svg viewBox="0 0 180 180" className="share-donut" role="img" aria-label={`สัดส่วน ${label} ตามบริษัท`}>
          <circle cx="90" cy="90" r={R} fill="none" stroke="#F0F0F3" strokeWidth={STROKE} />
          {slices.map((s) => s.len > 0 && (
            <circle
              key={s.company}
              cx="90" cy="90" r={R} fill="none"
              stroke={COMPANY_COLORS[s.company] ?? '#9C9C9C'}
              strokeWidth={STROKE}
              strokeDasharray={`${Math.max(s.len - GAP, 0.5)} ${C}`}
              strokeDashoffset={-s.offset}
              transform="rotate(-90 90 90)"
              opacity={sel === ALL || sel === s.company ? 1 : 0.25}
              className="share-slice"
              onClick={() => setSelected(sel === s.company ? ALL : s.company)}
            >
              <title>{`${s.company}: ${fmtNum(s.value)} (${s.pct.toFixed(1)}%)`}</title>
            </circle>
          ))}
          <text x="90" y="80" textAnchor="middle" className="donut-cap">{sel === ALL ? `${label} รวม` : sel}</text>
          <text x="90" y="102" textAnchor="middle" className="donut-val">{fmtShort(sel === ALL ? total : selTotal)}</text>
          <text x="90" y="120" textAnchor="middle" className="donut-cap">
            {sel === ALL ? `${companies.length} บริษัท` : `${total ? ((selTotal / total) * 100).toFixed(1) : '0.0'}%`}
          </text>
        </svg>

        <div className="share-tiles">
          <button type="button" className={`tile ${sel === ALL ? 'on' : ''}`} onClick={() => setSelected(ALL)} aria-pressed={sel === ALL}>
            <span className="tile-name">ทั้งหมด</span>
            <span className="tile-val">{fmtShort(total)}</span>
            <span className="tile-meta">100% · {rows.length} เซลล์</span>
          </button>
          {slices.map((s) => (
            <button key={s.company} type="button" className={`tile ${sel === s.company ? 'on' : ''}`}
              onClick={() => setSelected(s.company)} aria-pressed={sel === s.company}>
              <span className="tile-name"><span className="dot" style={{ background: COMPANY_COLORS[s.company] }} />{s.company}</span>
              <span className="tile-val">{fmtShort(s.value)}</span>
              <span className="tile-meta">{s.pct.toFixed(1)}% · {s.sellers} เซลล์</span>
              <span className="tile-share"><span style={{ width: `${s.pct}%`, background: COMPANY_COLORS[s.company] }} /></span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Principal ของที่เลือก: แสดงครบทุกตัว เรียงยอดมาก → น้อย ── */}
      <div className="share-detail">
        <div className="share-detail-head">
          <span className="eyebrow">Principal · {sel}</span>
          <span className="share-stats">
            <span><b>{fmtNum(selTotal)}</b> บาท</span>
            <span><b>{total ? ((selTotal / total) * 100).toFixed(1) : '0.0'}%</b> ของทั้งหมด</span>
            <span><b>{princs.length}</b> Principal</span>
            <span><b>{selRows.length}</b> เซลล์</span>
          </span>
        </div>
        <ol className="princ-grid">
          {princs.map((p, i) => (
            <li key={p.princ} className="princ" title={`${p.princ}: ${fmtNum(p.value)}`}>
              <span className="princ-rank">{i + 1}</span>
              <span className="princ-main">
                <span className="princ-name">
                  {p.princ}
                  {sel === ALL && [...p.companies].map((c) => (
                    <span key={c} className="princ-co" style={{ color: COMPANY_COLORS[c] }}>{c}</span>
                  ))}
                </span>
                <span className="princ-bar">
                  <span style={{ width: `${Math.max((p.value / maxPrinc) * 100, 0)}%`, background: sel === ALL ? '#1F66E5' : COMPANY_COLORS[sel] }} />
                </span>
              </span>
              <span className="princ-num">
                <span className="princ-val">{fmtShort(p.value)}</span>
                <span className="princ-share">{selTotal ? ((p.value / selTotal) * 100).toFixed(1) : '0.0'}%</span>
              </span>
            </li>
          ))}
        </ol>
        {princs.length === 0 && <p className="empty">ไม่มีข้อมูล</p>}
      </div>
    </section>
  );
}
