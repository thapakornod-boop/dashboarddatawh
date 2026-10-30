// Session การเข้าสู่ระบบ: cookie เก็บ "code.หมดอายุ" ที่เซ็นด้วย HMAC (SESSION_SECRET) — ใช้ฝั่ง server เท่านั้น
// ทุกครั้งที่เปิดหน้า dashboard จะอ่านพนักงานจากฐานข้อมูลใหม่
// ถ้าถูกลบ / ปิดสิทธิ์ (is_active = false) จะถือว่าออกจากระบบทันที
import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { selectTable } from '@/app/lib/api';

export const SESSION_COOKIE = 'rsm_session';
// ไม่ติ๊ก "จดจำฉัน" = cookie หายเมื่อปิดเบราว์เซอร์ และหมดอายุใน 8 ชั่วโมง
export const SESSION_HOURS = 8;
// ติ๊ก "จดจำฉัน" = อยู่ในระบบต่อได้ 30 วันบนเครื่องนี้
export const REMEMBER_DAYS = 30;

export type Employee = {
  code: string;
  full_name: string;
  position: string | null;
  branch: string | null;
  role: 'employee' | 'admin';
};

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('ยังไม่ได้ตั้งค่า SESSION_SECRET ใน .env.local');
  return s;
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function createToken(code: string, maxAgeSec: number) {
  const payload = `${code}.${Math.floor(Date.now() / 1000) + maxAgeSec}`;
  return `${payload}.${sign(payload)}`;
}

// คืนรหัสพนักงานถ้า token ถูกต้องและยังไม่หมดอายุ
export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const [code, exp, sig] = token.split('.');
  if (!code || !exp || !sig) return null;
  const expected = Buffer.from(sign(`${code}.${exp}`));
  const got = Buffer.from(sig);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return code;
}

// พนักงานที่เข้าสู่ระบบอยู่ (ไม่มีหรือถูกปิดสิทธิ์ = null) — ไม่ดึงเลขบัตรออกมา
export async function currentEmployee(): Promise<Employee | null> {
  const code = verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!code) return null;
  const [emp] = await selectTable<Employee>(
    `employees?select=code,full_name,position,branch,role&code=eq.${encodeURIComponent(code)}&is_active=is.true&limit=1`
  );
  return emp ?? null;
}

// ใช้บนหน้าที่ต้องเข้าสู่ระบบก่อน
export async function requireEmployee(): Promise<Employee> {
  const emp = await currentEmployee();
  if (!emp) redirect('/login');
  return emp;
}
