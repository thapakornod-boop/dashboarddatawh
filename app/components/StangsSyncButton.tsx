'use client';

// ปุ่ม "บันทึก STANGS ลง Supabase" (หน้าสถานะระบบ)
import { useTransition } from 'react';
import { syncStangsNow } from '@/app/dashboard/status/actions';
import { closeLoading, showError, showLoading, showToast } from '@/app/components/Loading';

export default function StangsSyncButton() {
  const [pending, start] = useTransition();
  const onClick = () => {
    showLoading('กำลังบันทึก STANGS ลง Supabase', 'อ่าน Seller / Visit / Compliance จาก Google Sheet');
    start(async () => {
      try {
        const r = await syncStangsNow();
        closeLoading();
        showToast(`บันทึกแล้ว · ${r.date_from} ถึง ${r.date_to} · เข้าพบ ${r.visits?.toLocaleString('th-TH')} ครั้ง`);
      } catch (err) {
        closeLoading();
        showError('บันทึกไม่สำเร็จ', err instanceof Error ? err.message : String(err));
      }
    });
  };
  return (
    <button type="button" className="clear-btn" onClick={onClick} disabled={pending}>
      ⇪ บันทึก STANGS ลง Supabase ตอนนี้
    </button>
  );
}
