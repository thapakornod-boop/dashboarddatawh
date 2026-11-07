// ตาราง สาขา × Princ (หน้ายอดขายรายทีม): Target / BE จากชีต + GIV จาก vw_lg014 (ตารางสรุป sales_branch_daily)
//   SDO          : สาขาตามสาขาที่ออกบิล (bplname)
//   PDC / DC     : สาขาตามชีตของเซลล์คนนั้น (เช่นเซลล์ NIS เขต PTT ออกบิลจาก DC RSM แต่ Target อยู่ PTT)
//                  ไม่มีในชีต → สาขาที่ออกบิล
import type { BranchPrincRow } from '@/app/lib/api';
import type { TargetRow } from '@/app/lib/targets';

export type PrincReportRow = { branch: string; principal: string; target: number; be: number; giv: number };

export function buildPrincReport(sales: BranchPrincRow[], targets: TargetRow[], companies: string[]): PrincReportRow[] {
  const ts = targets.filter((t) => companies.includes(t.company));

  // สาขาของเซลล์ตามชีต (เดือนล่าสุดในช่วงชนะ)
  const latest = [...ts].sort((a, b) => a.ym.localeCompare(b.ym));
  const bySellerPrinc = new Map<string, string>();
  const bySeller = new Map<string, string>();
  for (const t of latest) {
    if (!t.branch) continue;
    bySellerPrinc.set(`${t.seller}|${t.principal}`, t.branch);
    bySeller.set(t.seller, t.branch);
  }

  const map = new Map<string, PrincReportRow>();
  const row = (branch: string, principal: string) => {
    const k = `${branch}|${principal}`;
    let r = map.get(k);
    if (!r) map.set(k, (r = { branch, principal, target: 0, be: 0, giv: 0 }));
    return r;
  };

  for (const t of ts) {
    const r = row(t.branch || '-', t.principal);
    r.target += t.target;
    r.be += t.be;
  }
  for (const s of sales) {
    if (!companies.includes(s.company)) continue;
    const branch = s.company === 'SDO'
      ? s.branch
      : bySellerPrinc.get(`${s.seller}|${s.principal}`) ?? bySeller.get(s.seller) ?? s.branch;
    row(branch, s.principal).giv += s.giv;
  }

  return [...map.values()].filter((r) => r.target || r.be || Math.abs(r.giv) >= 1);
}
