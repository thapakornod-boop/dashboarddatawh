'use client';

import { useMemo, useState } from 'react';
import type { LG014SellerRow } from '@/app/lib/api';

function fmtNum(n: number | null | undefined) {
  if (n == null) return '-';
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeCompany(c: string) { return (c ?? '').trim().toUpperCase(); }

function growthColor(pct: number | null) {
  if (pct == null) return '#9CA3AF';
  return pct >= 0 ? '#16A34A' : '#DC2626';
}
function growthArrow(pct: number | null) {
  if (pct == null) return '–';
  return pct >= 0 ? `▲ ${pct.toFixed(2)}%` : `▼ ${Math.abs(pct).toFixed(2)}%`;
}
function pctGrowth(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Number((((cur - prev) / Math.abs(prev)) * 100).toFixed(2));
}

function sumGIVNIV(rows: LG014SellerRow[]) {
  return rows.reduce(
    (acc, r) => { acc.GIV += r.GIV ?? 0; acc.NIV += r.NIV ?? 0; return acc; },
    { GIV: 0, NIV: 0 }
  );
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
  prevRows,
  companyFilter,
}: {
  rows: LG014SellerRow[];
  prevRows: LG014SellerRow[];
  companyFilter: string;
}) {
  const [search, setSearch] = useState('');

  const filteredRows = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.Seller.toUpperCase().includes(q) || (r.Princ ?? '').toUpperCase().includes(q)
    );
  }, [rows, search]);

  const tableTotals = useMemo(() => sumGIVNIV(filteredRows), [filteredRows]);
  const maxNIV = useMemo(
    () => filteredRows.reduce((m, r) => Math.max(m, r.NIV ?? 0), 1),
    [filteredRows]
  );

  return (
    <div className="tbl-card">
      <div className="tbl-header">
        <span className="tbl-title">
          ตารางยอดขายรายคน
          {companyFilter !== 'all' ? ` · ${companyFilter}` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="th-search" style={{ minWidth: 200 }}>
            <IconSearch />
            <input
              type="text"
              placeholder="ค้นหารหัส Seller หรือชื่อ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="tbl-count">{filteredRows.length} คน</span>
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
              <th className="r">GIV (฿)</th>
              <th className="r">NIV (฿)</th>
              <th className="r">%NIV</th>
              <th>สัดส่วน</th>
              <th className="r base-col">Base GIV (ปีก่อน)</th>
              <th className="r base-col">Base NIV (ปีก่อน)</th>
              <th className="r base-col">Growth</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row: LG014SellerRow, i) => {
              const pct = tableTotals.NIV ? ((row.NIV / tableTotals.NIV) * 100).toFixed(1) : '0.0';
              const barW = maxNIV > 0 ? ((row.NIV / maxNIV) * 100).toFixed(1) : '0';
              const rankCls = i === 0 ? 'rank r1' : i === 1 ? 'rank r2' : i === 2 ? 'rank r3' : 'rank';
              const prevRow = prevRows.find(
                (p) => normalizeCompany(p.Company) === normalizeCompany(row.Company) && p.Seller.toUpperCase() === row.Seller.toUpperCase()
              );
              const prevGIV = prevRow?.GIV ?? null;
              const prevNIV = prevRow?.NIV ?? null;
              const rg = prevNIV != null && prevNIV !== 0 ? pctGrowth(row.NIV, prevNIV) : null;
              const growthCls = rg == null ? 'r dim' : rg >= 0 ? 'r grow-pos' : 'r grow-neg';
              const rowKey = `${row.Company}-${row.Princ}-${row.Seller}-${i}`;
              return (
                <tr key={rowKey}>
                  <td><span className={rankCls}>{i + 1}</span></td>
                  <td className="co-cell">{row.Company}</td>
                  <td className="seller-name">{row.Seller}</td>
                  <td className="princ-cell" title={row.Princ}>{row.Princ || '-'}</td>
                  <td className="r">{fmtNum(row.GIV)}</td>
                  <td className="r">{fmtNum(row.NIV)}</td>
                  <td className="r">{pct}%</td>
                  <td>
                    <div className="bar-wrap">
                      <div className="bar-bg"><div className="bar-fill" style={{ width: `${barW}%` }} /></div>
                      <span className="bar-pct">{barW}%</span>
                    </div>
                  </td>
                  <td className="r dim">{fmtNum(prevGIV)}</td>
                  <td className="r dim">{fmtNum(prevNIV)}</td>
                  <td className={growthCls}>{rg == null ? '–' : growthArrow(rg)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>รวม{companyFilter !== 'all' ? ` (${companyFilter})` : 'ทั้งหมด'}</td>
              <td className="r">{fmtNum(tableTotals.GIV)}</td>
              <td className="r">{fmtNum(tableTotals.NIV)}</td>
              <td className="r">100%</td>
              <td />
              <td className="r">–</td>
              <td className="r">–</td>
              <td className="r">–</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <div className="empty-note">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
      )}
    </div>
  );
}