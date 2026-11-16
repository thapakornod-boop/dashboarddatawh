'use client';

// กล่องรายละเอียดลอยกลางจอ (เช่น เซลล์ที่เลือกในหน้าร้านเครดิต) — เปิดทันทีที่ข้อมูลมา ไม่ต้องเลื่อนลงไปดู
// ปิด: ปุ่ม ✕ / คลิกพื้นหลัง / Esc → ซ่อนทันที แล้วล้าง ?seller ใน URL (closeHref)
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export default function DetailModal({ title, sub, closeHref, children }: {
  title: ReactNode; sub?: ReactNode; closeHref: string; children: ReactNode;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (hidden) return;
    const close = () => {
      setHidden(true);
      startTransition(() => router.replace(closeHref, { scroll: false }));
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [hidden, closeHref, router]);

  if (hidden) return null;
  const close = () => {
    setHidden(true);
    startTransition(() => router.replace(closeHref, { scroll: false }));
  };

  return (
    <div className="dm-backdrop" role="dialog" aria-modal="true" onClick={close}>
      <section className="dm" onClick={(e) => e.stopPropagation()}>
        <header className="dm-head">
          <div>
            <h3 className="card-title">{title}</h3>
            {sub && <p className="card-sub">{sub}</p>}
          </div>
          <button type="button" className="dm-close" onClick={close} aria-label="ปิด">✕</button>
        </header>
        <div className="dm-body">{children}</div>
      </section>
    </div>
  );
}
