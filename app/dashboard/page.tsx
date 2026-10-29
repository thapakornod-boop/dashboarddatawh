import {
  getLG014Summary,
  getLatestDate,
  getAvailableMonths,
  monthToRange,
  shiftYears,
  LG014SellerRow,
} from '@/app/lib/api';
import { getTargets, preloadTargets, TargetRow } from '@/app/lib/targets';
import SellerTable, { SellerDetailRow } from '@/app/components/SellerTable';
const COMPANY_ORDER = ['SDO', 'PDC', 'DC'];
const THAI_MONTH_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const COMPANY_COLORS: Record<string, string> = {
  SDO: '#2563EB',
  PDC: '#16A34A',
  DC:  '#8B5CF6',
  default0: '#D97706',
  default1: '#DB2777',
  default2: '#0D9488',
};

const PRINC_PALETTE = ['#2563EB', '#16A34A', '#8B5CF6', '#D97706', '#DB2777', '#0D9488', '#DC2626', '#0EA5E9'];
const PRINC_OTHER_COLOR = '#CBD5E1';

function getCompanyColor(company: string, fallbackIdx: number) {
  return COMPANY_COLORS[company.toUpperCase()] ??
    Object.values(COMPANY_COLORS).slice(3)[fallbackIdx % 3] ?? '#6B7280';
}

type CompanyAgg = { company: string; GIV: number; NIV: number };
type PrincAgg   = { princ: string; GIV: number; NIV: number };
type TrendPoint = { month: string; GIV: number; NIV: number };
// ── เพิ่ม type สำหรับ donut ──────────────────────────────────────
type PrincDonutSlice = { label: string; giv: number; niv: number; color: string };

// "2026-10" → "2025-10"
function shiftYM(ym: string, years: number): string {
  return shiftYears(`${ym}-01`, years).slice(0, 7);
}

function monthAbbr(ym: string): string {
  const [, m] = ym.split('-').map(Number);
  return THAI_MONTH_ABBR[m - 1];
}

function formatThaiMonth(ym: string): string {
  const [y] = ym.split('-').map(Number);
  return `${monthAbbr(ym)} ${y}`;
}

// "ต.ค. 2026" หรือ "ม.ค. 2026 → ต.ค. 2026"
function formatRange(from: string, to: string): string {
  return from === to ? formatThaiMonth(from) : `${formatThaiMonth(from)} → ${formatThaiMonth(to)}`;
}

// "2026-10-29" → "29/10/2026"
function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d}/${m}/${y}`;
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return '-';
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
  return n.toFixed(0);
}

function fmtPct(n: number | null) {
  return n == null ? '–' : `${n.toFixed(1)}%`;
}

function growthColor(pct: number | null) {
  if (pct == null) return '#9CA3AF';
  return pct >= 0 ? '#16A34A' : '#DC2626';
}

function growthArrow(pct: number | null) {
  if (pct == null) return '–';
  return pct >= 0 ? `▲ ${pct.toFixed(2)}%` : `▼ ${Math.abs(pct).toFixed(2)}%`;
}

function normalizeCompany(c: string) { return (c ?? '').trim().toUpperCase(); }
function companySortIndex(company: string) {
  const idx = COMPANY_ORDER.indexOf(normalizeCompany(company));
  return idx === -1 ? 999 : idx;
}

function sumGIVNIV(rows: LG014SellerRow[]) {
  return rows.reduce(
    (acc, r) => { acc.GIV += r.GIV ?? 0; acc.NIV += r.NIV ?? 0; return acc; },
    { GIV: 0, NIV: 0 }
  );
}

function sumTargets(rows: TargetRow[]) {
  return rows.reduce(
    (acc, r) => { acc.target += r.target; acc.be += r.be; return acc; },
    { target: 0, be: 0 }
  );
}

// รวมยอดหลายเดือนเป็นรายเซลล์ (key = บริษัท + รหัสเซลล์)
function mergeSellers(blocks: LG014SellerRow[][]): LG014SellerRow[] {
  const map = new Map<string, LG014SellerRow>();
  for (const rows of blocks) {
    for (const r of rows) {
      const key = `${r.Company}|${r.Seller}`;
      const cur = map.get(key);
      if (cur) { cur.GIV += r.GIV; cur.NIV += r.NIV; }
      else map.set(key, { ...r });
    }
  }
  return Array.from(map.values());
}

// ตารางรายคน: ยอดปีนี้ + ปีก่อน + Target / BE (รวมเซลล์ที่มี Target แต่ยังไม่มียอด)
function buildSellerDetail(
  cur: LG014SellerRow[], prev: LG014SellerRow[], targets: TargetRow[]
): SellerDetailRow[] {
  const map = new Map<string, SellerDetailRow>();
  const get = (company: string, seller: string, princ: string) => {
    const key = `${company}|${seller}`;
    let row = map.get(key);
    if (!row) {
      row = { company, seller, princ, giv: 0, niv: 0, prevGIV: 0, prevNIV: 0, target: 0, be: 0 };
      map.set(key, row);
    }
    return row;
  };
  for (const r of cur)  { const row = get(r.Company, r.Seller, r.Princ); row.giv += r.GIV; row.niv += r.NIV; }
  for (const r of prev) { const row = get(r.Company, r.Seller, r.Princ); row.prevGIV += r.GIV; row.prevNIV += r.NIV; }
  for (const t of targets) { const row = get(t.company, t.seller, t.principal); row.target += t.target; row.be += t.be; }
  return Array.from(map.values());
}

function aggregateByCompany(rows: LG014SellerRow[]): CompanyAgg[] {
  const map = new Map<string, CompanyAgg>();
  for (const r of rows) {
    const key = r.Company;
    const cur = map.get(key) ?? { company: key, GIV: 0, NIV: 0 };
    cur.GIV += r.GIV ?? 0; cur.NIV += r.NIV ?? 0;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort(
    (a, b) => companySortIndex(a.company) - companySortIndex(b.company) || a.company.localeCompare(b.company)
  );
}

function aggregateByPrinc(rows: LG014SellerRow[]): PrincAgg[] {
  const map = new Map<string, PrincAgg>();
  for (const r of rows) {
    const key = r.Princ || '(ไม่ระบุ)';
    const cur = map.get(key) ?? { princ: key, GIV: 0, NIV: 0 };
    cur.GIV += r.GIV ?? 0; cur.NIV += r.NIV ?? 0;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.NIV - a.NIV);
}

// ── สร้างข้อมูลสำหรับ donut ทั้งคู่ (GIV และ NIV ใช้ลำดับ Principal เดียวกัน) ──
function buildPrincDonutData(rows: LG014SellerRow[], topN = 8): PrincDonutSlice[] {
  const agg  = aggregateByPrinc(rows);
  const top  = agg.slice(0, topN);
  const rest = agg.slice(topN);
  const restNIV = rest.reduce((s, p) => s + p.NIV, 0);
  const restGIV = rest.reduce((s, p) => s + p.GIV, 0);

  const data: PrincDonutSlice[] = top.map((p, i) => ({
    label: p.princ,
    giv:   p.GIV,
    niv:   p.NIV,
    color: PRINC_PALETTE[i % PRINC_PALETTE.length],
  }));
  if (restNIV > 0 || restGIV > 0) {
    data.push({ label: 'อื่นๆ', giv: restGIV, niv: restNIV, color: PRINC_OTHER_COLOR });
  }
  return data;
}

function pctGrowth(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Number((((cur - prev) / Math.abs(prev)) * 100).toFixed(2));
}

// ── Icons ─────────────────────────────────────────────────────────
function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" />
      <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.55" />
      <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.55" />
      <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.55" />
    </svg>
  );
}
function IconShare() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M8.1 10.8 15.9 7.2M8.1 13.2 15.9 16.8" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function IconTrend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="3" width="10" height="18" rx="1" />
      <rect x="14" y="9" width="6" height="12" rx="1" />
      <path d="M7 7h1M10 7h1M7 11h1M10 11h1M7 15h1M10 15h1" />
    </svg>
  );
}
function IconPie() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v10l8.5 5A10 10 0 1 0 12 2Z" />
      <path d="M21 12A9 9 0 0 0 12 3" />
    </svg>
  );
}

// ── Trend Line Chart ───────────────────────────────────────────────
function TrendLineChart({ points }: { points: TrendPoint[] }) {
  const w = 640, h = 220, padL = 52, padR = 16, padT = 16, padB = 30;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxVal = Math.max(...points.map((p) => Math.max(p.NIV, p.GIV)), 1);
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  // ช่วงคร่อมปี → ใส่ปีท้ายชื่อเดือน เช่น "ธ.ค. 25"
  const multiYear = new Set(points.map((p) => p.month.slice(0, 4))).size > 1;

  const xFor = (i: number) => padL + i * stepX;
  const yFor = (v: number) => padT + (1 - v / maxVal) * innerH;

  const buildPath = (key: 'NIV' | 'GIV') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(p[key])}`).join(' ');

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxHeight: 260 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + (1 - t) * innerH;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#EEF1F7" strokeWidth={1} />
              <text x={padL - 8} y={y + 4} textAnchor="end" fill="#A2ABBD" fontSize={10}>
                {fmtShort(maxVal * t)}
              </text>
            </g>
          );
        })}
        <path d={buildPath('GIV')} fill="none" stroke="#16A34A" strokeWidth={2} strokeDasharray="5 4" opacity={0.85} />
        {points.map((p, i) => (
          <circle key={`g${i}`} cx={xFor(i)} cy={yFor(p.GIV)} r={3} fill="#16A34A" />
        ))}
        <path d={buildPath('NIV')} fill="none" stroke="#2563EB" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={`n${i}`} cx={xFor(i)} cy={yFor(p.NIV)} r={4.5} fill="#FFFFFF" stroke="#2563EB" strokeWidth={2.5} />
        ))}
        {points.map((p, i) => (
          <text key={`x${i}`} x={xFor(i)} y={h - 8} textAnchor="middle" fill="#5B6478" fontSize={11} fontWeight={600}>
            {multiYear ? `${monthAbbr(p.month)} ${p.month.slice(2, 4)}` : monthAbbr(p.month)}
          </text>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 18, marginTop: 4, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5B6478', fontWeight: 600 }}>
          <span style={{ width: 14, height: 3, background: '#2563EB', borderRadius: 2, display: 'inline-block' }} /> NIV
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5B6478', fontWeight: 600 }}>
          <span style={{ width: 14, height: 3, background: '#16A34A', borderRadius: 2, display: 'inline-block', opacity: 0.85 }} /> GIV
        </span>
      </div>
    </div>
  );
}

// ── Company Compare Chart ──────────────────────────────────────────
function CompanyCompareChart({
  current, previous, metric, accentColor,
}: {
  current: CompanyAgg[]; previous: CompanyAgg[]; metric: 'GIV' | 'NIV'; accentColor: string;
}) {
  const companies = current.length > 0 ? current.map((c) => c.company) : previous.map((c) => c.company);
  const prevMap = new Map(previous.map((c) => [normalizeCompany(c.company), c]));
  const curMap  = new Map(current.map((c) => [normalizeCompany(c.company), c]));

  const data = companies.map((co) => ({
    company: co,
    prev: prevMap.get(normalizeCompany(co))?.[metric] ?? 0,
    cur:  curMap.get(normalizeCompany(co))?.[metric] ?? 0,
  }));

  const maxVal = Math.max(...data.flatMap((d) => [d.prev, d.cur]), 1);
  const chartH = 160;
  const groupW = 88;
  const barW   = 30;
  const barGap = 6;
  const padL   = 52;
  const padB   = 30;
  const totalW = padL + data.length * groupW + 16;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${totalW} ${chartH + padB + 16}`} style={{ width: '100%', maxHeight: 220 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = 8 + (1 - t) * chartH;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={totalW - 8} y2={y} stroke="#EEF1F7" strokeWidth={1} />
              <text x={padL - 8} y={y + 4} textAnchor="end" fill="#A2ABBD" fontSize={10}>
                {fmtShort(maxVal * t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const groupX = padL + i * groupW + (groupW - (barW * 2 + barGap)) / 2;
          const prevH  = Math.max((d.prev / maxVal) * chartH, d.prev > 0 ? 2 : 0);
          const curH   = Math.max((d.cur / maxVal) * chartH, d.cur > 0 ? 2 : 0);
          const prevY  = 8 + chartH - prevH;
          const curY   = 8 + chartH - curH;
          return (
            <g key={d.company}>
              <rect x={groupX} y={prevY} width={barW} height={prevH} rx={5} fill="#CBD5E1" />
              <rect x={groupX + barW + barGap} y={curY} width={barW} height={curH} rx={5} fill={accentColor} />
              <text x={groupX + barW + barGap / 2} y={8 + chartH + padB - 8} textAnchor="middle" fill="#1A2540" fontSize={12} fontWeight={700}>
                {d.company}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5B6478', fontWeight: 600 }}>
          <span style={{ width: 10, height: 10, background: '#CBD5E1', borderRadius: 3, display: 'inline-block' }} /> ปีก่อน
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5B6478', fontWeight: 600 }}>
          <span style={{ width: 10, height: 10, background: accentColor, borderRadius: 3, display: 'inline-block' }} /> ปัจจุบัน
        </span>
      </div>
    </div>
  );
}

// ── Donut Chart (แยก GIV / NIV) ─────────────────────────────────────
// `metric` กำหนดว่าโดนัทวงนี้จะคำนวณสัดส่วน (มุม/สี/%) จากค่า GIV หรือ NIV
function DonutChart({
  data,
  metric,
}: {
  data: PrincDonutSlice[];
  metric: 'giv' | 'niv';
}) {
  const total = data.reduce((s, d) => s + d[metric], 0);
  const cx = 90, cy = 90, r = 68, innerR = 44;
  let cumAngle = -Math.PI / 2;

  const metricLabel = metric === 'giv' ? 'GIV' : 'NIV';
  const metricColor = metric === 'giv' ? '#16A34A' : '#2563EB';

  function arc(startA: number, endA: number, outerR: number, innerRad: number) {
    const x1 = cx + outerR * Math.cos(startA), y1 = cy + outerR * Math.sin(startA);
    const x2 = cx + outerR * Math.cos(endA),   y2 = cy + outerR * Math.sin(endA);
    const x3 = cx + innerRad * Math.cos(endA), y3 = cy + innerRad * Math.sin(endA);
    const x4 = cx + innerRad * Math.cos(startA), y4 = cy + innerRad * Math.sin(startA);
    const lg = endA - startA > Math.PI ? 1 : 0;
    return `M${x1},${y1} A${outerR},${outerR} 0 ${lg},1 ${x2},${y2} L${x3},${y3} A${innerRad},${innerRad} 0 ${lg},0 ${x4},${y4} Z`;
  }

  const slices = data.map((d) => {
    const val = d[metric];
    const angle = total > 0 ? (val / total) * 2 * Math.PI : 0;
    const startA = cumAngle;
    cumAngle += angle;
    return {
      label: d.label,
      color: d.color,
      value: val,
      startA,
      endA: cumAngle,
      pct: total > 0 ? ((val / total) * 100).toFixed(1) : '0.0',
    };
  });

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* Donut SVG */}
      <div style={{ flexShrink: 0 }}>
        <svg viewBox="0 0 180 180" style={{ width: 180, height: 180 }}>
          <defs>
            <filter id={`princ-donut-shadow-${metric}`}>
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#1A2540" floodOpacity="0.15" />
            </filter>
          </defs>
          {slices.map((s, i) => (
            <path key={i} d={arc(s.startA, s.endA, r, innerR)} fill={s.color} filter={`url(#princ-donut-shadow-${metric})`} opacity={0.95} />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="#1A2540" fontSize={13} fontWeight={800}>{metricLabel}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill="#8A93A6" fontSize={10}>รวม</text>
          <text x={cx} y={cy + 26} textAnchor="middle" fill="#1A2540" fontSize={10} fontWeight={700}>{fmtShort(total)}</text>
        </svg>
      </div>

      {/* Legend — แสดงค่าตาม metric + % */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 220, flex: 1 }}>
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '9px 1fr 1fr 48px',
          gap: '0 10px',
          alignItems: 'center',
          padding: '0 0 6px',
          borderBottom: '1px solid #EEF1F7',
          marginBottom: 4,
        }}>
          <span />
          <span style={{ fontSize: 10, color: '#A2ABBD', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Principal</span>
          <span style={{ fontSize: 10, color: metricColor, fontWeight: 700, textAlign: 'right' }}>{metricLabel}</span>
          <span style={{ fontSize: 10, color: '#A2ABBD', fontWeight: 700, textAlign: 'right' }}>%{metricLabel}</span>
        </div>

        {/* Data rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {slices.map((s) => (
            <div key={s.label} style={{
              display: 'grid',
              gridTemplateColumns: '9px 1fr 1fr 48px',
              gap: '0 10px',
              alignItems: 'center',
              padding: '5px 0',
              borderRadius: 6,
            }}>
              {/* dot */}
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: s.color }} />
              {/* label */}
              <span style={{
                fontSize: 12, color: '#1A2540', fontWeight: 700,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.label}
              </span>
              {/* value */}
              <span style={{
                fontSize: 11.5, color: metricColor, fontFamily: 'monospace',
                fontWeight: 600, textAlign: 'right',
              }}>
                {fmtShort(s.value)}
              </span>
              {/* % */}
              <span style={{
                fontSize: 11, color: '#8A93A6', fontFamily: 'monospace',
                textAlign: 'right',
              }}>
                {s.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── การ์ดเทียบปีก่อน (แนวตั้ง: ปีนี้ / ปีก่อน / ส่วนต่าง / เติบโต) ─────
function CompareCard({
  label, sub, accent, cur, prev, hasPrev, prevLabel,
}: {
  label: string; sub: string; accent: string;
  cur: number; prev: number; hasPrev: boolean; prevLabel: string;
}) {
  const g = hasPrev ? pctGrowth(cur, prev) : null;
  return (
    <div className="cmp-card" style={{ '--cmp-accent': accent } as React.CSSProperties}>
      <div className="cmp-head">
        <span className="cmp-title">{label}</span>
        <span className="cmp-sub">{sub}</span>
      </div>
      <div className="cmp-main">{fmtNum(cur)}</div>
      <div className="cmp-unit">บาท</div>
      <div className="cmp-lines">
        <div className="cmp-line">
          <span>ปีก่อน · {prevLabel}</span>
          <b className={hasPrev ? '' : 'muted'}>{hasPrev ? fmtNum(prev) : 'ยังไม่มีข้อมูล'}</b>
        </div>
        <div className="cmp-line">
          <span>ส่วนต่าง</span>
          <b style={{ color: hasPrev ? growthColor(cur - prev) : undefined }} className={hasPrev ? '' : 'muted'}>
            {hasPrev ? `${cur - prev >= 0 ? '+' : ''}${fmtNum(cur - prev)}` : '–'}
          </b>
        </div>
        <div className="cmp-line">
          <span>เติบโต (YoY)</span>
          <span className="cmp-growth" style={{ color: growthColor(g), background: g == null ? '#F1F4FA' : g >= 0 ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)' }}>
            {growthArrow(g)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ProgressLine({ label, pct, color }: { label: string; pct: number | null; color: string }) {
  return (
    <div className="prog">
      <div className="prog-top"><span>{label}</span><b style={{ color }}>{fmtPct(pct)}</b></div>
      <div className="prog-bg"><div className="prog-fill" style={{ width: `${Math.min(pct ?? 0, 100)}%`, background: color }} /></div>
    </div>
  );
}

// ── การ์ด Target / BE ──────────────────────────────────────────────
function TargetCard({
  target, be, giv, note,
}: { target: number; be: number; giv: number; note: string | null }) {
  const givPct = target ? (giv / target) * 100 : null;
  const bePct  = target ? (be / target) * 100 : null;
  return (
    <div className="cmp-card" style={{ '--cmp-accent': '#D97706' } as React.CSSProperties}>
      <div className="cmp-head">
        <span className="cmp-title">Target / BE</span>
        <span className="cmp-sub">จาก Google Sheet (BEST - Estimate)</span>
      </div>
      <div className="cmp-main">{target ? fmtNum(target) : '–'}</div>
      <div className="cmp-unit">Target (บาท)</div>
      <div className="cmp-lines">
        <div className="cmp-line"><span>BE (คาดการณ์)</span><b>{be ? fmtNum(be) : '–'}</b></div>
        <ProgressLine label="GIV เทียบ Target" pct={givPct} color="#16A34A" />
        <ProgressLine label="BE เทียบ Target" pct={bePct} color="#D97706" />
        {note && <div className="cmp-note">{note}</div>}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
const YM_RE = /^\d{4}-\d{2}$/;

export default async function SalesOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const param = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : undefined);

  const companyParam  = (param('company') ?? 'all').toUpperCase();
  const companyFilter = COMPANY_ORDER.includes(companyParam) ? companyParam : 'all';
  const view          = param('view') === 'seller' ? 'seller' : 'overview';
  const byCompany = <T,>(rows: T[], co: (r: T) => string) =>
    companyFilter === 'all' ? rows : rows.filter((r) => normalizeCompany(co(r)) === companyFilter);

  let errorMessage: string | null = null;
  let targetError = null as string | null;
  let months: string[] = [];
  let latestDate = '';
  let fromYM = '';
  let toYM = '';
  let trendMonths: string[] = [];
  let curByMonth: LG014SellerRow[][] = [];
  let prevByMonth: LG014SellerRow[][] = [];
  let targetRows: TargetRow[] = [];
  let targetMonths: string[] = [];

  try {
    preloadTargets();
    [latestDate, months] = await Promise.all([getLatestDate(), getAvailableMonths()]);
    const latestMonth = months[months.length - 1] ?? latestDate.slice(0, 7);

    // ช่วงเดือนที่เลือก (ค่าเริ่มต้น = เดือนล่าสุด) ถ้าเลือกกลับด้านก็สลับให้
    fromYM = YM_RE.test(param('from') ?? '') ? param('from')! : latestMonth;
    toYM   = YM_RE.test(param('to') ?? '')   ? param('to')!   : latestMonth;
    if (fromYM > toYM) [fromYM, toYM] = [toYM, fromYM];

    // กราฟแนวโน้ม = เดือนในช่วงที่เลือก ถ้าเลือกน้อยกว่า 3 เดือนให้แสดง 6 เดือนล่าสุดถึงเดือนปลายทาง
    const rangeMonths = months.filter((m) => m >= fromYM && m <= toYM);
    trendMonths = rangeMonths.length >= 3 ? rangeMonths : months.filter((m) => m <= toYM).slice(-6);

    // ดึงรายเดือน (ปีนี้ + เดือนเดียวกันปีก่อน) แล้วค่อยรวมเป็นช่วง — ตารางสรุปรายวันเร็วพอ
    const [cur, prev, targets] = await Promise.all([
      Promise.all(trendMonths.map((m) => getLG014Summary(monthToRange(m)))),
      Promise.all(trendMonths.map((m) => getLG014Summary(monthToRange(shiftYM(m, 1))))),
      getTargets(fromYM, toYM).catch((err: unknown) => {
        targetError = err instanceof Error ? err.message : 'อ่าน Target ไม่สำเร็จ';
        return { rows: [] as TargetRow[], months: [] as string[] };
      }),
    ]);
    curByMonth  = cur.map((b) => b.bySeller);
    prevByMonth = prev.map((b) => b.bySeller);
    targetRows   = targets.rows;
    targetMonths = targets.months;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
  }

  const inRange = (i: number) => trendMonths[i] >= fromYM && trendMonths[i] <= toYM;
  const curRows  = byCompany(mergeSellers(curByMonth.filter((_, i) => inRange(i))), (r) => r.Company);
  const prevRows = byCompany(mergeSellers(prevByMonth.filter((_, i) => inRange(i))), (r) => r.Company);
  const targets  = byCompany(targetRows, (r) => r.company);

  const trendPoints: TrendPoint[] = trendMonths.map((m, i) => ({
    month: m,
    ...sumGIVNIV(byCompany(curByMonth[i] ?? [], (r) => r.Company)),
  }));

  const grandCurrent  = sumGIVNIV(curRows);
  const grandPrevious = sumGIVNIV(prevRows);
  const grandTarget   = sumTargets(targets);
  // vw_lg014 มีข้อมูลตั้งแต่ ม.ค. 2026 — ช่วงที่ปีก่อนไม่มีข้อมูลให้บอกว่า "ยังไม่มีข้อมูล" แทนการโชว์ 0
  const hasPrev = prevRows.length > 0;

  const rangeLabel     = fromYM ? formatRange(fromYM, toYM) : '';
  const prevRangeLabel = fromYM ? formatRange(shiftYM(fromYM, 1), shiftYM(toYM, 1)) : '';
  const missingTargetMonths = months.filter((m) => m >= fromYM && m <= toYM && !targetMonths.includes(m));
  const targetNote = targetError
    ? `อ่าน Target ไม่สำเร็จ: ${targetError}`
    : missingTargetMonths.length > 0
      ? `ไม่มี Target ในชีตของเดือน ${missingTargetMonths.map(formatThaiMonth).join(', ')}`
      : null;

  const companyCurrent  = aggregateByCompany(curRows);
  const companyPrevious = aggregateByCompany(prevRows);
  const princDonutData  = buildPrincDonutData(curRows);
  const sellerDetail    = buildSellerDetail(curRows, prevRows, targets);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F4F7FC; font-family: 'Inter', 'Segoe UI', sans-serif; color: #1A2540; min-height: 100vh; }

        .app-shell { display: flex; min-height: 100vh; background: #F4F7FC; }

        .sidebar {
          width: 76px; flex-shrink: 0;
          background: #FFFFFF;
          border-right: 1px solid #E7ECF5;
          display: flex; flex-direction: column; align-items: center;
          padding: 20px 0; gap: 22px;
          position: sticky; top: 0; height: 100vh;
        }
        .sb-logo {
          width: 44px; height: 44px; border-radius: 50%;
          background: linear-gradient(135deg, #173B8C 0%, #2563EB 60%, #3B9EE8 100%);
          color: #fff; font-weight: 800; font-size: 13px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }
        .sb-nav-item {
          width: 44px; height: 44px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          color: #8A93A6; cursor: pointer; transition: all .15s;
        }
        .sb-nav-item.active {
          background: linear-gradient(135deg, #2563EB 0%, #3B9EE8 100%);
          color: #fff;
          box-shadow: 0 4px 14px rgba(37,99,235,0.3);
        }
        .sb-nav-item:not(.active):hover { background: #F1F4FA; color: #2563EB; }
        .sb-spacer { flex: 1; }

        .main-area { flex: 1; min-width: 0; }

        .top-header {
          background: #FFFFFF;
          border-bottom: 1px solid #E7ECF5;
          padding: 18px 32px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 20px; flex-wrap: wrap;
        }
        .th-breadcrumb { font-size: 12px; font-weight: 700; color: #8A93A6; margin-bottom: 4px; }
        .th-title { font-size: 22px; font-weight: 800; color: #1A2540; letter-spacing: -0.3px; }
        .th-sub { font-size: 12.5px; font-weight: 700; color: #2563EB; margin-top: 4px; }
        .th-right { display: flex; align-items: center; gap: 14px; }
        .th-search {
          display: flex; align-items: center; gap: 8px;
          background: #F4F7FC; border: 1px solid #E7ECF5; border-radius: 12px;
          padding: 9px 14px; color: #A2ABBD; min-width: 220px;
        }
        .th-search input {
          border: none; outline: none; background: transparent;
          font-size: 13px; color: #1A2540; width: 100%; font-family: inherit;
        }
        .th-search input::placeholder { color: #A2ABBD; }
        .th-avatar { display: flex; align-items: center; gap: 10px; }
        .th-avatar-circle {
          width: 38px; height: 38px; border-radius: 50%;
          background: linear-gradient(135deg, #173B8C 0%, #3B9EE8 100%);
          color: #fff; font-weight: 800; font-size: 12px;
          display: flex; align-items: center; justify-content: center;
        }
        .th-avatar-name { font-size: 13px; font-weight: 700; color: #1A2540; line-height: 1.3; }
        .th-avatar-role { font-size: 11px; color: #A2ABBD; }

        .page-body { padding: 24px 32px 48px; max-width: 1360px; margin: 0 auto; }

        .view-row {
          background: #FFFFFF; border: 1px solid #E7ECF5; border-radius: 16px;
          padding: 14px 20px; display: flex; align-items: center; justify-content: space-between;
          gap: 16px; flex-wrap: wrap; margin-bottom: 20px;
          box-shadow: 0 4px 16px rgba(26,37,64,0.05);
        }
        .view-row-sub { font-size: 12px; color: #A2ABBD; margin-top: 2px; }
        .date-pill {
          display: flex; align-items: center; gap: 8px;
          background: #F4F7FC; border: 1px solid #E7ECF5; border-radius: 12px;
          padding: 9px 14px; font-size: 13px; font-weight: 700; color: #1A2540;
        }

        /* ── toggle ภาพรวม / รายคน (radio อยู่ในฟอร์ม → กดค้นหาแล้วยังอยู่หน้าเดิม) ── */
        .seg { display: inline-flex; background: #F1F4FA; border-radius: 12px; padding: 4px; gap: 4px; }
        .seg input { position: absolute; opacity: 0; pointer-events: none; }
        .seg label {
          padding: 8px 18px; border-radius: 9px; font-size: 13px; font-weight: 700; color: #5B6478;
          cursor: pointer; transition: all .15s; user-select: none;
        }
        .seg input:checked + label { background: #FFFFFF; color: #2563EB; box-shadow: 0 2px 8px rgba(26,37,64,0.1); }
        .seg input:focus-visible + label { outline: 2px solid #3B9EE8; }
        .page-body:has(#view-seller:checked) .view-overview { display: none; }
        .page-body:has(#view-overview:checked) .view-seller { display: none; }

        .filter-card {
          background: #FFFFFF; border: 1px solid #E7ECF5; border-radius: 16px;
          padding: 18px 20px; display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end;
          margin-bottom: 20px; box-shadow: 0 4px 16px rgba(26,37,64,0.05);
        }
        .fg { display: flex; flex-direction: column; gap: 6px; }
        .fg label { font-size: 11px; color: #8A93A6; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; }
        .fg input[type="month"], .fg input[type="text"], .fg select {
          padding: 9px 13px; border: 1.5px solid #DDE4F0; border-radius: 10px;
          font-size: 13.5px; color: #1A2540; background: #F8FAFD; outline: none;
          min-width: 140px; transition: border-color .2s, box-shadow .2s; font-family: inherit;
        }
        .fg input:focus, .fg select:focus { border-color: #3B9EE8; box-shadow: 0 0 0 3px rgba(59,158,232,0.15); background: #FFFFFF; }
        .fg-arrow { align-self: flex-end; padding: 10px 0; color: #A2ABBD; font-weight: 700; }
        .btn-search {
          padding: 9px 20px; background: linear-gradient(135deg, #2563EB 0%, #3B9EE8 100%);
          color: #fff; border: none; border-radius: 10px; font-size: 13.5px; font-weight: 700;
          cursor: pointer; align-self: flex-end; box-shadow: 0 4px 14px rgba(37,99,235,0.3);
          transition: opacity .2s, transform .1s; font-family: inherit;
        }
        .btn-search:hover { opacity: .92; transform: translateY(-1px); }
        .filter-hint { font-size: 11.5px; color: #A2ABBD; align-self: center; }

        .sec-label { display: flex; align-items: center; gap: 10px; margin: 24px 0 12px; }
        .sec-label-text { font-size: 11px; font-weight: 800; color: #8A93A6; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; }
        .sec-label::before, .sec-label::after { content: ''; flex: 1; height: 1px; background: #E7ECF5; }

        /* ── การ์ดเทียบปีก่อน (แนวตั้ง) ── */
        .cmp-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 14px; }
        @media (max-width: 1000px) { .cmp-row { grid-template-columns: 1fr; } }
        .cmp-card {
          background: #FFFFFF; border: 1px solid #E7ECF5; border-radius: 16px; padding: 20px 22px;
          position: relative; overflow: hidden; box-shadow: 0 4px 16px rgba(26,37,64,0.05); min-width: 0;
        }
        .cmp-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--cmp-accent); }
        .cmp-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
        .cmp-title { font-size: 15px; font-weight: 800; color: var(--cmp-accent); }
        .cmp-sub { font-size: 11px; color: #A2ABBD; }
        .cmp-main {
          font-size: clamp(20px, 2.3vw, 28px); font-weight: 800; color: #1A2540;
          font-variant-numeric: tabular-nums; letter-spacing: -0.4px; line-height: 1.15; overflow-wrap: anywhere;
        }
        .cmp-unit { font-size: 11px; color: #A2ABBD; margin-top: 4px; }
        .cmp-lines { margin-top: 14px; border-top: 1px dashed #E7ECF5; padding-top: 10px; display: flex; flex-direction: column; gap: 9px; }
        .cmp-line { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; color: #5B6478; }
        .cmp-line b { font-variant-numeric: tabular-nums; color: #1A2540; font-weight: 700; text-align: right; }
        .cmp-line b.muted { color: #A2ABBD; font-weight: 600; }
        .cmp-growth { font-weight: 800; font-size: 13px; padding: 3px 10px; border-radius: 99px; font-variant-numeric: tabular-nums; }
        .cmp-note { font-size: 11px; color: #B45309; background: rgba(217,119,6,0.08); border-radius: 8px; padding: 6px 10px; }
        .prog { display: flex; flex-direction: column; gap: 5px; }
        .prog-top { display: flex; justify-content: space-between; font-size: 12.5px; color: #5B6478; }
        .prog-top b { font-variant-numeric: tabular-nums; }
        .prog-bg { height: 6px; background: #EEF1F7; border-radius: 99px; overflow: hidden; }
        .prog-fill { height: 100%; border-radius: 99px; }

        .chart-strip-1 { display: grid; grid-template-columns: 1fr; gap: 14px; margin-bottom: 14px; }
        .chart-strip-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        @media (max-width: 780px) { .chart-strip-2 { grid-template-columns: 1fr; } }
        .chart-card { background: #FFFFFF; border: 1px solid #E7ECF5; border-radius: 16px; padding: 20px 22px; box-shadow: 0 4px 16px rgba(26,37,64,0.05); }
        .chart-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .chart-card-icon {
          width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center;
          background: rgba(37,99,235,0.1); color: #2563EB; flex-shrink: 0;
        }
        .chart-card-title { font-size: 14.5px; font-weight: 800; color: #1A2540; }
        .chart-card-sub { font-size: 11.5px; color: #A2ABBD; }

        .co-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
        .co-card {
          background: #FFFFFF; border: 1px solid #E7ECF5; border-radius: 16px; padding: 16px 18px;
          border-left: 3px solid var(--co-color, #3B9EE8); box-shadow: 0 4px 16px rgba(26,37,64,0.05);
          transition: transform .2s, box-shadow .2s;
        }
        .co-card:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(26,37,64,0.09); }
        .co-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .co-name { font-size: 14.5px; font-weight: 800; color: var(--co-color, #2563EB); display: flex; align-items: center; gap: 6px; }
        .co-badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 99px; background: #F1F4FA; }
        .co-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
        .co-metric-label { font-size: 10.5px; color: #8A93A6; margin-bottom: 3px; }
        .co-metric-val   { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
        .co-metric-val.giv { color: #16A34A; }
        .co-metric-val.niv { color: #2563EB; }
        .co-metric-val.dim { color: #A2ABBD; font-size: 13px; }
        .co-metric-val.amber { color: #B45309; font-size: 13px; }

        .tbl-card { background: #FFFFFF; border: 1px solid #E7ECF5; border-radius: 16px; overflow: auto; box-shadow: 0 4px 16px rgba(26,37,64,0.05); }
        .tbl-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 0; gap: 12px; flex-wrap: wrap; }
        .tbl-title  { font-size: 14px; font-weight: 700; color: #1A2540; }
        .tbl-tools  { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .tbl-count  { font-size: 12px; font-weight: 700; color: #2563EB; background: rgba(37,99,235,0.08); padding: 3px 10px; border-radius: 99px; border: 1px solid rgba(37,99,235,0.18); }
        .tbl-select { padding: 8px 12px; border: 1px solid #E7ECF5; border-radius: 10px; font-size: 13px; color: #1A2540; background: #F4F7FC; font-family: inherit; }
        .tbl-btn { padding: 8px 14px; border: 1px solid #E7ECF5; border-radius: 10px; font-size: 13px; font-weight: 700; color: #2563EB; background: #FFFFFF; cursor: pointer; font-family: inherit; }
        .tbl-btn:hover { background: #F1F4FA; }
        .pills { display: inline-flex; gap: 4px; background: #F1F4FA; border-radius: 10px; padding: 3px; }
        .pill { padding: 6px 12px; border: none; border-radius: 8px; font-size: 12.5px; font-weight: 700; color: #5B6478; background: transparent; cursor: pointer; font-family: inherit; }
        .pill.on { background: #FFFFFF; color: #2563EB; box-shadow: 0 2px 6px rgba(26,37,64,0.08); }
        table { border-collapse: collapse; width: 100%; font-size: 13px; min-width: 1100px; }
        thead th { padding: 12px 14px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #8A93A6; background: #F8FAFD; border-bottom: 1px solid #E7ECF5; white-space: nowrap; }
        thead th.r { text-align: right; }
        thead th.sortable { cursor: pointer; user-select: none; }
        thead th.sortable:hover { color: #2563EB; }
        thead th.sorted { color: #2563EB; }
        thead th.base-col { color: #C3CADA; }
        tbody tr:hover td { background: #F8FAFD; }
        tbody td { padding: 10px 14px; border-bottom: 1px solid #EFF2F8; color: #1A2540; white-space: nowrap; }
        td.r { text-align: right; font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 12.5px; }
        td.seller-name { font-weight: 700; color: #2563EB; font-size: 13px; }
        td.co-cell { color: #8A93A6; font-size: 12px; }
        td.princ-cell { color: #5B6478; font-size: 12px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
        td.dim { color: #A2ABBD; font-size: 12.5px; }
        td.grow-pos { color: #16A34A; font-weight: 700; font-family: monospace; font-size: 12px; }
        td.grow-neg { color: #DC2626; font-weight: 700; font-family: monospace; font-size: 12px; }
        .rank { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; font-size: 11px; font-weight: 700; background: #F1F4FA; color: #8A93A6; }
        .rank.r1 { background: rgba(234,179,8,0.16); color: #B45309; }
        .rank.r2 { background: rgba(148,163,184,0.2); color: #64748B; }
        .rank.r3 { background: rgba(180,83,9,0.16); color: #92400E; }
        tfoot td { padding: 12px 14px; font-weight: 700; background: #F8FAFD !important; border-top: 1px solid rgba(37,99,235,0.3); color: #1A2540; white-space: nowrap; }
        tfoot td.r { text-align: right; color: #2563EB; font-family: monospace; font-size: 12.5px; }

        .error-box { background: rgba(220,38,38,0.06); border-left: 3px solid #DC2626; border-radius: 12px; padding: 14px 18px; color: #B91C1C; font-size: 13px; margin-bottom: 20px; }
        .empty-note { color: #A2ABBD; text-align: center; padding: 32px; font-size: 14px; }

        @media (max-width: 640px) {
          .sidebar { width: 60px; }
          .top-header { padding: 14px 16px; }
          .page-body { padding: 16px 16px 40px; }
          .co-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="app-shell">
        {/* ─── Sidebar ───────────────────────────────────────── */}
        <aside className="sidebar">
          <div className="sb-logo">R8M</div>
          <div className="sb-nav-item active" title="Dashboard"><IconGrid /></div>
          <div className="sb-spacer" />
          <div className="sb-nav-item" title="แชร์"><IconShare /></div>
        </aside>

        {/* ─── Main area ─────────────────────────────────────── */}
        <div className="main-area">
          <header className="top-header">
            <div>
              <div className="th-breadcrumb">Dashboard / ภาพรวมการขาย</div>
              <div className="th-title">ภาพรวมยอดขาย</div>
              <div className="th-sub">
                {rangeLabel}{companyFilter !== 'all' ? ` · ${companyFilter}` : ''}
              </div>
            </div>
            <div className="th-right">
              <div className="th-avatar">
                <div className="th-avatar-circle">RSM</div>
                <div>
                  <div className="th-avatar-name">R8M Group</div>
                  <div className="th-avatar-role">Sales Dashboard</div>
                </div>
              </div>
            </div>
          </header>

          <div className="page-body">

            {/* ─── Toggle มุมมอง + ช่วงข้อมูล ───────────────────── */}
            <div className="view-row">
              <div className="seg" role="radiogroup" aria-label="มุมมอง">
                <input type="radio" id="view-overview" name="view" value="overview" form="filter-form" defaultChecked={view === 'overview'} />
                <label htmlFor="view-overview">📊 ภาพรวม</label>
                <input type="radio" id="view-seller" name="view" value="seller" form="filter-form" defaultChecked={view === 'seller'} />
                <label htmlFor="view-seller">🧑‍💼 ยอดขายรายคน</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {latestDate && <span className="view-row-sub">ข้อมูลถึง {formatDate(latestDate)} · อัปเดตทุกชั่วโมง</span>}
                <div className="date-pill">
                  <IconCalendar />
                  {rangeLabel}
                </div>
              </div>
            </div>

            {/* ─── Filter form ─────────────────────────────────── */}
            <form method="GET" id="filter-form" className="filter-card">
              <div className="fg">
                <label htmlFor="f-from">ตั้งแต่เดือน</label>
                <select id="f-from" name="from" defaultValue={fromYM}>
                  {months.map((m) => <option key={m} value={m}>{formatThaiMonth(m)}</option>)}
                </select>
              </div>
              <span className="fg-arrow">→</span>
              <div className="fg">
                <label htmlFor="f-to">ถึงเดือน</label>
                <select id="f-to" name="to" defaultValue={toYM}>
                  {months.map((m) => <option key={m} value={m}>{formatThaiMonth(m)}</option>)}
                </select>
              </div>
              <div className="fg">
                <label htmlFor="f-company">บริษัท</label>
                <select id="f-company" name="company" defaultValue={companyFilter}>
                  <option value="all">ทั้งหมด</option>
                  {COMPANY_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button type="submit" className="btn-search">ค้นหา</button>
              {months.length > 0 && (
                <span className="filter-hint">มีข้อมูล {formatRange(months[0], months[months.length - 1])}</span>
              )}
            </form>

            {errorMessage && <div className="error-box">❌ {errorMessage}</div>}

            {!errorMessage && (
              <>
                <div className="view-overview">
                  {/* ─── สรุปยอด: GIV / NIV เทียบปีก่อน + Target / BE ───── */}
                  <div className="sec-label"><span className="sec-label-text">📅 สรุปยอดขาย · {rangeLabel}{companyFilter !== 'all' ? ` · ${companyFilter}` : ''}</span></div>
                  <div className="cmp-row">
                    <CompareCard label="GIV" sub="ยอดก่อนหักส่วนลด" accent="#16A34A"
                      cur={grandCurrent.GIV} prev={grandPrevious.GIV} hasPrev={hasPrev} prevLabel={prevRangeLabel} />
                    <CompareCard label="NIV" sub="ยอดสุทธิ" accent="#2563EB"
                      cur={grandCurrent.NIV} prev={grandPrevious.NIV} hasPrev={hasPrev} prevLabel={prevRangeLabel} />
                    <TargetCard target={grandTarget.target} be={grandTarget.be} giv={grandCurrent.GIV} note={targetNote} />
                  </div>

                  {/* ─── แนวโน้มยอดขาย ────────────────────────────── */}
                  <div className="chart-strip-1">
                    <div className="chart-card">
                      <div className="chart-card-head">
                        <span className="chart-card-icon"><IconTrend /></span>
                        <div>
                          <div className="chart-card-title">แนวโน้มยอดขาย</div>
                          <div className="chart-card-sub">
                            รายเดือน {trendMonths.length > 0 ? formatRange(trendMonths[0], trendMonths[trendMonths.length - 1]) : ''} (บาท) — GIV / NIV
                          </div>
                        </div>
                      </div>
                      <TrendLineChart points={trendPoints} />
                    </div>
                  </div>

                  {/* ─── ยอดขายรายบริษัท ──────────────────────────── */}
                  <div className="chart-strip-2">
                    <div className="chart-card">
                      <div className="chart-card-head">
                        <span className="chart-card-icon" style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}><IconBuilding /></span>
                        <div>
                          <div className="chart-card-title">ยอดขายรายบริษัท (GIV)</div>
                          <div className="chart-card-sub">{rangeLabel} เทียบ {prevRangeLabel}</div>
                        </div>
                      </div>
                      <CompanyCompareChart current={companyCurrent} previous={companyPrevious} metric="GIV" accentColor="#16A34A" />
                    </div>
                    <div className="chart-card">
                      <div className="chart-card-head">
                        <span className="chart-card-icon"><IconBuilding /></span>
                        <div>
                          <div className="chart-card-title">ยอดขายรายบริษัท (NIV)</div>
                          <div className="chart-card-sub">{rangeLabel} เทียบ {prevRangeLabel}</div>
                        </div>
                      </div>
                      <CompanyCompareChart current={companyCurrent} previous={companyPrevious} metric="NIV" accentColor="#2563EB" />
                    </div>
                  </div>

                  {/* ─── สัดส่วนยอดขายตาม Principal — แยก GIV / NIV คนละวง ─── */}
                  {princDonutData.length > 0 && (
                    <div className="chart-strip-2">
                      <div className="chart-card">
                        <div className="chart-card-head">
                          <span className="chart-card-icon" style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}><IconPie /></span>
                          <div>
                            <div className="chart-card-title">สัดส่วนยอดขายตาม Principal (GIV)</div>
                            <div className="chart-card-sub">รวมยอด GIV ของทุก Seller แยกตาม Principal ของแต่ละคน</div>
                          </div>
                        </div>
                        <DonutChart data={princDonutData} metric="giv" />
                      </div>
                      <div className="chart-card">
                        <div className="chart-card-head">
                          <span className="chart-card-icon" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563EB' }}><IconPie /></span>
                          <div>
                            <div className="chart-card-title">สัดส่วนยอดขายตาม Principal (NIV)</div>
                            <div className="chart-card-sub">รวมยอด NIV ของทุก Seller แยกตาม Principal ของแต่ละคน</div>
                          </div>
                        </div>
                        <DonutChart data={princDonutData} metric="niv" />
                      </div>
                    </div>
                  )}

                  {/* ─── Company cards ────────────────────────────── */}
                  <div className="sec-label"><span className="sec-label-text">🏢 ยอดขายแยกตามบริษัท</span></div>
                  <div className="co-grid">
                    {companyCurrent.map((c, i) => {
                      const prevC = companyPrevious.find((p) => normalizeCompany(p.company) === normalizeCompany(c.company));
                      const coTarget = sumTargets(targets.filter((t) => normalizeCompany(t.company) === normalizeCompany(c.company)));
                      const g     = prevC ? pctGrowth(c.NIV, prevC.NIV) : null;
                      const col   = getCompanyColor(c.company, i);
                      return (
                        <div className="co-card" key={c.company} style={{ '--co-color': col } as React.CSSProperties}>
                          <div className="co-head">
                            <span className="co-name">⚡ {c.company}</span>
                            <span className="co-badge" style={{ color: growthColor(g) }} title="NIV เทียบปีก่อน">{growthArrow(g)}</span>
                          </div>
                          <div className="co-metrics">
                            <div className="co-metric"><div className="co-metric-label">GIV</div><div className="co-metric-val giv">{fmtNum(c.GIV)}</div></div>
                            <div className="co-metric"><div className="co-metric-label">NIV</div><div className="co-metric-val niv">{fmtNum(c.NIV)}</div></div>
                            <div className="co-metric"><div className="co-metric-label">Target</div><div className="co-metric-val amber">{coTarget.target ? fmtNum(coTarget.target) : '–'}</div></div>
                            <div className="co-metric"><div className="co-metric-label">GIV / Target</div><div className="co-metric-val amber">{fmtPct(coTarget.target ? (c.GIV / coTarget.target) * 100 : null)}</div></div>
                            <div className="co-metric"><div className="co-metric-label">BE</div><div className="co-metric-val dim">{coTarget.be ? fmtNum(coTarget.be) : '–'}</div></div>
                            <div className="co-metric"><div className="co-metric-label">NIV ปีก่อน</div><div className="co-metric-val dim">{prevC ? fmtNum(prevC.NIV) : '–'}</div></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ─── ยอดขายรายคน (client component — ค้นหา/กรอง/เรียงได้ทันที) ── */}
                <div className="view-seller">
                  <SellerTable
                    rows={sellerDetail}
                    companyFilter={companyFilter}
                    hasPrev={hasPrev}
                    periodLabel={rangeLabel}
                    fileTag={fromYM === toYM ? fromYM : `${fromYM}_${toYM}`}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
