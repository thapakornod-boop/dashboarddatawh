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
import { loadScorecard, Scorecard, CompanyScore } from '@/app/lib/scorecard';
import {
  COMPANY_COLORS, fmtInt, fmtNum, fmtPct, fmtShort, paceColor, pctGrowth, pctOf,
} from '@/app/lib/format';
import { Growth, PaceBar, PaceChip } from '@/app/components/ui';
import { FilterForm, LoadingDone, LogoutButton } from '@/app/components/Loading';
import Image from 'next/image';
import Link from 'next/link';
import { requireEmployee } from '@/app/lib/session';
import { logout } from '@/app/login/actions';
import CompanyShare, { CompanyPrincRow } from '@/app/components/CompanyShare';
import BranchView, { BranchSellerRow } from '@/app/components/BranchView';

const COMPANY_ORDER = ['SDO', 'PDC', 'DC'];
const THAI_MONTH_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

type TrendPoint = { month: string; GIV: number; NIV: number };

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

function normalizeCompany(c: string) { return (c ?? '').trim().toUpperCase(); }

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

// ยอดขายตามสาขา: ใช้ทุกอย่างตามชีต รวม GIV / NIV ด้วย
// (SDO ในชีตรวมยอดเป็นรหัสเขต เช่น 501AD01 ส่วนในระบบแยกเป็นรหัส PS / MS ย่อย จึงจับคู่รายรหัสไม่ได้ — ยอดรวมบริษัทยังใกล้เคียงกัน)
// ข้อมูลทีมใช้แถวของเดือนล่าสุดในช่วง
function buildBranchRows(targets: TargetRow[]): BranchSellerRow[] {
  const map = new Map<string, BranchSellerRow & { ym: string }>();
  for (const t of targets) {
    const key = `${t.company}|${t.seller}`;
    const row = map.get(key);
    if (!row) {
      map.set(key, {
        ym: t.ym, company: t.company, sm: t.sm, sup: t.sup, princ: t.principal, branch: t.branch,
        channel: t.channel, seller: t.seller, name: t.name, order: t.order,
        target: t.target, be: t.be, giv: t.sheetGiv, niv: t.sheetNiv,
      });
    } else {
      row.target += t.target;
      row.be += t.be;
      row.giv += t.sheetGiv;
      row.niv += t.sheetNiv;
      if (t.ym > row.ym) Object.assign(row, { ym: t.ym, sm: t.sm, sup: t.sup, branch: t.branch, channel: t.channel, name: t.name, order: t.order });
    }
  }
  return Array.from(map.values());
}

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

// ── ไอคอน sidebar ──
function IconChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

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
          <RatioLine label="GIV" pct={ratio(s.month?.giv, s.base?.giv)} />
          <RatioLine label="NIV" pct={ratio(s.month?.niv, s.base?.niv)} />
        </span>
      ),
    },
    {
      key: 'fy', label: 'Sales vs YA (FYTD)', note: `ปีงบ P&G เริ่ม ก.ค. · ${ymLabel(R.fy.from, R.fy.to)} · ใช้กับ SDO`,
      cell: (s, co) => co !== 'SDO' ? <span className="muted">ไม่ใช้</span> : (
        <span className="sc-stack">
          <RatioLine label="GIV" pct={ratio(s.fy.cur?.giv, s.fy.prev?.giv)} />
          <RatioLine label="NIV" pct={ratio(s.fy.cur?.niv, s.fy.prev?.niv)} />
        </span>
      ),
    },
    {
      key: 'cy', label: 'Sales vs YA (CY)', note: `ต้นปี → ปัจจุบัน · ${ymLabel(R.cy.from, R.cy.to)}`,
      cell: (s) => (
        <span className="sc-stack">
          <RatioLine label="GIV" pct={ratio(s.cy.cur?.giv, s.cy.prev?.giv)} />
          <RatioLine label="NIV" pct={ratio(s.cy.cur?.niv, s.cy.prev?.niv)} />
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
      key: 'range', label: 'Active Stores ช่วงที่เลือก', note: rangeLabel,
      cell: (s) => s.storesRange ? <b className="sc-big">{fmt0(s.storesRange.active_stores)} ร้าน</b> : wait,
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
      <p className="sc-pending">
        <b>รอข้อมูลชุดใหม่ (NewDataset):</b> Coverage · Visit Call vs Target · Productive Call / Avg.Call / Line / Baht vs Target (KPI DSR) · Golden Point Q DGP · CD1–CD3 · สินค้าใหม่ IMR / HFS · Brand of the month · ยอด SaleOrders · KPI by Princ
      </p>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────
const YM_RE = /^\d{4}-\d{2}$/;

export default async function SalesOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // ต้องเข้าสู่ระบบก่อน (ตรวจ cookie + พนักงานยังอยู่ในตาราง employees และ is_active)
  const me = await requireEmployee();
  const params = await searchParams;
  const param = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : undefined);

  const companyParam  = (param('company') ?? 'all').toUpperCase();
  const companyFilter = COMPANY_ORDER.includes(companyParam) ? companyParam : 'all';
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
  let sheetUpdatedAt = '';
  let scorecard: Scorecard | null = null;

  try {
    preloadTargets();
    [latestDate, months] = await Promise.all([getLatestDate(), getAvailableMonths()]);
    const latestMonth = months[months.length - 1] ?? latestDate.slice(0, 7);

    // ช่วงเดือนที่เลือก (ค่าเริ่มต้น = เดือนล่าสุด) ถ้าเลือกกลับด้านก็สลับให้
    fromYM = YM_RE.test(param('from') ?? '') ? param('from')! : latestMonth;
    toYM   = YM_RE.test(param('to') ?? '')   ? param('to')!   : latestMonth;
    if (fromYM > toYM) [fromYM, toYM] = [toYM, fromYM];

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
    sheetUpdatedAt = targets.updatedAt;
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
  const branchRows  = buildBranchRows(targets);

  return (
    <>
      <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=general-sans@600&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600&family=IBM+Plex+Sans+Thai:wght@400;600&family=JetBrains+Mono&display=swap');

        /* ── tokens: โครงตาม design.md, สีหลักตามโลโก้ RSM (#3078F8) ── */
        :root {
          --brand: #3078F8; --brand-50: #EEF4FF; --brand-100: #DBE7FE; --brand-700: #1A55C2; --brand-900: #0D2B6B;
          --primary: #1F66E5; --primary-hover: #1A55C2; --ring: rgba(48,120,248,0.22);
          --neutral: #94A0B4; --bg: #F3F6FB; --surface: #FFFFFF;
          --text: #0F1B33; --text-2: #5B6478; --border: #E3E8F0; --track: #EDF1F7; --alt: #F1F5FB;
          --success: #10B981; --warning: #F59E0B; --error: #EF4444;
          --font-display: 'General Sans', 'IBM Plex Sans Thai', system-ui, sans-serif;
          --font-body: 'DM Sans', 'IBM Plex Sans Thai', system-ui, sans-serif;
          --font-mono: 'JetBrains Mono', ui-monospace, monospace;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); color: var(--text); font-family: var(--font-body); font-size: 15px; font-weight: 400; line-height: 1.5; }
        b, strong, th { font-weight: 600; }
        .muted { color: var(--text-2); }
        .eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-2); }
        .dot { display: inline-block; width: 8px; height: 8px; border-radius: 9999px; margin-right: 6px; vertical-align: 1px; flex-shrink: 0; }

        /* ── โครงหน้า: sidebar ซ้าย + เนื้อหา ── */
        .shell { display: flex; min-height: 100vh; }
        .sidebar {
          position: sticky; top: 0; height: 100vh; width: 248px; flex-shrink: 0; z-index: 20;
          display: flex; flex-direction: column; gap: 24px; padding: 20px 16px;
          background: linear-gradient(180deg, var(--primary) 0%, var(--brand-900) 100%); color: #FFFFFF;
        }
        .sb-brand { display: flex; align-items: center; gap: 12px; padding: 4px 8px; }
        .sb-logo { width: 44px; height: 44px; border-radius: 9999px; box-shadow: 0 0 0 3px rgba(255,255,255,0.9); flex-shrink: 0; }
        .sb-brand-text { display: flex; flex-direction: column; min-width: 0; }
        .sb-brand-text b { font: 600 16px var(--font-display); letter-spacing: 0.02em; }
        .sb-brand-text span { font-size: 12px; color: rgba(255,255,255,0.72); }
        .sb-group { display: flex; flex-direction: column; gap: 4px; }
        .sb-group-title { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.6); padding: 0 12px 6px; }
        .sb-item {
          display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px;
          color: rgba(255,255,255,0.85); text-decoration: none; font-size: 14px; transition: background .2s, color .2s;
        }
        .sb-item:hover { background: rgba(255,255,255,0.12); color: #FFFFFF; }
        .sb-item.active { background: #FFFFFF; color: var(--primary); font-weight: 600; box-shadow: 0 6px 16px rgba(13,43,107,0.25); }
        .sb-item svg { flex-shrink: 0; }
        .sb-spacer { flex: 1; }
        .sb-logout {
          margin-left: auto; width: 36px; height: 36px; flex-shrink: 0; display: grid; place-items: center;
          border: none; border-radius: 10px; background: rgba(255,255,255,0.14); color: #FFFFFF; cursor: pointer; transition: background .2s;
        }
        .sb-logout:hover { background: #EF4444; }
        .sb-logout:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,0.5); }
        .hero-side { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
        .hero-logout {
          display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px; border-radius: 9999px; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.45); background: rgba(255,255,255,0.14); color: #FFFFFF; font: 600 14px var(--font-body); transition: background .2s, color .2s;
        }
        .hero-logout:hover { background: #FFFFFF; color: var(--error); }
        .hero-logout:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,0.5); }
        @media (max-width: 640px) { .hero-side { align-items: flex-start; width: 100%; } }
        .sb-user { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.1); min-width: 0; }
        .sb-avatar { width: 34px; height: 34px; border-radius: 9999px; background: #FFFFFF; color: var(--primary); display: grid; place-items: center; font: 600 15px var(--font-body); flex-shrink: 0; }
        .sb-user-text { display: flex; flex-direction: column; min-width: 0; }
        .sb-user-text b { font-size: 13px; color: #FFFFFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb-user-text span { font-size: 11px; color: rgba(255,255,255,0.72); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .main { flex: 1; min-width: 0; }
        @media (max-width: 960px) {
          .sidebar { width: 72px; padding: 16px 10px; align-items: center; }
          .sb-brand { padding: 0; }
          .sb-brand-text, .sb-group-title, .sb-label, .sb-user-text { display: none; }
          .sb-user { padding: 6px; background: transparent; flex-direction: column; }
          .sb-logout { margin-left: 0; }
          .sb-item { justify-content: center; padding: 12px; }
        }

        /* ── segmented / tabs (สิ่งที่กดได้ = สีแบรนด์) ── */
        .seg { display: inline-flex; gap: 2px; padding: 3px; background: var(--alt); border-radius: 8px; }
        .seg button { border: none; background: transparent; font: 400 13px var(--font-body); color: var(--text-2); padding: 6px 14px; border-radius: 6px; cursor: pointer; white-space: nowrap; transition: color .2s, background .2s; }
        .seg button:hover { color: var(--text); }
        .seg button.on { background: var(--primary); color: #FFFFFF; font-weight: 600; }
        .seg button:focus-visible { box-shadow: 0 0 0 3px var(--ring); }

        /* ── layout ── */
        .container { max-width: 1280px; margin: 0 auto; padding: 0 32px 64px; display: flex; flex-direction: column; gap: 24px; }
        /* หัวหน้าเพจสีแบรนด์ + ฟอร์ม filter วางทับขอบล่าง */
        .hero {
          position: relative; overflow: hidden; color: #FFFFFF; padding: 32px 32px 72px;
          background: linear-gradient(120deg, var(--primary) 0%, var(--brand) 60%, #5B9BFF 100%);
        }
        .hero::after { content: ''; position: absolute; right: -80px; top: -120px; width: 360px; height: 360px; border-radius: 9999px; background: rgba(255,255,255,0.08); }
        .hero::before { content: ''; position: absolute; right: 160px; bottom: -160px; width: 280px; height: 280px; border-radius: 9999px; background: rgba(255,255,255,0.06); }
        .hero-inner { position: relative; z-index: 1; max-width: 1280px; margin: 0 auto; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
        .hero .crumb { font-size: 13px; color: rgba(255,255,255,0.75); }
        .hero h1 { font: 600 32px/1.15 var(--font-display); letter-spacing: -0.03em; margin-top: 4px; }
        .hero p { color: rgba(255,255,255,0.85); font-size: 15px; margin-top: 6px; }
        .hero-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .hero-chip { font-size: 13px; padding: 6px 12px; border-radius: 9999px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.25); white-space: nowrap; }
        .filters-wrap { margin-top: -48px; position: relative; z-index: 2; }
        .filters-wrap .card { box-shadow: 0 12px 32px rgba(13,43,107,0.12); }
        .section { display: flex; flex-direction: column; gap: 16px; }
        .section-title { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .section-title h2 { font: 600 20px var(--font-display); letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px; }
        .section-title h2::before { content: ''; width: 4px; height: 20px; border-radius: 9999px; background: var(--brand); }
        .section-title span { font-size: 13px; color: var(--text-2); }
        .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; align-items: start; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
        @media (max-width: 1024px) { .grid-3 { grid-template-columns: 1fr; } }
        @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }

        /* ── card: แบน มีเส้นขอบ ไม่มีเงา (เงาเฉพาะของที่กดได้ตอน hover) ── */
        .card { container: card / inline-size; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px 24px; min-width: 0; box-shadow: 0 1px 2px rgba(15,27,51,0.04), 0 6px 20px rgba(15,27,51,0.04); }
        .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .card-title { font: 600 16px var(--font-display); letter-spacing: -0.02em; }
        .card-sub { font-size: 13px; color: var(--text-2); }
        .empty { color: var(--text-2); text-align: center; padding: 32px 0; font-size: 13px; }
        .pill { font-size: 12px; color: var(--text-2); background: var(--alt); border-radius: 9999px; padding: 2px 10px; white-space: nowrap; }
        .note { font-size: 12px; color: #92400E; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 8px 12px; }

        /* ── ฟอร์ม ── */
        .filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }
        .field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .field-label { font-size: 12px; color: var(--text-2); }
        .field select, .input {
          height: 38px; padding: 0 14px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface);
          font: 400 14px var(--font-body); color: var(--text); outline: none; min-width: 150px; transition: border-color .2s, box-shadow .2s;
        }
        .field select:focus, .input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--ring); }
        .field select:disabled { background: var(--alt); color: var(--neutral); }
        .arrow { color: var(--neutral); padding-bottom: 8px; }
        .filters-hint { font-size: 12px; color: var(--neutral); margin-left: auto; padding-bottom: 10px; }
        .btn { height: 38px; padding: 0 16px; border-radius: 6px; font: 600 14px var(--font-body); cursor: pointer; transition: transform .2s, box-shadow .2s, background .2s; }
        .btn:hover { transform: translateY(-1px); }
        .btn-primary { background: var(--primary); color: #FAFAFA; border: 1px solid var(--primary); }
        .btn-primary:hover { background: var(--primary-hover); box-shadow: 0 4px 12px rgba(99,102,241,0.35); }
        .btn-secondary { background: transparent; color: var(--text); border: 1px solid var(--border); }
        .btn-secondary:hover { border-color: var(--primary); color: var(--primary); }
        .btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }

        /* ── แท่ง % + ขีด Time gone + ป้ายสถานะ ── */
        /* แท่งแบบ Ant Design Progress: พื้นเทาอ่อน ขอบมน แท่งค่อย ๆ วิ่งเติมตอนโหลด */
        .bar { position: relative; display: block; width: 100%; background: #F0F0F0; border-radius: 100px; overflow: hidden; }
        .bar-md { height: 8px; }
        .bar-sm { height: 8px; }
        .bar-fill { position: absolute; inset: 0 auto 0 0; border-radius: 100px; transform-origin: left center; animation: bar-grow .9s cubic-bezier(.08,.82,.17,1) both; }
        @keyframes bar-grow { from { transform: scaleX(0); } }
        @media (prefers-reduced-motion: reduce) { .bar-fill { animation: none; } }
        /* ตำแหน่ง Time gone = ช่องขาวบาง ๆ ในแท่ง (แทนขีดดำ) */
        .bar-tick { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: #FFFFFF; box-shadow: 0 0 0 0.5px rgba(0,0,0,0.08); }
        .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 2px 10px; border-radius: 9999px; white-space: nowrap; }
        .chip-dot { width: 6px; height: 6px; border-radius: 9999px; background: currentColor; }
        /* ป้ายสถานะแบบ Ant Design Tag */
        .chip-ok   { color: #389E0D; background: #F6FFED; box-shadow: inset 0 0 0 1px #B7EB8F; }
        .chip-warn { color: #AD6800; background: #FFFBE6; box-shadow: inset 0 0 0 1px #FFE58F; }
        .chip-bad  { color: #CF1322; background: #FFF1F0; box-shadow: inset 0 0 0 1px #FFA39E; }
        .chip-none { color: var(--text-2); background: var(--alt); }
        .growth { font-size: 12px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .growth-up { color: #389E0D; }
        .growth-down { color: #CF1322; }
        .growth-none { color: var(--neutral); }
        .pct-cell { display: inline-flex; align-items: center; justify-content: flex-end; gap: 8px; width: 100%; }
        .pct-cell .bar { width: 88px; flex-shrink: 0; }
        .pct-cell b { min-width: 48px; text-align: right; font-variant-numeric: tabular-nums; }

        /* ── KPI แถวบน ── */
        .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 0; }
        .kpi { display: flex; flex-direction: column; gap: 8px; padding: 20px 24px; border-left: 1px solid var(--border); min-width: 0; }
        .kpi:first-child { border-left: none; }
        .kpi-val { font: 600 28px/1.1 var(--font-display); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
        .kpi-top { display: flex; align-items: center; gap: 10px; }
        .kpi-ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: var(--brand-50); color: var(--primary); flex-shrink: 0; }
        .kpi-cap { font-size: 12px; color: var(--text-2); }
        @media (max-width: 900px) {
          .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .kpi:nth-child(3) { border-left: none; }
          .kpi:nth-child(n+3) { border-top: 1px solid var(--border); }
        }

        /* ── การ์ด GIV / NIV ── */
        .metric-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
        .metric-name { font: 600 14px var(--font-display); letter-spacing: 0.02em; padding: 4px 12px; border-radius: 8px; }
        .metric-giv { background: var(--primary); color: #FFFFFF; }
        .metric-niv { background: var(--brand-100); color: var(--brand-700); }
        .metric-val { font: 600 clamp(26px, 3vw, 36px)/1.1 var(--font-display); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
        .rows { display: flex; flex-direction: column; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); }
        .rows-title { margin-bottom: 4px; }
        .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 0; font-size: 14px; }
        .row + .row { border-top: 1px solid #F4F4F6; }
        .row dt { color: var(--text-2); }
        .row dd { font-variant-numeric: tabular-nums; text-align: right; }
        .row dd.muted { color: var(--neutral); }
        .row-bar dd { display: flex; align-items: center; gap: 10px; flex: 1; justify-content: flex-end; }
        .row-bar dd .bar { max-width: 200px; }
        .row-bar dd b { min-width: 52px; text-align: right; }

        /* ── รายบริษัท ── */
        .co { display: flex; flex-direction: column; gap: 4px; }
        .co-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
        .card.co { border-top: 4px solid var(--co-color); }
        .co-name { font: 600 18px var(--font-display); letter-spacing: -0.02em; display: flex; align-items: center; }
        .co-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .co-col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .co-col + .co-col { border-left: 1px solid var(--border); padding-left: 16px; }
        .co-val { font: 600 20px var(--font-display); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .co-sub { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; flex-wrap: wrap; }
        .co .rows { margin-top: 12px; }
        .co .row { font-size: 13px; }

        /* ── ตาราง responsive: จอใหญ่ = ตาราง, จอเล็ก = การ์ดรายแถว (ไม่มี scroll ด้านข้าง) ── */
        .rtable { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
        .rtable th { text-align: left; font-size: 12px; color: var(--text-2); padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
        .rtable td { padding: 12px; border-bottom: 1px solid #F4F4F6; vertical-align: middle; }
        .rtable tbody tr { transition: background .2s; }
        .rtable tbody tr:hover { background: #FAFAFB; }
        .rtable tfoot td { border-top: 1px solid var(--border); border-bottom: none; background: #FAFAFB; }
        .rtable .r { text-align: right; }
        .rtable th.sortable { cursor: pointer; user-select: none; }
        .rtable th.sortable:hover, .rtable th.sorted { color: var(--primary); }
        .rtable .strong { font-weight: 600; }
        .rank-col { width: 36px; color: var(--neutral); }
        .stack { display: inline-flex; flex-direction: column; align-items: flex-end; gap: 2px; }
        .stack.left { align-items: flex-start; }
        .num-lg { font: 600 15px var(--font-display); letter-spacing: -0.01em; }
        .who { display: flex; flex-direction: column; gap: 2px; }
        .code { font-family: var(--font-mono); font-size: 12.5px; color: var(--text); }
        .warn-mark { color: #B45309; }
        .periods tbody tr:first-child td { background: #FAFAFB; }
        .sort-mobile { display: none; }
        @container card (max-width: 800px) {
          .rtable thead { display: none; }
          .rtable, .rtable tbody, .rtable tfoot, .rtable tr, .rtable td { display: block; width: 100%; }
          .rtable tr { border: 1px solid var(--border); border-radius: 12px; padding: 8px 14px; margin-bottom: 10px; background: var(--surface); }
          .rtable tfoot tr { background: #FAFAFB; }
          .rtable td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 7px 0; border: none; text-align: right; }
          .rtable td + td { border-top: 1px solid #F4F4F6; }
          .rtable td::before { content: attr(data-label); color: var(--text-2); font-size: 12px; text-align: left; flex-shrink: 0; }
          .rtable td:not([data-label])::before { content: none; }
          .rtable .rank-col { display: none; }
          .rtable .stack { align-items: flex-end; }
          .rtable .pct-cell { width: auto; }
          .sort-mobile { display: block; }
        }

        /* ── Scorecard รายบริษัท ── */
        .score { table-layout: fixed; }
        .score th:first-child { width: 30%; }
        .score th:not(:first-child) { text-align: left; }
        .score td { vertical-align: top; }
        .sc-label { display: flex; flex-direction: column; gap: 2px; }
        .sc-label b { font-size: 14px; }
        .sc-label .muted { font-size: 11.5px; line-height: 1.4; }
        .sc-stack { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .sc-line { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 13px; font-variant-numeric: tabular-nums; }
        .sc-big { font: 600 16px var(--font-display); letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
        .sc-pending { margin-top: 12px; font-size: 12px; color: var(--text-2); line-height: 1.6; padding: 10px 12px; border-radius: 8px; background: var(--alt); }
        .sc-pending b { color: #C2410C; }
        @container card (max-width: 800px) {
          .score td.sc-label { background: var(--brand-50); margin: -8px -14px 6px; padding: 10px 14px; width: auto; border-radius: 12px 12px 0 0; flex-direction: column; align-items: flex-start; text-align: left; }
          .score td:not(.sc-label) { align-items: flex-start; }
          .score td:not(.sc-label) > * { flex: 1; max-width: 60%; }
          .score .sc-stack { align-items: stretch; }
        }

        /* ── toolbar ── */
        .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; }
        .toolbar .search { flex: 1; min-width: 200px; }
        .more { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; padding-top: 16px; font-size: 13px; }

        /* ── กราฟแนวโน้ม ── */
        .trend svg { width: 100%; height: auto; display: block; }
        .trend .axis { font: 400 11px var(--font-body); fill: var(--text-2); }
        .trend .direct { font: 600 12px var(--font-body); fill: var(--primary); }
        .trend .direct.muted { fill: var(--text-2); }
        .legend { display: flex; flex-wrap: wrap; gap: 16px; font-size: 12px; margin-top: 8px; }
        .legend span { display: inline-flex; align-items: center; gap: 6px; }
        .legend-line { display: inline-block; width: 18px; height: 0; border-top: 3px solid var(--primary); }
        .legend-line.dashed { border-top: 2px dashed var(--neutral); }

        /* ── สัดส่วน บริษัท → Principal ── */
        .share-top { display: grid; grid-template-columns: 180px 1fr; gap: 24px; align-items: center; }
        .share-donut { width: 180px; height: 180px; }
        .share-slice { cursor: pointer; transition: opacity .2s; }
        .donut-cap { font: 400 11px var(--font-body); fill: var(--text-2); }
        .donut-val { font: 600 20px var(--font-display); fill: var(--text); letter-spacing: -0.02em; }
        .share-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .tile {
          display: flex; flex-direction: column; gap: 4px; text-align: left; padding: 14px 16px; min-width: 0;
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px; cursor: pointer;
          font: 400 13px var(--font-body); color: var(--text); transition: transform .2s, box-shadow .2s, border-color .2s;
        }
        .tile:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
        .tile.on { border-color: var(--primary); box-shadow: 0 0 0 3px var(--ring); }
        .tile:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
        .tile-name { font-weight: 600; display: flex; align-items: center; }
        .tile-val { font: 600 22px var(--font-display); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .tile-meta { font-size: 12px; color: var(--text-2); }
        .tile-share { height: 4px; background: var(--track); border-radius: 9999px; overflow: hidden; margin-top: 4px; }
        .tile-share > span { display: block; height: 100%; }
        .share-detail { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); }
        .share-detail-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .share-stats { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; color: var(--text-2); }
        .share-stats b { color: var(--text); font-variant-numeric: tabular-nums; }
        .princ-grid { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0 32px; }
        .princ { display: grid; grid-template-columns: 24px 1fr auto; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid #F4F4F6; }
        .princ-rank { font-size: 12px; color: var(--neutral); text-align: right; font-variant-numeric: tabular-nums; }
        .princ-main { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .princ-name { font-size: 13px; font-weight: 600; display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
        .princ-co { font-size: 11px; font-weight: 600; }
        .princ-bar { height: 4px; background: var(--track); border-radius: 9999px; overflow: hidden; }
        .princ-bar > span { display: block; height: 100%; border-radius: 9999px; }
        .princ-num { display: flex; flex-direction: column; align-items: flex-end; font-variant-numeric: tabular-nums; }
        .princ-val { font-size: 13px; font-weight: 600; }
        .princ-share { font-size: 12px; color: var(--text-2); }
        @media (max-width: 900px) {
          .share-top { grid-template-columns: 1fr; justify-items: center; }
          .share-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
        }

        /* ── ยอดขายตามทีม ── */
        .team-filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 16px; }
        .team-summary { display: grid; grid-template-columns: 1.3fr repeat(3, 1fr); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 16px; }
        .ts-item { display: flex; flex-direction: column; gap: 4px; padding: 14px 18px; border-left: 1px solid var(--border); min-width: 0; }
        .ts-item:first-child { border-left: none; }
        .ts-big { font: 600 24px var(--font-display); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
        .ts-val { font: 600 17px var(--font-display); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .ts-cap { font-size: 12px; color: var(--text-2); }
        .ts-pace { display: flex; align-items: center; gap: 8px; font-size: 12px; }
        .ts-pace .bar { flex: 1; }
        @media (max-width: 900px) {
          .team-summary { grid-template-columns: 1fr 1fr; }
          .ts-item:nth-child(3) { border-left: none; }
          .ts-item:nth-child(n+3) { border-top: 1px solid var(--border); }
        }
        /* ตารางทีม: แถวหัวกลุ่ม หัวหน้า (SM) → Sup พร้อมยอดรวมกลุ่ม */
        .team-table .grp td { font-weight: 600; }
        .team-table .grp-sm td { background: #E8F0FE; border-top: 2px solid var(--brand-100); }
        .team-table .grp-sup td { background: #F6F9FF; }
        .team-table .grp:hover td { filter: none; }
        .grp-name { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .grp-tag { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 9999px; background: var(--primary); color: #FFFFFF; }
        .grp-sup .grp-tag { background: var(--brand-100); color: var(--brand-700); }
        .grp-count { font-size: 12px; font-weight: 400; color: var(--text-2); }
        .grp-open { border: none; background: none; padding: 0; font: 600 12px var(--font-body); color: var(--primary); cursor: pointer; }
        .grp-open:hover { text-decoration: underline; }
        .grp-open:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); border-radius: 4px; }
        .team-table td.seller-cell { padding-left: 28px; }
        .clear-btn { height: 38px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--primary); font: 600 13px var(--font-body); cursor: pointer; }
        .clear-btn:hover { border-color: var(--primary); }
        .clear-btn:disabled { color: var(--neutral); cursor: default; border-color: var(--border); }
        @container card (max-width: 800px) {
          .team-table .grp td { background: transparent !important; border: none; }
          .team-table tr.grp-sm { background: #E8F0FE; border-color: var(--brand-100); }
          .team-table tr.grp-sup { background: #F6F9FF; }
          .team-table td.seller-cell { padding-left: 0; }
          /* การ์ดแบบกะทัดรัด: Target | GIV · % เต็มแถว · BE | NIV */
          .team-table tr { display: grid; grid-template-columns: 1fr 1fr; column-gap: 16px; }
          .team-table td { min-width: 0; }
          .team-table td:nth-child(1), .team-table td:nth-child(2), .team-table td[data-label="% ถึง Target"] { grid-column: 1 / -1; }
          .team-table td[data-label="Target"], .team-table td[data-label="BE"] { border-top: 1px solid #F4F4F6; }
        }

        @media (max-width: 640px) {
          .container { padding-left: 16px; padding-right: 16px; }
          .hero { padding: 24px 16px 64px; }
          .hero h1 { font-size: 26px; }
          .card { padding: 16px; }
          .kpis { padding: 0; }
          .kpi { padding: 16px; }
          .kpi-val { font-size: 22px; }
          .field, .field select { width: 100%; }
          .arrow { display: none; }
          .filters .btn { width: 100%; }
          .filters-hint { margin-left: 0; }
          .co-cols { grid-template-columns: 1fr; }
          .co-col + .co-col { border-left: none; padding-left: 0; border-top: 1px solid var(--border); padding-top: 12px; }
        }

        /* ── SweetAlert2 ให้เข้ากับธีม ── */
        .swal2-popup.swal-genesis { border-radius: 12px; font-family: var(--font-body); padding: 24px; }
        .swal-genesis .swal2-title { font: 600 20px var(--font-display); letter-spacing: -0.02em; color: var(--text); }
        .swal-genesis .swal2-html-container { font-size: 14px; color: var(--text-2); }
        .swal-genesis .swal2-loader { border-color: var(--primary) transparent var(--primary) transparent; }
        .swal-actions { gap: 8px; }
        .swal-btn-ghost { background: transparent !important; color: var(--text) !important; border: 1px solid var(--border) !important; }
        .swal-btn { height: 38px; padding: 0 20px; border-radius: 6px; border: none; background: var(--primary); color: #FAFAFA; font: 600 14px var(--font-body); cursor: pointer; }
      `}</style>

      <div className="shell">
        <LoadingDone error={errorMessage} />

        {/* ─── Sidebar: เมนูหลัก (เพิ่มฟังก์ชันใหม่เป็น sb-item ในกลุ่มได้เลย) ─── */}
        <aside className="sidebar">
          <div className="sb-brand">
            <Image src="/logo.png" alt="RSM Group" width={44} height={44} className="sb-logo" priority />
            <div className="sb-brand-text"><b>RSM GROUP</b><span>Sales Dashboard</span></div>
          </div>
          <nav className="sb-group" aria-label="เมนูหลัก">
            <span className="sb-group-title">แดชบอร์ด</span>
            <Link href="/dashboard" className="sb-item active" aria-current="page" title="ภาพรวมยอดขาย">
              <IconChart /><span className="sb-label">ภาพรวมยอดขาย</span>
            </Link>
          </nav>
          <div className="sb-spacer" />
          {/* การ์ดผู้ใช้ + ปุ่มออกจากระบบอยู่ข้างชื่อ (ถามยืนยันก่อนออก) */}
          <div className="sb-user" title={`${me.full_name} (${me.code})`}>
            <span className="sb-avatar">{me.full_name.replace(/^(นาย|นางสาว|นาง|น\.ส\.)\s*/, '').slice(0, 1)}</span>
            <span className="sb-user-text">
              <b>{me.full_name}</b>
              <span>{me.code}{me.position ? ` · ${me.position}` : ''}</span>
            </span>
            <LogoutButton action={logout} className="sb-logout"><IconLogout /></LogoutButton>
          </div>
        </aside>

        <div className="main">
        <header className="hero">
          <div className="hero-inner">
            <div>
              <div className="crumb">แดชบอร์ด / ภาพรวมยอดขาย</div>
              <h1>ภาพรวมยอดขาย</h1>
              <p>{rangeLabel}{companyFilter !== 'all' ? ` · ${companyFilter}` : ' · SDO / PDC / DC'}</p>
            </div>
            <div className="hero-side">
              <LogoutButton action={logout} className="hero-logout"><IconLogout /><span>ออกจากระบบ</span></LogoutButton>
              <div className="hero-chips">
                {!errorMessage && <span className="hero-chip">Time gone {tg.pct.toFixed(1)}%</span>}
                {latestDate && <span className="hero-chip">ข้อมูลถึง {formatDate(latestDate)}</span>}
              </div>
            </div>
          </div>
        </header>

        <main className="container">
          {/* ─── Filter (วางทับขอบล่างของ hero) ─── */}
          <div className="filters-wrap">
          <FilterForm id="filter-form" className="card filters">
            <label className="field">
              <span className="field-label">ตั้งแต่เดือน</span>
              <select name="from" defaultValue={fromYM}>
                {months.map((m) => <option key={m} value={m}>{formatThaiMonth(m)}</option>)}
              </select>
            </label>
            <span className="arrow">→</span>
            <label className="field">
              <span className="field-label">ถึงเดือน</span>
              <select name="to" defaultValue={toYM}>
                {months.map((m) => <option key={m} value={m}>{formatThaiMonth(m)}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">บริษัท</span>
              <select name="company" defaultValue={companyFilter}>
                <option value="all">ทั้งหมด</option>
                {COMPANY_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <button type="submit" className="btn btn-primary">ค้นหา</button>
            {months.length > 0 && <span className="filters-hint">มีข้อมูล {formatRange(months[0], months[months.length - 1])}</span>}
          </FilterForm>
          </div>

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

                {/* ─── 7. ยอดขายตามทีม (ชีต BE) ─── */}
                <BranchView rows={branchRows} companies={companies} timeGonePct={tg.pct} periodLabel={rangeLabel} sheetUpdatedAt={sheetUpdatedAt} />
              </div>
            </>
          )}
        </main>
        </div>
      </div>
    </>
  );
}
