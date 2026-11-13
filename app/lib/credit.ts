// ร้านเครดิต: รวมเซลล์เครดิตในช่วง + สรุป Active Store / บิล / GIV รายเดือน — ใช้ทั้งหน้า /dashboard/credit และไฟล์ Excel
import 'server-only';
import { addDays, getCreditSummary, getLG014Summary, monthToRange, type CreditRow } from '@/app/lib/api';
import { getTargets } from '@/app/lib/targets';
import { sellerTypeOf } from '@/app/lib/sellerType';
import { normalizeCompany } from '@/app/lib/period';

export const CREDIT_MAX_MONTHS = 12;

export type SellerSum = {
  key: string; company: string; seller: string; name: string; branch: string; princ: string;
  stores: number; regular: number; giv: number; niv: number; bills: number;
  monthStores: number; monthRepeat: number; // ผลรวมรายเดือน (ไว้คิด % ร้านเดิมเฉลี่ย)
  months: CreditRow[];
};

export type CreditData = {
  sellers: SellerSum[];
  ready: boolean; // รัน seller_kpi.sql แล้วหรือยัง
  from: string; rangeEnd: string; givTo: string;
};

// ช่วง [from, rangeEnd) · เดือนปลายทางที่ยังไม่จบนับถึงวันที่ข้อมูลล่าสุด
export function creditRange(fromYM: string, toYM: string, latestDate: string) {
  const monthEnd = addDays(monthToRange(toYM).endDate, 1);
  const rangeEnd = latestDate < monthEnd ? addDays(latestDate, 1) : monthEnd;
  return { from: `${fromYM}-01`, rangeEnd, givTo: addDays(rangeEnd, -1) };
}

export async function loadCreditSellers(opts: {
  fromYM: string; toYM: string; latestDate: string; months: string[]; companies: string[];
}): Promise<CreditData> {
  const { fromYM, toYM, latestDate, months, companies } = opts;
  const { from, rangeEnd, givTo } = creditRange(fromYM, toYM, latestDate);

  // เซลล์ที่มียอดในช่วง + ประเภท / ชื่อ / สาขา จากชีต (เดือนล่าสุดชนะ)
  const [block, targets] = await Promise.all([
    getLG014Summary({ startDate: from, endDate: givTo }),
    getTargets(months[0] ?? fromYM, toYM).catch(() => ({ rows: [], months: [], updatedAt: '' })),
  ]);
  const channels: Record<string, string> = {};
  const names: Record<string, string> = {};
  const branches: Record<string, string> = {};
  // รหัสเดียวกันใช้คนละบริษัทได้ (เช่น RCR001 / KCR001: DC = KHA คนหนึ่ง · PDC = อีกคน) → ชื่อ / สาขาเก็บแยก "บริษัท|เซลล์"
  for (const t of [...targets.rows].sort((a, b) => a.ym.localeCompare(b.ym))) {
    const k = `${normalizeCompany(t.company)}|${t.seller}`;
    if (t.channel) channels[t.seller] = t.channel;
    if (t.name) names[k] = t.name;
    if (t.branch) branches[k] = t.branch;
  }
  const credit = block.bySeller
    .map((r) => ({ company: normalizeCompany(r.Company), seller: r.Seller, princ: r.Company === 'SDO' ? 'P&G' : r.Princ ?? '' }))
    .filter((r) => companies.includes(r.company) && sellerTypeOf(r.company, r.seller, channels) === 'CREDIT');
  const keys = credit.map((r) => `${r.company}|${r.seller}`);
  const princOf = new Map(credit.map((r) => [`${r.company}|${r.seller}`, r.princ]));

  const summary = keys.length ? await getCreditSummary(keys, from, rangeEnd) : [];
  const byKey = new Map<string, SellerSum>();
  for (const r of summary ?? []) {
    const key = `${r.company}|${r.seller}`;
    let s = byKey.get(key);
    if (!s) {
      byKey.set(key, (s = {
        key, company: r.company, seller: r.seller, name: names[key] ?? '', branch: branches[key] ?? '', princ: princOf.get(key) ?? '',
        stores: 0, regular: 0, giv: 0, niv: 0, bills: 0, monthStores: 0, monthRepeat: 0, months: [],
      }));
    }
    if (r.ym === 'ALL') {
      s.stores = r.stores; s.regular = r.repeatStores; s.giv = r.giv; s.niv = r.niv; s.bills = r.bills;
    } else {
      s.months.push(r); s.monthStores += r.stores; s.monthRepeat += r.repeatStores;
    }
  }
  return {
    sellers: [...byKey.values()].sort((a, b) => b.giv - a.giv),
    ready: summary !== null,
    from, rangeEnd, givTo,
  };
}
