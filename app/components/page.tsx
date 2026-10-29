import { getLG014SummaryBase, getLG014Summary, LG014SellerRow } from '@/app/lib/api';
import SellerTable from '@/app/components/SellerTable';
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
type PrincDonutSlice = { label: string; giv: number; niv: number; color: string };

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthToRange(ym: string): { startDate: string; endDate: string } {
  const [y, m] = ym.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDayNum = new Date(y, m, 0).getDate();
  return {
    startDate: `${y}-${pad(m)}-01`,
    endDate: `${y}-${pad(m)}-${pad(lastDayNum)}`,
  };
}

function shiftMonths(ym: string, monthsBack: number): string {
  let [y, m] = ym.split('-').map(Number);
  m -= monthsBack;
  while (m <= 0) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

function monthAbbr(ym: string): string {
  const [, m] = ym.split('-').map(Number);
  return THAI_MONTH_ABBR[m - 1];
}

function formatThaiMonth(ym: string): string {
  const [y] = ym.split('-').map(Number);
  return `${monthAbbr(ym)} ${y}`;
}

function getTrendMonths(selectedMonth: string): string[] {
  // ดึง 7 เดือน: [เดือนปัจจุบัน-6, ..., เดือนปัจจุบัน-1, เดือนปัจจุบัน]
  // index 0-5 = 6 เดือนย้อนหลัง (ไม่รวมเดือนปัจจุบัน) ใช้คำนวณ sum3/sum6
  // index 1-6 = เดือนปัจจุบัน + ย้อนหลัง 5 เดือน ใช้แสดงกราฟแนวโน้ม (เหมือนเดิม)
  return Array.from({ length: 7 }, (_, i) => shiftMonths(selectedMonth, 6 - i));
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

function growthColor(pct: number | null) {
  if (pct == null) return '#9CA3AF';
  return pct >= 0 ? '#16A34A' : '#DC2626';
}

function growthArrow(pct: number | null) {
  if (pct == null) return '–';
  return pct >= 0 ? `▲ ${pct.toFixed(2)}%` : `▼ ${Math.abs(pct).toFixed(2)}%`;
}

function normalizeCompany(c: string) { return (c ?? '').trim().toUpperCase(); }
function isGSM(seller: string) { return (seller ?? '').toUpperCase().includes('GSM'); }
function companySortIndex(company: string) {
  const idx = COMPANY_ORDER.indexOf(normalizeCompany(company));
  return idx === -1 ? 999 : idx;
}

function distinctCompanies(rows: LG014SellerRow[]) {
  return Array.from(new Set(rows.map((r) => r.Company))).sort(
    (a, b) => companySortIndex(a) - companySortIndex(b) || a.localeCompare(b)
  );
}

function sumGIVNIV(rows: LG014SellerRow[]) {
  return rows.reduce(
    (acc, r) => { acc.GIV += r.GIV ?? 0; acc.NIV += r.NIV ?? 0; return acc; },
    { GIV: 0, NIV: 0 }
  );
}

function sumTrendPoints(points: TrendPoint[]) {
  return points.reduce(
    (acc, p) => { acc.GIV += p.GIV ?? 0; acc.NIV += p.NIV ?? 0; return acc; },
    { GIV: 0, NIV: 0 }
  );
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
function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
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
            {monthAbbr(p.month)}
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 220, flex: 1 }}>
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
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: s.color }} />
              <span style={{
                fontSize: 12, color: '#1A2540', fontWeight: 700,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.label}
              </span>
              <span style={{
                fontSize: 11.5, color: metricColor, fontFamily: 'monospace',
                fontWeight: 600, textAlign: 'right',
              }}>
                {fmtShort(s.value)}
              </span>
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

// ── Page ──────────────────────────────────────────────────────────
export default async function SalesOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params        = await searchParams;
  const currentMonth  = getCurrentMonth();
  const selectedMonth = params.month || currentMonth;

  const companyFilter = params.company || 'all';
  const excludeGSM    = params.gsm === '1' || params.gsm === 'on';

  const { startDate, endDate } = monthToRange(selectedMonth);
  const trendMonths = getTrendMonths(selectedMonth);

  let result: Awaited<ReturnType<typeof getLG014SummaryBase>> | undefined;
  let trendPoints: TrendPoint[] = [];
  let errorMessage: string | null = null;

  try {
    const [baseRes, trendResList] = await Promise.all([
      getLG014SummaryBase({ startDate, endDate }),
      Promise.all(trendMonths.map((m) => getLG014Summary(monthToRange(m)))),
    ]);
    result = baseRes;
    trendPoints = trendMonths.map((m, i) => {
      const rows = trendResList[i]?.bySeller ?? [];
      const filtered = excludeGSM ? rows.filter((r) => !isGSM(r.Seller)) : rows;
      const { GIV, NIV } = sumGIVNIV(filtered);
      return { month: m, GIV, NIV };
    });
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
  }

  const prevPeriod = result?.previous?.period;
  const rawCurrent  = result?.current?.bySeller  ?? [];
  const rawPrevious = result?.previous?.bySeller ?? [];

  const curRows  = excludeGSM ? rawCurrent.filter((r) => !isGSM(r.Seller))  : rawCurrent;
  const prevRows = excludeGSM ? rawPrevious.filter((r) => !isGSM(r.Seller)) : rawPrevious;

  const grandCurrent   = sumGIVNIV(curRows);
  const grandPrevious  = sumGIVNIV(prevRows);
  const grandNIVGrowthPct = pctGrowth(grandCurrent.NIV, grandPrevious.NIV);
  const grandGIVGrowthPct = pctGrowth(grandCurrent.GIV, grandPrevious.GIV);

  const companyCurrent  = aggregateByCompany(curRows);
  const companyPrevious = aggregateByCompany(prevRows);
  const companyOptions  = distinctCompanies(rawCurrent);
  const princDonutData  = buildPrincDonutData(curRows);

  // ── FIX: ตัดเดือนปัจจุบัน (index 6) ออกก่อน ──────────────────
  // trendPoints มี 7 ตัว (index 0-6) โดย index 6 = เดือนปัจจุบัน
  // historicalPoints = 6 เดือนย้อนหลังล้วนๆ (ไม่รวมเดือนปัจจุบัน)
  const historicalPoints = trendPoints.slice(0, -1);          // index 0-5 (6 เดือน)
  const last3Points      = historicalPoints.slice(-3);         // index 3-5 (3 เดือนล่าสุด ไม่รวมปัจจุบัน)
  const last6Points      = historicalPoints;                   // index 0-5 (6 เดือนทั้งหมด ไม่รวมปัจจุบัน)
  // ────────────────────────────────────────────────────────────────

  const sum3 = sumTrendPoints(last3Points);
  const sum6 = sumTrendPoints(last6Points);
  const range3Label = last3Points.length > 0
    ? `${formatThaiMonth(last3Points[0].month)} → ${formatThaiMonth(last3Points[last3Points.length - 1].month)}`
    : '';
  const range6Label = last6Points.length > 0
    ? `${formatThaiMonth(last6Points[0].month)} → ${formatThaiMonth(last6Points[last6Points.length - 1].month)}`
    : '';

  const tableRows = curRows
    .filter((r) => companyFilter === 'all' || normalizeCompany(r.Company) === normalizeCompany(companyFilter))
    .sort((a, b) => (b.NIV ?? 0) - (a.NIV ?? 0));

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
          padding: 16px 20px; display: flex; align-items: center; justify-content: space-between;
          gap: 16px; flex-wrap: wrap; margin-bottom: 20px;
          box-shadow: 0 4px 16px rgba(26,37,64,0.05);
        }
        .view-row-label { font-size: 14px; font-weight: 700; color: #1A2540; }
        .view-row-sub { font-size: 12px; color: #A2ABBD; margin-top: 2px; }
        .date-pill {
          display: flex; align-items: center; gap: 8px;
          background: #F4F7FC; border: 1px solid #E7ECF5; border-radius: 12px;
          padding: 9px 14px; font-size: 13px; font-weight: 700; color: #1A2540;
        }

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
        .fg-check { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #5B6478; padding: 9px 4px; cursor: pointer; user-select: none; }
        .fg-check input[type="checkbox"] { width: 15px; height: 15px; accent-color: #2563EB; cursor: pointer; }
        .btn-search {
          padding: 9px 20px; background: linear-gradient(135deg, #2563EB 0%, #3B9EE8 100%);
          color: #fff; border: none; border-radius: 10px; font-size: 13.5px; font-weight: 700;
          cursor: pointer; align-self: flex-end; box-shadow: 0 4px 14px rgba(37,99,235,0.3);
          transition: opacity .2s, transform .1s; font-family: inherit;
        }
        .btn-search:hover { opacity: .92; transform: translateY(-1px); }

        .sec-label { display: flex; align-items: center; gap: 10px; margin: 24px 0 12px; }
        .sec-label-text { font-size: 11px; font-weight: 800; color: #8A93A6; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; }
        .sec-label::before, .sec-label::after { content: ''; flex: 1; height: 1px; background: #E7ECF5; }

        .kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 4px; }
        .kpi-card {
          background: #FFFFFF; border: 1px solid #E7ECF5; border-radius: 16px; padding: 18px 20px;
          position: relative; overflow: hidden; box-shadow: 0 4px 16px rgba(26,37,64,0.05);
          transition: transform .2s, box-shadow .2s;
          min-width: 0;
        }
        .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(26,37,64,0.09); }
        .kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 16px 16px 0 0; background: var(--accent-top, #3B9EE8); }
        .kpi-card.accent-green::before { --accent-top: #16A34A; }
        .kpi-card.accent-blue::before  { --accent-top: #2563EB; }
        .kpi-card.accent-red::before   { --accent-top: #DC2626; }
        .kpi-card.accent-dim::before   { --accent-top: #CBD5E1; }
        .kpi-card.accent-amber::before { --accent-top: #D97706; }
        .kpi-icon  { font-size: 20px; margin-bottom: 8px; display: block; }
        .kpi-label { font-size: 10.5px; font-weight: 700; color: #8A93A6; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }
        .kpi-value {
          font-size: clamp(15px, 2.1vw, 24px);
          font-weight: 800; color: #1A2540;
          font-variant-numeric: tabular-nums; letter-spacing: -0.3px; line-height: 1.15;
          overflow-wrap: anywhere; word-break: break-word; max-width: 100%;
        }
        .kpi-unit  { font-size: 10.5px; color: #A2ABBD; margin-top: 6px; }

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

        .co-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
        .co-card {
          background: #FFFFFF; border: 1px solid #E7ECF5; border-radius: 16px; padding: 16px 18px;
          border-left: 3px solid var(--co-color, #3B9EE8); box-shadow: 0 4px 16px rgba(26,37,64,0.05);
          transition: transform .2s, box-shadow .2s;
        }
        .co-card:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(26,37,64,0.09); }
        .co-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .co-name { font-size: 14.5px; font-weight: 800; color: var(--co-color, #2563EB); display: flex; align-items: center; gap: 6px; }
        .co-badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 99px; background: #F1F4FA; }
        .co-metrics { display: flex; gap: 18px; flex-wrap: wrap; }
        .co-metric-label { font-size: 10.5px; color: #8A93A6; margin-bottom: 3px; }
        .co-metric-val   { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
        .co-metric-val.giv { color: #16A34A; }
        .co-metric-val.niv { color: #2563EB; }
        .co-metric-val.dim { color: #A2ABBD; font-size: 14px; }

        .tbl-card { background: #FFFFFF; border: 1px solid #E7ECF5; border-radius: 16px; overflow: auto; box-shadow: 0 4px 16px rgba(26,37,64,0.05); }
        .tbl-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 0; gap: 12px; flex-wrap: wrap; }
        .tbl-title  { font-size: 14px; font-weight: 700; color: #1A2540; }
        .tbl-count  { font-size: 12px; font-weight: 700; color: #2563EB; background: rgba(37,99,235,0.08); padding: 3px 10px; border-radius: 99px; border: 1px solid rgba(37,99,235,0.18); }
        table { border-collapse: collapse; width: 100%; font-size: 13px; min-width: 760px; }
        thead th { padding: 12px 14px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #8A93A6; background: #F8FAFD; border-bottom: 1px solid #E7ECF5; white-space: nowrap; }
        thead th.r { text-align: right; }
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
        .bar-wrap { display: flex; align-items: center; gap: 8px; min-width: 110px; }
        .bar-bg   { flex: 1; height: 5px; background: #EEF1F7; border-radius: 99px; overflow: hidden; }
        .bar-fill { height: 100%; background: #3B9EE8; border-radius: 99px; }
        .bar-pct  { font-size: 11px; color: #A2ABBD; min-width: 34px; text-align: right; }
        tfoot td { padding: 12px 14px; font-weight: 700; background: #F8FAFD !important; border-top: 1px solid rgba(37,99,235,0.3); color: #1A2540; }
        tfoot td.r { text-align: right; color: #2563EB; font-family: monospace; font-size: 12.5px; }

        .error-box { background: rgba(220,38,38,0.06); border-left: 3px solid #DC2626; border-radius: 12px; padding: 14px 18px; color: #B91C1C; font-size: 13px; margin-bottom: 20px; }
        .empty-note { color: #A2ABBD; text-align: center; padding: 32px; font-size: 14px; }

        @media (max-width: 640px) {
          .sidebar { width: 60px; }
          .top-header { padding: 14px 16px; }
          .page-body { padding: 16px 16px 40px; }
          .kpi-row { grid-template-columns: 1fr 1fr; }
          .co-grid { grid-template-columns: 1fr; }
          .th-search { display: none; }
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
              <div className="th-sub">{formatThaiMonth(selectedMonth)}</div>
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

            <div className="view-row">
              <div>
                <div className="view-row-label">ช่วงเวลาข้อมูล</div>
                <div className="view-row-sub">แสดงข้อมูลของเดือนที่เลือก</div>
              </div>
              <div className="date-pill">
                <IconCalendar />
                {formatThaiMonth(selectedMonth)}
              </div>
            </div>

            {/* ─── Filter form ─────────────────────────────────── */}
            <form method="GET" className="filter-card">
              <div className="fg">
                <label>เดือนที่ดู</label>
                <input type="month" name="month" defaultValue={selectedMonth} />
              </div>
              {/* <div className="fg">
                <label>บริษัท</label>
                <select name="company" defaultValue={companyFilter}>
                  <option value="all">ทั้งหมด ({companyOptions.length})</option>
                  {companyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div> */}

              <label className="fg-check">
                <input type="checkbox" name="gsm" value="1" defaultChecked={excludeGSM} />
                ไม่รวมรหัส GSM
              </label>
              <button type="submit" className="btn-search">ค้นหา</button>
            </form>

            {errorMessage && <div className="error-box">❌ {errorMessage}</div>}

            {result && (
              <>
                {/* ─── KPI cards ───────────────────────────────── */}
                <div className="sec-label"><span className="sec-label-text">📅 สรุปยอดขายรายเดือน · {startDate} → {endDate}</span></div>
                <div className="kpi-row">
                  <div className="kpi-card accent-green">
                    <span className="kpi-icon">💰</span>
                    <div className="kpi-label">GIV รวม</div>
                    <div className="kpi-value">{fmtNum(grandCurrent.GIV)}</div>
                    <div className="kpi-unit">บาท</div>
                  </div>
                  <div className="kpi-card accent-blue">
                    <span className="kpi-icon">🎯</span>
                    <div className="kpi-label">NIV รวม</div>
                    <div className="kpi-value">{fmtNum(grandCurrent.NIV)}</div>
                    <div className="kpi-unit">บาท</div>
                  </div>
                  <div className={`kpi-card ${(grandGIVGrowthPct ?? 0) >= 0 ? 'accent-green' : 'accent-red'}`}>
                    <span className="kpi-icon">📊</span>
                    <div className="kpi-label">GIV Growth (YoY)</div>
                    <div className="kpi-value" style={{ color: growthColor(grandGIVGrowthPct) }}>{growthArrow(grandGIVGrowthPct)}</div>
                    <div className="kpi-unit">เทียบปีก่อน</div>
                  </div>
                  <div className={`kpi-card ${(grandNIVGrowthPct ?? 0) >= 0 ? 'accent-green' : 'accent-red'}`}>
                    <span className="kpi-icon">📈</span>
                    <div className="kpi-label">NIV Growth (YoY)</div>
                    <div className="kpi-value" style={{ color: growthColor(grandNIVGrowthPct) }}>{growthArrow(grandNIVGrowthPct)}</div>
                    <div className="kpi-unit">เทียบปีก่อน</div>
                  </div>
                  <div className="kpi-card accent-amber">
                    <span className="kpi-icon">🧾</span>
                    <div className="kpi-label">GIV Base (ปีก่อน)</div>
                    <div className="kpi-value" style={{ color: '#B45309' }}>{fmtNum(grandPrevious.GIV)}</div>
                    <div className="kpi-unit">บาท</div>
                  </div>
                  <div className="kpi-card accent-dim">
                    <span className="kpi-icon">🗂️</span>
                    <div className="kpi-label">NIV Base (ปีก่อน)</div>
                    <div className="kpi-value" style={{ color: '#8A93A6' }}>{fmtNum(grandPrevious.NIV)}</div>
                    <div className="kpi-unit">บาท</div>
                  </div>
                </div>

                {/* ─── 3 เดือนย้อนหลัง (ไม่รวมเดือนปัจจุบัน) ─── */}
                <div className="sec-label"><span className="sec-label-text">📅 สรุปยอดขาย 3 เดือนย้อนหลัง · {range3Label}</span></div>
                <div className="kpi-row">
                  <div className="kpi-card accent-green">
                    <span className="kpi-icon">💰</span>
                    <div className="kpi-label">GIV รวม (3 เดือน)</div>
                    <div className="kpi-value">{fmtNum(sum3.GIV)}</div>
                    <div className="kpi-unit">บาท</div>
                  </div>
                  <div className="kpi-card accent-blue">
                    <span className="kpi-icon">🎯</span>
                    <div className="kpi-label">NIV รวม (3 เดือน)</div>
                    <div className="kpi-value">{fmtNum(sum3.NIV)}</div>
                    <div className="kpi-unit">บาท</div>
                  </div>
                </div>

                {/* ─── 6 เดือนย้อนหลัง (ไม่รวมเดือนปัจจุบัน) ─── */}
                <div className="sec-label"><span className="sec-label-text">📅 สรุปยอดขาย 6 เดือนย้อนหลัง · {range6Label}</span></div>
                <div className="kpi-row">
                  <div className="kpi-card accent-green">
                    <span className="kpi-icon">💰</span>
                    <div className="kpi-label">GIV รวม (6 เดือน)</div>
                    <div className="kpi-value">{fmtNum(sum6.GIV)}</div>
                    <div className="kpi-unit">บาท</div>
                  </div>
                  <div className="kpi-card accent-blue">
                    <span className="kpi-icon">🎯</span>
                    <div className="kpi-label">NIV รวม (6 เดือน)</div>
                    <div className="kpi-value">{fmtNum(sum6.NIV)}</div>
                    <div className="kpi-unit">บาท</div>
                  </div>
                </div>

                {/* ─── แนวโน้มยอดขาย (ใช้ trendPoints ทั้ง 7 เดือน รวมปัจจุบัน) ── */}
                <div className="chart-strip-1">
                  <div className="chart-card">
                    <div className="chart-card-head">
                      <span className="chart-card-icon"><IconTrend /></span>
                      <div>
                        <div className="chart-card-title">แนวโน้มยอดขาย</div>
                        <div className="chart-card-sub">แนวโน้มยอดขายย้อนหลัง 6 เดือน (บาท) — GIV / NIV</div>
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
                        <div className="chart-card-sub">SDO / PDC / DC — ปัจจุบันเทียบกับปีก่อน</div>
                      </div>
                    </div>
                    <CompanyCompareChart current={companyCurrent} previous={companyPrevious} metric="GIV" accentColor="#16A34A" />
                  </div>
                  <div className="chart-card">
                    <div className="chart-card-head">
                      <span className="chart-card-icon"><IconBuilding /></span>
                      <div>
                        <div className="chart-card-title">ยอดขายรายบริษัท (NIV)</div>
                        <div className="chart-card-sub">SDO / PDC / DC — ปัจจุบันเทียบกับปีก่อน</div>
                      </div>
                    </div>
                    <CompanyCompareChart current={companyCurrent} previous={companyPrevious} metric="NIV" accentColor="#2563EB" />
                  </div>
                </div>

                {/* ─── สัดส่วนยอดขายตาม Principal ────────────────── */}
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
  const givGrowth = prevC ? pctGrowth(c.GIV, prevC.GIV) : null;
  const nivGrowth = prevC ? pctGrowth(c.NIV, prevC.NIV) : null;
  const col = getCompanyColor(c.company, i);
  return (
    <div className="co-card" key={c.company} style={{ '--co-color': col } as React.CSSProperties}>
      <div className="co-head">
        <span className="co-name">⚡ {c.company}</span>
      </div>
      <div className="co-metrics">
        <div className="co-metric">
          <div className="co-metric-label">GIV</div>
          <div className="co-metric-val giv">{fmtNum(c.GIV)}</div>
          {prevC && (
            <div style={{ fontSize: 11, marginTop: 3, color: growthColor(givGrowth), fontWeight: 700, fontFamily: 'monospace' }}>
              {growthArrow(givGrowth)}
            </div>
          )}
        </div>
        <div className="co-metric">
          <div className="co-metric-label">NIV</div>
          <div className="co-metric-val niv">{fmtNum(c.NIV)}</div>
          {prevC && (
            <div style={{ fontSize: 11, marginTop: 3, color: growthColor(nivGrowth), fontWeight: 700, fontFamily: 'monospace' }}>
              {growthArrow(nivGrowth)}
            </div>
          )}
        </div>
        {prevC && (
          <div className="co-metric">
            <div className="co-metric-label">Base GIV</div>
            <div className="co-metric-val dim">{fmtNum(prevC.GIV)}</div>
          </div>
        )}
        {prevC && (
          <div className="co-metric">
            <div className="co-metric-label">Base NIV</div>
            <div className="co-metric-val dim">{fmtNum(prevC.NIV)}</div>
          </div>
        )}
      </div>
    </div>
  );
})}
                </div>

                {/* ─── Seller table ─────────────────────────────── */}
                <div className="sec-label" style={{ marginTop: 28 }}>
                  <span className="sec-label-text">🧑‍💼 ยอดขายรายบุคคล</span>
                </div>
                <SellerTable
                  rows={tableRows}
                  prevRows={prevRows}
                  companyFilter={companyFilter}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}