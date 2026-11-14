// STANGS KPI & Compliance: วินัยการทำงานของเซลล์ (แผนเยี่ยม / การเข้าพบจริงจากแอป STANGS) + ยอดขายจาก vw_lg014
// ตัวกรองทั้งหมดอยู่ในหน้า (วันที่ภายในทริป / บริษัท / สาขา / ทีม / เซลล์) คำนวณใหม่ทันทีที่หน้าเว็บ
import { getLatestDate } from '@/app/lib/api';
import { requireEmployee } from '@/app/lib/session';
import { getStangs } from '@/app/lib/stangs';
import type { StangsData } from '@/app/lib/stangsCalc';
import { formatDate } from '@/app/lib/period';
import { LoadingDone } from '@/app/components/Loading';
import StangsBoard from '@/app/components/StangsBoard';
import { Hero } from '../parts';

export default async function StangsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireEmployee();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

  let errorMessage: string | null = null;
  let data: StangsData | null = null;
  let latestSales = '';
  try {
    latestSales = await getLatestDate();
    data = await getStangs(latestSales, { from: one(params.from), to: one(params.to) });
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
  }

  return (
    <>
      <LoadingDone error={errorMessage} />
      <Hero
        crumb="แดชบอร์ด / STANGS KPI & Compliance"
        title="STANGS KPI & Compliance"
        subtitle={data && data.rangeFrom ? `${formatDate(data.rangeFrom)} – ${formatDate(data.rangeTo)} · ${data.sellers.length} เซลล์` : ''}
        chips={[
          ...(data?.latest ? [`เข้าพบล่าสุด ${formatDate(data.latest)}`] : []),
          ...(latestSales ? [`ยอดขายถึง ${formatDate(latestSales)}`] : []),
        ]}
      />
      <main className="container">
        {errorMessage && <p className="empty">โหลดข้อมูลไม่สำเร็จ — {errorMessage}</p>}
        {data && !data.sellers.length && <p className="empty">ไม่พบข้อมูล STANGS ในช่วงนี้ — ตรวจ tab Seller ในชีต หรือกด &quot;บันทึก STANGS ลง Supabase&quot; ในหน้าสถานะระบบ</p>}
        {data && data.sellers.length > 0 && <StangsBoard data={data} />}
      </main>
    </>
  );
}
