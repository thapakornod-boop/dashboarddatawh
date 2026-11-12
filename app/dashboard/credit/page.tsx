// ร้านเครดิต: เซลล์เครดิตแต่ละคนขายกี่ร้าน ยอดเท่าไหร่ และ "ขายร้านเดิม ๆ ทุกเดือนไหม"
//   - เซลล์เครดิต = ประเภท Credit ตาม lib/sellerType (Channel ในชีต: Credit / MAS · หรือรหัส MS / ASM / DSM / CR)
//   - ยอด / ร้าน จากตารางสรุป sales_store_daily ผ่าน RPC credit_summary / credit_seller_stores (supabase/seller_kpi.sql)
//   - ร้านเดิม = ร้านที่ซื้อเดือนนั้น และเดือนก่อนหน้าก็ซื้อจากเซลล์คนเดียวกัน · ร้านประจำ = ซื้อทุกเดือนในช่วง
// ช่วงเดือน / บริษัท ตามตัวกรองด้านบน (?from=&to=&company=) + ?seller=PDC|RCR001 เซลล์ที่เลือกดูรายร้าน
import { getAvailableMonths, getCreditSellerStores, getLatestDate, type CreditStoreRow } from '@/app/lib/api';
import { requireEmployee } from '@/app/lib/session';
import { CREDIT_MAX_MONTHS, loadCreditSellers, type SellerSum } from '@/app/lib/credit';
import { COMPANY_ORDER, companyFromParams, formatDate, formatRange, formatThaiMonth, rangeFromParams } from '@/app/lib/period';
import { COMPANY_COLORS, fmtInt, fmtShort } from '@/app/lib/format';
import { LoadingDone } from '@/app/components/Loading';
import CreditStoreGrid, { type CreditStore } from '@/app/components/CreditStoreGrid';
import CreditSellers from '@/app/components/CreditSellers';
import { Hero, RangeFilter } from '../parts';

const MAX_MONTHS = CREDIT_MAX_MONTHS;
const pctText = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : '–');

export default async function CreditPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireEmployee();
  const params = await searchParams;
  const companyFilter = companyFromParams(params);
  const companies = companyFilter === 'all' ? COMPANY_ORDER : [companyFilter];
  const sellerKey = typeof params.seller === 'string' ? params.seller : '';

  let errorMessage: string | null = null;
  let latestDate = '';
  let months: string[] = [];
  let fromYM = '';
  let toYM = '';
  let givTo = '';
  let rangeMonths: string[] = [];
  let tooLong = false;
  let ready = true; // รัน seller_kpi.sql แล้วหรือยัง
  let sellers: SellerSum[] = [];
  let storeRows: CreditStoreRow[] = [];

  try {
    [latestDate, months] = await Promise.all([getLatestDate(), getAvailableMonths()]);
    ({ fromYM, toYM } = rangeFromParams(params, months, latestDate));
    rangeMonths = months.filter((m) => m >= fromYM && m <= toYM);
    tooLong = rangeMonths.length > MAX_MONTHS;
    if (!tooLong) {
      const data = await loadCreditSellers({ fromYM, toYM, latestDate, months, companies });
      sellers = data.sellers;
      ready = data.ready;
      givTo = data.givTo;
      const picked = sellers.find((s) => s.key === sellerKey);
      if (picked) storeRows = await getCreditSellerStores(picked.company, picked.seller, data.from, data.rangeEnd);
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
  }

  const rangeLabel = fromYM ? formatRange(fromYM, toYM) : '';
  const n = rangeMonths.length;
  const keep = { from: fromYM, to: toYM, company: companyFilter };
  const picked = sellers.find((s) => s.key === sellerKey) ?? null;

  const total = sellers.reduce((s, x) => ({
    stores: s.stores + x.stores, regular: s.regular + x.regular, giv: s.giv + x.giv, bills: s.bills + x.bills,
    monthStores: s.monthStores + x.monthStores, monthRepeat: s.monthRepeat + x.monthRepeat,
  }), { stores: 0, regular: 0, giv: 0, bills: 0, monthStores: 0, monthRepeat: 0 });

  // ร้านของเซลล์ที่เลือก → 1 แถวต่อร้าน, ยอดรายเดือนเรียงตาม rangeMonths
  const stores: CreditStore[] = (() => {
    const map = new Map<string, CreditStore>();
    for (const r of storeRows) {
      const i = rangeMonths.indexOf(r.ym);
      if (i < 0) continue;
      let s = map.get(r.cardcode);
      if (!s) map.set(r.cardcode, (s = { cardcode: r.cardcode, name: r.name, giv: rangeMonths.map(() => 0), total: 0, active: 0, bills: 0 }));
      s.giv[i] += r.giv;
      s.bills = (s.bills ?? 0) + r.bills;
      s.total += r.giv;
    }
    for (const s of map.values()) s.active = s.giv.filter((v) => v > 0).length;
    return [...map.values()].sort((a, b) => b.total - a.total);
  })();

  return (
    <>
      <LoadingDone error={errorMessage} />
      <Hero
        crumb="แดชบอร์ด / ร้านเครดิต"
        title="ยอดขายรายร้านเครดิต"
        subtitle={`${rangeLabel}${companyFilter !== 'all' ? ` · ${companyFilter}` : ' · SDO / PDC / DC'}`}
        chips={latestDate ? [`ข้อมูลถึง ${formatDate(latestDate)}`] : []}
      />
      <main className="container">
        <RangeFilter months={months} fromYM={fromYM} toYM={toYM} company={companyFilter} />
        {picked && <input type="hidden" name="seller" value={picked.key} form="filter-form" />}

        {errorMessage && <p className="empty">โหลดข้อมูลไม่สำเร็จ — ลองกดค้นหาอีกครั้ง</p>}
        {!errorMessage && tooLong && <p className="note">เลือกช่วงได้ไม่เกิน {MAX_MONTHS} เดือน (ตอนนี้ {n} เดือน) — ปรับช่วงเดือนด้านบนแล้วกดค้นหา</p>}
        {!errorMessage && !tooLong && !ready && <p className="empty">รอข้อมูลร้านเครดิต — รัน supabase/seller_kpi.sql ใน Supabase ก่อน</p>}

        {!errorMessage && !tooLong && ready && (
          <>
            {/* ── ภาพรวมเซลล์เครดิต ── */}
            <section className="st-kpis st-kpis-6">
              <div className="st-kpi st-kpi-main">
                <span className="eyebrow">GIV ร้านเครดิต · {rangeLabel}</span>
                <span className="st-kpi-val">{fmtInt(total.giv)}</span>
                <span className="st-kpi-cap">{formatDate(`${fromYM}-01`)} – {formatDate(givTo)}</span>
              </div>
              <div className="st-kpi">
                <span className="eyebrow">เซลล์เครดิต</span>
                <span className="st-kpi-val">{fmtInt(sellers.length)} คน</span>
                <span className="st-kpi-cap">ที่มียอดขายในช่วง</span>
              </div>
              <div className="st-kpi">
                <span className="eyebrow">Active Store เฉลี่ย / เดือน</span>
                <span className="st-kpi-val">{fmtInt(total.monthStores / Math.max(n, 1))} ร้าน</span>
                <span className="st-kpi-cap">ร้านไม่ซ้ำที่ซื้อแต่ละเดือน (ซื้อกี่บิลก็นับ 1) · ทั้งช่วง {fmtInt(total.stores)} ร้าน</span>
              </div>
              <div className="st-kpi">
                <span className="eyebrow">จำนวนบิลเฉลี่ย / เดือน</span>
                <span className="st-kpi-val">{fmtInt(total.bills / Math.max(n, 1))} บิล</span>
                <span className="st-kpi-cap">ขายกี่ครั้งนับเท่านั้น · รวม {fmtInt(total.bills)} บิล</span>
              </div>
              <div className="st-kpi">
                <span className="eyebrow">ร้านเดิมจากเดือนก่อน</span>
                <span className="st-kpi-val">{pctText(total.monthRepeat, total.monthStores)}</span>
                <span className="st-kpi-cap">ร้านที่ซื้อเดือนนั้น และเดือนก่อนหน้าก็ซื้อ ÷ ร้านที่ซื้อเดือนนั้น</span>
              </div>
              <div className="st-kpi">
                <span className="eyebrow">บิลต่อร้าน</span>
                <span className="st-kpi-val">{total.monthStores ? (total.bills / total.monthStores).toLocaleString('th-TH', { maximumFractionDigits: 1 }) : '–'}</span>
                <span className="st-kpi-cap">บิล ÷ Active Store (เฉลี่ยร้านหนึ่งซื้อกี่ครั้ง/เดือน) · GIV/คน {sellers.length ? fmtShort(total.giv / sellers.length) : '–'}</span>
              </div>
            </section>

            {/* ── รายเซลล์: Active Store / บิล รายเดือน + ค่าเฉลี่ย ── */}
            <section className="card">
              <header className="card-head">
                <div>
                  <h3 className="card-title">เซลล์เครดิต · Active Store และจำนวนบิลรายเดือน</h3>
                  <p className="card-sub">
                    <b>Active</b> = จำนวนร้านไม่ซ้ำที่ซื้อ (ร้านเดียวซื้อกี่บิลก็นับ 1) ·
                    <b> บิล</b> = จำนวนครั้งที่ขาย (ร้านเดียวขาย 10 ครั้ง = 10 บิล) ·
                    <b> เฉลี่ย / เดือน</b> = รวมทุกเดือน ÷ {n} เดือน · กดชื่อเซลล์เพื่อดูรายร้าน ·
                    เซลล์เครดิต = Channel ในชีตเป็น Credit / MAS หรือรหัส MS / ASM / DSM / CR
                  </p>
                </div>
              </header>
              {sellers.length === 0 ? <p className="empty">ไม่มีเซลล์เครดิตที่มียอดในช่วงนี้</p> : (
                <CreditSellers
                  sellers={sellers.map((s) => ({
                    key: s.key, company: s.company, seller: s.seller, name: s.name, branch: s.branch, princ: s.princ,
                    stores: s.stores, giv: s.giv, bills: s.bills,
                    months: Object.fromEntries(s.months.map((m) => [m.ym, { stores: m.stores, bills: m.bills, giv: m.giv, repeat: m.repeatStores }])),
                  }))}
                  months={rangeMonths}
                  companies={companies}
                  pickedKey={picked?.key ?? ''}
                  hrefFor={Object.fromEntries(sellers.map((s) => [s.key, `?${new URLSearchParams({ ...keep, seller: s.key }).toString()}`]))}
                  exportInfo={{
                    rangeLabel: `${rangeLabel} (${formatDate(`${fromYM}-01`)} – ${formatDate(givTo)})`,
                    company: companyFilter === 'all' ? 'ทั้งหมด (SDO / PDC / DC)' : companyFilter,
                    overviewHref: `/dashboard/credit/export?${new URLSearchParams(keep).toString()}`,
                    fileTag: `${fromYM}${toYM !== fromYM ? `_${toYM}` : ''}`,
                  }}
                  pickedStores={picked ? stores : undefined}
                />
              )}
            </section>

            {/* ── เซลล์ที่เลือก: รายเดือน + รายร้าน ── */}
            {picked && (
              <section className="card" id="credit-detail">
                <header className="card-head">
                  <div>
                    <h3 className="card-title">{picked.name || picked.seller} · ร้านที่ขายในแต่ละเดือน</h3>
                    <p className="card-sub">
                      <span className="dot" style={{ background: COMPANY_COLORS[picked.company] }} />{picked.company} · {picked.seller}{picked.branch ? ` · ${picked.branch}` : ''} ·
                      {' '}{fmtInt(picked.stores)} ร้าน · GIV {fmtInt(picked.giv)}
                    </p>
                  </div>
                </header>

                <table className="rtable credit-month-table">
                  <thead>
                    <tr><th>เดือน</th><th className="r">Active Store</th><th className="r">บิล</th><th className="r">ร้านเดิมจากเดือนก่อน</th><th className="r">ร้านใหม่ / กลับมาซื้อ</th><th className="r">% ร้านเดิม</th><th className="r">GIV</th><th className="r">GIV / ร้าน</th></tr>
                  </thead>
                  <tbody>
                    {rangeMonths.map((ym) => {
                      const m = picked.months.find((x) => x.ym === ym);
                      const rate = m && m.stores ? (m.repeatStores / m.stores) * 100 : null;
                      return (
                        <tr key={ym}>
                          <td className="strong">{formatThaiMonth(ym)}</td>
                          <td data-label="Active Store" className="r strong">{m ? fmtInt(m.stores) : '–'}</td>
                          <td data-label="บิล" className="r strong">{m ? fmtInt(m.bills) : '–'}</td>
                          <td data-label="ร้านเดิมจากเดือนก่อน" className="r">{m ? fmtInt(m.repeatStores) : '–'}</td>
                          <td data-label="ร้านใหม่ / กลับมาซื้อ" className="r">{m ? fmtInt(m.stores - m.repeatStores) : '–'}</td>
                          <td data-label="% ร้านเดิม" className="r">
                            {rate == null ? '–' : <span className={`sc-chip ${rate >= 70 ? 'up' : rate >= 50 ? 'mid' : 'down'}`}>{rate.toFixed(0)}%</span>}
                          </td>
                          <td data-label="GIV" className="r strong">{m ? fmtInt(m.giv) : '–'}</td>
                          <td data-label="GIV / ร้าน" className="r">{m && m.stores ? fmtInt(m.giv / m.stores) : '–'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <h4 className="cg-title">รายร้าน · ช่องสี = เดือนที่ซื้อ (ยิ่งเข้มยอดยิ่งมาก) · ช่องว่าง = ไม่ซื้อ</h4>
                <CreditStoreGrid stores={stores} months={rangeMonths} />
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
