// ยอดขายรายทีม: หัวหน้า (SM) → Sup → ลูกทีม จากชีต BEST - Estimate
// ช่วงเดือน / บริษัท ตามหน้าภาพรวม (?from=&to=&company=) และเลือกเปลี่ยนเองในหน้านี้ได้
import { getAvailableMonths, getLatestDate } from '@/app/lib/api';
import { requireEmployee } from '@/app/lib/session';
import { getTargets } from '@/app/lib/targets';
import { timeGone } from '@/app/lib/workdays';
import {
  COMPANY_ORDER, buildBranchRows, companyFromParams, formatDate, formatRange, normalizeCompany, rangeFromParams,
} from '@/app/lib/period';
import { LoadingDone } from '@/app/components/Loading';
import BranchView from '@/app/components/BranchView';
import { Hero, RangeFilter } from '../parts';

export default async function TeamSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireEmployee();
  const params = await searchParams;
  const companyFilter = companyFromParams(params);
  const companies = companyFilter === 'all' ? COMPANY_ORDER : [companyFilter];

  let errorMessage: string | null = null;
  let latestDate = '';
  let months: string[] = [];
  let fromYM = '';
  let toYM = '';
  let rows: ReturnType<typeof buildBranchRows> = [];
  let updatedAt = '';
  let missing: string[] = [];

  try {
    [latestDate, months] = await Promise.all([getLatestDate(), getAvailableMonths()]);
    ({ fromYM, toYM } = rangeFromParams(params, months, latestDate));
    const targets = await getTargets(fromYM, toYM);
    rows = buildBranchRows(targets.rows.filter((t) => companies.includes(normalizeCompany(t.company))));
    updatedAt = targets.updatedAt;
    missing = months.filter((m) => m >= fromYM && m <= toYM && !targets.months.includes(m));
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
  }

  const rangeMonths = months.filter((m) => m >= fromYM && m <= toYM);
  const tg = latestDate ? timeGone(rangeMonths, latestDate) : { elapsed: 0, total: 0, pct: 0 };
  const rangeLabel = fromYM ? formatRange(fromYM, toYM) : '';

  return (
    <>
      <LoadingDone error={errorMessage} />
      <Hero
        crumb="แดชบอร์ด / ยอดขายรายทีม"
        title="ยอดขายรายทีม"
        subtitle={`${rangeLabel}${companyFilter !== 'all' ? ` · ${companyFilter}` : ' · SDO / PDC / DC'}`}
        chips={[...(!errorMessage ? [`Time gone ${tg.pct.toFixed(1)}%`] : []), ...(latestDate ? [`ข้อมูลถึง ${formatDate(latestDate)}`] : [])]}
      />
      <main className="container">
        <RangeFilter months={months} fromYM={fromYM} toYM={toYM} company={companyFilter} />
        {errorMessage && <p className="empty">โหลดข้อมูลไม่สำเร็จ — ลองกดค้นหาอีกครั้ง</p>}
        {!errorMessage && missing.length > 0 && (
          <p className="note">ไม่มีข้อมูลในชีตของเดือน {missing.map((m) => formatRange(m, m)).join(', ')} — ยอดของเดือนนั้นจึงไม่ถูกรวม</p>
        )}
        {!errorMessage && (
          <BranchView rows={rows} companies={companies} timeGonePct={tg.pct} periodLabel={rangeLabel} sheetUpdatedAt={updatedAt} />
        )}
      </main>
    </>
  );
}
