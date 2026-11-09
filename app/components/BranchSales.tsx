'use client';

import { useMemo, useState } from 'react';
import type { BranchRow } from '@/app/lib/api';
import { fmtInt } from '@/app/lib/format';

// ยอดขาย GIV รายสาขา: ช่วงที่เลือก เทียบช่วงเดียวกันปีก่อน + Index + ยอดเฉลี่ยต่อเดือน
// เลือกบริษัท / Princ ได้ในการ์ด (บริษัทที่เลือกได้ = ตาม filter ด้านบน)
export const BRANCH_ORDER = ['RSM', 'UTH', 'KKC', 'RCB', 'BON', 'PSL', 'PTT', 'SRT', 'HDY'];
const ALL = '';

export const rank = (b: string) => {
  const i = BRANCH_ORDER.indexOf(b);
  return i < 0 ? BRANCH_ORDER.length : i;
};

function IndexCell({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return <td className="r" data-label="Index">–</td>;
  const idx = (cur / prev) * 100;
  return (
    <td className="r" data-label="Index">
      <span className={`idx-chip ${idx >= 100 ? 'up' : 'down'}`}>{idx.toFixed(1)}</span>
    </td>
  );
}

export function BranchSales({
  cur, prev, companies, curLabel, prevLabel, nMonths,
}: {
  cur: BranchRow[]; prev: BranchRow[]; companies: string[];
  curLabel: string; prevLabel: string; nMonths: number;
}) {
  const [co, setCo] = useState(ALL);
  const [princ, setPrinc] = useState(ALL);
  const [metric, setMetric] = useState<'giv' | 'niv'>('giv');
  const label = metric.toUpperCase();

  const inCo = (r: BranchRow) => companies.includes(r.company) && (!co || r.company === co);
  const princOptions = useMemo(
    () => Array.from(new Set(cur.filter(inCo).map((r) => r.principal))).sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cur, co, companies]
  );
  const keep = (r: BranchRow) => inCo(r) && (!princ || r.principal === princ);

  const rows = useMemo(() => {
    const m = new Map<string, { cur: number; prev: number }>();
    for (const r of cur) if (keep(r)) { const x = m.get(r.branch) ?? { cur: 0, prev: 0 }; x.cur += r[metric]; m.set(r.branch, x); }
    for (const r of prev) if (keep(r)) { const x = m.get(r.branch) ?? { cur: 0, prev: 0 }; x.prev += r[metric]; m.set(r.branch, x); }
    return [...m.entries()]
      .filter(([, v]) => Math.abs(v.cur) >= 1 || Math.abs(v.prev) >= 1)
      .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, prev, co, princ, companies, metric]);

  const total = rows.reduce((s, [, v]) => ({ cur: s.cur + v.cur, prev: s.prev + v.prev }), { cur: 0, prev: 0 });
  const avg = (v: number) => (nMonths > 0 ? v / nMonths : 0);

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h3 className="card-title">{label} รายสาขา · {curLabel}</h3>
          <p className="card-sub">เทียบช่วงเดียวกันปีก่อน ({prevLabel}) · Index = ปีนี้ ÷ ปีก่อน × 100 · เฉลี่ยต่อเดือน = ÷ {nMonths} เดือน</p>
        </div>
        <div className="seg" role="tablist" aria-label="ตัวชี้วัด">
          {(['giv', 'niv'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={metric === m}
              className={metric === m ? 'on' : ''} onClick={() => setMetric(m)}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <div className="team-filters">
        <label className="field">
          <span className="field-label">บริษัท</span>
          <select value={co} onChange={(e) => { setCo(e.target.value); setPrinc(ALL); }} disabled={companies.length < 2}>
            {companies.length > 1 && <option value={ALL}>ทั้งหมด</option>}
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Princ</span>
          <select value={princ} onChange={(e) => setPrinc(e.target.value)}>
            <option value={ALL}>ทั้งหมด ({princOptions.length})</option>
            {princOptions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <button type="button" className="clear-btn" onClick={() => { setCo(ALL); setPrinc(ALL); }} disabled={!co && !princ}>ล้างตัวกรอง</button>
      </div>

      {rows.length === 0 ? (
        <p className="empty">ไม่มียอดขายในช่วงที่เลือก</p>
      ) : (
        <table className="rtable branch-table">
          <thead>
            <tr>
              <th>สาขา</th>
              <th className="r">{prevLabel}</th>
              <th className="r">{curLabel}</th>
              <th className="r">Index</th>
              <th className="r">ยอดขายเฉลี่ย/M</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([b, v]) => (
              <tr key={b}>
                <td className="strong">{b}</td>
                <td className="r" data-label={prevLabel}>{v.prev ? fmtInt(v.prev) : '–'}</td>
                <td className="r" data-label={curLabel}>{fmtInt(v.cur)}</td>
                <IndexCell cur={v.cur} prev={v.prev} />
                <td className="r" data-label="ยอดขายเฉลี่ย/M">{fmtInt(avg(v.cur))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="strong">Group</td>
              <td className="r strong" data-label={prevLabel}>{total.prev ? fmtInt(total.prev) : '–'}</td>
              <td className="r strong" data-label={curLabel}>{fmtInt(total.cur)}</td>
              <IndexCell cur={total.cur} prev={total.prev} />
              <td className="r strong" data-label="ยอดขายเฉลี่ย/M">{fmtInt(avg(total.cur))}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}
