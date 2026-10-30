import {
  getLG014Summary,
  getLatestDate,
  getAvailableMonths,
  monthToRange,
  shiftYears,
  addDays,
  LG014SellerRow,
} from '@/app/lib/api';
import { getTargets, preloadTargets, TargetRow } from '@/app/lib/targets';
import { timeGone, TimeGone } from '@/app/lib/workdays';
import { loadScorecard, Scorecard, CompanyScore, MAX_RANGE_MONTHS } from '@/app/lib/scorecard';
import {
  COMPANY_COLORS, fmtInt, fmtNum, fmtPct, fmtShort, paceColor, pctGrowth, pctOf,
} from '@/app/lib/format';
import { Growth, PaceBar, PaceChip } from '@/app/components/ui';
import { LoadingDone } from '@/app/components/Loading';
import { requireEmployee } from '@/app/lib/session';
import CompanyShare, { CompanyPrincRow } from '@/app/components/CompanyShare';
import {
  COMPANY_ORDER, companyFromParams, formatDate, formatRange, formatThaiMonth, monthAbbr,
  normalizeCompany, rangeFromParams, shiftYM,
} from '@/app/lib/period';
import { Hero, RangeFilter } from './parts';

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
type CompanyStat = { company: string; cur: GivNiv; prev: GivNiv; target: number; be: number };

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
const IconGauge = () => <Svg><path d="M4 18a8 8 0 1 1 16 0" /><path d="M12 18l4-6" /></Svg>;
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

// ยอดที่ยังขาด หรือเกินแล้ว
function fmtGap(goal: number, actual: number) {
  if (!goal) return '–';
  const gap = goal - actual;
  return gap > 0 ? `ขาดอีก ${fmtNum(gap)}` : `เกินแล้ว ${fmtNum(-gap)}`;
}

// ── KPI แถวบน: Time gone เทียบยอดที่ทำได้ ──
function PaceStrip({ tg, giv, target }: { tg: TimeGone; giv: number; target: number }) {
  const achieved = pctOf(giv, target);
  const gapPts = achieved == null ? null : achieved - tg.pct;
  // คาดการณ์สิ้นช่วง = ยอดตอนนี้ ÷ สัดส่วนวันทำงานที่ผ่านไป (run-rate)
  const projected = tg.pct > 0 && tg.pct < 100 ? giv / (tg.pct / 100) : null;
  const projPct = projected != null ? pctOf(projected, target) : null;
  return (
    <section className="card kpis">
      <div className="kpi">
        <span className="kpi-top"><span className="kpi-ic"><IconClock /></span><span className="eyebrow">Time gone</span></span>
        <span className="kpi-val">{tg.pct.toFixed(1)}%</span>
        <span className="bar bar-sm"><span className="bar-fill" style={{ width: `${Math.min(tg.pct, 100)}%`, background: 'var(--primary)' }} /></span>
        <span className="kpi-cap">{tg.elapsed} จาก {tg.total} วันทำงาน (จ.–ส.)</span>
      </div>
      <div className="kpi">
        <span className="kpi-top"><span className="kpi-ic"><IconTarget /></span><span className="eyebrow">GIV ถึง Target</span></span>
        <span className="kpi-val" style={{ color: paceColor(achieved, tg.pct) }}>{fmtPct(achieved)}</span>
        <PaceBar pct={achieved} timeGonePct={tg.pct} size="sm" />
        <span className="kpi-cap">{fmtShort(giv)} จาก {target ? fmtShort(target) : '–'}</span>
      </div>
      <div className="kpi">
        <span className="kpi-top"><span className="kpi-ic"><IconGauge /></span><span className="eyebrow">เทียบ Time gone</span></span>
        <span className="kpi-val" style={{ color: paceColor(achieved, tg.pct) }}>
          {gapPts == null ? '–' : `${gapPts >= 0 ? '+' : ''}${gapPts.toFixed(1)} pts`}
        </span>
        <span><PaceChip pct={achieved} timeGonePct={tg.pct} /></span>
        <span className="kpi-cap">ยอดที่ทำได้ เทียบเวลาที่ผ่านไป</span>
      </div>
      <div className="kpi">
        <span className="kpi-top"><span className="kpi-ic"><IconTrend /></span><span className="eyebrow">คาดการณ์ GIV (run-rate)</span></span>
        <span className="kpi-val">{projected != null ? fmtShort(projected) : 'ครบช่วงแล้ว'}</span>
        <span className="kpi-cap">{projPct != null ? `≈ ${projPct.toFixed(1)}% ของ Target` : 'ไม่มีวันทำงานเหลือ'}</span>
      </div>
    </section>
  );
}

function MetricCard({
  label, sub, cur, prev, hasPrev, prevLabel, children,
}: {
  label: string; sub: string;
  cur: number; prev: number; hasPrev: boolean; prevLabel: string;
  children?: React.ReactNode;
}) {
  const diff = cur - prev;
  return (
    <section className="card metric">
      <header className="metric-head">
        <h3 className={`metric-name metric-${label.toLowerCase()}`}>{label}</h3>
        <span className="card-sub">{sub}</span>
      </header>
      <div className="metric-val">{fmtNum(cur)}</div>
      <div className="card-sub">บาท</div>

      <dl className="rows">
        <div className="rows-title eyebrow">เทียบปีก่อน · {prevLabel}</div>
        <div className="row"><dt>Base ปีก่อน</dt><dd className={hasPrev ? '' : 'muted'}>{hasPrev ? fmtNum(prev) : 'ยังไม่มีข้อมูล'}</dd></div>
        <div className="row"><dt>ส่วนต่าง</dt><dd>{hasPrev ? `${diff >= 0 ? '+' : ''}${fmtNum(diff)}` : '–'}</dd></div>
        <div className="row"><dt>เติบโต (YoY)</dt><dd><Growth pct={hasPrev ? pctGrowth(cur, prev) : null} /></dd></div>
      </dl>
      {children}
    </section>
  );
}

// Target / BE ในชีตตั้งเป็นยอด GIV จึงมีเฉพาะการ์ด GIV
function GivTargetGroup({ giv, target, be, note, tg }: { giv: number; target: number; be: number; note: string | null; tg: TimeGone }) {
  const pct = pctOf(giv, target);
  const bePct = pctOf(giv, be);
  return (
    <dl className="rows">
      <div className="rows-title eyebrow">เทียบเป้า · Google Sheet</div>
      <div className="row"><dt>Target</dt><dd>{target ? fmtNum(target) : '–'}</dd></div>
      <div className="row row-bar">
        <dt>GIV ถึง Target</dt>
        <dd><PaceBar pct={pct} timeGonePct={tg.pct} /><b style={{ color: paceColor(pct, tg.pct) }}>{fmtPct(pct)}</b></dd>
      </div>
      <div className="row"><dt>BE (คาดการณ์)</dt><dd>{be ? fmtNum(be) : '–'}</dd></div>
      <div className="row row-bar">
        <dt>GIV ถึง BE</dt>
        <dd><PaceBar pct={bePct} timeGonePct={tg.pct} /><b style={{ color: paceColor(bePct, tg.pct) }}>{fmtPct(bePct)}</b></dd>
      </div>
      <div className="row"><dt>BE เทียบ Target</dt><dd>{fmtPct(pctOf(be, target))}</dd></div>
      <div className="row"><dt>GIV เทียบ Target</dt><dd>{fmtGap(target, giv)}</dd></div>
      <div className="row"><dt>GIV เทียบ BE</dt><dd>{fmtGap(be, giv)}</dd></div>
      {note && <div className="note">{note}</div>}
    </dl>
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
          <p className="card-sub">{isGiv ? 'ยอดก่อนหักส่วนลด · เทียบ Base ปีก่อน / Target / BE' : 'ยอดสุทธิ · เทียบ Base ปีก่อน'}</p>
        </div>
      </header>
      <table className="rtable periods">
        <thead>
          <tr>
            <th>ช่วงเวลา</th>
            <th className="r">ยอดรวม</th>
            <th className="r">เฉลี่ย / เดือน</th>
            <th className="r">Base ปีก่อน · YoY</th>
            {isGiv && <>
              <th className="r">Target · % ถึง</th>
              <th className="r">BE · % ถึง</th>
              <th className="r">Time gone</th>
            </>}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => {
            const cur = p.cur[metric];
            const prev = p.prev[metric];
            const tPct = pctOf(cur, p.target);
            const bPct = pctOf(cur, p.be);
            return (
              <tr key={p.label}>
                <td data-label="ช่วงเวลา">
                  <span className="stack left"><b>{p.label}</b><span className="muted">{p.range}{p.n > 1 ? ` · ${p.n} เดือน` : ''}</span></span>
                </td>
                <td data-label="ยอดรวม" className="r"><b className="num-lg">{fmtInt(cur)}</b></td>
                <td data-label="เฉลี่ย / เดือน" className="r">{p.n ? fmtInt(cur / p.n) : '–'}</td>
                <td data-label="Base ปีก่อน · YoY" className="r" title={p.prevRange}>
                  <span className="stack"><span className="muted">{p.hasPrev ? fmtInt(prev) : 'ยังไม่มีข้อมูล'}</span><Growth pct={p.hasPrev ? pctGrowth(cur, prev) : null} /></span>
                </td>
                {isGiv && <>
                  <td data-label="Target · % ถึง" className="r">
                    <span className="stack">
                      <span>{p.target ? fmtInt(p.target) : '–'}{!p.targetComplete && p.target ? <span className="warn-mark" title="บางเดือนในช่วงนี้ไม่มี Target ในชีต"> *</span> : null}</span>
                      <span className="pct-cell"><PaceBar pct={tPct} timeGonePct={p.tg.pct} size="sm" /><b style={{ color: paceColor(tPct, p.tg.pct) }}>{fmtPct(tPct)}</b></span>
                    </span>
                  </td>
                  <td data-label="BE · % ถึง" className="r">
                    <span className="stack">
                      <span>{p.be ? fmtInt(p.be) : '–'}</span>
                      <span className="pct-cell"><PaceBar pct={bPct} timeGonePct={p.tg.pct} size="sm" /><b style={{ color: paceColor(bPct, p.tg.pct) }}>{fmtPct(bPct)}</b></span>
                    </span>
                  </td>
                  <td data-label="Time gone" className="r muted">{p.tg.pct.toFixed(1)}%</td>
                </>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// ── การ์ดรายบริษัท: ตัวเลขชัด ๆ แทนกราฟแท่ง ──
function CompanyCards({ stats, tg, hasPrev }: { stats: CompanyStat[]; tg: TimeGone; hasPrev: boolean }) {
  const totalGiv = stats.reduce((s, c) => s + c.cur.GIV, 0);
  return (
    <div className="grid-3">
      {stats.map((c) => {
        const tPct = pctOf(c.cur.GIV, c.target);
        const bPct = pctOf(c.cur.GIV, c.be);
        const col = (key: 'GIV' | 'NIV') => (
          <div className="co-col">
            <span className="eyebrow">{key}</span>
            <span className="co-val">{fmtNum(c.cur[key])}</span>
            <span className="co-sub">
              <span className="muted">ปีก่อน {hasPrev ? fmtShort(c.prev[key]) : '–'}</span>
              <Growth pct={hasPrev ? pctGrowth(c.cur[key], c.prev[key]) : null} />
            </span>
          </div>
        );
        return (
          <section className="card co" key={c.company} style={{ '--co-color': COMPANY_COLORS[c.company] } as React.CSSProperties}>
            <header className="co-head">
              <h3 className="co-name"><span className="dot" style={{ background: COMPANY_COLORS[c.company] }} />{c.company}</h3>
              <span className="pill">{totalGiv ? ((c.cur.GIV / totalGiv) * 100).toFixed(1) : '0.0'}% ของ GIV</span>
            </header>
            <div className="co-cols">{col('GIV')}{col('NIV')}</div>
            <dl className="rows">
              <div className="row row-bar">
                <dt>ถึง Target {c.target ? fmtShort(c.target) : '–'}</dt>
                <dd><PaceBar pct={tPct} timeGonePct={tg.pct} size="sm" /><b style={{ color: paceColor(tPct, tg.pct) }}>{fmtPct(tPct)}</b></dd>
              </div>
              <div className="row row-bar">
                <dt>ถึง BE {c.be ? fmtShort(c.be) : '–'}</dt>
                <dd><PaceBar pct={bPct} timeGonePct={tg.pct} size="sm" /><b style={{ color: paceColor(bPct, tg.pct) }}>{fmtPct(bPct)}</b></dd>
              </div>
            </dl>
          </section>
        );
      })}
    </div>
  );
}

// ── Scorecard รายบริษัท (SDO | PDC | DC) ตามนิยามในไฟล์ KPI ฝ่ายขาย ──
const ratio = (cur: number | undefined, base: number | undefined) => (cur != null && base ? (cur / base) * 100 : null);
const div = (a: number | undefined, b: number | undefined) => (a != null && b ? a / b : null);
const fmt1 = (n: number | null) => (n == null ? '–' : n.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const fmt0 = (n: number | null) => (n == null ? '–' : Math.round(n).toLocaleString('th-TH'));

// % เทียบฐาน (ยอด ÷ ฐาน): ≥ 100% เขียว ▲ / ต่ำกว่า แดง ▼
function RatioLine({ label, pct }: { label: string; pct: number | null }) {
  return (
    <span className="sc-line">
      <span className="muted">{label}</span>
      {pct == null ? <span className="muted">–</span> : <b className={pct >= 100 ? 'growth-up' : 'growth-down'}>{pct >= 100 ? '▲' : '▼'} {pct.toFixed(1)}%</b>}
    </span>
  );
}

// ยอดจริง / ยอดฐาน + % (Sales vs Base / vs YA)
function CompareLine({ label, cur, base }: { label: string; cur: number | undefined; base: number | undefined }) {
  const pct = ratio(cur, base);
  return (
    <span className="sc-cmp">
      <span className="sc-line">
        <span className="muted">{label}</span>
        {pct == null ? <span className="muted">–</span> : <b className={pct >= 100 ? 'growth-up' : 'growth-down'}>{pct >= 100 ? '▲' : '▼'} {pct.toFixed(1)}%</b>}
      </span>
      <span className="sc-nums">
        <b>{cur == null ? '–' : fmtShort(cur)}</b>
        <span className="muted"> / {base ? fmtShort(base) : 'ไม่มีข้อมูล'}</span>
      </span>
    </span>
  );
}

type ScoreRow = { key: string; label: string; note?: string; cell: (s: CompanyScore, co: string) => React.ReactNode };

function ScorecardTable({
  sc, companies, targets, tg, ymLabel, rangeLabel, monthLabel,
}: {
  sc: Scorecard; companies: string[]; targets: Record<string, { target: number; be: number }>;
  tg: TimeGone; ymLabel: (from: string, toExclusive: string) => string; rangeLabel: string; monthLabel: string;
}) {
  const wait = <span className="muted">{sc.kpiReady ? '–' : 'รอข้อมูล'}</span>;
  const R = sc.ranges;
  const rows: ScoreRow[] = [
    {
      key: 'stores', label: 'Active Stores',
      note: `SDO: P3 ${ymLabel(R.storesP3.from, R.storesP3.to)} · PDC/DC: P1 ${monthLabel} (ยอด > 0, ไม่นับ RFCCA) · Coverage รอข้อมูล`,
      cell: (s) => s.storesActive ? <b className="sc-big">{fmt0(s.storesActive.active_stores)} ร้าน</b> : wait,
    },
    {
      key: 'target', label: 'Sales vs Target', note: `${monthLabel} · Target ตั้งเป็นยอด GIV`,
      cell: (s, co) => {
        const tPct = pctOf(s.month?.giv ?? 0, targets[co]?.target ?? 0);
        return (
          <span className="sc-stack">
            <span className="sc-line"><b className="sc-big" style={{ color: paceColor(tPct, tg.pct) }}>{fmtPct(tPct)}</b><span className="muted">{fmtShort(s.month?.giv ?? 0)} / {targets[co]?.target ? fmtShort(targets[co].target) : '–'}</span></span>
            <PaceBar pct={tPct} timeGonePct={tg.pct} size="sm" />
          </span>
        );
      },
    },
    {
      key: 'base', label: 'Sales vs Base', note: `${monthLabel} เทียบเดือนเดียวกันปีก่อน (ถึงวันเดียวกัน)`,
      cell: (s) => (
        <span className="sc-stack">
          <CompareLine label="GIV" cur={s.month?.giv} base={s.base?.giv} />
          <CompareLine label="NIV" cur={s.month?.niv} base={s.base?.niv} />
        </span>
      ),
    },
    {
      key: 'fy', label: 'Sales vs YA (FYTD)', note: `ปีงบ P&G เริ่ม ก.ค. · ${ymLabel(R.fy.from, R.fy.to)} · ใช้กับ SDO`,
      cell: (s, co) => co !== 'SDO' ? <span className="muted">ไม่ใช้</span> : (
        <span className="sc-stack">
          <CompareLine label="GIV" cur={s.fy.cur?.giv} base={s.fy.prev?.giv} />
          <CompareLine label="NIV" cur={s.fy.cur?.niv} base={s.fy.prev?.niv} />
        </span>
      ),
    },
    {
      key: 'cy', label: 'Sales vs YA (CY)', note: `ต้นปี → ปัจจุบัน · ${ymLabel(R.cy.from, R.cy.to)}`,
      cell: (s) => (
        <span className="sc-stack">
          <CompareLine label="GIV" cur={s.cy.cur?.giv} base={s.cy.prev?.giv} />
          <CompareLine label="NIV" cur={s.cy.cur?.niv} base={s.cy.prev?.niv} />
        </span>
      ),
    },
    ...(['p3', 'p6'] as const).map((p): ScoreRow => ({
      key: p, label: `Sales ${p.toUpperCase()}`, note: `เฉลี่ยต่อเดือน ${ymLabel(R[p].from, R[p].to)} · % = เดือนนี้เทียบค่าเฉลี่ย`,
      cell: (s) => {
        const n = p === 'p3' ? s.p3Months : s.p6Months;
        const avg = (k: 'giv' | 'niv') => (s[p] && n ? s[p]![k] / n : null);
        return (
          <span className="sc-stack">
            <span className="sc-line"><span className="muted">GIV</span><b>{avg('giv') == null ? '–' : fmtShort(avg('giv')!)}</b></span>
            <span className="sc-line"><span className="muted">NIV</span><b>{avg('niv') == null ? '–' : fmtShort(avg('niv')!)}</b></span>
            <RatioLine label="เดือนนี้ (GIV)" pct={ratio(s.month?.giv, avg('giv') ?? undefined)} />
          </span>
        );
      },
    })),
    {
      key: 'tg', label: 'Timegone %', note: 'วันทำงาน จ.–ส. ที่ผ่านไป / ทั้งเดือน (ยังไม่มี RoutePlan)',
      cell: () => <span className="sc-stack"><b className="sc-big">{tg.pct.toFixed(1)}%</b><span className="muted">{tg.elapsed} / {tg.total} วัน</span></span>,
    },
    {
      key: 'days', label: 'วันทำงาน (ตามวันที่ Invoice)', note: 'นับจำนวนวันที่มี Invoice',
      cell: (s) => s.kpiMonth ? <b className="sc-big">{s.kpiMonth.work_days} วัน</b> : wait,
    },
    {
      key: 'calls', label: 'Productive Call', note: 'จำนวนบิลขาย · Target (KPI DSR) รอข้อมูล',
      cell: (s) => <b className="sc-big">{fmt0(s.month?.bills ?? null)} บิล</b>,
    },
    {
      key: 'avgcall', label: 'Avg.Call/Day', note: 'บิล ÷ วันที่มี Invoice',
      cell: (s) => s.kpiMonth ? <b className="sc-big">{fmt1(div(s.month?.bills, s.kpiMonth.work_days))}</b> : wait,
    },
    {
      key: 'line', label: 'Line/Bill', note: 'SDO: ทุกบรรทัด · PDC/DC: เฉพาะบรรทัดยอด > 1 บาท',
      cell: (s, co) => {
        const lines = co === 'SDO' ? s.month?.lines : s.kpiMonth?.lines_gt1;
        return co !== 'SDO' && !s.kpiMonth ? wait : <b className="sc-big">{fmt1(div(lines, s.month?.bills))}</b>;
      },
    },
    {
      key: 'baht', label: 'Baht/Bill', note: 'ยอดขาย ÷ จำนวนบิล',
      cell: (s) => (
        <span className="sc-stack">
          <span className="sc-line"><span className="muted">GIV</span><b>{fmt0(div(s.month?.giv, s.month?.bills))}</b></span>
          <span className="sc-line"><span className="muted">NIV</span><b>{fmt0(div(s.month?.niv, s.month?.bills))}</b></span>
        </span>
      ),
    },
    {
      key: 'range', label: 'Active Stores ช่วงที่เลือก', note: `${rangeLabel} · นับได้ไม่เกิน ${MAX_RANGE_MONTHS} เดือน`,
      cell: (s) => sc.rangeTooLong
        ? <span className="muted">เลือกช่วงไม่เกิน {MAX_RANGE_MONTHS} เดือน</span>
        : s.storesRange ? <b className="sc-big">{fmt0(s.storesRange.active_stores)} ร้าน</b> : wait,
    },
  ];

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h3 className="card-title">Scorecard รายบริษัท · {monthLabel}</h3>
          <p className="card-sub">ตามนิยาม KPI ฝ่ายขาย · เดือนปัจจุบันนับถึงวันที่ข้อมูลล่าสุดและเทียบปีก่อนถึงวันเดียวกัน</p>
        </div>
      </header>
      <table className="rtable score">
        <thead>
          <tr>
            <th>ตัวชี้วัด</th>
            {companies.map((co) => <th key={co}><span className="dot" style={{ background: COMPANY_COLORS[co] }} />{co}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="sc-label"><b>{r.label}</b>{r.note && <span className="muted">{r.note}</span>}</td>
              {companies.map((co) => (
                <td key={co} data-label={co}>{sc.byCompany[co] ? r.cell(sc.byCompany[co], co) : '–'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!sc.kpiReady && (
        <p className="note" style={{ marginTop: 12 }}>
          ช่อง &quot;รอข้อมูล&quot; (Active Stores, วันทำงานตาม Invoice, Avg.Call/Day, Line/Bill ของ PDC/DC) จะขึ้นหลังรัน supabase/kpi_store.sql และรอคำนวณย้อนหลังเสร็จ
        </p>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default async function SalesOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // ต้องเข้าสู่ระบบก่อน (ตรวจ cookie + พนักงานยังอยู่ในตาราง employees และ is_active)
  await requireEmployee();
  const params = await searchParams;
  const companyFilter = companyFromParams(params);
  const byCompany = <T,>(rows: T[], co: (r: T) => string) =>
    companyFilter === 'all' ? rows : rows.filter((r) => normalizeCompany(co(r)) === companyFilter);

  let errorMessage: string | null = null;
  let targetError = null as string | null;
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
    const [cur, prev, targets, sc] = await Promise.all([
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
    ]);
    scorecard = sc;
    fetchMonths.forEach((m, i) => {
      curByYM.set(m, cur[i].bySeller);
      prevByYM.set(m, prev[i].bySeller);
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
  const tg = latestDate ? timeGone(rangeMonths, latestDate) : { elapsed: 0, total: 0, pct: 0 };

  const rangeLabel     = fromYM ? formatRange(fromYM, toYM) : '';
  // ช่วงที่รวมเดือนปัจจุบัน (ยังไม่จบเดือน) ให้บอกวันที่ตัดด้วย เช่น "ต.ค. 2025 (ถึง 30/10/2025)"
  const prevLabelOf = (ms: string[]) => !ms.length ? '' :
    formatRange(shiftYM(ms[0], 1), shiftYM(ms[ms.length - 1], 1)) +
    (ms[ms.length - 1] === latestDate.slice(0, 7) ? ` (ถึง ${formatDate(shiftYears(latestDate, 1))})` : '');
  const prevRangeLabel = prevLabelOf(rangeMonths);
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
      tg: latestDate ? timeGone(ms, latestDate) : { elapsed: 0, total: 0, pct: 0 },
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
    return {
      company: co,
      cur: sumGIVNIV(of(curRows, (r) => r.Company)),
      prev: sumGIVNIV(of(prevRows, (r) => r.Company)),
      target: t.target,
      be: t.be,
    };
  });

  const princRows: CompanyPrincRow[] = curRows.map((r) => ({ company: r.Company, princ: r.Princ, giv: r.GIV, niv: r.NIV }));

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

          {errorMessage && <p className="empty">โหลดข้อมูลไม่สำเร็จ — ลองกดค้นหาอีกครั้ง</p>}

          {!errorMessage && (
            <>
              <div className="section" style={{ gap: 24 }}>
                {/* ─── 1. Time gone ─── */}
                <PaceStrip tg={tg} giv={grandCurrent.GIV} target={grandTarget.target} />

                {/* ─── 2. GIV / NIV ─── */}
                <div className="grid-2">
                  <MetricCard label="GIV" sub="ยอดก่อนหักส่วนลด"
                    cur={grandCurrent.GIV} prev={grandPrevious.GIV} hasPrev={hasPrev} prevLabel={prevRangeLabel}>
                    <GivTargetGroup giv={grandCurrent.GIV} target={grandTarget.target} be={grandTarget.be} note={targetNote} tg={tg} />
                  </MetricCard>
                  <MetricCard label="NIV" sub="ยอดสุทธิ"
                    cur={grandCurrent.NIV} prev={grandPrevious.NIV} hasPrev={hasPrev} prevLabel={prevRangeLabel} />
                </div>

                {/* ─── 2.5 Scorecard รายบริษัท ─── */}
                {scorecard && (
                  <div className="section">
                    <div className="section-title"><h2>Scorecard รายบริษัท</h2><span>SDO / PDC / DC · ตามนิยาม KPI ฝ่ายขาย</span></div>
                    <ScorecardTable
                      sc={scorecard}
                      companies={companies}
                      targets={Object.fromEntries(companies.map((co) => [co, sumTargets(targetRows.filter((t) => t.ym === toYM && normalizeCompany(t.company) === co))]))}
                      tg={timeGone([toYM], latestDate)}
                      ymLabel={(from, to) => formatRange(from.slice(0, 7), addDays(to, -1).slice(0, 7))}
                      rangeLabel={rangeLabel}
                      monthLabel={formatThaiMonth(toYM) + (toYM === latestDate.slice(0, 7) ? ` (ถึง ${formatDate(latestDate)})` : '')}
                    />
                  </div>
                )}

                {/* ─── 3. รายบริษัท ─── */}
                <div className="section">
                  <div className="section-title"><h2>ยอดขายแยกตามบริษัท</h2><span>{rangeLabel} · เทียบ {prevRangeLabel}</span></div>
                  <CompanyCards stats={companyStats} tg={tg} hasPrev={hasPrev} />
                </div>

                {/* ─── 4. ยอดสะสม / ค่าเฉลี่ย 3 · 6 เดือน ─── */}
                <div className="section">
                  <div className="section-title">
                    <h2>ยอดสะสมและค่าเฉลี่ยย้อนหลัง</h2>
                    <span>นับถึง {formatThaiMonth(toYM)} · เดือนปัจจุบันนับถึง {formatDate(latestDate)} (MTD)</span>
                  </div>
                  <PeriodTable metric="GIV" periods={periods} />
                  <PeriodTable metric="NIV" periods={periods} />
                </div>

                {/* ─── 5. แนวโน้ม ─── */}
                <section className="card">
                  <header className="card-head">
                    <div>
                      <h3 className="card-title">แนวโน้มยอดขายรายเดือน</h3>
                      <p className="card-sub">{trendMonths.length > 0 ? formatRange(trendMonths[0], trendMonths[trendMonths.length - 1]) : ''} · บาท</p>
                    </div>
                  </header>
                  <TrendLineChart points={trendPoints} />
                </section>

                {/* ─── 6. สัดส่วน บริษัท → Principal ─── */}
                <CompanyShare rows={princRows} companies={companies} />

              </div>
            </>
          )}
        </main>
    </>
  );
}
