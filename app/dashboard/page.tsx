import {
  getLG014Summary,
  getLatestDate,
  getAvailableMonths,
  monthToRange,
  shiftYears,
  addDays,
  getBranchPrinc,
  getSellerKpi,
  BranchPrincRow,
  SellerKpi,
  LG014SellerRow,
} from '@/app/lib/api';
import { getTargets, preloadTargets, TargetRow } from '@/app/lib/targets';
import { timeGone, TimeGone } from '@/app/lib/workdays';
import { lastYear, loadScorecard, Scorecard, MAX_RANGE_MONTHS } from '@/app/lib/scorecard';
import { BranchSales, type BranchTarget } from '@/app/components/BranchSales';
import ScorecardView, { type TypeStat } from '@/app/components/Scorecard';
import { SELLER_TYPES, sellerTypeOf, type SellerType } from '@/app/lib/sellerType';
import {
  COMPANY_COLORS, fmtInt, fmtNum, fmtPct, fmtShort, paceColor, pctOf,
} from '@/app/lib/format';
import { PaceBar } from '@/app/components/ui';
import { LoadingDone } from '@/app/components/Loading';
import { requireEmployee } from '@/app/lib/session';
import CompanyShare, { CompanyPrincRow, type SellerTarget } from '@/app/components/CompanyShare';
import {
  COMPANY_ORDER, companyFromParams, formatDate, formatRange, formatThaiMonth, monthAbbr,
  normalizeCompany, rangeFromParams, shiftYM,
} from '@/app/lib/period';
import { HealthBanner, Hero, RangeFilter } from './parts';
import { checkHealth, type HealthIssue } from '@/app/lib/health';

type TrendPoint = { month: string; GIV: number; NIV: number };

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

type GivNiv = { GIV: number; NIV: number };
type PeriodStat = {
  label: string; range: string; prevRange: string; n: number;
  cur: GivNiv; prev: GivNiv; hasPrev: boolean;
  target: number; be: number; tg: TimeGone; targetComplete: boolean;
};
type CompanyStat = { company: string; cur: GivNiv; prev: GivNiv; target: number; be: number; sellers: number };

// ── ไอคอน KPI ──
function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const IconClock = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
const IconTarget = () => <Svg><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Svg>;
const IconTrend = () => <Svg><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></Svg>;

// ── กราฟแนวโน้ม: GIV เส้นทึบสีเข้ม / NIV เส้นประสีเทา (สีบริษัทสงวนไว้ให้วงล้อมบริษัท) ──
function TrendLineChart({ points }: { points: TrendPoint[] }) {
  const w = 1100, h = 260, padL = 60, padR = 64, padT = 16, padB = 32;
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
  const last = points.length - 1;

  return (
    <figure className="trend">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="ยอดขายรายเดือน GIV และ NIV">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + (1 - t) * innerH;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#F0F0F3" strokeWidth={1} />
              <text x={padL - 10} y={y + 4} textAnchor="end" className="axis">{fmtShort(maxVal * t)}</text>
            </g>
          );
        })}
        <path d={buildPath('NIV')} fill="none" stroke="#94A0B4" strokeWidth={2} strokeDasharray="6 5" />
        <path d={buildPath('GIV')} fill="none" stroke="#1F66E5" strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.month}>
            <circle cx={xFor(i)} cy={yFor(p.NIV)} r={4} fill="#FFFFFF" stroke="#94A0B4" strokeWidth={2} />
            <circle cx={xFor(i)} cy={yFor(p.GIV)} r={4.5} fill="#FFFFFF" stroke="#1F66E5" strokeWidth={2.5} />
            {/* พื้นที่ hover ใหญ่กว่าจุด — tooltip แบบ native */}
            <rect x={xFor(i) - Math.max(stepX / 2, 20)} y={padT} width={Math.max(stepX, 40)} height={innerH} fill="transparent">
              <title>{`${formatThaiMonth(p.month)}\nGIV ${fmtNum(p.GIV)}\nNIV ${fmtNum(p.NIV)}`}</title>
            </rect>
            <text x={xFor(i)} y={h - 10} textAnchor="middle" className="axis">
              {multiYear ? `${monthAbbr(p.month)} ${p.month.slice(2, 4)}` : monthAbbr(p.month)}
            </text>
          </g>
        ))}
        {last >= 0 && (
          <>
            <text x={xFor(last) + 10} y={yFor(points[last].GIV) + 4} className="direct">GIV</text>
            <text x={xFor(last) + 10} y={yFor(points[last].NIV) + 4} className="direct muted">NIV</text>
          </>
        )}
      </svg>
      <figcaption className="legend">
        <span><i className="legend-line" /> GIV</span>
        <span><i className="legend-line dashed" /> NIV</span>
        <span className="muted">ชี้ที่เดือนเพื่อดูตัวเลข</span>
      </figcaption>
    </figure>
  );
}

/// ฐานปีก่อนของช่วงที่เลือก: mtd = ถึงวันเดียวกันของปีก่อน · full = ทั้งเดือน / ทั้งช่วงของปีก่อน
// split = ช่วงที่เลือกมีเดือนปัจจุบัน (ยังไม่จบ) → mtd กับ full ต่างกัน ต้องแสดงทั้งคู่
type BaseStat = { mtd: GivNiv; full: GivNiv; mtdLabel: string; fullLabel: string; hasPrev: boolean; split: boolean };

/// ── KPI แถวบน: Target → Base → Time gone · ตัวเลขยอด / เป้าตัวใหญ่ ให้เห็นชัดว่าเทียบอะไรกับอะไร ──
function PaceStrip({ tg, giv, target, base }: { tg: TimeGone; giv: number; target: number; base: BaseStat }) {
  const achieved = pctOf(giv, target);
  // Base = ยอดปีก่อน "ทั้งเดือน" (เหมือน Target) → สีเทียบ Time gone
  const vsBase = base.hasPrev ? pctOf(giv, base.full.GIV) : null;
  return (
    <section className="card kpis kpis-3">
      <div className="kpi">
        <span className="kpi-top"><span className="kpi-ic"><IconTarget /></span><span className="eyebrow">GIV เทียบ Target</span></span>
        <div className="kpi-pair">
          <span><small>ยอดทำได้ (MTD)</small><b>{fmtInt(giv)}</b></span>
          <span><small>Target ทั้งเดือน</small><b className="kpi-goal">{target ? fmtInt(target) : '–'}</b></span>
        </div>
        <span className="kpi-pct">
          <b style={{ color: paceColor(achieved, tg.pct) }}>{fmtPct(achieved)}</b>
          <PaceBar pct={achieved} timeGonePct={tg.pct} size="sm" />
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-top"><span className="kpi-ic"><IconTrend /></span><span className="eyebrow">GIV เทียบ Base ปีก่อน</span></span>
        <div className="kpi-pair">
          <span><small>ยอดทำได้ (MTD)</small><b>{fmtInt(giv)}</b></span>
          <span><small>Base ปีก่อนทั้งเดือน</small><b className="kpi-goal">{base.hasPrev ? fmtInt(base.full.GIV) : '–'}</b></span>
        </div>
        <span className="kpi-pct">
          <b style={{ color: paceColor(vsBase, tg.pct) }}>{fmtPct(vsBase)}</b>
          <PaceBar pct={vsBase} timeGonePct={tg.pct} size="sm" />
        </span>
        <span className="kpi-cap">Base = {base.fullLabel}</span>
      </div>
      <div className="kpi">
        <span className="kpi-top"><span className="kpi-ic"><IconClock /></span><span className="eyebrow">Time gone</span></span>
        <div className="kpi-pair">
          <span><small>วันทำงานที่ผ่านไป</small><b>{tg.elapsed} วัน</b></span>
          <span><small>วันทำงานทั้งเดือน</small><b className="kpi-goal">{tg.total} วัน</b></span>
        </div>
        <span className="kpi-pct">
          <b>{tg.pct.toFixed(1)}%</b>
          <span className="bar bar-sm"><span className="bar-fill" style={{ width: `${Math.min(tg.pct, 100)}%`, background: 'var(--primary)' }} /></span>
        </span>
        <span className="kpi-cap">นับถึง {formatDate(tg.asOf)} · จ.–ส. เริ่มนับวันที่ 3</span>
      </div>
    </section>
  );
}

// แถว "เทียบ": ฐานที่เทียบ | ยอดของฐาน | ยอด MTD | % (MTD ÷ ฐาน)
// tgPct = ฐานเป็นเป้า (Target / BE) → สี % เทียบ Time gone + แท่ง · ไม่ใส่ = ฐานปีก่อน → เขียวเมื่อ ≥ 100%
function VsRow({ label, sub, cur, base, tgPct, missing }: {
  label: string; sub?: string; cur: number; base: number; tgPct?: number; missing?: string;
}) {
  const pct = pctOf(cur, base);
  return (
    <div className="vs-row">
      <div className="vs-name"><b>{label}</b>{sub && <span className="muted">{sub}</span>}</div>
      <div className="vs-base" data-label="Target / Base">{base ? fmtInt(base) : <span className="muted">{missing ?? '–'}</span>}</div>
      <div className="vs-diff" data-label="MTD">{fmtInt(cur)}</div>
      <div className="vs-pct" data-label="% ของฐาน">
        {pct == null ? '–' : tgPct != null
          ? <b style={{ color: paceColor(pct, tgPct) }}>{fmtPct(pct)}</b>
          : <b className={`sc-chip ${pct >= 100 ? 'up' : 'down'}`}>{fmtPct(pct)}</b>}
      </div>
      {tgPct != null && <div className="vs-bar"><PaceBar pct={pct} timeGonePct={tgPct} size="sm" /></div>}
    </div>
  );
}

// การ์ด GIV / NIV: ยอดตอนนี้ตัวใหญ่ แล้ว "เทียบ" กับฐานทีละตัว เห็นตัวเลขสองฝั่งชัด ๆ
// Target / BE ในชีตตั้งเป็นยอด GIV จึงมีเฉพาะการ์ด GIV
function MetricCard({ label, sub, cur, base, goal, tg, note }: {
  label: 'GIV' | 'NIV'; sub: string; cur: number; base: BaseStat;
  goal?: { target: number; be: number }; tg: TimeGone; note?: string | null;
}) {
  return (
    <section className="card metric">
      <header className="metric-head">
        <h3 className={`metric-name metric-${label.toLowerCase()}`}>{label}</h3>
        <span className="card-sub">{sub}</span>
      </header>
      <div className="metric-val">{fmtNum(cur)}</div>
      <div className="card-sub">บาท · ยอดสะสมถึงวันล่าสุด (MTD)</div>

      <div className="vs">
        <div className="vs-row vs-head">
          <div>เทียบกับ</div><div>Target / Base</div><div>MTD</div><div>%</div>
        </div>
        {goal && (
          <>
            <VsRow label="Target" sub="ทั้งเดือน" cur={cur} base={goal.target} tgPct={tg.pct} />
            <VsRow label="BE" sub="คาดการณ์ทั้งเดือน" cur={cur} base={goal.be} tgPct={tg.pct} />
          </>
        )}
        <VsRow label={base.split ? 'Base ปีก่อน (MTD)' : 'Base ปีก่อน'} sub={base.mtdLabel}
          cur={cur} base={base.hasPrev ? base.mtd[label] : 0} missing="ยังไม่มีข้อมูล" />
        {base.split && (
          <VsRow label="Base ปีก่อน (ทั้งเดือน)" sub={base.fullLabel}
            cur={cur} base={base.hasPrev ? base.full[label] : 0} tgPct={tg.pct} missing="ยังไม่มีข้อมูล" />
        )}
      </div>
      <p className="vs-foot">
        <b>Time gone {tg.pct.toFixed(1)}%</b> · % = MTD ÷ ยอดฐาน · ฐานทั้งเดือน (Target / BE / ปีก่อนทั้งเดือน) เขียวเมื่อ % ถึง Time gone · ปีก่อน (MTD) เขียวเมื่อ ≥ 100%
        {goal && goal.target && goal.be ? ` · BE เทียบ Target ${fmtPct(pctOf(goal.be, goal.target))}` : ''}
      </p>
      {note && <div className="note">{note}</div>}
    </section>
  );
}

// ── ตารางยอดสะสม / ค่าเฉลี่ย (ช่วงที่เลือก · 3 เดือน · 6 เดือน) แยก GIV / NIV ──
// จอเล็กแสดงเป็นการ์ดรายช่วง (ไม่มี scroll ด้านข้าง)
function PeriodTable({ metric, periods }: { metric: 'GIV' | 'NIV'; periods: PeriodStat[] }) {
  const isGiv = metric === 'GIV';
  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h3 className="card-title">{metric} · ยอดสะสมและค่าเฉลี่ย</h3>
          <p className="card-sub">{isGiv ? 'ยอดก่อนหักส่วนลด · เทียบ Base ปีก่อน / Target' : 'ยอดสุทธิ · เทียบ Base ปีก่อน'} · เฉลี่ย / เดือน = ยอดรวม ÷ จำนวนเดือน</p>
        </div>
      </header>
      <table className="rtable periods">
        <thead>
          <tr>
            <th>ช่วงเวลา</th>
            <th className="r">ยอดรวม</th>
            <th className="r">เฉลี่ย / เดือน</th>
            <th className="r">Base ปีก่อน · % เทียบ</th>
            {isGiv && <th className="r">Target · % เทียบ</th>}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => {
            const cur = p.cur[metric];
            const prev = p.prev[metric];
            const tPct = pctOf(cur, p.target);
            const yPct = p.hasPrev ? pctOf(cur, prev) : null;
            return (
              <tr key={p.label}>
                <td data-label="ช่วงเวลา">
                  <span className="stack left"><b>{p.label}</b><span className="muted">{p.range}{p.n > 1 ? ` · ${p.n} เดือน` : ''}</span></span>
                </td>
                <td data-label="ยอดรวม" className="r"><b className="num-lg">{fmtInt(cur)}</b></td>
                <td data-label="เฉลี่ย / เดือน" className="r">{p.n ? fmtInt(cur / p.n) : '–'}</td>
                <td data-label="Base ปีก่อน · % เทียบ" className="r" title={p.prevRange}>
                  <span className="stack">
                    <span>{p.hasPrev ? fmtInt(prev) : <span className="muted">ยังไม่มีข้อมูล</span>}</span>
                    {yPct == null ? <span className="muted">–</span> : <b className={`sc-chip ${yPct >= 100 ? 'up' : 'down'}`}>{fmtPct(yPct)}</b>}
                  </span>
                </td>
                {isGiv && (
                  <td data-label="Target · % เทียบ" className="r">
                    <span className="stack">
                      <span>{p.target ? fmtInt(p.target) : '–'}{!p.targetComplete && p.target ? <span className="warn-mark" title="บางเดือนในช่วงนี้ไม่มี Target ในชีต"> *</span> : null}</span>
                      <span className="pct-cell"><PaceBar pct={tPct} timeGonePct={p.tg.pct} size="sm" /><b style={{ color: paceColor(tPct, p.tg.pct) }}>{fmtPct(tPct)}</b></span>
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// ── การ์ดรายบริษัท: ยอด → เทียบ Target → เทียบปีก่อน → เฉลี่ยต่อเซลล์ ──
function CompanyCards({ stats, tg, hasPrev, prevLabel }: { stats: CompanyStat[]; tg: TimeGone; hasPrev: boolean; prevLabel: string }) {
  const totalGiv = stats.reduce((s, c) => s + c.cur.GIV, 0);
  return (
    <div className="grid-3">
      {stats.map((c) => {
        const tPct = pctOf(c.cur.GIV, c.target);
        const yPct = hasPrev ? pctOf(c.cur.GIV, c.prev.GIV) : null;
        return (
          <section className="card co" key={c.company} style={{ '--co-color': COMPANY_COLORS[c.company] } as React.CSSProperties}>
            <header className="co-head">
              <h3 className="co-name"><span className="dot" style={{ background: COMPANY_COLORS[c.company] }} />{c.company}</h3>
              <span className="pill" title="สัดส่วนยอดขาย = GIV ของบริษัท ÷ GIV รวมทุกบริษัท">สัดส่วน {totalGiv ? ((c.cur.GIV / totalGiv) * 100).toFixed(1) : '0.0'}%</span>
            </header>
            <div className="co-cols">
              <div className="co-col"><span className="eyebrow">GIV</span><span className="co-val">{fmtInt(c.cur.GIV)}</span></div>
              <div className="co-col"><span className="eyebrow">NIV</span><span className="co-val">{fmtInt(c.cur.NIV)}</span></div>
            </div>
            <div className="co-vs">
              <div className="co-vs-row">
                <span className="co-vs-name">vs Target</span>
                <span className="co-vs-num">{c.target ? fmtInt(c.target) : '–'}</span>
                <b className="co-vs-pct" style={{ color: paceColor(tPct, tg.pct) }}>{fmtPct(tPct)}</b>
                <span className="co-vs-bar"><PaceBar pct={tPct} timeGonePct={tg.pct} size="sm" /></span>
              </div>
              <div className="co-vs-row">
                <span className="co-vs-name" title={prevLabel}>vs ปีก่อน</span>
                <span className="co-vs-num">{hasPrev ? fmtInt(c.prev.GIV) : '–'}</span>
                {yPct == null ? <span className="co-vs-pct muted">–</span> : <b className={`co-vs-pct sc-chip ${yPct >= 100 ? 'up' : 'down'}`}>{fmtPct(yPct)}</b>}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ส่วน "ยอดสะสมและค่าเฉลี่ยย้อนหลัง" ซ่อนไว้ก่อนตามที่ขอ — เปลี่ยนเป็น true เพื่อแสดงอีกครั้ง
const SHOW_PERIODS = false;

// ── Page ──────────────────────────────────────────────────────────
export default async function SalesOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // ต้องเข้าสู่ระบบก่อน (ตรวจ cookie + พนักงานยังอยู่ในตาราง employees และ is_active)
  const me = await requireEmployee();
  const params = await searchParams;
  const companyFilter = companyFromParams(params);
  const byCompany = <T,>(rows: T[], co: (r: T) => string) =>
    companyFilter === 'all' ? rows : rows.filter((r) => normalizeCompany(co(r)) === companyFilter);

  let errorMessage: string | null = null;
  let targetError = null as string | null;
  // แถบเตือนข้อมูลไม่อัปเดต / เข้าไม่ครบ (ตรวจไม่สำเร็จก็ไม่ขวางหน้า)
  let healthIssues: HealthIssue[] = [];
  let months: string[] = [];
  let latestDate = '';
  let fromYM = '';
  let toYM = '';
  let rangeMonths: string[] = [];
  let trendMonths: string[] = [];
  let last3: string[] = [];
  let last6: string[] = [];
  const curByYM  = new Map<string, LG014SellerRow[]>();
  const prevByYM = new Map<string, LG014SellerRow[]>();
  let targetRows: TargetRow[] = [];
  let targetMonths: string[] = [];
  let scorecard: Scorecard | null = null;
  let princDetailPrev: BranchPrincRow[] | null = null;
  let princDetailPrevFull: BranchPrincRow[] | null = null; // ปีก่อนทั้งเดือน (Base)
  let sellerKpi: SellerKpi[] | null = null;
  let baseSplit = false;
  const prevFullByYM = new Map<string, LG014SellerRow[]>();
  // สัดส่วนยอดขาย: ยอดราย สาขา × เซลล์ × Princ (Princ แยกตามรหัสสินค้า) ไว้เจาะดูว่าสาขา / เซลล์ไหนขายดี
  let princDetail: BranchPrincRow[] | null = null;

  try {
    preloadTargets();
    [latestDate, months] = await Promise.all([getLatestDate(), getAvailableMonths()]);

    // ช่วงเดือนที่เลือก (ค่าเริ่มต้น = เดือนล่าสุด) ถ้าเลือกกลับด้านก็สลับให้
    ({ fromYM, toYM } = rangeFromParams(params, months, latestDate));

    rangeMonths = months.filter((m) => m >= fromYM && m <= toYM);
    // กราฟแนวโน้ม = เดือนในช่วงที่เลือก ถ้าเลือกน้อยกว่า 3 เดือนให้แสดง 6 เดือนล่าสุดถึงเดือนปลายทาง
    trendMonths = rangeMonths.length >= 3 ? rangeMonths : months.filter((m) => m <= toYM).slice(-6);
    // ย้อนหลัง 3 / 6 เดือน นับถึงเดือนปลายทางของ filter (รวมเดือนปัจจุบันแบบ MTD) เช่น ต.ค. → ส.ค.–ต.ค. / พ.ค.–ต.ค.
    last6 = months.filter((m) => m <= toYM).slice(-6);
    last3 = last6.slice(-3);
    const fetchMonths = Array.from(new Set([...rangeMonths, ...trendMonths, ...last6])).sort();

    // เดือนปัจจุบันยังไม่จบ → เทียบปีก่อนแค่วันที่เท่ากัน (เช่น 1–30 ต.ค. เทียบ 1–30 ต.ค.) ไม่งั้นเทียบกับทั้งเดือนแล้วติดลบเกินจริง
    const prevRange = (m: string) => {
      const r = monthToRange(shiftYM(m, 1));
      if (m === latestDate.slice(0, 7)) r.endDate = shiftYears(latestDate, 1);
      return r;
    };

    // ดึงรายเดือน (ปีนี้ + ปีก่อน) แล้วค่อยรวมเป็นช่วง — ตารางสรุปรายวันเร็วพอ และ cache ไว้ 5 นาที
    // ยอดรายสาขา: ช่วงที่เลือก (เดือนปัจจุบันนับถึงวันที่ข้อมูลล่าสุด) เทียบช่วงเดียวกันปีก่อน
    const monthEnd = addDays(monthToRange(toYM).endDate, 1);
    const rangeEnd = latestDate < monthEnd ? addDays(latestDate, 1) : monthEnd;
    const branchRange = { from: `${fromYM}-01`, to: rangeEnd };
    const branchPrev = lastYear(branchRange);
    const baseFullRange = lastYear({ from: branchRange.from, to: monthEnd }); // ปีก่อนทั้งเดือน
    // ช่วงที่เลือกมีเดือนปัจจุบัน → ดึงเดือนเดียวกันของปีก่อน "ทั้งเดือน" เพิ่ม (Base ทั้งเดือน)
    const latestYM = latestDate.slice(0, 7);
    baseSplit = rangeMonths.includes(latestYM);

    const [cur, prev, targets, sc, bp, bpPrev, health, fullPrev, skpi, bpPrevFull] = await Promise.all([
      Promise.all(fetchMonths.map((m) => getLG014Summary(monthToRange(m)))),
      Promise.all(fetchMonths.map((m) => getLG014Summary(prevRange(m)))),
      getTargets(fetchMonths[0] ?? fromYM, toYM).catch((err: unknown) => {
        targetError = err instanceof Error ? err.message : 'อ่าน Target ไม่สำเร็จ';
        return { rows: [] as TargetRow[], months: [] as string[], updatedAt: '' };
      }),
      // Scorecard รายบริษัท (ยอดรวมหลายช่วง + ตัวชี้วัดระดับร้านค้า)
      loadScorecard({
        toYM, fromYM, latestDate, months,
        companies: companyFilter === 'all' ? COMPANY_ORDER : [companyFilter],
      }),
      getBranchPrinc(branchRange.from, branchRange.to).catch(() => null),
      getBranchPrinc(branchPrev.from, branchPrev.to).catch(() => null),
      checkHealth(latestDate).catch(() => null),
      baseSplit ? getLG014Summary(monthToRange(shiftYM(latestYM, 1))) : Promise.resolve(null),
      // ตัวชี้วัดรายเซลล์ของเดือนปลายทาง (Scorecard แยก Credit / Van)
      getSellerKpi(`${toYM}-01`, rangeEnd).catch(() => null),
      // Base ทั้งเดือนของปีก่อน ราย สาขา × เซลล์ × Princ (หน้าต่างเจาะดู Principal) — ช่วงที่จบเดือนแล้วใช้ชุดเดียวกับ bpPrev
      baseSplit ? getBranchPrinc(baseFullRange.from, baseFullRange.to).catch(() => null) : Promise.resolve(undefined),
    ]);
    princDetail = bp;
    princDetailPrev = bpPrev;
    princDetailPrevFull = bpPrevFull === undefined ? bpPrev : bpPrevFull;
    sellerKpi = skpi;
    healthIssues = health?.issues ?? [];
    scorecard = sc;
    fetchMonths.forEach((m, i) => {
      curByYM.set(m, cur[i].bySeller);
      prevByYM.set(m, prev[i].bySeller);
      // ปีก่อนแบบ "ทั้งเดือน": เดือนปัจจุบันใช้ชุดที่ดึงเพิ่ม เดือนอื่นเท่ากับชุดปกติ
      prevFullByYM.set(m, m === latestYM && fullPrev ? fullPrev.bySeller : prev[i].bySeller);
    });
    targetRows   = targets.rows;
    targetMonths = targets.months;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
  }

  const pick = (map: Map<string, LG014SellerRow[]>, ms: string[]) =>
    byCompany(mergeSellers(ms.map((m) => map.get(m) ?? [])), (r) => r.Company);
  const targetsIn = (ms: string[]) => byCompany(targetRows.filter((t) => ms.includes(t.ym)), (r) => r.company);

  const curRows  = pick(curByYM, rangeMonths);
  const prevRows = pick(prevByYM, rangeMonths);
  const targets  = targetsIn(rangeMonths);

  const trendPoints: TrendPoint[] = trendMonths.map((m) => ({
    month: m,
    ...sumGIVNIV(byCompany(curByYM.get(m) ?? [], (r) => r.Company)),
  }));

  const grandCurrent  = sumGIVNIV(curRows);
  const grandPrevious = sumGIVNIV(prevRows);
  const grandTarget   = sumTargets(targets);
  // เดือนที่ปีก่อนไม่มีข้อมูลให้บอกว่า "ยังไม่มีข้อมูล" แทนการโชว์ 0
  const hasPrev = prevRows.length > 0;
  // Time gone นับถึงเมื่อวาน (ยอดขายเข้าช้า 1 วัน) เริ่มนับวันที่ 3 — ดู lib/workdays
  const tg = timeGone(rangeMonths);

  const rangeLabel     = fromYM ? formatRange(fromYM, toYM) : '';
  // ช่วงที่รวมเดือนปัจจุบัน (ยังไม่จบเดือน) ให้บอกวันที่ตัดด้วย เช่น "ต.ค. 2025 (ถึง 30/10/2025)"
  const prevLabelOf = (ms: string[]) => !ms.length ? '' :
    formatRange(shiftYM(ms[0], 1), shiftYM(ms[ms.length - 1], 1)) +
    (ms[ms.length - 1] === latestDate.slice(0, 7) ? ` (ถึง ${formatDate(shiftYears(latestDate, 1))})` : '');
  const prevRangeLabel = prevLabelOf(rangeMonths);
  const baseStat: BaseStat = {
    mtd: grandPrevious,
    full: sumGIVNIV(pick(prevFullByYM, rangeMonths)),
    mtdLabel: prevRangeLabel,
    fullLabel: rangeMonths.length ? `${formatRange(shiftYM(rangeMonths[0], 1), shiftYM(rangeMonths[rangeMonths.length - 1], 1))} เต็มเดือน` : '',
    hasPrev,
    split: baseSplit,
  };
  const missingTargetMonths = rangeMonths.filter((m) => !targetMonths.includes(m));
  const targetNote = targetError
    ? `อ่าน Target ไม่สำเร็จ: ${targetError}`
    : missingTargetMonths.length > 0
      ? `ไม่มี Target ในชีตของเดือน ${missingTargetMonths.map(formatThaiMonth).join(', ')}`
      : null;

  // ── ยอดสะสม / ค่าเฉลี่ย: ช่วงที่เลือก, 3 เดือน, 6 เดือน ──
  const periodStats = (label: string, ms: string[]): PeriodStat => {
    const prevList = pick(prevByYM, ms);
    const t = sumTargets(targetsIn(ms));
    return {
      label,
      range: ms.length ? formatRange(ms[0], ms[ms.length - 1]) : '–',
      prevRange: prevLabelOf(ms),
      n: ms.length,
      cur: sumGIVNIV(pick(curByYM, ms)),
      prev: sumGIVNIV(prevList),
      hasPrev: prevList.length > 0,
      target: t.target,
      be: t.be,
      tg: timeGone(ms),
      targetComplete: ms.every((m) => targetMonths.includes(m)),
    };
  };
  const periods = [
    periodStats(`ช่วงที่เลือก`, rangeMonths),
    periodStats('3 เดือนล่าสุด', last3),
    periodStats('6 เดือนล่าสุด', last6),
  ];

  // ── รายบริษัท ──
  const companies = companyFilter === 'all' ? COMPANY_ORDER : [companyFilter];
  const companyStats: CompanyStat[] = companies.map((co) => {
    const of = <T,>(rows: T[], get: (r: T) => string) => rows.filter((r) => normalizeCompany(get(r)) === co);
    const t = sumTargets(of(targets, (r) => r.company));
    const mine = of(curRows, (r) => r.Company);
    return {
      company: co,
      cur: sumGIVNIV(mine),
      prev: sumGIVNIV(of(prevRows, (r) => r.Company)),
      target: t.target,
      be: t.be,
      sellers: mine.filter((r) => Math.abs(r.GIV) >= 1).length, // เซลล์ที่มียอดขายในช่วง
    };
  });

  const princRows: CompanyPrincRow[] = curRows.map((r) => ({ company: r.Company, princ: r.Princ, giv: r.GIV, niv: r.NIV }));
  // ชื่อเซลล์จากชีต (เดือนล่าสุดชนะ) — SDO ในชีตเป็นรหัสเขต จึงอาจไม่มีชื่อ
  // สาขาของเซลล์ PDC / DC ตามชีต (key "เซลล์|princ" และ "เซลล์") — ใช้แทนสาขาที่ออกบิล เหมือนหน้ายอดขายรายทีม
  const sellerNames: Record<string, string> = {};
  const sellerChannels: Record<string, string> = {}; // ประเภทเซลล์ตามคอลัมน์ Channel ในชีต เช่น VAN / CREDIT / PRESALE
  const sheetBranch: Record<string, string> = {};
  for (const t of [...targetRows].sort((a, b) => a.ym.localeCompare(b.ym))) {
    if (t.name) sellerNames[t.seller] = t.name;
    if (t.channel) sellerChannels[t.seller] = t.channel.toUpperCase();
    if (t.branch && normalizeCompany(t.company) !== 'SDO') {
      sheetBranch[`${t.seller}|${t.principal}`] = t.branch;
      sheetBranch[t.seller] = t.branch;
    }
  }
  const toSheetBranch = (rows: BranchPrincRow[] | null) => rows?.map((r) => ({
    ...r,
    branch: r.company === 'SDO' ? r.branch : sheetBranch[`${r.seller}|${r.principal}`] ?? sheetBranch[r.seller] ?? r.branch,
  })) ?? null;
  const princDetailRows = toSheetBranch(princDetail);
  // ปีก่อนจัดสาขาด้วยโครงสร้างปัจจุบันเหมือนกัน → เทียบสาขาเดียวกันได้ตรง
  const princDetailPrevRows = toSheetBranch(princDetailPrev) ?? [];
  const princDetailBaseRows = toSheetBranch(princDetailPrevFull) ?? [];
  // Base ทั้งเดือนของปีก่อน รายบริษัท (การ์ดในสัดส่วนยอดขาย)
  const baseFullRows = pick(prevFullByYM, rangeMonths);
  const baseFullOf = (co: string) => sumGIVNIV(baseFullRows.filter((r) => normalizeCompany(r.Company) === co));
  const branchTargets: BranchTarget[] = targets.map((t) => ({
    company: normalizeCompany(t.company), branch: t.branch, principal: t.principal, target: t.target, be: t.be,
  }));
  // Target รายเซลล์ × Princ (หน้าต่างเจาะดู Principal) — SDO ในชีตเป็นรหัสเขต จึงจับคู่รายคนไม่ได้
  const sellerTargets: SellerTarget[] = targets.map((t) => ({
    company: normalizeCompany(t.company), seller: t.seller, principal: t.principal, target: t.target,
  }));

  // ── Scorecard: การเข้าพบ แยกประเภทเซลล์ (Credit / Van / Presale) ──
  const typeStats: Record<string, TypeStat[]> | null = sellerKpi && Object.fromEntries(companies.map((co) => {
    const by = new Map<SellerType, TypeStat>();
    for (const r of sellerKpi!.filter((x) => x.company === co)) {
      const type = sellerTypeOf(co, r.seller, sellerChannels);
      const s = by.get(type) ?? { type, sellers: 0, sellerDays: 0, bills: 0, lines: 0, giv: 0, niv: 0 };
      if (r.bills > 0) s.sellers += 1;
      s.sellerDays += r.workDays;
      s.bills += r.bills;
      s.lines += co === 'SDO' ? r.lines : r.linesGt1; // PDC / DC นับเฉพาะบรรทัดยอด > 1 บาท
      s.giv += r.giv;
      s.niv += r.niv;
      by.set(type, s);
    }
    return [co, SELLER_TYPES.map((t) => by.get(t)).filter((x): x is TypeStat => !!x)];
  }));
  const ymRange = (r: { from: string; to: string }) => formatRange(r.from.slice(0, 7), addDays(r.to, -1).slice(0, 7));

  return (
    <>

      <LoadingDone error={errorMessage} />
      <Hero
        crumb="แดชบอร์ด / ภาพรวมยอดขาย"
        title="ภาพรวมยอดขาย"
        subtitle={`${rangeLabel}${companyFilter !== 'all' ? ` · ${companyFilter}` : ' · SDO / PDC / DC'}`}
        chips={[...(!errorMessage ? [`Time gone ${tg.pct.toFixed(1)}%`] : []), ...(latestDate ? [`ข้อมูลถึง ${formatDate(latestDate)}`] : [])]}
      />

        <main className="container">
          {/* ─── Filter (วางทับขอบล่างของ hero) ─── */}
          <RangeFilter months={months} fromYM={fromYM} toYM={toYM} company={companyFilter} />
          <HealthBanner issues={healthIssues} showLink={me.role === 'admin'} />

          {errorMessage && <p className="empty">โหลดข้อมูลไม่สำเร็จ — ลองกดค้นหาอีกครั้ง</p>}

          {!errorMessage && (
            <>
              <div className="section" style={{ gap: 24 }}>
                {/* ─── 1. Target → Base → Time gone ─── */}
                <PaceStrip tg={tg} giv={grandCurrent.GIV} target={grandTarget.target} base={baseStat} />

                {/* ─── 2. GIV / NIV เทียบ Target / BE / Base ─── */}
                <div className="grid-2">
                  <MetricCard label="GIV" sub="ยอดก่อนหักส่วนลด" cur={grandCurrent.GIV} base={baseStat}
                    goal={{ target: grandTarget.target, be: grandTarget.be }} tg={tg} note={targetNote} />
                  <MetricCard label="NIV" sub="ยอดสุทธิ" cur={grandCurrent.NIV} base={baseStat} tg={tg} />
                </div>

                {/* ─── 3. รายบริษัท ─── */}
                <div className="section">
                  <div className="section-title"><h2>ยอดขายแยกตามบริษัท</h2><span>{rangeLabel} · vs Target · vs ปีก่อน {prevRangeLabel}</span></div>
                  <CompanyCards stats={companyStats} tg={tg} hasPrev={hasPrev} prevLabel={prevRangeLabel} />
                </div>

                {/* ─── 4. สัดส่วน บริษัท → Principal → กดเจาะดูสาขา / เซลล์ ─── */}
                <CompanyShare rows={princRows} companies={companies} detail={princDetailRows} sellerNames={sellerNames} sellerChannels={sellerChannels}
                  coStats={Object.fromEntries(companyStats.map((c) => {
                    const b = baseFullOf(c.company);
                    return [c.company, { target: c.target, prev: { giv: b.GIV, niv: b.NIV }, sellers: c.sellers }];
                  }))}
                  nMonths={rangeMonths.length} hasPrev={hasPrev} prevLabel={prevRangeLabel}
                  targets={branchTargets} prevDetail={princDetailBaseRows} baseLabel={baseStat.fullLabel}
                  sellerTargets={sellerTargets} timeGonePct={tg.pct} />

                {/* ─── 5. ยอดขายรายสาขา ─── */}
                <div className="section">
                  <div className="section-title"><h2>ยอดขายรายสาขา</h2><span>{rangeLabel} · Time gone {tg.pct.toFixed(1)}%</span></div>
                  {princDetailRows ? (
                    <BranchSales cur={princDetailRows} prev={princDetailPrevRows} base={princDetailBaseRows} baseLabel={baseStat.fullLabel} targets={branchTargets} companies={companies}
                      curLabel={rangeLabel} prevLabel={prevRangeLabel} nMonths={rangeMonths.length} timeGonePct={tg.pct} />
                  ) : (
                    <p className="empty">รอข้อมูลรายสาขา — รัน supabase/princ_store.sql ใน Supabase ก่อน</p>
                  )}
                </div>

                {/* ─── 6. Scorecard รายบริษัท ─── */}
                {scorecard && (
                  <div className="section">
                    <div className="section-title"><h2>Scorecard รายบริษัท</h2><span>SDO / PDC / DC · ตามนิยาม KPI ฝ่ายขาย</span></div>
                    <ScorecardView
                      sc={scorecard}
                      companies={companies}
                      targets={Object.fromEntries(companies.map((co) => [co, sumTargets(targetRows.filter((t) => t.ym === toYM && normalizeCompany(t.company) === co))]))}
                      tg={timeGone([toYM])}
                      rangeLabel={rangeLabel}
                      monthLabel={formatThaiMonth(toYM) + (toYM === latestDate.slice(0, 7) ? ` (ถึง ${formatDate(latestDate)})` : '')}
                      labels={{
                        cy: ymRange(scorecard.ranges.cy), fy: ymRange(scorecard.ranges.fy),
                        p3: ymRange(scorecard.ranges.p3), p6: ymRange(scorecard.ranges.p6), storesP3: ymRange(scorecard.ranges.storesP3),
                      }}
                      typeStats={typeStats}
                      maxRangeMonths={MAX_RANGE_MONTHS}
                    />
                  </div>
                )}

                {/* ─── ยอดสะสม / ค่าเฉลี่ย 3 · 6 เดือน — ซ่อนไว้ก่อน (เปิดด้วย SHOW_PERIODS) ─── */}
                {SHOW_PERIODS && (
                <div className="section">
                  <div className="section-title">
                    <h2>ยอดสะสมและค่าเฉลี่ยย้อนหลัง</h2>
                    <span>นับถึง {formatThaiMonth(toYM)} · เดือนปัจจุบันนับถึง {formatDate(latestDate)} (MTD)</span>
                  </div>
                  <PeriodTable metric="GIV" periods={periods} />
                  <PeriodTable metric="NIV" periods={periods} />
                </div>

                )}

                {/* ─── 7. แนวโน้ม ─── */}
                <section className="card">
                  <header className="card-head">
                    <div>
                      <h3 className="card-title">แนวโน้มยอดขายรายเดือน</h3>
                      <p className="card-sub">{trendMonths.length > 0 ? formatRange(trendMonths[0], trendMonths[trendMonths.length - 1]) : ''} · บาท</p>
                    </div>
                  </header>
                  <TrendLineChart points={trendPoints} />
                </section>

              </div>
            </>
          )}
        </main>
    </>
  );
}
