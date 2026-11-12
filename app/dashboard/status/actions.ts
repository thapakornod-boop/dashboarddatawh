'use server';

// ปุ่ม "อัปเดตยอดขายตอนนี้" (admin): สั่งคำนวณตารางสรุปจาก vw_lg014 ใหม่ + ถามสถานะ
import { refresh } from 'next/cache';
import { clearDataCache, getManualRefresh, requestManualRefresh, type ManualRefresh } from '@/app/lib/api';
import { requireEmployee } from '@/app/lib/session';

async function requireAdmin() {
  const me = await requireEmployee();
  if (me.role !== 'admin') throw new Error('เฉพาะผู้ดูแลระบบ');
}

export async function startDataRefresh(): Promise<'queued' | 'busy'> {
  await requireAdmin();
  return requestManualRefresh();
}

export async function dataRefreshStatus(): Promise<ManualRefresh | null> {
  await requireAdmin();
  return getManualRefresh();
}

// เสร็จแล้ว: ลืม cache 5 นาทีของหน้าเว็บ → ทุกหน้าเห็นยอดใหม่ทันที
export async function finishDataRefresh() {
  await requireAdmin();
  clearDataCache();
  refresh();
}
