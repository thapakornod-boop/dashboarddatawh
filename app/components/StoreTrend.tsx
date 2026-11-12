'use client';

// กราฟแท่ง GIV รายเดือนของร้าน (ซ้อนตามบริษัท) + tooltip เมื่อชี้ / แตะ
import { useState } from 'react';
import { COMPANY_COLORS, fmtInt, fmtShort } from '@/app/lib/format';
import { monthAbbr } from '@/app/lib/period';

export type TrendMonth = { ym: string; byCo: Record<string, number>; total: number; bills: number };

// เส้นแกน: ปัดค่าสูงสุดขึ้นเป็นเลขกลม (1 / 2 / 2.5 / 5 × 10^n) แบ่ง 4 ช่อง
function niceMax(v: number) {
  if (v <= 0) return 1;
  const step = v / 4;
  const p = 10 ** Math.floor(Math.log10(step));
  const n = [1, 2, 2.5, 5, 10].find((m) => m * p >= step)! * p;
  return n * 4;
}

// avg = เส้นประค่าเฉลี่ยต่อเดือน (ไม่ใส่ = ไม่แสดง)
export default function StoreTrend({ months, companies, avg }: { months: TrendMonth[]; companies: string[]; avg?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...months.map((m) => m.total), avg ?? 0, 0));
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  const h = hover !== null ? months[hover] : null;
  const multiYear = new Set(months.map((m) => m.ym.slice(0, 4))).size > 1;

  return (
    <div className="trend-chart">
      {companies.length > 1 && (
        <div className="trend-legend">
          {companies.map((c) => <span key={c}><i style={{ background: COMPANY_COLORS[c] }} />{c}</span>)}
        </div>
      )}
      <div className="tc-plot" onMouseLeave={() => setHover(null)}>
        <div className="tc-grid" aria-hidden="true">
          {ticks.slice().reverse().map((t) => (
            <div key={t} className="tc-gridline"><span>{t ? fmtShort(t) : '0'}</span></div>
          ))}
        </div>
        {avg != null && avg > 0 && (
          <div className="tc-avg" style={{ bottom: `calc(24px + (100% - 24px) * ${Math.min(avg / max, 1)})` }} aria-hidden="true"><span>เฉลี่ย</span></div>
        )}
        <div className="tc-cols">
          {months.map((m, i) => (
            <button key={m.ym} type="button" className={`tc-col${hover === i ? ' on' : ''}`}
              onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)}
              aria-label={`${m.ym} GIV ${fmtInt(m.total)}`}>
              <span className="tc-stack" style={{ height: `${Math.max((m.total / max) * 100, 0)}%` }}>
                {companies.filter((c) => (m.byCo[c] ?? 0) > 0).map((c) => (
                  <span key={c} className="tc-seg" style={{ flexGrow: m.byCo[c], background: COMPANY_COLORS[c] }} />
                ))}
              </span>
              <span className={`tc-x${months.length > 6 && i % 2 ? ' thin' : ''}`}>{monthAbbr(m.ym)}{multiYear && m.ym.endsWith('-01') ? ` ${m.ym.slice(2, 4)}` : ''}</span>
            </button>
          ))}
        </div>
        {h && (
          <div className="tc-tip" style={{ left: `${Math.min(Math.max(((hover! + 0.5) / months.length) * 100, 22), 78)}%` }} role="status">
            <b>{monthAbbr(h.ym)} {h.ym.slice(0, 4)}</b>
            <span className="tc-tip-row"><span>GIV</span><b>{fmtInt(h.total)}</b></span>
            {companies.length > 1 && companies.map((c) => (
              <span key={c} className="tc-tip-row"><span><i style={{ background: COMPANY_COLORS[c] }} />{c}</span><span>{fmtInt(h.byCo[c] ?? 0)}</span></span>
            ))}
            <span className="tc-tip-row"><span>บิล</span><span>{fmtInt(h.bills)}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}
