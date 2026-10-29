'use client';

import { useMemo, useState } from 'react';

// แถวตารางรายคน: ยอดช่วงที่เลือก + ช่วงเดียวกันปีก่อน + Target / BE จาก Google Sheet
export type SellerDetailRow = {
  company: string;
  seller: string;
  princ: string;
  giv: number;
  niv: number;
  prevGIV: number;
  prevNIV: number;
  target: number;
  be: number;
};

type SortKey = 'giv' | 'niv' | 'target' | 'givPct' | 'be' | 'bePct' | 'prevNIV' | 'growth';

const COMPANIES = ['SDO', 'PDC', 'DC'];

function fmtNum(n: number | null | undefined) {
  if (n == null) return '-';
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function growthArrow(pct: number | null) {
  if (pct == null) return '–';
  return pct >= 0 ? `▲ ${pct.toFixed(2)}%` : `▼ ${Math.abs(pct).toFixed(2)}%`;
}
function pctGrowth(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Number((((cur - prev) / Math.abs(prev)) * 100).toFixed(2));
}
function pctOf(value: number, target: number): number | null {
  return target ? (value / target) * 100 : null;
}
function fmtPct(n: number | null) {
  return n == null ? '–' : `${n.toFixed(1)}%`;
}
// ≥100% เขียว, ≥80% ส้ม, ต่ำกว่านั้นแดง
function achieveColor(pct: number | null) {
  if (pct == null) return '#A2ABBD';
  return pct >= 100 ? '#16A34A' : pct >= 80 ? '#D97706' : '#DC2626';
}

function sortValue(r: SellerDetailRow, key: SortKey): number {
  switch (key) {
    case 'givPct': return pctOf(r.giv, r.target) ?? -Infinity;
    case 'bePct':  return pctOf(r.be, r.target) ?? -Infinity;
    case 'growth': return pctGrowth(r.niv, r.prevNIV) ?? -Infinity;
    default:       return r[key];
  }
}

function downloadCsv(rows: SellerDetailRow[], fileTag: string) {
  const header = ['บริษัท', 'รหัสเซลล์', 'Principal', 'GIV', 'NIV', 'Target', '% GIV/Target', 'BE', '% BE/Target', 'GIV ปีก่อน', 'NIV ปีก่อน', 'Growth NIV %'];
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = rows.map((r) => [
    r.company, r.seller, r.princ,
    r.giv.toFixed(2), r.niv.toFixed(2), r.target.toFixed(2),
    pctOf(r.giv, r.target)?.toFixed(1) ?? '', r.be.toFixed(2),
    pctOf(r.be, r.target)?.toFixed(1) ?? '',
    r.prevGIV.toFixed(2), r.prevNIV.toFixed(2),
    pctGrowth(r.niv, r.prevNIV)?.toFixed(2) ?? '',
  ].map(cell).join(','));
  // BOM ให้ Excel อ่านภาษาไทยถูก
  const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sales-by-seller-${fileTag}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Icon ─────────────────────────────
function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export default function SellerTable({
  rows,
  companyFilter,
  hasPrev,
  periodLabel,
  fileTag,
}: {
  rows: SellerDetailRow[];
  companyFilter: string;
  hasPrev: boolean;
  periodLabel: string;
  fileTag: string;
}) {
  const [search, setSearch] = useState('');
  // ถ้าตัวกรองด้านบนเลือกบริษัทไว้แล้ว ข้อมูลมีแค่บริษัทนั้น จึงซ่อนปุ่มเลือกบริษัท
  const [company, setCompany] = useState('all');
  const [princ, setPrinc] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'giv', desc: true });

  const princOptions = useMemo(
    () => Array.from(new Set(rows.filter((r) => company === 'all' || r.company === company).map((r) => r.princ || '-'))).sort(),
    [rows, company]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toUpperCase();
    return rows
      .filter((r) =>
        (company === 'all' || r.company === company) &&
        (princ === 'all' || (r.princ || '-') === princ) &&
        (!q || r.seller.toUpperCase().includes(q) || r.princ.toUpperCase().includes(q))
      )
      .sort((a, b) => (sortValue(b, sort.key) - sortValue(a, sort.key)) * (sort.desc ? 1 : -1));
  }, [rows, search, company, princ, sort]);

  const totals = useMemo(
    () => filteredRows.reduce(
      (s, r) => ({
        giv: s.giv + r.giv, niv: s.niv + r.niv, target: s.target + r.target, be: s.be + r.be,
        prevGIV: s.prevGIV + r.prevGIV, prevNIV: s.prevNIV + r.prevNIV,
      }),
      { giv: 0, niv: 0, target: 0, be: 0, prevGIV: 0, prevNIV: 0 }
    ),
    [filteredRows]
  );

  const th = (key: SortKey, label: string, extra = '') => (
    <th
      className={`r sortable ${sort.key === key ? 'sorted' : ''} ${extra}`}
      onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))}
      aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}
    >
      {label}{sort.key === key ? (sort.desc ? ' ↓' : ' ↑') : ''}
    </th>
  );

  return (
    <div className="tbl-card">
      <div className="tbl-header">
        <span className="tbl-title">
          ตารางยอดขายรายคน · {periodLabel}
          {companyFilter !== 'all' ? ` · ${companyFilter}` : ''}
        </span>
        <div className="tbl-tools">
          {companyFilter === 'all' && (
            <div className="pills">
              {['all', ...COMPANIES].map((c) => (
                <button key={c} type="button" className={`pill ${company === c ? 'on' : ''}`}
                  onClick={() => { setCompany(c); setPrinc('all'); }}>
                  {c === 'all' ? 'ทั้งหมด' : c}
                </button>
              ))}
            </div>
          )}
          <select className="tbl-select" value={princ} onChange={(e) => setPrinc(e.target.value)} aria-label="Principal">
            <option value="all">ทุก Principal</option>
            {princOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="th-search" style={{ minWidth: 200 }}>
            <IconSearch />
            <input
              type="text"
              placeholder="ค้นหารหัส Seller หรือ Principal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="tbl-count">{filteredRows.length} คน</span>
          <button type="button" className="tbl-btn" onClick={() => downloadCsv(filteredRows, fileTag)}>⬇ CSV</button>
        </div>
      </div>

      {filteredRows.length > 0 ? (
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>บริษัท</th>
              <th>Seller</th>
              <th>Princ</th>
              {th('giv', 'GIV (฿)')}
              {th('niv', 'NIV (฿)')}
              {th('target', 'Target')}
              {th('givPct', '% GIV/Target')}
              {th('be', 'BE')}
              {th('bePct', '% BE/Target')}
              <th className="r base-col">GIV ปีก่อน</th>
              {th('prevNIV', 'NIV ปีก่อน', 'base-col')}
              {th('growth', 'Growth NIV', 'base-col')}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => {
              const rankCls = i === 0 ? 'rank r1' : i === 1 ? 'rank r2' : i === 2 ? 'rank r3' : 'rank';
              const givPct = pctOf(row.giv, row.target);
              const bePct = pctOf(row.be, row.target);
              const rg = hasPrev ? pctGrowth(row.niv, row.prevNIV) : null;
              const growthCls = rg == null ? 'r dim' : rg >= 0 ? 'r grow-pos' : 'r grow-neg';
              return (
                <tr key={`${row.company}|${row.seller}`}>
                  <td><span className={rankCls}>{i + 1}</span></td>
                  <td className="co-cell">{row.company}</td>
                  <td className="seller-name">{row.seller}</td>
                  <td className="princ-cell" title={row.princ}>{row.princ || '-'}</td>
                  <td className="r">{fmtNum(row.giv)}</td>
                  <td className="r">{fmtNum(row.niv)}</td>
                  <td className="r">{row.target ? fmtNum(row.target) : '–'}</td>
                  <td className="r" style={{ color: achieveColor(givPct), fontWeight: 700 }}>{fmtPct(givPct)}</td>
                  <td className="r">{row.be ? fmtNum(row.be) : '–'}</td>
                  <td className="r" style={{ color: achieveColor(bePct), fontWeight: 700 }}>{fmtPct(bePct)}</td>
                  <td className="r dim">{hasPrev ? fmtNum(row.prevGIV) : '–'}</td>
                  <td className="r dim">{hasPrev ? fmtNum(row.prevNIV) : '–'}</td>
                  <td className={growthCls}>{growthArrow(rg)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>รวม {filteredRows.length} คน</td>
              <td className="r">{fmtNum(totals.giv)}</td>
              <td className="r">{fmtNum(totals.niv)}</td>
              <td className="r">{fmtNum(totals.target)}</td>
              <td className="r">{fmtPct(pctOf(totals.giv, totals.target))}</td>
              <td className="r">{fmtNum(totals.be)}</td>
              <td className="r">{fmtPct(pctOf(totals.be, totals.target))}</td>
              <td className="r">{hasPrev ? fmtNum(totals.prevGIV) : '–'}</td>
              <td className="r">{hasPrev ? fmtNum(totals.prevNIV) : '–'}</td>
              <td className="r">{growthArrow(hasPrev ? pctGrowth(totals.niv, totals.prevNIV) : null)}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <div className="empty-note">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
      )}
      {!hasPrev && (
        <div className="empty-note" style={{ padding: '10px 20px 16px', fontSize: 12, textAlign: 'left' }}>
          * ยังไม่มีข้อมูลปีก่อนในระบบ (vw_lg014 มีข้อมูลตั้งแต่ ม.ค. 2026) — คอลัมน์ปีก่อน / Growth จะแสดงเมื่อมีข้อมูล
        </div>
      )}
    </div>
  );
}
