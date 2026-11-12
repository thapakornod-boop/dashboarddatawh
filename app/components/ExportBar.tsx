'use client';

// แถบปุ่ม Export Excel 2 แบบ
//   ตาม filter = ข้อมูลที่เห็นอยู่ตอนนี้ (รวมตัวกรองในตาราง) — ทำไฟล์ในเครื่อง
//   ภาพรวม     = ทุกข้อมูลของช่วงเดือน / บริษัทที่เลือก (ไม่สนตัวกรองในตาราง) — ทำไฟล์ที่ server
import { useState } from 'react';
import { closeLoading, showError, showLoading, showToast } from '@/app/components/Loading';
import { buildWorkbook, downloadBuffer, type XSheet } from '@/app/lib/xlsx';

function IconSheet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h8M12 11v8" />
    </svg>
  );
}

export default function ExportBar({ filterSheets, filterName, filterHint, overviewHref, overviewHint, disabled }: {
  filterSheets: () => XSheet[]; filterName: string; filterHint: string;
  overviewHref: string; overviewHint: string; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const run = async (job: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    showLoading('กำลังทำไฟล์ Excel', 'รอสักครู่');
    try {
      await job();
      closeLoading();
      showToast('ดาวน์โหลดไฟล์ Excel แล้ว');
    } catch (err) {
      closeLoading();
      showError('ทำไฟล์ไม่สำเร็จ', err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  const byFilter = () => run(async () => downloadBuffer(await buildWorkbook(filterSheets()), filterName));

  const overview = () => run(async () => {
    const res = await fetch(overviewHref, { cache: 'no-store' });
    if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
    const cd = res.headers.get('Content-Disposition') ?? '';
    const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
    downloadBuffer(await res.arrayBuffer(), m ? decodeURIComponent(m[1]) : 'export.xlsx');
  });

  return (
    <div className="export-bar">
      <span className="export-title"><IconSheet /> Export Excel</span>
      <button type="button" className="btn btn-primary" onClick={byFilter} disabled={busy || disabled} title={filterHint}>ตาม filter</button>
      <button type="button" className="clear-btn" onClick={overview} disabled={busy} title={overviewHint}>ภาพรวม</button>
      <span className="export-hint"><b>ตาม filter</b> = {filterHint} · <b>ภาพรวม</b> = {overviewHint}</span>
    </div>
  );
}
