import { NextResponse, type NextRequest } from 'next/server';

// ด่านแรก: ไม่มี cookie เข้าสู่ระบบ → ไปหน้า login ทันที (ไม่ต้องรอโหลดข้อมูล)
// การตรวจจริง (ลายเซ็น / หมดอายุ / พนักงานยังอยู่และ is_active) ทำใน requireEmployee() ของแต่ละหน้า
export function proxy(request: NextRequest) {
  if (!request.cookies.has('rsm_session')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
