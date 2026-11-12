'use client';

// แถบลัดไปหัวข้อในหน้า (มือถือ / แท็บเล็ต) — ค้างไว้ด้านบนตอนเลื่อน · กดแล้วเลื่อนไปหัวข้อนั้น · ไฮไลต์หัวข้อที่กำลังดูอยู่
import { useEffect, useRef, useState } from 'react';

export type NavItem = { id: string; label: string };

export default function SectionNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '');
  const bar = useRef<HTMLDivElement>(null);
  const lock = useRef<ReturnType<typeof setTimeout> | null>(null); // ระหว่างเลื่อนจากการกด ไม่ต้องเปลี่ยนไฮไลต์ตามการเลื่อน

  // หัวข้อที่กำลังดู = หัวข้อสุดท้ายที่ขอบบนเลื่อนผ่านเส้นใต้แถบลัดแล้ว
  useEffect(() => {
    const onScroll = () => {
      if (lock.current) return;
      const line = (bar.current?.getBoundingClientRect().bottom ?? 0) + 24;
      let cur = items[0]?.id ?? '';
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= line) cur = it.id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [items]);

  // ปุ่มที่ไฮไลต์ให้อยู่ในจอเสมอ (แถบเลื่อนซ้าย-ขวาได้)
  useEffect(() => {
    bar.current?.querySelector<HTMLElement>(`[data-id="${active}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    if (lock.current) clearTimeout(lock.current);
    lock.current = setTimeout(() => { lock.current = null; }, 800);
    const offset = (bar.current?.offsetHeight ?? 0) + 12;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
  };

  return (
    <nav className="sec-nav" aria-label="ไปที่หัวข้อ" ref={bar}>
      {items.map((it) => (
        <button key={it.id} type="button" data-id={it.id} className={active === it.id ? 'on' : ''}
          aria-current={active === it.id ? 'true' : undefined} onClick={() => go(it.id)}>
          {it.label}
        </button>
      ))}
    </nav>
  );
}
