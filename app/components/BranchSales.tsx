'use client';

import { useMemo, useState } from 'react';
import type { BranchPrincRow } from '@/app/lib/api';
import { fmtInt } from '@/app/lib/format';

// ยอดขายรายสาขา (GIV จาก vw_lg014 · Target / BE จากชีต) — 2 มุมมอง
//   เทียบ Target : Target | Base (ปีก่อนทั้งเดือน) | MTD | % MTD เทียบ Target | % MTD เทียบ Base | Time gone | BE | % BE เทียบ Target
//   เทียบปีก่อน  : ปีก่อน (ช่วงเดียวกัน) | ปีนี้ | Index | เฉลี่ย/เดือน  (เลือก GIV / NIV ได้)
// สาขา: SDO = สาขาที่ออกบิล · PDC / DC = สาขาของเซลล์ตามชีต (ตรงกับสาขาของ Target) — จัดมาแล้วจากหน้า page
// เลือกบริษัท / Princ ได้ในการ์ด (บริษัทที่เลือกได้ = ตาม filter ด้านบน)
export const BRANCH_ORDER = ['RSM', 'UTH', 'KKC', 'RCB', 'BON', 'PSL', 'PTT', 'SRT', 'HDY'];
const ALL = '';

export const rank = (b: string) => {
  const i = BRANCH_ORDER.indexOf(b);
  return i < 0 ? BRANCH_ORDER.length : i;
};

export type BranchTarget = { company: string; branch: string; principal: string; target: number; be: number };
type View = 'target' | 'yoy';
type Row = { cur: number; prev: number; base: number; target: number; be: number };

const pct = (a: number, b: number) => (b ? (a / b) * 100 : null);

function PctChip({ value, base, label }: { value: number | null; base?: number; label: string }) {
  if (value === null) return <td className="r" data-label={label}>–</td>;
  // base = Time gone → เขียวเมื่อ % ถึง Time gone แล้ว · ไม่มี base → เขียวเมื่อ ≥ 100
  const up = value >= (base ?? 100);
  return (
    <td className="r" data-label={label}>
      <span className={`idx-chip ${up ? 'up' : 'down'}`}>{value.toFixed(1)}{base !== undefined ? '%' : ''}</span>
    </td>
  );
}

// base = ยอดปีก่อน "ทั้งเดือน" ราย สาขา × เซลล์ × Princ (จัดสาขาแบบเดียวกับปีนี้)
export function BranchSales({
  cur, prev, base, baseLabel, targets, companies, curLabel, prevLabel, nMonths, timeGonePct,
}: {
  cur: BranchPrincRow[]; prev: BranchPrincRow[]; base: BranchPrincRow[]; baseLabel: string; targets: BranchTarget[]; companies: string[];
  curLabel: string; prevLabel: string; nMonths: number; timeGonePct: number;
}) {
  const [co, setCo] = useState(ALL);
  const [princ, setPrinc] = useState(ALL);
  const [view, setView] = useState<View>('target');
  const [metric, setMetric] = useState<'giv' | 'niv'>('giv');
  // Target ตั้งเป็นยอด GIV → มุมมองเทียบ Target ใช้ GIV เสมอ
  const m = view === 'target' ? 'giv' : metric;

  const inCo = (c: string) => companies.includes(c) && (!co || c === co);
  const princOptions = useMemo(
    () => Array.from(new Set([...cur.filter((r) => inCo(r.company)).map((r) => r.principal), ...targets.filter((t) => inCo(t.company)).map((t) => t.principal)])).sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cur, targets, co, companies]
  );
  const keep = (c: string, p: string) => inCo(c) && (!princ || p === princ);

  const rows = useMemo(() => {
    const map = new Map<string, Row>();
    const at = (b: string) => {
      let x = map.get(b);
      if (!x) map.set(b, (x = { cur: 0, prev: 0, base: 0, target: 0, be: 0 }));
      return x;
    };
    for (const r of cur) if (keep(r.company, r.principal)) at(r.branch).cur += r[m];
    for (const r of prev) if (keep(r.company, r.principal)) at(r.branch).prev += r[m];
    for (const r of base) if (keep(r.company, r.principal)) at(r.branch).base += r[m];
    for (const t of targets) if (keep(t.company, t.principal)) { const x = at(t.branch || '-'); x.target += t.target; x.be += t.be; }
    return [...map.entries()]
      .filter(([, v]) => Math.abs(v.cur) >= 1 || Math.abs(v.prev) >= 1 || v.target || v.be)
      .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, prev, base, targets, co, princ, companies, m]);

  const total = rows.reduce<Row>((s, [, v]) => ({ cur: s.cur + v.cur, prev: s.prev + v.prev, base: s.base + v.base, target: s.target + v.target, be: s.be + v.be }), { cur: 0, prev: 0, base: 0, target: 0, be: 0 });
  const avg = (v: number) => (nMonths > 0 ? v / nMonths : 0);
  const label = m.toUpperCase();
  const tg = `${timeGonePct.toFixed(1)}%`;

  const line = (name: string, v: Row, strong = false) => {
    const s = strong ? ' strong' : '';
    return view === 'target' ? (
      <>
        <td className="strong">{name}</td>
        <td className={`r${s}`} data-label="Target">{v.target ? fmtInt(v.target) : '–'}</td>
        <td className={`r${s}`} data-label="Base">{v.base ? fmtInt(v.base) : '–'}</td>
        <td className="r strong" data-label="MTD (GIV)">{fmtInt(v.cur)}</td>
        <PctChip value={pct(v.cur, v.target)} base={timeGonePct} label="MTD เทียบ Target" />
        <PctChip value={pct(v.cur, v.base)} base={timeGonePct} label="MTD เทียบ Base" />
        <td className="r muted" data-label="Time gone">{tg}</td>
        <td className={`r${s}`} data-label="BE">{v.be ? fmtInt(v.be) : '–'}</td>
        <td className="r" data-label="BE เทียบ Target">{pct(v.be, v.target) === null ? '–' : `${pct(v.be, v.target)!.toFixed(1)}%`}</td>
      </>
    ) : (
      <>
        <td className="strong">{name}</td>
        <td className={`r${s}`} data-label={prevLabel}>{v.prev ? fmtInt(v.prev) : '–'}</td>
        <td className="r strong" data-label={curLabel}>{fmtInt(v.cur)}</td>
        <PctChip value={pct(v.cur, v.prev)} label="Index" />
        <td className={`r${s}`} data-label="ยอดขายเฉลี่ย/M">{fmtInt(avg(v.cur))}</td>
      </>
    );
  };

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h3 className="card-title">{view === 'target' ? 'GIV รายสาขา เทียบ Target' : `${label} รายสาขา เทียบปีก่อน`} · {curLabel}</h3>
          <p className="card-sub">
            {view === 'target'
              ? `ยอดขายจาก vw_lg014 · Target / BE จากชีต · Base = ยอดปีก่อนทั้งเดือน (${baseLabel}) · % = MTD ÷ Target หรือ Base (เขียว = ถึง Time gone ${tg} แล้ว)`
              : `เทียบช่วงเดียวกันปีก่อน (${prevLabel}) · Index = ปีนี้ ÷ ปีก่อน × 100 · เฉลี่ยต่อเดือน = ÷ ${nMonths} เดือน`}
            {' '}· สาขา PDC / DC ตามสาขาของเซลล์ในชีต
          </p>
        </div>
        <div className="seg-group">
          <div className="seg" role="tablist" aria-label="มุมมอง">
            <button type="button" role="tab" aria-selected={view === 'target'} className={view === 'target' ? 'on' : ''} onClick={() => setView('target')}>เทียบ Target</button>
            <button type="button" role="tab" aria-selected={view === 'yoy'} className={view === 'yoy' ? 'on' : ''} onClick={() => setView('yoy')}>เทียบปีก่อน</button>
          </div>
          {view === 'yoy' && (
            <div className="seg" role="tablist" aria-label="ตัวชี้วัด">
              {(['giv', 'niv'] as const).map((x) => (
                <button key={x} type="button" role="tab" aria-selected={metric === x} className={metric === x ? 'on' : ''} onClick={() => setMetric(x)}>
                  {x.toUpperCase()}
                </button>
              ))}
            </div>
          )}
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
            {view === 'target' ? (
              <tr>
                <th>สาขา</th>
                <th className="r">Target</th>
                <th className="r" title={baseLabel}>Base<br /><small className="muted">ปีก่อนทั้งเดือน</small></th>
                <th className="r">MTD (GIV)</th>
                <th className="r">MTD เทียบ Target</th>
                <th className="r">MTD เทียบ Base</th>
                <th className="r">Time gone</th>
                <th className="r">BE</th>
                <th className="r">BE เทียบ Target</th>
              </tr>
            ) : (
              <tr>
                <th>สาขา</th>
                <th className="r">{prevLabel}</th>
                <th className="r">{curLabel}</th>
                <th className="r">Index</th>
                <th className="r">ยอดขายเฉลี่ย/M</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map(([b, v]) => <tr key={b}>{line(b, v)}</tr>)}
          </tbody>
          <tfoot>
            <tr>{line('Group', total, true)}</tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}
