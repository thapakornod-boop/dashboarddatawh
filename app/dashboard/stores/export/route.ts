// Export Excel ภาพรวม ยอดขายรายร้าน: GET /dashboard/stores/export?from=&to=&company=
//   ทุกร้านในช่วงเดือนที่เลือก (ไม่เกิน 12 เดือน) — สรุปรายบริษัท + ร้านทั้งหมด (ยอดรายเดือน)
import type { NextRequest } from 'next/server';
import { addDays, getAvailableMonths, getLatestDate, getStoreExport, monthToRange, type StoreExport } from '@/app/lib/api';
import { currentEmployee } from '@/app/lib/session';
import { COMPANY_ORDER, companyFromParams, formatDate, formatRange, rangeFromParams } from '@/app/lib/period';
import { buildWorkbook, exportedAt, XLSX_TYPE } from '@/app/lib/xlsx';
import { storeOverviewSheets, type StoreAllX } from '@/app/lib/exportSheets';

export const maxDuration = 300;
const MAX_MONTHS = 12;

// ดึงช่วง [from, to) ของบริษัทเดียว — เกิน statement timeout ก็แบ่งครึ่งช่วงวันแล้วลองใหม่ (ช่วงสั้นสุด 2 วัน)
async function fetchChunk(co: string, from: string, to: string): Promise<StoreExport[] | null> {
  try {
    const got = await getStoreExport([co], from, to);
    return got ? [got] : null;
  } catch (err) {
    const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
    if (!(err instanceof Error && /57014|statement timeout/.test(err.message)) || days < 2) throw err;
    const mid = addDays(from, Math.floor(days / 2));
    const a = await fetchChunk(co, from, mid);
    const b = await fetchChunk(co, mid, to);
    return a && b ? [...a, ...b] : null;
  }
}

export async function GET(request: NextRequest) {
  if (!(await currentEmployee())) return new Response('unauthorized', { status: 401 });
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const company = companyFromParams(params);
  const companies = company === 'all' ? COMPANY_ORDER : [company];
  try {
    const [latestDate, months] = await Promise.all([getLatestDate(), getAvailableMonths()]);
    const { fromYM, toYM } = rangeFromParams(params, months, latestDate);
    const rangeMonths = months.filter((m) => m >= fromYM && m <= toYM);
    if (rangeMonths.length > MAX_MONTHS) {
      return new Response(`เลือกช่วงได้ไม่เกิน ${MAX_MONTHS} เดือน`, { status: 400 });
    }
    const monthEnd = addDays(monthToRange(toYM).endDate, 1);
    const rangeEnd = latestDate < monthEnd ? addDays(latestDate, 1) : monthEnd;
    // ดึงทีละ บริษัท × เดือน (ครั้งละไม่กี่วินาที) ทีละ 4 ชุดพร้อมกัน — ดึงรวดเดียวหลายเดือนจะเกิน statement timeout ของ Supabase
    const jobs = companies.flatMap((co) => rangeMonths.map((ym) => {
      const next = addDays(monthToRange(ym).endDate, 1);
      return { co, from: `${ym}-01`, to: next < rangeEnd ? next : rangeEnd };
    }));
    const parts: StoreExport[] = [];
    for (let i = 0; i < jobs.length; i += 2) {
      const got = await Promise.all(jobs.slice(i, i + 2).map((j) => fetchChunk(j.co, j.from, j.to)));
      if (got.some((g) => !g)) return new Response('ยังไม่ได้รัน supabase/export.sql ใน Supabase', { status: 503 });
      for (const g of got) parts.push(...g!);
    }

    const map = new Map<string, StoreAllX>();
    for (const [co, code, rsm, name] of parts.flatMap((p) => p.stores)) {
      if (!map.has(`${co}|${code}`)) map.set(`${co}|${code}`, { company: co, cardcode: code, rsmcode: rsm, name, giv: rangeMonths.map(() => 0), niv: 0, bills: 0, lastD: null });
    }
    for (const [co, code, ym, giv, niv, bills, lastD] of parts.flatMap((p) => p.rows)) {
      const s = map.get(`${co}|${code}`);
      const i = rangeMonths.indexOf(ym);
      if (!s || i < 0) continue;
      s.giv[i] += Number(giv);
      s.niv += Number(niv);
      s.bills += Number(bills);
      if (lastD && (!s.lastD || lastD > s.lastD)) s.lastD = lastD;
    }
    const stores = [...map.values()].filter((s) => s.bills > 0 || s.giv.some((v) => v));

    const info: [string, string][] = [
      ['ช่วงเดือน', `${formatRange(fromYM, toYM)} (${formatDate(`${fromYM}-01`)} – ${formatDate(addDays(rangeEnd, -1))})`],
      ['บริษัท', company === 'all' ? 'ทั้งหมด (SDO / PDC / DC)' : company],
      ['ประเภทไฟล์', 'ภาพรวม — ทุกร้านในช่วงที่เลือก'],
      ['Export เมื่อ', exportedAt()],
    ];
    const buf = await buildWorkbook(storeOverviewSheets(stores, rangeMonths, info));
    const name = `ยอดขายรายร้าน-ภาพรวม-${fromYM}${toYM !== fromYM ? `_${toYM}` : ''}${company !== 'all' ? `-${company}` : ''}.xlsx`;
    return new Response(buf, {
      headers: {
        'Content-Type': XLSX_TYPE,
        'Content-Disposition': `attachment; filename="stores-overview.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : 'ทำไฟล์ไม่สำเร็จ', { status: 500 });
  }
}
