import { getLG014Summary, LG014SellerRow } from '@/app/lib/api';

function getCurrentMonthRange() {
  const now   = new Date();
  const y     = now.getFullYear();
  const m     = now.getMonth();
  const first = new Date(y, m, 1).toISOString().slice(0, 10);
  const last  = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { first, last };
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return '-';
  return Number(n).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Filter: เช็คว่า seller เป็น GSM หรือไม่ (เช่น "400GSM1") ──────
function isGsmSeller(seller: string | null | undefined): boolean {
  if (!seller) return false;
  return /GSM/i.test(seller);
}

export default async function LG014SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params            = await searchParams;
  const { first, last }   = getCurrentMonthRange();
  const startDate         = params.startDate || first;
  const endDate           = params.endDate   || last;

  // ── ค่า filter ใหม่ ───────────────────────────────────────────
  const includeGsm  = params.includeGsm === 'true';       // ไม่ติ๊ก = ไม่รวม GSM (default)
  const sellerSearch = (params.sellerSearch ?? '').trim();

  let result;
  let errorMessage: string | null = null;

  try {
    result = await getLG014Summary({ startDate, endDate });
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
  }

  // ── กรอง GSM + ค้นหารหัส seller ───────────────────────────────
  let bySeller = result?.bySeller ?? [];

  if (!includeGsm) {
    bySeller = bySeller.filter((row) => !isGsmSeller(row.Seller));
  }

  if (sellerSearch) {
    const q = sellerSearch.toLowerCase();
    bySeller = bySeller.filter((row) =>
      row.Seller?.toLowerCase().includes(q)
    );
  }

  // ── คำนวณ summary ใหม่จาก bySeller ที่กรองแล้ว ──────────────────
  const summary = bySeller.length > 0
    ? bySeller.reduce(
        (acc, row) => ({
          GIV:       acc.GIV       + (row.GIV ?? 0),
          totalNIV:  acc.totalNIV  + (row.NIV ?? 0),
          totalDocs: acc.totalDocs + (row.totalDocs ?? 0),
          totalRows: acc.totalRows + (row.totalRows ?? 0),
        }),
        { GIV: 0, totalNIV: 0, totalDocs: 0, totalRows: 0 }
      )
    : undefined;

  // หา max NIV สำหรับ progress bar
  const maxNIV = bySeller.reduce((m, r) => Math.max(m, r.NIV ?? 0), 1);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f5f6fa; font-family: 'Segoe UI', sans-serif; }

        .page-wrap { padding: 24px; max-width: 1100px; margin: 0 auto; }

        /* ── Header ── */
        .page-title { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 18px; }

        /* ── Filter ── */
        .filter-bar {
          display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;
          background: #fff; border-radius: 12px;
          padding: 16px 20px; margin-bottom: 20px;
          box-shadow: 0 1px 4px rgba(0,0,0,.08);
        }
        .filter-group { display: flex; flex-direction: column; gap: 4px; }
        .filter-group label { font-size: 12px; color: #666; font-weight: 500; }
        .filter-group input[type="date"],
        .filter-group input[type="text"] {
          padding: 8px 12px; border: 1.5px solid #d0d5dd;
          border-radius: 8px; font-size: 14px; color: #1a1a2e;
          background: #fafafa; outline: none;
        }
        .filter-group input[type="date"]:focus,
        .filter-group input[type="text"]:focus { border-color: #0070f3; }
        .filter-checkbox {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 0 9px;
        }
        .filter-checkbox input[type="checkbox"] {
          width: 16px; height: 16px; accent-color: #0070f3; cursor: pointer;
        }
        .filter-checkbox label { font-size: 13px; color: #333; cursor: pointer; user-select: none; }
        .btn-search {
          padding: 9px 20px; background: #0070f3; color: #fff;
          border: none; border-radius: 8px; font-size: 14px;
          font-weight: 600; cursor: pointer;
        }
        .btn-search:hover { background: #005ecc; }

        /* ── KPI Cards ── */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
          margin-bottom: 24px;
        }
        .kpi-card {
          background: #fff; border-radius: 14px;
          padding: 18px 22px;
          box-shadow: 0 1px 4px rgba(0,0,0,.08);
          border-left: 5px solid #0070f3;
        }
        .kpi-card.giv { border-color: #10b981; }
        .kpi-card.niv { border-color: #6366f1; }
        .kpi-card.docs { border-color: #f59e0b; }
        .kpi-label { font-size: 12px; color: #666; font-weight: 500; margin-bottom: 6px; }
        .kpi-value { font-size: 24px; font-weight: 800; color: #1a1a2e; }
        .kpi-unit  { font-size: 12px; color: #999; margin-top: 2px; }

        /* ── Section title ── */
        .section-title {
          font-size: 15px; font-weight: 700; color: #1a1a2e;
          margin-bottom: 12px; padding-bottom: 6px;
          border-bottom: 2px solid #e8f0fe;
        }

        /* ── Seller table ── */
        .table-wrap {
          background: #fff; border-radius: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,.08);
          overflow: auto;
        }
        table { border-collapse: collapse; width: 100%; font-size: 13px; }
        thead th {
          background: #1a1a2e; color: #fff;
          padding: 11px 14px; text-align: left;
          font-weight: 600; white-space: nowrap;
          border-right: 1px solid #2d2d4e;
        }
        thead th.num { text-align: right; }
        tbody tr:nth-child(even) td { background: #f8f9ff; }
        tbody tr:nth-child(odd)  td { background: #fff; }
        tbody tr:hover td { background: #e8f0fe !important; }
        tbody td {
          padding: 9px 14px; border-bottom: 1px solid #eef0f6;
          border-right: 1px solid #eef0f6; white-space: nowrap;
          color: #333;
        }
        td.num { text-align: right; font-variant-numeric: tabular-nums; }
        td.seller-name { font-weight: 600; color: #1967d2; min-width: 140px; }

        /* ── Progress bar ── */
        .bar-wrap { display: flex; align-items: center; gap: 8px; min-width: 160px; }
        .bar-bg {
          flex: 1; height: 8px; background: #e8f0fe;
          border-radius: 99px; overflow: hidden;
        }
        .bar-fill {
          height: 100%; background: #6366f1;
          border-radius: 99px; transition: width .3s;
        }
        .bar-pct { font-size: 11px; color: #888; min-width: 36px; text-align: right; }

        /* ── Rank badge ── */
        .rank {
          display: inline-flex; align-items: center; justify-content: center;
          width: 24px; height: 24px; border-radius: 50%;
          font-size: 11px; font-weight: 700; background: #e8f0fe; color: #1967d2;
        }
        .rank.r1 { background: #ffd700; color: #7a5f00; }
        .rank.r2 { background: #c0c0c0; color: #555; }
        .rank.r3 { background: #cd7f32; color: #fff; }

        /* ── Footer total row ── */
        tfoot td {
          padding: 10px 14px; font-weight: 700;
          background: #1a1a2e !important; color: #fff;
          border-top: 2px solid #0070f3;
        }
        tfoot td.num { text-align: right; color: #7dd3fc; }

        /* ── Error ── */
        .error-box {
          background: #fff0f0; border: 1.5px solid #fca5a5;
          border-radius: 10px; padding: 16px 20px;
          color: #b91c1c; font-size: 14px; margin-bottom: 16px;
        }
      `}</style>

      <div className="page-wrap">
        <h1 className="page-title">📊 สรุปยอดขาย — LG014</h1>

        {/* ── Filter ── */}
        <form method="GET" className="filter-bar">
          <div className="filter-group">
            <label>ตั้งแต่วันที่</label>
            <input type="date" name="startDate" defaultValue={startDate} />
          </div>
          <div className="filter-group">
            <label>ถึงวันที่</label>
            <input type="date" name="endDate" defaultValue={endDate} />
          </div>
          <div className="filter-group">
            <label>ค้นหารหัส Seller</label>
            <input
              type="text"
              name="sellerSearch"
              placeholder="เช่น 400GSM1"
              defaultValue={sellerSearch}
            />
          </div>
          <div className="filter-checkbox">
            <input
              type="checkbox"
              id="includeGsm"
              name="includeGsm"
              value="true"
              defaultChecked={includeGsm}
            />
            <label htmlFor="includeGsm">รวมยอด GSM</label>
          </div>
          <button type="submit" className="btn-search">🔍 ค้นหา</button>
        </form>

        {/* ── Error ── */}
        {errorMessage && <div className="error-box">❌ {errorMessage}</div>}

        {/* ── KPI Cards ── */}
        {summary && (
          <div className="kpi-grid">
            <div className="kpi-card giv">
              <div className="kpi-label">ยอดรวม GIV (ก่อนส่วนลด)</div>
              <div className="kpi-value">{fmtNum(summary.GIV)}</div>
              <div className="kpi-unit">บาท</div>
            </div>
            <div className="kpi-card niv">
              <div className="kpi-label">ยอดรวม NIV (LineTotal)</div>
              <div className="kpi-value">{fmtNum(summary.totalNIV)}</div>
              <div className="kpi-unit">บาท</div>
            </div>
            <div className="kpi-card docs">
              <div className="kpi-label">จำนวนเอกสาร</div>
              <div className="kpi-value">{(summary.totalDocs ?? 0).toLocaleString()}</div>
              <div className="kpi-unit">ใบ</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">จำนวนรายการ</div>
              <div className="kpi-value">{(summary.totalRows ?? 0).toLocaleString()}</div>
              <div className="kpi-unit">รายการ</div>
            </div>
          </div>
        )}

        {/* ── Seller Table ── */}
        {bySeller.length > 0 && (
          <>
            <div className="section-title">🧑‍💼 ยอดขายรายคน ({bySeller.length} คน)</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Seller</th>
                    <th className="num">GIV (บาท)</th>
                    <th className="num">NIV (บาท)</th>
                    <th className="num">%NIV</th>
                    <th>สัดส่วน NIV</th>
                    <th className="num">เอกสาร</th>
                    <th className="num">รายการ</th>
                  </tr>
                </thead>
                <tbody>
                  {bySeller.map((row: LG014SellerRow, i) => {
                    const pct = summary?.totalNIV
                      ? ((row.NIV / summary.totalNIV) * 100).toFixed(1)
                      : '0.0';
                    const barW = maxNIV > 0
                      ? ((row.NIV / maxNIV) * 100).toFixed(1)
                      : '0';
                    const rankCls =
                      i === 0 ? 'rank r1' : i === 1 ? 'rank r2' : i === 2 ? 'rank r3' : 'rank';
                    return (
                      <tr key={row.Seller}>
                        <td><span className={rankCls}>{i + 1}</span></td>
                        <td className="seller-name">{row.Seller}</td>
                        <td className="num">{fmtNum(row.GIV)}</td>
                        <td className="num">{fmtNum(row.NIV)}</td>
                        <td className="num">{pct}%</td>
                        <td>
                          <div className="bar-wrap">
                            <div className="bar-bg">
                              <div className="bar-fill" style={{ width: `${barW}%` }} />
                            </div>
                            <span className="bar-pct">{barW}%</span>
                          </div>
                        </td>
                        <td className="num">{(row.totalDocs ?? 0).toLocaleString()}</td>
                        <td className="num">{(row.totalRows ?? 0).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {summary && (
                  <tfoot>
                    <tr>
                      <td colSpan={2}>รวมทั้งหมด</td>
                      <td className="num">{fmtNum(summary.GIV)}</td>
                      <td className="num">{fmtNum(summary.totalNIV)}</td>
                      <td className="num">100%</td>
                      <td />
                      <td className="num">{(summary.totalDocs ?? 0).toLocaleString()}</td>
                      <td className="num">{(summary.totalRows ?? 0).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}

        {!errorMessage && bySeller.length === 0 && (
          <div style={{ color: '#999', marginTop: 24, textAlign: 'center' }}>
            ไม่พบข้อมูลในช่วงวันที่เลือก
          </div>
        )}
      </div>
    </>
  );
}