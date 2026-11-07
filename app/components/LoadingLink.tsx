'use client';

// ลิงก์ที่เปลี่ยนแค่ ?query ในหน้าเดิม (เช่นกดเลือกร้าน) — Next ไม่โชว์ loading.tsx ให้ จึงเปิด loading เองจนหน้าใหม่มาถึง
// scrollToId: โหลดเสร็จแล้วเลื่อนไปที่ส่วนนั้น (เช่นโปรไฟล์ร้าน)
import { useEffect, useRef, useTransition, type MouseEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { closeLoading, showLoading } from '@/app/components/Loading';

export default function LoadingLink({ href, className, children, scrollToId }: {
  href: string; className?: string; children: ReactNode; scrollToId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const clicked = useRef(false);

  useEffect(() => {
    if (isPending || !clicked.current) return;
    clicked.current = false;
    closeLoading();
    if (scrollToId) document.getElementById(scrollToId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isPending, scrollToId]);

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    // เปิดแท็บใหม่ (Ctrl / Cmd / คลิกกลาง) ปล่อยให้เบราว์เซอร์ทำเอง
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    clicked.current = true;
    showLoading('กำลังโหลดข้อมูลร้าน', 'ดึงยอดขายล่าสุด');
    startTransition(() => router.push(href, { scroll: false }));
  }

  return <a href={href} className={className} onClick={onClick}>{children}</a>;
}
