'use client';

// Export Excel หน้ายอดขายรายร้าน — ตาม filter = ร้านที่เลือกอยู่ · ภาพรวม = ทุกร้านในช่วงเดือน / บริษัทที่เลือก
import ExportBar from '@/app/components/ExportBar';
import { storeOneSheets, type StoreOneX } from '@/app/lib/exportSheets';
import { exportedAt } from '@/app/lib/xlsx';

export default function StoreExport({ store, company, rangeText, overviewHref, fileTag }: {
  store: StoreOneX | null; company: string; rangeText: string; overviewHref: string; fileTag: string;
}) {
  const filterSheets = () => {
    if (!store) return [];
    const info: [string, string][] = [
      ['ร้าน', store.name],
      ['RSM code', store.rsmcode ?? '–'],
      ['รหัสร้าน', store.codes.map((c) => `${c.company} ${c.cardcode}`).join(' · ')],
      ['ช่วงเดือน', rangeText],
      ['บริษัท', company],
      ['Export เมื่อ', exportedAt()],
    ];
    return storeOneSheets(store, info);
  };
  return (
    <section className="card export-card">
      <ExportBar
        filterSheets={filterSheets}
        filterName={`ยอดขายรายร้าน-${(store?.name ?? 'ร้าน').replace(/[\\/:*?"<>|]/g, '').slice(0, 40)}-${fileTag}.xlsx`}
        filterHint={store ? `ร้านที่เลือก (${store.name}) · สรุป / รายเดือน / ราย Princ / รายละเอียด` : 'เลือกร้านก่อน'}
        overviewHref={overviewHref}
        overviewHint="ทุกร้านในช่วงเดือน / บริษัทที่เลือก (ไม่เกิน 12 เดือน)"
        disabled={!store}
      />
    </section>
  );
}
