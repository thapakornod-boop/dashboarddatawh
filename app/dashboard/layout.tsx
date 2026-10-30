// โครงหน้าร่วมของทุกหน้าใน /dashboard: CSS + sidebar (เมนู / ผู้ใช้ / ออกจากระบบ)
// sidebar อยู่ที่ layout → เปลี่ยนหน้าหรือรอข้อมูล เมนูยังแสดงค้างไว้ ไม่ต้องโหลดใหม่
import { Suspense } from 'react';
import Image from 'next/image';
import { requireEmployee } from '@/app/lib/session';
import { logout } from '@/app/login/actions';
import { LogoutButton } from '@/app/components/Loading';
import SidebarNav from './SidebarNav';
import { IconLogout } from './parts';
import { DASHBOARD_CSS } from './styles';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await requireEmployee();
  return (
    <>
      <style>{DASHBOARD_CSS}</style>
      <div className="shell">
        <aside className="sidebar">
          <div className="sb-brand">
            <Image src="/logo.png" alt="RSM Group" width={44} height={44} className="sb-logo" priority />
            <div className="sb-brand-text"><b>RSM GROUP</b><span>Sales Dashboard</span></div>
          </div>
          {/* useSearchParams ต้องอยู่ใน Suspense */}
          <Suspense fallback={<nav className="sb-group" aria-label="เมนูหลัก" />}>
            <SidebarNav />
          </Suspense>
          <div className="sb-spacer" />
          {/* การ์ดผู้ใช้ + ปุ่มออกจากระบบอยู่ข้างชื่อ (ถามยืนยันก่อนออก) */}
          <div className="sb-user" title={`${me.full_name} (${me.code})`}>
            <span className="sb-avatar">{me.full_name.replace(/^(นาย|นางสาว|นาง|น\.ส\.)\s*/, '').slice(0, 1)}</span>
            <span className="sb-user-text">
              <b>{me.full_name}</b>
              <span>{me.code}{me.position ? ` · ${me.position}` : ''}</span>
            </span>
            <LogoutButton action={logout} className="sb-logout"><IconLogout /></LogoutButton>
          </div>
        </aside>
        <div className="main">{children}</div>
      </div>
    </>
  );
}
