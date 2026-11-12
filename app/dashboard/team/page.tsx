// ยอดขายรายทีม: หัวหน้า (SM) → Sup → ลูกทีม จากชีต BEST - Estimate
// ช่วงเดือน / บริษัท ตามหน้าภาพรวม (?from=&to=&company=) และเลือกเปลี่ยนเองในหน้านี้ได้
import { addDays, getAvailableMonths, getBranchPrinc, getLatestDate, monthToRange } from '@/app/lib/api';
import { buildPrincReport, type PrincReportRow } from '@/app/lib/princReport';
import { requireEmployee } from '@/app/lib/session';
import { getTargets } from '@/app/lib/targets';
import { timeGone } from '@/app/lib/workdays';
import {
  COMPANY_ORDER, buildBranchRows, companyFromParams, formatDate, formatRange, normalizeCompany, rangeFromParams,
} from '@/app/lib/period';
import { LoadingDone } from '@/app/components/Loading';
import BranchView from '@/app/components/BranchView';
import PrincReport from '@/app/components/PrincReport';
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
  let princRows: PrincReportRow[] | null = null;
  let givTo = '';

  try {
    [latestDate, months] = await Promise.all([getLatestDate(), getAvailableMonths()]);
    ({ fromYM, toYM } = rangeFromParams(params, months, latestDate));
    // GIV ตั้งแต่ต้นเดือนแรกถึงวันล่าสุดที่มีข้อมูล (ไม่เกินสิ้นเดือนสุดท้าย)
    const monthEnd = addDays(monthToRange(toYM).endDate, 1);
    const rangeEnd = latestDate < monthEnd ? addDays(latestDate, 1) : monthEnd;
    const [targets, sales] = await Promise.all([getTargets(fromYM, toYM), getBranchPrinc(`${fromYM}-01`, rangeEnd)]);
    givTo = addDays(rangeEnd, -1);
    if (sales) princRows = buildPrincReport(sales, targets.rows, companies);
    rows = buildBranchRows(targets.rows.filter((t) => companies.includes(normalizeCompany(t.company))));
    updatedAt = targets.updatedAt;
    missing = months.filter((m) => m >= fromYM && m <= toYM && !targets.months.includes(m));
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
  }

  const rangeMonths = months.filter((m) => m >= fromYM && m <= toYM);
  const tg = timeGone(rangeMonths);
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
        {!errorMessage && (princRows ? (
          <PrincReport rows={princRows} timeGonePct={tg.pct} targetLabel={rangeLabel}
            dataLabel={`GIV ${formatDate(`${fromYM}-01`)} – ${formatDate(givTo)} · Target / BE ${rangeLabel}${companyFilter !== 'all' ? ` · ${companyFilter}` : ''}`}
            fileTag={givTo} />
        ) : (
          <p className="empty">รอข้อมูล Princ รายสาขา — รัน supabase/princ_store.sql ใน Supabase ก่อน</p>
        ))}
        {!errorMessage && (
          <BranchView rows={rows} companies={companies} timeGonePct={tg.pct} periodLabel={rangeLabel} sheetUpdatedAt={updatedAt} />
        )}
      </main>
    </>
  );
}
