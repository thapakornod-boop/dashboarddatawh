'use client';

import { useMemo, useRef, useState } from 'react';
import type { BranchPrincRow } from '@/app/lib/api';
import { COMPANY_COLORS, fmtInt, fmtNum, fmtShort } from '@/app/lib/format';
import { rank as branchRank } from '@/app/components/BranchSales';

// สัดส่วนยอดขาย: ภาพรวมทั้งหมดก่อน → เลือกบริษัท → เห็น Principal ทั้งหมดของบริษัทนั้น (ไม่มี scroll)
// → กด Principal เพื่อเจาะดูว่า สาขาไหน / เซลล์คนไหน ขายได้มากที่สุด
// rows   = 1 แถวต่อเซลล์ (ยอดตามตารางสรุปหลัก ใช้เมื่อยังไม่มี detail)
// detail = บริษัท × สาขา × เซลล์ × Princ (Princ แยกตามรหัสสินค้า) — มีแล้วใช้ตัวนี้ทั้งรายการ Princ และการเจาะดู
export type CompanyPrincRow = { company: string; princ: string; giv: number; niv: number };

type Metric = 'giv' | 'niv';
const ALL = 'ทั้งหมด';
const BRANCH_SELLERS = 8; // เซลล์ต่อสาขาที่โชว์ก่อนกด "ดูทั้งหมด"

const R = 70;
const STROKE = 22;
const C = 2 * Math.PI * R;
const GAP = 2.5; // ช่องว่างระหว่างชิ้น (ตามเส้นรอบวง)

// รวมค่าเป็นกลุ่มแล้วเรียงมาก → น้อย
function rankBy<T>(list: T[], key: (r: T) => string, value: (r: T) => number) {
  const m = new Map<string, { key: string; value: number; rows: T[] }>();
  for (const r of list) {
    const k = key(r);
    const x = m.get(k) ?? { key: k, value: 0, rows: [] };
    x.value += value(r);
    x.rows.push(r);
    m.set(k, x);
  }
  return [...m.values()].sort((a, b) => b.value - a.value);
}

export default function CompanyShare({ rows, companies, detail, sellerNames = {}, sellerChannels = {} }: {
  rows: CompanyPrincRow[]; companies: string[]; detail?: BranchPrincRow[] | null;
  sellerNames?: Record<string, string>; sellerChannels?: Record<string, string>;
}) {
  // "KVN008 (VAN)" — ประเภทจากคอลัมน์ Channel ในชีต · SDO ที่ไม่มีในชีตใช้ตัวอักษรในรหัส เช่น 708PS07 → PS, 700MS03 → MS
  const typeOf = (seller: string) => sellerChannels[seller] ?? (/^\d+([A-Z]+)\d*$/.exec(seller)?.[1] ?? '');
  const withType = (seller: string) => (typeOf(seller) ? `${seller} (${typeOf(seller)})` : seller);
  const [metric, setMetric] = useState<Metric>('giv');
  const [selected, setSelected] = useState<string>(ALL);
  const [princ, setPrinc] = useState<string | null>(null);
  const [openBranches, setOpenBranches] = useState<Set<string>>(new Set());
  const toggleBranch = (b: string) => setOpenBranches((s) => {
    const n = new Set(s);
    if (n.has(b)) n.delete(b); else n.add(b);
    return n;
  });
  const drillRef = useRef<HTMLDivElement>(null);
  const sel = selected === ALL || companies.includes(selected) ? selected : ALL;

  const byCompany = useMemo(() => companies.map((co) => {
    const list = rows.filter((r) => r.company === co);
    return { company: co, value: list.reduce((s, r) => s + r[metric], 0), sellers: list.length };
  }), [rows, companies, metric]);
  const total = byCompany.reduce((s, c) => s + c.value, 0);

  const selRows = useMemo(() => (sel === ALL ? rows : rows.filter((r) => r.company === sel)), [rows, sel]);
  const selDetail = useMemo(
    () => (detail ?? []).filter((r) => companies.includes(r.company) && (sel === ALL || r.company === sel)),
    [detail, companies, sel]
  );

  // รายการ Principal: ใช้ detail (แยก Princ ตามรหัสสินค้า กดเจาะได้) ถ้ามี ไม่งั้นใช้ตารางสรุปหลัก
  const princs = useMemo(() => {
    const src = detail
      ? selDetail.map((r) => ({ company: r.company, princ: r.principal, value: r[metric] }))
      : selRows.map((r) => ({ company: r.company, princ: r.princ, value: r[metric] }));
    const map = new Map<string, { princ: string; value: number; companies: Set<string> }>();
    for (const r of src) {
      const k = r.princ || '(ไม่ระบุ)';
      const cur = map.get(k) ?? { princ: k, value: 0, companies: new Set<string>() };
      cur.value += r.value;
      cur.companies.add(r.company);
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [detail, selDetail, selRows, metric]);
  const selTotal = princs.reduce((s, p) => s + p.value, 0);
  const maxPrinc = Math.max(...princs.map((p) => p.value), 1);
  const sellerCount = detail ? new Set(selDetail.map((r) => `${r.company}|${r.seller}`)).size : selRows.length;

  // ── เจาะดู Principal ที่เลือก: สาขา / เซลล์ ──
  const activePrinc = princ && princs.some((p) => p.princ === princ) ? princ : null;
  const drill = useMemo(() => {
    if (!activePrinc || !detail) return null;
    const list = selDetail.filter((r) => r.principal === activePrinc);
    const sum = list.reduce((s, r) => s + r[metric], 0);
    // แต่ละสาขา: ยอดรวม + เซลล์ในสาขานั้น (เรียงยอดมาก → น้อย)
    const branches = rankBy(list, (r) => r.branch || '-', (r) => r[metric])
      .sort((a, b) => b.value - a.value || branchRank(a.key) - branchRank(b.key))
      .map((b) => ({
        ...b,
        sellers: rankBy(b.rows, (r) => `${r.company}|${r.seller}`, (r) => r[metric]).map((s) => ({
          ...s, company: s.rows[0].company, seller: s.rows[0].seller, name: sellerNames[s.rows[0].seller] ?? '',
        })),
      }));
    const sellers = rankBy(list, (r) => `${r.company}|${r.seller}`, (r) => r[metric]).map((s) => {
      const r0 = s.rows[0];
      const branch = rankBy(s.rows, (r) => r.branch || '-', (r) => r[metric])[0]?.key ?? '-';
      return { ...s, company: r0.company, seller: r0.seller, name: sellerNames[r0.seller] ?? '', branch };
    });
    return { sum, branches, sellers };
  }, [activePrinc, detail, selDetail, metric, sellerNames]);

  const openPrinc = (p: string) => {
    if (!detail) return;
    const next = activePrinc === p ? null : p;
    setPrinc(next);
    setOpenBranches(new Set());
    if (next) requestAnimationFrame(() => drillRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  const pickCompany = (co: string) => { setSelected(co); setPrinc(null); };
  const topSellerKey = drill?.sellers[0]?.key;

  const lens = byCompany.map((c) => (total > 0 ? (Math.max(c.value, 0) / total) * C : 0));
  const slices = byCompany.map((c, i) => ({
    ...c,
    len: lens[i],
    offset: lens.slice(0, i).reduce((s, l) => s + l, 0), // ความยาวสะสมของชิ้นก่อนหน้า
    pct: total ? (c.value / total) * 100 : 0,
  }));

  const label = metric.toUpperCase();
  const barColor = sel === ALL ? '#1F66E5' : COMPANY_COLORS[sel];
  const pctOf = (v: number, base: number) => (base ? `${((v / base) * 100).toFixed(1)}%` : '–');

  return (
    <section className="card share">
      <header className="card-head">
        <div>
          <h3 className="card-title">สัดส่วนยอดขาย</h3>
          <p className="card-sub">เลือกบริษัท → กด Principal เพื่อดูว่าสาขาไหน / เซลล์คนไหนขายดีที่สุด</p>
        </div>
        <div className="seg" role="tablist" aria-label="ตัวชี้วัด">
          {(['giv', 'niv'] as Metric[]).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={metric === m}
              className={metric === m ? 'on' : ''} onClick={() => setMetric(m)}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* ── ภาพรวม: วงล้อม + การ์ดบริษัท ── */}
      <div className="share-top">
        <svg viewBox="0 0 180 180" className="share-donut" role="img" aria-label={`สัดส่วน ${label} ตามบริษัท`}>
          <circle cx="90" cy="90" r={R} fill="none" stroke="#F0F0F3" strokeWidth={STROKE} />
          {slices.map((s) => s.len > 0 && (
            <circle
              key={s.company}
              cx="90" cy="90" r={R} fill="none"
              stroke={COMPANY_COLORS[s.company] ?? '#9C9C9C'}
              strokeWidth={STROKE}
              strokeDasharray={`${Math.max(s.len - GAP, 0.5)} ${C}`}
              strokeDashoffset={-s.offset}
              transform="rotate(-90 90 90)"
              opacity={sel === ALL || sel === s.company ? 1 : 0.25}
              className="share-slice"
              onClick={() => pickCompany(sel === s.company ? ALL : s.company)}
            >
              <title>{`${s.company}: ${fmtNum(s.value)} (${s.pct.toFixed(1)}%)`}</title>
            </circle>
          ))}
          <text x="90" y="80" textAnchor="middle" className="donut-cap">{sel === ALL ? `${label} รวม` : sel}</text>
          <text x="90" y="102" textAnchor="middle" className="donut-val">{fmtShort(sel === ALL ? total : selTotal)}</text>
          <text x="90" y="120" textAnchor="middle" className="donut-cap">
            {sel === ALL ? `${companies.length} บริษัท` : `${total ? ((selTotal / total) * 100).toFixed(1) : '0.0'}%`}
          </text>
        </svg>

        <div className="share-tiles">
          <button type="button" className={`tile ${sel === ALL ? 'on' : ''}`} onClick={() => pickCompany(ALL)} aria-pressed={sel === ALL}>
            <span className="tile-name">ทั้งหมด</span>
            <span className="tile-val">{fmtShort(total)}</span>
            <span className="tile-meta">100% · {rows.length} เซลล์</span>
          </button>
          {slices.map((s) => (
            <button key={s.company} type="button" className={`tile ${sel === s.company ? 'on' : ''}`}
              onClick={() => pickCompany(s.company)} aria-pressed={sel === s.company}>
              <span className="tile-name"><span className="dot" style={{ background: COMPANY_COLORS[s.company] }} />{s.company}</span>
              <span className="tile-val">{fmtShort(s.value)}</span>
              <span className="tile-meta">{s.pct.toFixed(1)}% · {s.sellers} เซลล์</span>
              <span className="tile-share"><span style={{ width: `${s.pct}%`, background: COMPANY_COLORS[s.company] }} /></span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Principal ของที่เลือก: แสดงครบทุกตัว เรียงยอดมาก → น้อย · กดเพื่อเจาะดู ── */}
      <div className="share-detail">
        <div className="share-detail-head">
          <span className="eyebrow">Principal · {sel}{detail ? ' · กดเพื่อดูสาขา / เซลล์' : ''}</span>
          <span className="share-stats">
            <span><b>{fmtNum(selTotal)}</b> บาท</span>
            <span><b>{total ? ((selTotal / total) * 100).toFixed(1) : '0.0'}%</b> ของทั้งหมด</span>
            <span><b>{princs.length}</b> Principal</span>
            <span><b>{sellerCount}</b> เซลล์</span>
          </span>
        </div>
        <ol className="princ-grid">
          {princs.map((p, i) => {
            const on = activePrinc === p.princ;
            const inner = (
              <>
                <span className="princ-rank">{i + 1}</span>
                <span className="princ-main">
                  <span className="princ-name">
                    {p.princ}
                    {sel === ALL && [...p.companies].map((c) => (
                      <span key={c} className="princ-co" style={{ color: COMPANY_COLORS[c] }}>{c}</span>
                    ))}
                  </span>
                  <span className="princ-bar">
                    <span style={{ width: `${Math.max((p.value / maxPrinc) * 100, 0)}%`, background: barColor }} />
                  </span>
                </span>
                <span className="princ-num">
                  <span className="princ-val">{fmtShort(p.value)}</span>
                  <span className="princ-share">{selTotal ? ((p.value / selTotal) * 100).toFixed(1) : '0.0'}%</span>
                </span>
              </>
            );
            return (
              <li key={p.princ} className={`princ${detail ? ' princ-click' : ''}${on ? ' on' : ''}`} title={`${p.princ}: ${fmtNum(p.value)}`}>
                {detail
                  ? <button type="button" className="princ-btn" onClick={() => openPrinc(p.princ)} aria-expanded={on}>{inner}</button>
                  : inner}
              </li>
            );
          })}
        </ol>
        {princs.length === 0 && <p className="empty">ไม่มีข้อมูล</p>}
      </div>

      {/* ── เจาะดู Principal: สาขา / เซลล์ ที่ขายได้มากที่สุด ── */}
      {drill && activePrinc && (
        <div className="drill" ref={drillRef}>
          <div className="drill-head">
            <div>
              <span className="eyebrow">เจาะดู Principal</span>
              <h4 className="drill-title">{activePrinc}<span className="muted"> · {sel === ALL ? 'ทุกบริษัท' : sel}</span></h4>
            </div>
            <button type="button" className="clear-btn" onClick={() => setPrinc(null)}>ปิด ✕</button>
          </div>

          <div className="drill-kpis">
            <div className="drill-kpi">
              <span className="eyebrow">{label} รวม</span>
              <b>{fmtInt(drill.sum)}</b>
              <span className="muted">{pctOf(drill.sum, selTotal)} ของ {sel === ALL ? 'ทั้งหมด' : sel}</span>
            </div>
            <div className="drill-kpi hl">
              <span className="eyebrow">🏆 สาขาขายดีสุด</span>
              <b>{drill.branches[0]?.key ?? '–'}</b>
              <span className="muted">{drill.branches[0] ? `${fmtShort(drill.branches[0].value)} · ${pctOf(drill.branches[0].value, drill.sum)}` : ''}</span>
            </div>
            <div className="drill-kpi hl">
              <span className="eyebrow">🏆 เซลล์ยอดสูงสุด</span>
              <b className="drill-who">{drill.sellers[0] ? (drill.sellers[0].name || withType(drill.sellers[0].seller)) : '–'}</b>
              <span className="muted">{drill.sellers[0] ? `${withType(drill.sellers[0].seller)} · ${drill.sellers[0].branch} · ${fmtShort(drill.sellers[0].value)}` : ''}</span>
            </div>
            <div className="drill-kpi">
              <span className="eyebrow">ครอบคลุม</span>
              <b>{drill.branches.length} สาขา · {drill.sellers.length} เซลล์</b>
              <span className="muted">เฉลี่ย {fmtShort(drill.sellers.length ? drill.sum / drill.sellers.length : 0)} / เซลล์</span>
            </div>
          </div>

          {/* ── แยกตามสาขา: หัวสาขา (ยอดรวม / %) แล้วตามด้วยเซลล์ในสาขานั้น ── */}
          <span className="eyebrow">ยอดตามสาขา · เซลล์ในแต่ละสาขา</span>
          <div className="drill-branches">
            {drill.branches.map((b, i) => {
              const open = openBranches.has(b.key);
              const shown = open ? b.sellers : b.sellers.slice(0, BRANCH_SELLERS);
              return (
                <div key={b.key} className={`drill-branch${i === 0 ? ' top' : ''}`}>
                  <div className="drill-branch-head">
                    <span className={`drill-rank${i === 0 ? ' gold' : ''}`}>{i + 1}</span>
                    <span className="drill-main">
                      <span className="drill-row">
                        <span><b className="drill-branch-name">{b.key}</b> <span className="muted">· {b.sellers.length} เซลล์</span></span>
                        <span className="drill-val"><b>{fmtInt(b.value)}</b> <span className="muted">{pctOf(b.value, drill.sum)}</span></span>
                      </span>
                      <span className="princ-bar"><span style={{ width: `${Math.max((b.value / (drill.branches[0]?.value || 1)) * 100, 0)}%`, background: barColor }} /></span>
                    </span>
                  </div>
                  <ol className="drill-list">
                    {shown.map((s, j) => (
                      <li key={s.key}>
                        <span className="drill-rank sm">{j + 1}</span>
                        <span className="drill-row">
                          <span className="drill-seller">
                            <b>
                              {s.name || withType(s.seller)}
                              {s.key === topSellerKey && <span className="drill-top">🏆 Top</span>}
                            </b>
                            {/* ไม่มีชื่อในชีต (เช่นรหัส SDO ย่อย) → บรรทัดบนเป็นรหัสแล้ว บรรทัดล่างบอกบริษัทแทน */}
                            <span className="muted"><span className="dot" style={{ background: COMPANY_COLORS[s.company] }} />{s.name ? withType(s.seller) : s.company}</span>
                          </span>
                          <span className="drill-val"><b>{fmtInt(s.value)}</b> <span className="muted">{pctOf(s.value, b.value)}</span></span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  {b.sellers.length > BRANCH_SELLERS && (
                    <button type="button" className="clear-btn drill-more" onClick={() => toggleBranch(b.key)}>
                      {open ? 'ย่อ' : `ดูทั้งหมด ${b.sellers.length} คน`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
