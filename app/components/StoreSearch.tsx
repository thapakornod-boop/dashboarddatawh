'use client';

// ช่องค้นหาร้าน: พิมพ์รหัสร้าน / RSM code / ชื่อร้าน → ขึ้นรายการร้านที่ใกล้เคียงทันที (สูงสุด 10 ร้าน)
// เลือกจากรายการ = เปิดร้านนั้นเลย · กด Enter / ปุ่มค้นหา = ค้นแบบเต็ม (สูงสุด 60 ร้าน)
import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { StoreHit } from '@/app/lib/api';
import { COMPANY_COLORS } from '@/app/lib/format';
import { closeLoading, showLoading } from '@/app/components/Loading';

export default function StoreSearch({ defaultQ, keep }: { defaultQ: string; keep: Record<string, string> }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQ);
  const [hits, setHits] = useState<StoreHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPending) closeLoading();
  }, [isPending]);

  // พิมพ์หยุด 250ms แล้วค่อยถาม (ยกเลิกคำขอเก่าถ้าพิมพ์ต่อ)
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/dashboard/stores/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) { setHits(await res.json()); setActive(-1); }
      } catch { /* ยกเลิก / เน็ตหลุด — ไม่ต้องแจ้ง */ } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  // คลิกนอกกล่อง = ปิดรายการ
  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const go = (params: Record<string, string>) => {
    setOpen(false);
    showLoading();
    startTransition(() => router.push(`?${new URLSearchParams({ ...keep, ...params }).toString()}`));
  };
  const pick = (h: StoreHit) => {
    setQ(h.rsmcode ?? h.cardcode);
    go({ q: h.rsmcode ?? h.cardcode, store: h.rsmcode ?? `${h.company}|${h.cardcode}` });
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (active >= 0 && hits[active]) return pick(hits[active]);
    if (q.trim().length >= 2) go({ q: q.trim() });
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !hits.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % hits.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? hits.length - 1 : i - 1)); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const term = q.trim();
  const show = open && term.length >= 2;
  return (
    <form className="store-search" onSubmit={onSubmit} role="search">
      <div className="store-box" ref={box}>
        <input className="store-input" type="search" value={q} placeholder="เช่น 10100004 / M-131800 / ชื่อร้าน"
          onChange={(e) => { setQ(e.target.value); setOpen(true); if (e.target.value.trim().length < 2) setHits([]); }}
          onFocus={() => setOpen(true)} onKeyDown={onKey}
          maxLength={60} autoComplete="off" aria-label="ค้นหาร้านค้า" role="combobox" aria-controls="store-suggest" aria-autocomplete="list" aria-expanded={show} />
        {show && (
          <ul id="store-suggest" className="store-suggest" role="listbox">
            {hits.length === 0 && <li className="store-suggest-empty">{loading ? 'กำลังค้นหา…' : 'ไม่พบร้านที่ใกล้เคียง'}</li>}
            {hits.map((h, i) => (
              <li key={`${h.company}|${h.cardcode}`} role="option" aria-selected={i === active}>
                <button type="button" className={`store-suggest-item${i === active ? ' active' : ''}`}
                  onMouseEnter={() => setActive(i)} onClick={() => pick(h)}>
                  <span className="store-hit-name">{h.name || '(ไม่มีชื่อร้าน)'}</span>
                  <span className="store-hit-codes">
                    <span className="store-tag"><span className="dot" style={{ background: COMPANY_COLORS[h.company] }} />{h.company} {h.cardcode}</span>
                    {h.rsmcode && <span className="code">{h.rsmcode}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit" className="btn btn-primary">ค้นหา</button>
    </form>
  );
}
