// Export Excel ภาพรวม ร้านเครดิต: GET /dashboard/credit/export?from=&to=&company=
//   เซลล์เครดิตทุกคน (ไม่ใช้ตัวกรองในตาราง) — สรุปรายบริษัท / Active Store และบิล / GIV รายเดือน / ร้านของทุกเซลล์
import type { NextRequest } from 'next/server';
import { getAvailableMonths, getCreditExport, getLatestDate } from '@/app/lib/api';
import { currentEmployee } from '@/app/lib/session';
import { CREDIT_MAX_MONTHS, loadCreditSellers } from '@/app/lib/credit';
import { COMPANY_ORDER, companyFromParams, formatDate, formatRange, rangeFromParams } from '@/app/lib/period';
import { buildWorkbook, exportedAt, XLSX_TYPE } from '@/app/lib/xlsx';
import { creditSheets, creditStoreSheet, type CreditStoreX } from '@/app/lib/exportSheets';

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (!(await currentEmployee())) return new Response('unauthorized', { status: 401 });
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const company = companyFromParams(params);
  const companies = company === 'all' ? COMPANY_ORDER : [company];
  try {
    const [latestDate, months] = await Promise.all([getLatestDate(), getAvailableMonths()]);
    const { fromYM, toYM } = rangeFromParams(params, months, latestDate);
    const rangeMonths = months.filter((m) => m >= fromYM && m <= toYM);
    if (rangeMonths.length > CREDIT_MAX_MONTHS) {
      return new Response(`เลือกช่วงได้ไม่เกิน ${CREDIT_MAX_MONTHS} เดือน`, { status: 400 });
    }
    const data = await loadCreditSellers({ fromYM, toYM, latestDate, months, companies });
    if (!data.ready) return new Response('ยังไม่ได้รัน supabase/seller_kpi.sql ใน Supabase', { status: 503 });

    const info: [string, string][] = [
      ['ช่วงเดือน', `${formatRange(fromYM, toYM)} (${formatDate(data.from)} – ${formatDate(data.givTo)})`],
      ['บริษัท', company === 'all' ? 'ทั้งหมด (SDO / PDC / DC)' : company],
      ['ประเภทไฟล์', 'ภาพรวม — เซลล์เครดิตทุกคน ไม่ใช้ตัวกรองในตาราง'],
      ['Export เมื่อ', exportedAt()],
    ];
    const sellers = data.sellers.map((s) => ({
      ...s, months: Object.fromEntries(s.months.map((m) => [m.ym, { stores: m.stores, bills: m.bills, giv: m.giv, repeat: m.repeatStores }])),
    }));
    const sheets = creditSheets(sellers, rangeMonths, info);

    // ร้านของทุกเซลล์ (supabase/export.sql) — ยังไม่ได้รันก็ยังได้ไฟล์ แค่ไม่มีชีตรายร้าน
    const keys = data.sellers.map((s) => s.key);
    const st = keys.length ? await getCreditExport(keys, data.from, data.rangeEnd) : null;
    if (st) {
      const names = new Map(st.names.map(([co, code, name]) => [`${co}|${code}`, name ?? '']));
      const sellerName = new Map(data.sellers.map((s) => [s.key, s.name]));
      const map = new Map<string, CreditStoreX>();
      for (const [co, seller, code, ym, giv, bills] of st.rows) {
        const i = rangeMonths.indexOf(ym);
        if (i < 0) continue;
        const k = `${co}|${seller}|${code}`;
        let s = map.get(k);
        if (!s) map.set(k, (s = { company: co, seller, sellerName: sellerName.get(`${co}|${seller}`) ?? '', cardcode: code, name: names.get(`${co}|${code}`) ?? '', giv: rangeMonths.map(() => 0), bills: 0 }));
        s.giv[i] += Number(giv);
        s.bills += Number(bills);
      }
      const order = new Map(data.sellers.map((s, i) => [s.key, i]));
      const stores = [...map.values()].sort((a, b) =>
        (order.get(`${a.company}|${a.seller}`) ?? 0) - (order.get(`${b.company}|${b.seller}`) ?? 0) ||
        b.giv.reduce((x, y) => x + y, 0) - a.giv.reduce((x, y) => x + y, 0));
      sheets.push(creditStoreSheet(stores, rangeMonths, info, 'ร้านเครดิต · ร้านของเซลล์ทุกคน (GIV รายเดือน)'));
    }

    const buf = await buildWorkbook(sheets);
    const name = `ร้านเครดิต-ภาพรวม-${fromYM}${toYM !== fromYM ? `_${toYM}` : ''}${company !== 'all' ? `-${company}` : ''}.xlsx`;
    return new Response(buf, {
      headers: {
        'Content-Type': XLSX_TYPE,
        'Content-Disposition': `attachment; filename="credit-overview.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : 'ทำไฟล์ไม่สำเร็จ', { status: 500 });
  }
}
