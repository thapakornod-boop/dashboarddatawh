'use client';

// เมนูด้านข้าง: ไฮไลต์หน้าปัจจุบัน และพาช่วงเดือน / บริษัท (?from=&to=&company=) ไปหน้าอื่นด้วย
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const KEEP = ['from', 'to', 'company'];

function IconChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
function IconTeam() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M16 14.6c2.9.3 5 2.2 5 5.4" />
    </svg>
  );
}

// เพิ่มเมนูใหม่ในอนาคต = เพิ่มรายการตรงนี้
const ITEMS = [
  { href: '/dashboard', label: 'ภาพรวมยอดขาย', icon: <IconChart /> },
  { href: '/dashboard/team', label: 'ยอดขายรายทีม', icon: <IconTeam /> },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const qs = new URLSearchParams();
  for (const k of KEEP) {
    const v = params.get(k);
    if (v) qs.set(k, v);
  }
  const suffix = qs.size ? `?${qs.toString()}` : '';

  return (
    <nav className="sb-group" aria-label="เมนูหลัก">
      <span className="sb-group-title">แดชบอร์ด</span>
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link key={item.href} href={item.href + suffix} className={`sb-item${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined} title={item.label}>
            {item.icon}<span className="sb-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
