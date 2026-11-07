'use client';

// ปุ่มรีเฟรช: แก้ Google Sheet แล้วกดปุ่มนี้ → หน้าเว็บอ่านชีตใหม่ทันที (ไม่ต้องรอ cache 5 นาที)
import { useTransition } from 'react';
import { refreshData } from '@/app/dashboard/actions';
import { closeLoading, showError, showLoading, showToast } from '@/app/components/Loading';

export default function RefreshButton({ className = 'clear-btn' }: { className?: string }) {
  const [pending, startTransition] = useTransition();
  const onClick = () => {
    showLoading('กำลังรีเฟรชข้อมูล', 'อ่าน Google Sheet และยอดขายล่าสุด');
    startTransition(async () => {
      try {
        await refreshData();
        closeLoading();
        showToast('อัปเดตข้อมูลล่าสุดแล้ว');
      } catch (err) {
        closeLoading();
        showError('รีเฟรชไม่สำเร็จ', err instanceof Error ? err.message : String(err));
      }
    });
  };
  return (
    <button type="button" className={className} onClick={onClick} disabled={pending}>
      ↻ รีเฟรชข้อมูลชีต
    </button>
  );
}
