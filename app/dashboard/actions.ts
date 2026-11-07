'use server';

// ปุ่ม "รีเฟรชข้อมูล": อ่าน Google Sheet (Target / BE / ทีม) + ยอดจาก Supabase ใหม่ แล้ววาดหน้าใหม่
import { refresh } from 'next/cache';
import { clearDataCache } from '@/app/lib/api';
import { requireEmployee } from '@/app/lib/session';
import { clearTargetsCache } from '@/app/lib/targets';

export async function refreshData() {
  await requireEmployee();
  clearTargetsCache();
  clearDataCache();
  refresh();
}
