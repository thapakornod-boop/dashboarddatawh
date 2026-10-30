'use client';

import { Fragment, useMemo, useState } from 'react';
import { COMPANY_COLORS, fmtInt, fmtPct, paceColor, pctOf } from '@/app/lib/format';
import { PaceBar } from '@/app/components/ui';

// ยอดขายตามทีม: ตัวกรอง บริษัท / หัวหน้า (SM) / Sup / Princ → ตารางเต็มทุกคน จัดกลุ่ม SM → Sup พร้อมยอดรวมกลุ่ม
// ทุกค่ามาจากชีต BEST - Estimate รวม GIV / NIV (SDO ในชีตรวมยอดเป็นรหัสเขต จับคู่รายรหัสกับระบบไม่ได้)
export type BranchSellerRow = {
  company: string;
  sm: string;
  sup: string;
  princ: string;
  branch: string;
  channel: string;
  seller: string;
  name: string;
  target: number;
  be: number;
  giv: number;
  niv: number;
  order: number;
};

const ALL = '';
const NONE = '(ไม่ระบุ)';
const smOf = (r: BranchSellerRow) => r.sm || NONE;
const supOf = (r: BranchSellerRow) => r.sup || NONE;
const princOf = (r: BranchSellerRow) => r.princ || NONE;

type Agg = { target: number; be: number; giv: number; niv: number; sellers: number };
function sum(rows: BranchSellerRow[]): Agg {
  return rows.reduce(
    (s, r) => ({ target: s.target + r.target, be: s.be + r.be, giv: s.giv + r.giv, niv: s.niv + r.niv, sellers: s.sellers + 1 }),
    { target: 0, be: 0, giv: 0, niv: 0, sellers: 0 }
  );
}

// จัดกลุ่มตามลำดับที่เจอในชีต (คงรูปแบบเดียวกับชีต)
function groupInOrder(rows: BranchSellerRow[], key: (r: BranchSellerRow) => string) {
  const map = new Map<string, BranchSellerRow[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return Array.from(map, ([name, list]) => ({ name, list }));
}

const uniq = (values: string[]) => Array.from(new Set(values));

function Summary({ label, agg, timeGonePct }: { label: string; agg: Agg; timeGonePct: number }) {
  const pct = pctOf(agg.giv, agg.target);
  return (
    <div className="team-summary">
      <div className="ts-item ts-main">
        <span className="eyebrow">{label}</span>
        <span className="ts-big">{fmtInt(agg.giv)}</span>
        <span className="ts-cap">GIV · {agg.sellers} คน</span>
      </div>
      <div className="ts-item">
        <span className="eyebrow">Target</span>
        <span className="ts-val">{agg.target ? fmtInt(agg.target) : '–'}</span>
        <span className="ts-pace"><PaceBar pct={pct} timeGonePct={timeGonePct} size="sm" /><b style={{ color: paceColor(pct, timeGonePct) }}>{fmtPct(pct)}</b></span>
      </div>
      <div className="ts-item">
        <span className="eyebrow">BE</span>
        <span className="ts-val">{agg.be ? fmtInt(agg.be) : '–'}</span>
        <span className="ts-cap">GIV ถึง BE {fmtPct(pctOf(agg.giv, agg.be))}</span>
      </div>
      <div className="ts-item">
        <span className="eyebrow">NIV</span>
        <span className="ts-val">{fmtInt(agg.niv)}</span>
        <span className="ts-cap">BE เทียบ Target {fmtPct(pctOf(agg.be, agg.target))}</span>
      </div>
    </div>
  );
}

// แถวตัวเลข (Target / GIV / % / BE / NIV) ใช้ร่วมกันทั้งแถวคนและแถวหัวกลุ่ม
function NumberCells({ agg, timeGonePct, strong }: { agg: Omit<Agg, 'sellers'>; timeGonePct: number; strong?: boolean }) {
  const pct = pctOf(agg.giv, agg.target);
  return (
    <>
      <td data-label="Target" className="r">{agg.target ? fmtInt(agg.target) : '–'}</td>
      <td data-label="GIV" className="r strong">{fmtInt(agg.giv)}</td>
      <td data-label="% ถึง Target" className="r">
        <span className="pct-cell"><PaceBar pct={pct} timeGonePct={timeGonePct} size="sm" /><b style={{ color: paceColor(pct, timeGonePct) }}>{fmtPct(pct)}</b></span>
      </td>
      <td data-label="BE" className="r">{agg.be ? fmtInt(agg.be) : '–'}</td>
      <td data-label="NIV" className={strong ? 'r' : 'r muted'}>{fmtInt(agg.niv)}</td>
    </>
  );
}

export default function BranchView({
  rows, companies, timeGonePct, periodLabel, sheetUpdatedAt,
}: {
  rows: BranchSellerRow[]; companies: string[]; timeGonePct: number; periodLabel: string; sheetUpdatedAt: string;
}) {
  const [company, setCompany] = useState(companies[0] ?? 'SDO');
  const [sm, setSm] = useState(ALL);
  const [sup, setSup] = useState(ALL);
  const [princ, setPrinc] = useState(ALL);
  const co = companies.includes(company) ? company : companies[0];

  // ตัวเลือกของแต่ละตัวกรองขึ้นกับตัวกรองก่อนหน้า (บริษัท → หัวหน้า → Sup) ส่วน Princ กรองได้อิสระ
  const coRows = useMemo(() => rows.filter((r) => r.company === co), [rows, co]);
  const smOptions = useMemo(() => uniq(coRows.filter((r) => !princ || princOf(r) === princ).map(smOf)), [coRows, princ]);
  const supOptions = useMemo(
    () => uniq(coRows.filter((r) => (!sm || smOf(r) === sm) && (!princ || princOf(r) === princ)).map(supOf)),
    [coRows, sm, princ]
  );
  const princOptions = useMemo(
    () => uniq(coRows.filter((r) => (!sm || smOf(r) === sm) && (!sup || supOf(r) === sup)).map(princOf)).sort(),
    [coRows, sm, sup]
  );

  const filtered = useMemo(
    () => coRows
      .filter((r) => (!sm || smOf(r) === sm) && (!sup || supOf(r) === sup) && (!princ || princOf(r) === princ))
      .sort((a, b) => a.order - b.order),
    [coRows, sm, sup, princ]
  );
  const groups = useMemo(
    () => groupInOrder(filtered, smOf).map((g) => ({ ...g, sups: groupInOrder(g.list, supOf) })),
    [filtered]
  );

  const label = [co, sm && `หัวหน้า ${sm}`, sup && `Sup ${sup}`, princ && princ].filter(Boolean).join(' · ');
  const reset = () => { setSm(ALL); setSup(ALL); setPrinc(ALL); };

  return (
    <section className="card teams">
      <header className="card-head">
        <div>
          <h3 className="card-title">ยอดขายตามทีม · {periodLabel}</h3>
          <p className="card-sub">
            จาก Google Sheet (BEST - Estimate){sheetUpdatedAt ? ` · อัปเดต ${sheetUpdatedAt}` : ''} · ช่องขาวบนแท่ง = Time gone {timeGonePct.toFixed(1)}%
          </p>
        </div>
      </header>

      {/* ── ตัวกรอง: เลือก "ทั้งหมด" = ดูภาพรวม / เลือกเฉพาะ = ดูแค่ทีมนั้น ── */}
      <div className="team-filters">
        <label className="field">
          <span className="field-label">บริษัท</span>
          <select value={co} onChange={(e) => { setCompany(e.target.value); reset(); }} disabled={companies.length < 2}>
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">หัวหน้า (SM)</span>
          <select value={sm} onChange={(e) => { setSm(e.target.value); setSup(ALL); }}>
            <option value={ALL}>ทั้งหมด ({smOptions.length})</option>
            {smOptions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Sup</span>
          <select value={sup} onChange={(e) => {
            // เลือก Sup ตอนยังไม่ได้เลือกหัวหน้า → เลือกหัวหน้าของ Sup คนนั้นให้ด้วย จะได้เห็นตารางเต็ม
            const v = e.target.value;
            if (v && !sm) setSm(smOf(coRows.find((r) => supOf(r) === v)!));
            setSup(v);
          }}>
            <option value={ALL}>ทั้งหมด ({supOptions.length})</option>
            {supOptions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Princ</span>
          <select value={princ} onChange={(e) => setPrinc(e.target.value)}>
            <option value={ALL}>ทั้งหมด ({princOptions.length})</option>
            {princOptions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <button type="button" className="clear-btn" onClick={reset} disabled={!sm && !sup && !princ}>ล้างตัวกรอง</button>
      </div>

      <Summary label={label} agg={sum(filtered)} timeGonePct={timeGonePct} />

      {filtered.length === 0 ? (
        <p className="empty">ไม่มีพนักงานตามตัวกรองที่เลือก</p>
      ) : (
        <table className="rtable team-table">
          <thead>
            <tr>
              <th>พนักงานขาย</th>
              <th>Princ · สาขา · ช่องทาง</th>
              <th className="r">Target</th>
              <th className="r">GIV</th>
              <th className="r">% ถึง Target</th>
              <th className="r">BE</th>
              <th className="r">NIV</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.name}>
                {/* หัวกลุ่มหัวหน้า (SM) + ยอดรวมทีม */}
                <tr className="grp grp-sm">
                  <td colSpan={2}>
                    <span className="grp-name">
                      <span className="grp-tag">SM</span>{g.name}
                      <span className="grp-count">{g.sups.length} Sup · {g.list.length} คน</span>
                      {/* ยังไม่เลือกหัวหน้า = ภาพรวมรายหัวหน้า กดเพื่อเปิดดูทีมเต็ม */}
                      {!sm && <button type="button" className="grp-open" onClick={() => { setSm(g.name); setSup(ALL); }}>ดูทีม →</button>}
                    </span>
                  </td>
                  <NumberCells agg={sum(g.list)} timeGonePct={timeGonePct} strong />
                </tr>
                {sm && g.sups.map((s) => (
                  <Fragment key={`${g.name}|${s.name}`}>
                    {/* Sup ที่มีลูกทีมคนเดียว ยอดรวมเท่ากับแถวคนอยู่แล้ว ไม่ต้องมีแถวหัวกลุ่ม */}
                    {s.list.length > 1 && <tr className="grp grp-sup">
                      <td colSpan={2}>
                        <span className="grp-name">
                          <span className="grp-tag">Sup</span>{s.name}
                          <span className="grp-count">{s.list.length} คน</span>
                        </span>
                      </td>
                      <NumberCells agg={sum(s.list)} timeGonePct={timeGonePct} strong />
                    </tr>}
                    {s.list.map((r) => (
                      <tr key={`${r.seller}|${r.princ}`}>
                        <td data-label="พนักงานขาย" className="seller-cell">
                          <span className="who"><span className="code">{r.seller}</span><span>{r.name}</span></span>
                        </td>
                        <td data-label="Princ · สาขา · ช่องทาง" className="muted">
                          <span className="dot" style={{ background: COMPANY_COLORS[r.company] }} />{r.princ} · {r.branch || '–'} · {r.channel || '–'}
                        </td>
                        <NumberCells agg={r} timeGonePct={timeGonePct} />
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}><b>รวม {label}</b></td>
              <NumberCells agg={sum(filtered)} timeGonePct={timeGonePct} strong />
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}
