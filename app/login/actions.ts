'use server';

// เข้าสู่ระบบ / ออกจากระบบ — ตรวจรหัสพนักงาน + เลขบัตรประชาชนกับตาราง public.employees ใน Supabase
import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { selectTable } from '@/app/lib/api';
import { createToken, REMEMBER_DAYS, SESSION_COOKIE, SESSION_HOURS } from '@/app/lib/session';

export type LoginResult = { ok: true; name: string } | { ok: false; error: string };

const CODE_RE = /^[A-Z]{3}\d{4}$/;

// กันเดาเลขบัตร: ผิดเกิน 5 ครั้งใน 10 นาที (ต่อรหัสพนักงาน) ให้รอก่อน
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const fails = new Map<string, { count: number; first: number }>();

function tooManyAttempts(code: string) {
  const f = fails.get(code);
  if (f && Date.now() - f.first > LOCK_MS) fails.delete(code);
  return (fails.get(code)?.count ?? 0) >= MAX_FAILS;
}
function recordFail(code: string) {
  const f = fails.get(code) ?? { count: 0, first: Date.now() };
  f.count += 1;
  fails.set(code, f);
}

const sameText = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function login(input: { code: string; idCard: string; remember: boolean }): Promise<LoginResult> {
  const code = (input.code ?? '').trim().toUpperCase();
  const idCard = (input.idCard ?? '').replace(/\D/g, '');

  if (!code || !idCard) return { ok: false, error: 'กรุณากรอกรหัสพนักงานและเลขบัตรประชาชน' };
  if (!CODE_RE.test(code)) return { ok: false, error: 'รหัสพนักงานต้องเป็นตัวอักษรอังกฤษ 3 ตัว ตามด้วยตัวเลข 4 ตัว เช่น SDO1234' };
  if (idCard.length !== 13) return { ok: false, error: 'เลขบัตรประชาชนต้องมี 13 หลัก' };
  if (tooManyAttempts(code)) return { ok: false, error: 'กรอกผิดหลายครั้งเกินไป กรุณารอ 10 นาทีแล้วลองใหม่' };

  let emp: { code: string; id_card: string; full_name: string; is_active: boolean } | undefined;
  try {
    [emp] = await selectTable<NonNullable<typeof emp>>(
      `employees?select=code,id_card,full_name,is_active&code=eq.${encodeURIComponent(code)}&limit=1`
    );
  } catch {
    return { ok: false, error: 'ระบบขัดข้อง ไม่สามารถเชื่อมต่อฐานข้อมูลได้' };
  }

  if (!emp || !sameText(emp.id_card, idCard)) {
    recordFail(code);
    return { ok: false, error: 'รหัสพนักงานหรือเลขบัตรประชาชนไม่ถูกต้อง' };
  }
  if (!emp.is_active) return { ok: false, error: 'บัญชีนี้ถูกปิดสิทธิ์เข้าระบบ กรุณาติดต่อผู้ดูแลระบบ' };
  fails.delete(code);

  // จดจำฉัน = cookie อยู่ 30 วัน / ไม่ติ๊ก = cookie หายเมื่อปิดเบราว์เซอร์ (และหมดอายุใน 8 ชม.)
  const maxAge = input.remember ? REMEMBER_DAYS * 24 * 3600 : SESSION_HOURS * 3600;
  (await cookies()).set(SESSION_COOKIE, createToken(emp.code, maxAge), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(input.remember ? { maxAge } : {}),
  });

  // บันทึกเวลาเข้าระบบล่าสุด — ไม่สำเร็จก็ไม่ขวางการเข้าระบบ
  fetch(`${process.env.SUPABASE_URL}/rest/v1/employees?code=eq.${encodeURIComponent(emp.code)}`, {
    method: 'PATCH',
    headers: {
      apikey: process.env.SUPABASE_SECRET_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ last_login_at: new Date().toISOString() }),
    cache: 'no-store',
  }).catch(() => {});

  return { ok: true, name: emp.full_name };
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
