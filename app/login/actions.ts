'use server';

// เข้าสู่ระบบ / ออกจากระบบ — ตรวจรหัสพนักงาน + เลขบัตรประชาชนในฐานข้อมูล (RPC employee_login · supabase/security.sql)
// ฐานข้อมูลเก็บเลขบัตรเป็น hash (bcrypt) เท่านั้น และนับครั้งที่กรอกผิดต่อรหัส / ต่อ IP (ล็อก 10 นาที)
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { rpc } from '@/app/lib/api';
import { createToken, REMEMBER_DAYS, SESSION_COOKIE, SESSION_HOURS } from '@/app/lib/session';

export type LoginResult = { ok: true; name: string } | { ok: false; error: string };

const CODE_RE = /^[A-Z]{3}\d{4}$/;

export async function login(input: { code: string; idCard: string; remember: boolean }): Promise<LoginResult> {
  const code = (input.code ?? '').trim().toUpperCase();
  const idCard = (input.idCard ?? '').replace(/\D/g, '');

  if (!code || !idCard) return { ok: false, error: 'กรุณากรอกรหัสพนักงานและเลขบัตรประชาชน' };
  if (!CODE_RE.test(code)) return { ok: false, error: 'รหัสพนักงานต้องเป็นตัวอักษรอังกฤษ 3 ตัว ตามด้วยตัวเลข 4 ตัว เช่น SDO1234' };
  if (idCard.length !== 13) return { ok: false, error: 'เลขบัตรประชาชนต้องมี 13 หลัก' };

  const h = await headers();
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim().slice(0, 64);
  let res: { status: 'ok' | 'bad' | 'locked' | 'inactive'; code: string | null; full_name: string | null } | undefined;
  try {
    [res] = await rpc<NonNullable<typeof res>>('employee_login', { p_code: code, p_id: idCard, p_ip: ip });
  } catch {
    return { ok: false, error: 'ระบบขัดข้อง ไม่สามารถเชื่อมต่อฐานข้อมูลได้' };
  }
  if (!res || res.status === 'bad') return { ok: false, error: 'รหัสพนักงานหรือเลขบัตรประชาชนไม่ถูกต้อง' };
  if (res.status === 'locked') return { ok: false, error: 'กรอกผิดหลายครั้งเกินไป กรุณารอ 10 นาทีแล้วลองใหม่' };
  if (res.status === 'inactive') return { ok: false, error: 'บัญชีนี้ถูกปิดสิทธิ์เข้าระบบ กรุณาติดต่อผู้ดูแลระบบ' };

  // จดจำฉัน = cookie อยู่ 30 วัน / ไม่ติ๊ก = cookie หายเมื่อปิดเบราว์เซอร์ (และหมดอายุใน 8 ชม.)
  const maxAge = input.remember ? REMEMBER_DAYS * 24 * 3600 : SESSION_HOURS * 3600;
  (await cookies()).set(SESSION_COOKIE, createToken(res.code!, maxAge), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(input.remember ? { maxAge } : {}),
  });
  return { ok: true, name: res.full_name ?? '' };
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
