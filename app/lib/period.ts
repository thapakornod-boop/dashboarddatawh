// ตัวช่วยร่วมของหน้า dashboard ทุกหน้า: ชื่อเดือนไทย / ช่วงเดือนจาก URL / แถวทีมจากชีต BE
import { shiftYears } from '@/app/lib/api';
import type { TargetRow } from '@/app/lib/targets';
import type { BranchSellerRow } from '@/app/components/BranchView';

export const COMPANY_ORDER = ['SDO', 'PDC', 'DC'];
const THAI_MONTH_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const YM_RE = /^\d{4}-\d{2}$/;

// "2026-10" → "2025-10"
export function shiftYM(ym: string, years: number): string {
  return shiftYears(`${ym}-01`, years).slice(0, 7);
}

export function monthAbbr(ym: string): string {
  const [, m] = ym.split('-').map(Number);
  return THAI_MONTH_ABBR[m - 1];
}

export function formatThaiMonth(ym: string): string {
  const [y] = ym.split('-').map(Number);
  return `${monthAbbr(ym)} ${y}`;
}

// "ต.ค. 2026" หรือ "ม.ค. 2026 → ต.ค. 2026"
export function formatRange(from: string, to: string): string {
  return from === to ? formatThaiMonth(from) : `${formatThaiMonth(from)} → ${formatThaiMonth(to)}`;
}

// "2026-10-29" → "29/10/2026"
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d}/${m}/${y}`;
}

export function normalizeCompany(c: string) { return (c ?? '').trim().toUpperCase(); }

type SearchParams = { [key: string]: string | string[] | undefined };

// บริษัทจาก ?company= (ไม่ถูกต้อง = ทั้งหมด)
export function companyFromParams(params: SearchParams): string {
  const v = typeof params.company === 'string' ? params.company.toUpperCase() : 'all';
  return COMPANY_ORDER.includes(v) ? v : 'all';
}

// ช่วงเดือนจาก ?from=&to= (ค่าเริ่มต้น = เดือนล่าสุดที่มีข้อมูล ถ้าเลือกกลับด้านก็สลับให้)
// ทุกหน้าใช้ชื่อพารามิเตอร์เดียวกัน → เปลี่ยนหน้าผ่านเมนูแล้วช่วงเดือนตามไปด้วย
export function rangeFromParams(params: SearchParams, months: string[], latestDate: string) {
  const latestMonth = months[months.length - 1] ?? latestDate.slice(0, 7);
  const pick = (k: string) => (typeof params[k] === 'string' && YM_RE.test(params[k] as string) ? (params[k] as string) : latestMonth);
  let fromYM = pick('from');
  let toYM = pick('to');
  if (fromYM > toYM) [fromYM, toYM] = [toYM, fromYM];
  return { fromYM, toYM };
}

// ยอดขายตามทีม: ใช้ทุกอย่างตามชีต รวม GIV / NIV ด้วย
// (SDO ในชีตรวมยอดเป็นรหัสเขต เช่น 501AD01 ส่วนในระบบแยกเป็นรหัส PS / MS ย่อย จึงจับคู่รายรหัสไม่ได้ — ยอดรวมบริษัทยังใกล้เคียงกัน)
// ข้อมูลทีมใช้แถวของเดือนล่าสุดในช่วง
export function buildBranchRows(targets: TargetRow[]): BranchSellerRow[] {
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
