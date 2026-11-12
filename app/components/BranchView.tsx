'use client';

import { Fragment, useMemo, useState } from 'react';
import { COMPANY_COLORS, fmtInt, fmtPct, paceColor, pctOf } from '@/app/lib/format';
import { PaceBar } from '@/app/components/ui';

// ยอดขายตามทีม: ตัวกรอง บริษัท (เลือก "ทั้งหมด" ได้) / หัวหน้า (SM) / Sup / Princ → ตารางเต็มทุกคน จัดกลุ่ม SM → Sup พร้อมยอดรวมกลุ่ม
// คอลัมน์: Target | BE | GIV MTD | NIV | % GIV เทียบ Target | % GIV เทียบ BE | Time gone
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
const COMPANY_ORDER = ['SDO', 'PDC', 'DC'];
const NONE = '(ไม่ระบุ)';
const smOf = (r: BranchSellerRow) => r.sm || NONE;
const supOf = (r: BranchSellerRow) => r.sup || NONE;
const princOf = (r: BranchSellerRow) => r.princ || NONE;

type Agg = { target: number; be: number; giv: number; niv: number };
function sum(rows: BranchSellerRow[]): Agg {
  return rows.reduce(
    (s, r) => ({ target: s.target + r.target, be: s.be + r.be, giv: s.giv + r.giv, niv: s.niv + r.niv }),
    { target: 0, be: 0, giv: 0, niv: 0 }
  );
}

// จัดกลุ่มตามลำดับที่เจอในชีต (คงรูปแบบเดียวกับชีต)
function groupInOrder(rows: BranchSellerRow[], key: (r: BranchSellerRow) => string) {
  const map = new Map<string, BranchSellerRow[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return Array.from(map, ([name, list]) => ({ name, list }));
}

const uniq = (values: string[]) => Array.from(new Set(values));
// ต่ำกว่า Time gone = % GIV เทียบ Target ยังไม่ถึง % เวลาที่ผ่านไป (คนที่ "ขาด")
const behind = (r: Agg, tg: number) => r.target > 0 && (r.giv / r.target) * 100 < tg;

// showBe = false → ช่วงที่เลือกเป็นเดือนย้อนหลัง (BE เป็นค่าคาดการณ์ของเดือนปัจจุบันเท่านั้น) ซ่อน BE ทั้งหมด
function Summary({ label, agg, timeGonePct, showBe }: { label: string; agg: Agg; timeGonePct: number; showBe: boolean }) {
  const tPct = pctOf(agg.giv, agg.target);
  const bPct = pctOf(agg.giv, agg.be);
  return (
    <div className={`team-summary team-summary-5${showBe ? '' : ' no-be'}`}>
      <div className="ts-item">
        <span className="eyebrow">Target</span>
        <span className="ts-val">{agg.target ? fmtInt(agg.target) : '–'}</span>
        <span className="ts-cap">{label}</span>
      </div>
      {showBe && (
        <div className="ts-item">
          <span className="eyebrow">BE</span>
          <span className="ts-val">{agg.be ? fmtInt(agg.be) : '–'}</span>
          <span className="ts-cap">BE เทียบ Target {fmtPct(pctOf(agg.be, agg.target))}</span>
        </div>
      )}
      <div className="ts-item ts-main">
        <span className="eyebrow">GIV MTD</span>
        <span className="ts-big">{fmtInt(agg.giv)}</span>
        <span className="ts-pace"><PaceBar pct={tPct} timeGonePct={timeGonePct} size="sm" /></span>
        <span className="ts-cap">
          เทียบ Target <b style={{ color: paceColor(tPct, timeGonePct) }}>{fmtPct(tPct)}</b>
          {showBe && <> · เทียบ BE <b style={{ color: paceColor(bPct, timeGonePct) }}>{fmtPct(bPct)}</b></>}
        </span>
      </div>
      <div className="ts-item">
        <span className="eyebrow">NIV</span>
        <span className="ts-val">{fmtInt(agg.niv)}</span>
      </div>
      <div className="ts-item">
        <span className="eyebrow">Time gone</span>
        <span className="ts-val">{timeGonePct.toFixed(1)}%</span>
        <span className="ts-cap">% GIV ควรถึงค่านี้</span>
      </div>
    </div>
  );
}

// แถวตัวเลข ใช้ร่วมกันทั้งแถวคนและแถวหัวกลุ่ม
function NumberCells({ agg, timeGonePct, strong, showBe }: { agg: Agg; timeGonePct: number; strong?: boolean; showBe: boolean }) {
  const tPct = pctOf(agg.giv, agg.target);
  const bPct = pctOf(agg.giv, agg.be);
  return (
    <>
      <td data-label="Target" className="r">{agg.target ? fmtInt(agg.target) : '–'}</td>
      {showBe && <td data-label="BE" className="r">{agg.be ? fmtInt(agg.be) : '–'}</td>}
      <td data-label="GIV MTD" className="r strong">{fmtInt(agg.giv)}</td>
      <td data-label="NIV" className={strong ? 'r' : 'r muted'}>{fmtInt(agg.niv)}</td>
      <td data-label="% เทียบ Target" className="r">
        <span className="pct-cell"><PaceBar pct={tPct} timeGonePct={timeGonePct} size="sm" /><b style={{ color: paceColor(tPct, timeGonePct) }}>{fmtPct(tPct)}</b></span>
      </td>
      {showBe && <td data-label="% เทียบ BE" className="r"><b style={{ color: paceColor(bPct, timeGonePct) }}>{fmtPct(bPct)}</b></td>}
      <td data-label="Time gone" className="r muted">{timeGonePct.toFixed(1)}%</td>
    </>
  );
}

export default function BranchView({
  rows, companies, timeGonePct, periodLabel, sheetUpdatedAt, showBe = true,
}: {
  rows: BranchSellerRow[]; companies: string[]; timeGonePct: number; periodLabel: string; sheetUpdatedAt: string; showBe?: boolean;
}) {
  // เริ่มที่ "ทั้งหมด" (ถ้า filter ด้านบนเลือกบริษัทเดียว ก็มีแค่บริษัทนั้น)
  const [company, setCompany] = useState(ALL);
  const [sm, setSm] = useState(ALL);
  const [sup, setSup] = useState(ALL);
  const [princ, setPrinc] = useState(ALL);
  const [onlyBehind, setOnlyBehind] = useState(false);
  const co = company && companies.includes(company) ? company : ALL;

  // ตัวเลือกของแต่ละตัวกรองขึ้นกับตัวกรองก่อนหน้า (บริษัท → หัวหน้า → Sup) ส่วน Princ กรองได้อิสระ
  const coRows = useMemo(() => rows.filter((r) => companies.includes(r.company) && (!co || r.company === co)), [rows, co, companies]);
  const smOptions = useMemo(() => uniq(coRows.filter((r) => !princ || princOf(r) === princ).map(smOf)), [coRows, princ]);
  const supOptions = useMemo(
    () => uniq(coRows.filter((r) => (!sm || smOf(r) === sm) && (!princ || princOf(r) === princ)).map(supOf)),
    [coRows, sm, princ]
  );
  const princOptions = useMemo(
    () => uniq(coRows.filter((r) => (!sm || smOf(r) === sm) && (!sup || supOf(r) === sup)).map(princOf)).sort(),
    [coRows, sm, sup]
  );

  const base = useMemo(
    () => coRows
      .filter((r) => (!sm || smOf(r) === sm) && (!sup || supOf(r) === sup) && (!princ || princOf(r) === princ))
      .sort((a, b) => COMPANY_ORDER.indexOf(a.company) - COMPANY_ORDER.indexOf(b.company) || a.order - b.order),
    [coRows, sm, sup, princ]
  );
  const behindCount = useMemo(() => base.filter((r) => behind(r, timeGonePct)).length, [base, timeGonePct]);
  const filtered = useMemo(() => (onlyBehind ? base.filter((r) => behind(r, timeGonePct)) : base), [base, onlyBehind, timeGonePct]);
  const groups = useMemo(
    () => groupInOrder(filtered, smOf).map((g) => ({ ...g, sups: groupInOrder(g.list, supOf) })),
    [filtered]
  );

  const label = [co || (companies.length > 1 ? 'ทุกบริษัท' : companies[0]), sm && `หัวหน้า ${sm}`, sup && `Sup ${sup}`, princ && princ].filter(Boolean).join(' · ');
  const reset = () => { setSm(ALL); setSup(ALL); setPrinc(ALL); setOnlyBehind(false); };
  // เลือกหัวหน้าแล้ว หรือกรองเฉพาะคนที่ต่ำกว่า Time gone → แสดงรายคน
  const showPeople = !!sm || onlyBehind;

  return (
    <section className="card teams">
      <header className="card-head">
        <div>
          <h3 className="card-title">ยอดขายตามทีม · {periodLabel}</h3>
          <p className="card-sub">
            จาก Google Sheet (BEST - Estimate){sheetUpdatedAt ? ` · อัปเดต ${sheetUpdatedAt}` : ''} · Time gone {timeGonePct.toFixed(1)}% (ขีดบนแท่ง) · % สีแดง = ต่ำกว่า Time gone
          </p>
        </div>
      </header>

      {/* ── ตัวกรอง: เลือก "ทั้งหมด" = ดูภาพรวม / เลือกเฉพาะ = ดูแค่ทีมนั้น ── */}
      <div className="team-filters">
        <label className="field">
          <span className="field-label">บริษัท</span>
          <select value={co} onChange={(e) => { setCompany(e.target.value); reset(); }} disabled={companies.length < 2}>
            {companies.length > 1 && <option value={ALL}>ทั้งหมด</option>}
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
        <button type="button" className={`clear-btn behind-btn${onlyBehind ? ' on' : ''}`} onClick={() => setOnlyBehind((v) => !v)} aria-pressed={onlyBehind}>
          {onlyBehind ? '✓ ' : ''}เฉพาะคนที่ต่ำกว่า Time gone ({behindCount})
        </button>
        <button type="button" className="clear-btn" onClick={reset} disabled={!sm && !sup && !princ && !onlyBehind}>ล้างตัวกรอง</button>
      </div>

      <Summary label={label} agg={sum(filtered)} timeGonePct={timeGonePct} showBe={showBe} />

      {filtered.length === 0 ? (
        <p className="empty">ไม่มีพนักงานตามตัวกรองที่เลือก</p>
      ) : (
        <table className={`rtable team-table team-table-7${showBe ? '' : ' no-be'}`}>
          <thead>
            <tr>
              <th>พนักงานขาย</th>
              <th>Princ · สาขา · ช่องทาง</th>
              <th className="r">Target</th>
              {showBe && <th className="r">BE</th>}
              <th className="r">GIV MTD</th>
              <th className="r">NIV</th>
              <th className="r">% เทียบ Target</th>
              {showBe && <th className="r">% เทียบ BE</th>}
              <th className="r">Time gone</th>
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
                      <span className="grp-count">{g.sups.length} Sup</span>
                      {/* ยังไม่เลือกหัวหน้า = ภาพรวมรายหัวหน้า กดเพื่อเปิดดูทีมเต็ม */}
                      {!sm && <button type="button" className="grp-open" onClick={() => { setSm(g.name); setSup(ALL); }}>ดูทีม →</button>}
                    </span>
                  </td>
                  <NumberCells agg={sum(g.list)} timeGonePct={timeGonePct} strong showBe={showBe} />
                </tr>
                {showPeople && g.sups.map((s) => (
                  <Fragment key={`${g.name}|${s.name}`}>
                    {/* Sup ที่มีลูกทีมคนเดียว ยอดรวมเท่ากับแถวคนอยู่แล้ว ไม่ต้องมีแถวหัวกลุ่ม */}
                    {s.list.length > 1 && <tr className="grp grp-sup">
                      <td colSpan={2}>
                        <span className="grp-name">
                          <span className="grp-tag">Sup</span>{s.name}
                        </span>
                      </td>
                      <NumberCells agg={sum(s.list)} timeGonePct={timeGonePct} strong showBe={showBe} />
                    </tr>}
                    {s.list.map((r) => (
                      <tr key={`${r.company}|${r.seller}|${r.princ}`} className={behind(r, timeGonePct) ? 'row-behind' : ''}>
                        <td data-label="พนักงานขาย" className="seller-cell">
                          <span className="who"><span className="code">{r.seller}</span><span>{r.name}</span></span>
                        </td>
                        <td data-label="Princ · สาขา · ช่องทาง" className="muted">
                          <span className="dot" style={{ background: COMPANY_COLORS[r.company] }} />{r.princ} · {r.branch || '–'} · {r.channel || '–'}
                        </td>
                        <NumberCells agg={r} timeGonePct={timeGonePct} showBe={showBe} />
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
              <NumberCells agg={sum(filtered)} timeGonePct={timeGonePct} strong showBe={showBe} />
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}
