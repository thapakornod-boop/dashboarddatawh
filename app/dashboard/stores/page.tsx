// ยอดขายรายร้าน: ค้นด้วย รหัสร้าน (cardcode) / RSM code / ชื่อร้าน → ภาพรวมร้าน (KPI / แนวโน้มรายเดือน / สัดส่วน Princ / บริษัท)
// ร้านเดียวกันคนละบริษัทผูกกันด้วย RSM code (vw_rsmcode) · ชื่อร้าน / ยอดขาย จาก vw_lg014 (ทุกเซลล์ ยกเว้น GSM)
// ช่วงเดือน / บริษัท ตามตัวกรองด้านบน (?from=&to=&company=) + ?q= คำค้น + ?store= ร้านที่เลือก
import {
  addDays, getAvailableMonths, getLatestDate, getStoreMonthly, getStoreSales, getTopStores, monthToRange, searchStores,
  type StoreHit, type StoreMonthRow, type StoreSalesRow,
} from '@/app/lib/api';
import { requireEmployee } from '@/app/lib/session';
import { lastYear } from '@/app/lib/scorecard';
import { COMPANY_ORDER, companyFromParams, formatDate, formatRange, rangeFromParams } from '@/app/lib/period';
import { COMPANY_COLORS, fmtInt, fmtShort } from '@/app/lib/format';
import { LoadingDone } from '@/app/components/Loading';
import StoreSearch from '@/app/components/StoreSearch';
import LoadingLink from '@/app/components/LoadingLink';
import StoreTrend, { type TrendMonth } from '@/app/components/StoreTrend';
import StoreFigures from '@/app/components/StoreFigures';
import StoreExport from '@/app/components/StoreExport';
import { Hero, RangeFilter } from '../parts';

type Group = { key: string; rsmcode: string | null; stores: StoreHit[] };

// ร้านที่ RSM code เดียวกัน = กลุ่มเดียวกัน · ไม่มี RSM code = ร้านเดี่ยว
function groupHits(hits: StoreHit[]): Group[] {
  const map = new Map<string, Group>();
  for (const h of hits) {
    const key = h.rsmcode ?? `${h.company}|${h.cardcode}`;
    const g = map.get(key) ?? { key, rsmcode: h.rsmcode, stores: [] };
    g.stores.push(h);
    map.set(key, g);
  }
  return [...map.values()];
}

// ตารางรายละเอียด บริษัท × รหัสร้าน × Princ — ซ่อนไว้ก่อนตามที่ผู้บริหารขอ
const SHOW_DETAIL = false;

const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v.trim() : '');
const sum = (rows: { giv: number; niv: number; bills: number }[]) =>
  rows.reduce((s, r) => ({ giv: s.giv + r.giv, niv: s.niv + r.niv, bills: s.bills + r.bills }), { giv: 0, niv: 0, bills: 0 });

export default async function StoreSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireEmployee();
  const params = await searchParams;
  const companyFilter = companyFromParams(params);
  const companies = companyFilter === 'all' ? COMPANY_ORDER : [companyFilter];
  let q = str(params.q).slice(0, 60);
  const storeKey = str(params.store);

  let errorMessage: string | null = null;
  let latestDate = '';
  let months: string[] = [];
  let fromYM = '';
  let toYM = '';
  let givTo = '';
  let groups: Group[] = [];
  let selected: Group | null = null;
  let sales: StoreSalesRow[] = [];
  let monthly: StoreMonthRow[] | null = null;
  let monthlyPrev: StoreMonthRow[] | null = null; // ช่วงเดียวกันของปีก่อน (ถึงวันเดียวกัน)
  // ยังไม่ได้ค้น → แสดงร้านตัวอย่าง (ยอดสูงสุดของวันล่าสุด) ให้ดูก่อน
  let examples: (StoreHit & { giv: number })[] = [];
  let isExample = false;
  let topFromYM = '';

  try {
    [latestDate, months] = await Promise.all([getLatestDate(), getAvailableMonths()]);
    ({ fromYM, toYM } = rangeFromParams(params, months, latestDate));
    const monthEnd = addDays(monthToRange(toYM).endDate, 1);
    const rangeEnd = latestDate < monthEnd ? addDays(latestDate, 1) : monthEnd;
    givTo = addDays(rangeEnd, -1);
    if (!q) {
      // ร้านยอดสูงสุดตามเดือนที่เลือก (ช่วงยาวใช้ 3 เดือนสุดท้าย ให้โหลดเร็ว)
      topFromYM = months.filter((m) => m >= fromYM && m <= toYM).slice(-3)[0] ?? toYM;
      examples = await getTopStores(`${topFromYM}-01`, rangeEnd);
      const first = examples[0];
      if (first) { q = first.rsmcode ?? first.cardcode; isExample = true; }
    }
    if (q.length >= 2) {
      groups = groupHits(await searchStores(q));
      const wanted = isExample ? (examples[0].rsmcode ?? `${examples[0].company}|${examples[0].cardcode}`) : storeKey;
      selected = groups.find((g) => g.key === wanted) ?? (groups.length === 1 ? groups[0] : null);
      if (isExample) groups = selected ? [selected] : [];
      if (selected) {
        const keys = selected.stores.filter((s) => companies.includes(s.company)).map((s) => `${s.company}|${s.cardcode}`);
        if (keys.length) {
          const prev = lastYear({ from: `${fromYM}-01`, to: rangeEnd });
          [sales, monthly, monthlyPrev] = await Promise.all([
            getStoreSales(keys, `${fromYM}-01`, rangeEnd),
            getStoreMonthly(keys, `${fromYM}-01`, rangeEnd),
            getStoreMonthly(keys, prev.from, prev.to).catch(() => null),
          ]);
        }
      }
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
  }

  const rangeLabel = fromYM ? formatRange(fromYM, toYM) : '';
  const keep = { from: fromYM, to: toYM, company: companyFilter };
  const hrefFor = (g: Group) => `?${new URLSearchParams({ ...keep, q, store: g.key }).toString()}`;
  const nameOf = (g: Group) => g.stores.find((s) => s.name)?.name ?? '(ไม่มีชื่อร้าน)';

  // ── ตัวเลขภาพรวมร้าน ──
  const total = sum(sales);
  const byCo = COMPANY_ORDER.map((c) => ({ company: c, rows: sales.filter((r) => r.company === c) }))
    .filter((x) => x.rows.length)
    .map((x) => ({ ...x, ...sum(x.rows) }));
  const byPrinc = [...sales.reduce((m, r) => m.set(r.principal, [...(m.get(r.principal) ?? []), r]), new Map<string, StoreSalesRow[]>())]
    .map(([p, rows]) => ({ p, companies: [...new Set(rows.map((r) => r.company))], ...sum(rows) }))
    .sort((a, b) => b.giv - a.giv);

  const rangeMonths = months.filter((m) => m >= fromYM && m <= toYM);
  const trend: TrendMonth[] = rangeMonths.map((ym) => {
    const rows = (monthly ?? []).filter((r) => r.ym === ym);
    return {
      ym,
      byCo: Object.fromEntries(rows.map((r) => [r.company, r.giv])),
      total: rows.reduce((s, r) => s + r.giv, 0),
      bills: rows.reduce((s, r) => s + r.bills, 0),
    };
  });
  const activeMonths = trend.filter((m) => m.bills > 0).length;
  // บิลเดียวมีหลาย Princ ได้ → จำนวนบิลรวมนับจากยอดรายเดือน (ไม่ซ้ำ) ถ้ามี
  const bills = monthly ? monthly.reduce((s, r) => s + r.bills, 0) : total.bills;
  const lastBuy = (monthly ?? []).map((r) => r.lastD).filter(Boolean).sort().at(-1) ?? null;
  const daysSince = lastBuy ? Math.round((Date.parse(latestDate) - Date.parse(lastBuy)) / 86_400_000) : null;
  const pct = (v: number) => (total.giv ? `${((v / total.giv) * 100).toFixed(1)}%` : '–');
  // ── เฉลี่ยต่อเดือน / เทียบปีก่อน (YAGO) / ตารางรายเดือน ──
  const nMonths = Math.max(rangeMonths.length, 1);
  const prevTotal = (monthlyPrev ?? []).reduce((s, r) => s + r.giv, 0);
  const avgGiv = total.giv / nMonths;
  const storeName = selected ? nameOf(selected) : '';
  // บิลรวมของบริษัท: นับจากยอดรายเดือน (บิลเดียวหลาย Princ ไม่นับซ้ำ) ถ้ามี
  const coBills = (company: string, fallback: number) =>
    monthly ? monthly.filter((r) => r.company === company).reduce((s, r) => s + r.bills, 0) : fallback;
  const chip = (e: StoreHit & { giv: number }, i: number, extra: boolean) => (
    <LoadingLink key={`${e.company}|${e.cardcode}`} scrollToId="store-profile"
      className={`store-chip${i === 0 ? ' active' : ''}${extra ? ' extra' : ''}`}
      href={`?${new URLSearchParams({ ...keep, q: e.rsmcode ?? e.cardcode, store: e.rsmcode ?? `${e.company}|${e.cardcode}` }).toString()}`}>
      <span className="dot" style={{ background: COMPANY_COLORS[e.company] }} />
      <span className="store-chip-name">{e.name || e.cardcode}</span>
      <span className="store-chip-val">{fmtShort(e.giv)}</span>
    </LoadingLink>
  );

  return (
    <>
      <LoadingDone error={errorMessage} />
      <Hero
        crumb="แดชบอร์ด / ยอดขายรายร้าน"
        title="ยอดขายรายร้าน"
        subtitle={`${rangeLabel}${companyFilter !== 'all' ? ` · ${companyFilter}` : ' · SDO / PDC / DC'}`}
        chips={latestDate ? [`ข้อมูลถึง ${formatDate(latestDate)}`] : []}
      />
      <main className="container">
        <RangeFilter months={months} fromYM={fromYM} toYM={toYM} company={companyFilter} />
        {/* เปลี่ยนช่วงเดือนแล้วคำค้น / ร้านที่เลือกยังอยู่ */}
        {q && !isExample && <input type="hidden" name="q" value={q} form="filter-form" />}
        {selected && !isExample && <input type="hidden" name="store" value={selected.key} form="filter-form" />}

        {/* ── ค้นหา ── */}
        <section className="card st-search">
          <h3 className="card-title">ค้นหาร้านค้า</h3>
          <p className="card-sub">รหัสร้าน (cardcode) · RSM code · ชื่อร้าน — พิมพ์ 2 ตัวอักษรขึ้นไปจะมีรายการแนะนำ · ร้านเดียวกันในบริษัทอื่น (RSM code เดียวกัน) รวมให้อัตโนมัติ</p>
          <StoreSearch key={isExample ? '' : q} defaultQ={isExample ? '' : q} keep={keep} />

          {examples.length > 0 && (
            <div className="store-examples">
              <span className="field-label">ร้านยอด GIV สูงสุด {formatRange(topFromYM, toYM)}{topFromYM !== fromYM ? ' (3 เดือนล่าสุดของช่วง)' : ''} · กดเพื่อดู</span>
              <div className="store-chips">{examples.map((e, i) => chip(e, i, i >= 4))}</div>
              {/* มือถือ: ซ่อนร้านที่ 5 เป็นต้นไปไว้ใต้ "ดูเพิ่ม" (คอมโชว์ครบในแถวด้านบน) */}
              {examples.length > 4 && (
                <details className="store-more">
                  <summary>ดูอีก {examples.length - 4} ร้าน</summary>
                  <div className="store-chips">{examples.slice(4).map((e, i) => chip(e, i + 4, false))}</div>
                </details>
              )}
            </div>
          )}

          {q.length >= 2 && !errorMessage && groups.length === 0 && <p className="empty">ไม่พบร้านที่ตรงกับ “{q}”</p>}
          {groups.length > 1 && (
            <>
              <p className="st-count">พบ {groups.length}{groups.length >= 60 ? '+' : ''} ร้าน — เลือกร้านที่ต้องการ</p>
              <ul className="store-hits">
                {groups.map((g) => (
                  <li key={g.key}>
                    <LoadingLink href={hrefFor(g)} scrollToId="store-profile" className={`store-hit${selected?.key === g.key ? ' active' : ''}`}>
                      <span className="store-hit-name">{nameOf(g)}</span>
                      <span className="store-hit-codes">
                        {g.rsmcode && <span className="code">{g.rsmcode}</span>}
                        {g.stores.map((s) => (
                          <span key={`${s.company}|${s.cardcode}`} className="store-tag">
                            <span className="dot" style={{ background: COMPANY_COLORS[s.company] }} />{s.company} {s.cardcode}
                          </span>
                        ))}
                      </span>
                    </LoadingLink>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* ── Export Excel: ตาม filter (ร้านที่เลือก) / ภาพรวม (ทุกร้านในช่วง) ── */}
        {!errorMessage && fromYM && (
          <StoreExport
            store={selected && sales.length ? {
              name: storeName, rsmcode: selected.rsmcode,
              codes: selected.stores.filter((s) => companies.includes(s.company)).map((s) => ({ company: s.company, cardcode: s.cardcode })),
              rangeLabel, lastBuy, sales, monthly: monthly ?? [], months: rangeMonths, prevGiv: monthlyPrev ? prevTotal : null,
            } : null}
            company={companyFilter === 'all' ? 'ทั้งหมด (SDO / PDC / DC)' : companyFilter}
            rangeText={`${rangeLabel} (${formatDate(`${fromYM}-01`)} – ${formatDate(givTo)})`}
            overviewHref={`/dashboard/stores/export?${new URLSearchParams(keep).toString()}`}
            fileTag={`${fromYM}${toYM !== fromYM ? `_${toYM}` : ''}`}
          />
        )}

        {selected && (
          <>
            {/* ── โปรไฟล์ร้าน ── */}
            <section className="card st-profile" id="store-profile">
              <div className="st-avatar" aria-hidden="true">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l1.5-5h15L21 9M3 9h18M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3" />
                  <path d="M5 12v8h14v-8M10 20v-5h4v5" />
                </svg>
              </div>
              <div className="st-who">
                <div className="st-name">
                  {isExample && <span className="store-badge">ตัวอย่าง</span>}
                  <h2>{storeName}</h2>
                </div>
                <div className="st-ids">
                  {selected.rsmcode && <span className="st-id st-id-rsm">RSM {selected.rsmcode}</span>}
                  {selected.stores.length <= 4
                    ? selected.stores.map((s) => (
                      <span key={`${s.company}|${s.cardcode}`} className="st-id">
                        <span className="dot" style={{ background: COMPANY_COLORS[s.company] }} />{s.company} · {s.cardcode}
                      </span>
                    ))
                    // รหัสร้านเยอะ (เช่น 1 ร้านมีรหัสแยกทุก Princ) → สรุปจำนวนต่อบริษัท กดดูทั้งหมดได้
                    : COMPANY_ORDER.filter((c) => selected!.stores.some((s) => s.company === c)).map((c) => (
                      <span key={c} className="st-id">
                        <span className="dot" style={{ background: COMPANY_COLORS[c] }} />{c} · {selected!.stores.filter((s) => s.company === c).length} รหัส
                      </span>
                    ))}
                </div>
                {selected.stores.length > 4 && (
                  <details className="st-codes">
                    <summary>ดูรหัสร้านทั้งหมด ({selected.stores.length})</summary>
                    <div className="st-ids">
                      {selected.stores.map((s) => (
                        <span key={`${s.company}|${s.cardcode}`} className="st-id">
                          <span className="dot" style={{ background: COMPANY_COLORS[s.company] }} />{s.company} · {s.cardcode}
                        </span>
                      ))}
                    </div>
                  </details>
                )}
              </div>
              <div className="st-meta">
                <span>{rangeLabel}</span>
                <span className="muted">{formatDate(`${fromYM}-01`)} – {formatDate(givTo)}</span>
                {lastBuy && (
                  <span className={`st-last${daysSince !== null && daysSince > 30 ? ' warn' : ''}`}>
                    ซื้อล่าสุด {formatDate(lastBuy)}{daysSince !== null ? ` · ${daysSince === 0 ? 'วันนี้' : `${daysSince} วันก่อน`}` : ''}
                  </span>
                )}
              </div>
            </section>

            {sales.length === 0 ? (
              <section className="card"><p className="empty">ไม่มียอดขายในช่วงที่เลือก{companyFilter !== 'all' ? ` (บริษัท ${companyFilter})` : ''}</p></section>
            ) : (
              <>
                {/* ── KPI + ซื้อ Princ อะไรบ้าง (สลับ ยอดรวม / เฉลี่ยต่อเดือน ได้) ── */}
                <StoreFigures
                  giv={total.giv} niv={total.niv} bills={bills} prevGiv={prevTotal} nMonths={nMonths}
                  activeMonths={monthly ? activeMonths : null} rangeLabel={rangeLabel}
                  princs={byPrinc.map((x) => ({ p: x.p, companies: x.companies, giv: x.giv }))}
                  cos={byCo.map((c) => ({ company: c.company, giv: c.giv }))}
                  chart={
                    <section className="card">
                      <h3 className="card-title">GIV รายเดือน</h3>
                      <p className="card-sub">ชี้ / แตะที่แท่งเพื่อดูยอด{byCo.length > 1 ? ' · สีตามบริษัท' : ''} · เส้นประ = เฉลี่ยต่อเดือน {fmtShort(avgGiv)}</p>
                      {monthly ? <StoreTrend months={trend} companies={byCo.map((c) => c.company)} avg={avgGiv} />
                        : <p className="empty">รอข้อมูลรายเดือน — รัน supabase/store_monthly.sql ใน Supabase ก่อน</p>}
                    </section>
                  }
                />

                {/* ── ตารางรายละเอียด บริษัท × รหัสร้าน × Princ: ซ่อนไว้ก่อน (เปิดด้วย SHOW_DETAIL) ── */}
                {SHOW_DETAIL && (
                  <>
                <section className="card">
                  <h3 className="card-title">รายละเอียด บริษัท × รหัสร้าน × Princ</h3>
                  <table className="rtable store-table">
                    <thead>
                      <tr>
                        <th>รหัสร้าน</th>
                        <th>Princ</th>
                        <th className="r">GIV</th>
                        <th className="r">NIV</th>
                        <th className="r">บิล</th>
                        <th className="r">สัดส่วน</th>
                      </tr>
                    </thead>
                    {/* แยกกลุ่มตามบริษัท: หัวกลุ่ม (ยอดรวมบริษัท) อยู่บนสุด แล้วตามด้วยรหัสร้าน × Princ ของบริษัทนั้น */}
                    {byCo.map(({ company, rows, ...t }) => (
                      <tbody key={company} className="st-co">
                        <tr className="grp st-co-head" style={{ ['--co' as string]: COMPANY_COLORS[company] }}>
                          <td colSpan={2}>
                            <span className="st-co-name"><span className="dot" style={{ background: COMPANY_COLORS[company] }} />{company}</span>
                            <span className="muted st-co-sub"> · {new Set(rows.map((r) => r.cardcode)).size} รหัสร้าน · {rows.length} Princ</span>
                          </td>
                          <td data-label="GIV" className="r strong">{fmtInt(t.giv)}</td>
                          <td data-label="NIV" className="r">{fmtInt(t.niv)}</td>
                          <td data-label="บิล" className="r">{fmtInt(coBills(company, t.bills))}</td>
                          <td data-label="สัดส่วน" className="r strong">{pct(t.giv)}</td>
                        </tr>
                        {[...rows].sort((a, b) => b.giv - a.giv).map((r) => (
                          <tr key={`${r.cardcode}|${r.principal}`} className="st-co-row">
                            <td data-label="รหัสร้าน" className="muted"><span className="code">{r.cardcode}</span></td>
                            <td data-label="Princ" className="strong">{r.principal}</td>
                            <td data-label="GIV" className="r strong">{fmtInt(r.giv)}</td>
                            <td data-label="NIV" className="r">{fmtInt(r.niv)}</td>
                            <td data-label="บิล" className="r">{fmtInt(r.bills)}</td>
                            <td data-label="สัดส่วน" className="r muted">{pct(r.giv)}</td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                    <tfoot>
                      <tr>
                        <td colSpan={2}><b>รวมทั้งหมด</b></td>
                        <td data-label="GIV" className="r strong">{fmtInt(total.giv)}</td>
                        <td data-label="NIV" className="r strong">{fmtInt(total.niv)}</td>
                        <td data-label="บิล" className="r strong">{fmtInt(bills)}</td>
                        <td data-label="สัดส่วน" className="r strong">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </section>
                  </>
                )}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
