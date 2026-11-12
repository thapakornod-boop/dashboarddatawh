'use client';

// ปุ่มลัดเลือกช่วงเดือน: 3 / 6 / 12 เดือนย้อนหลัง — ไม่นับเดือนปัจจุบัน (เดือนล่าสุดที่มีข้อมูล ซึ่งยังไม่จบเดือน)
// กดแล้วตั้งค่า "ตั้งแต่เดือน / ถึงเดือน" ในฟอร์มแล้วค้นหาทันที (ใช้ loading เดียวกับปุ่มค้นหา)
import { formatRange } from '@/app/lib/period';

const PRESETS = [3, 6, 12];

export function RangePresets({ formId, months, fromYM, toYM }: { formId: string; months: string[]; fromYM: string; toYM: string }) {
  // ตัดเดือนปัจจุบัน (เวลาไทย) ออก ถ้ามีในรายการ
  const nowYM = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
  const past = months.filter((m) => m < nowYM);
  if (past.length === 0) return null;
  const opts = PRESETS.map((n) => {
    const ms = past.slice(-n);
    return { n, from: ms[0], to: ms[ms.length - 1], full: ms.length === n };
  });
  const active = opts.find((o) => o.from === fromYM && o.to === toYM);

  const pick = (from: string, to: string) => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    (form.elements.namedItem('from') as HTMLSelectElement).value = from;
    (form.elements.namedItem('to') as HTMLSelectElement).value = to;
    form.requestSubmit();
  };

  return (
    <div className="range-presets">
      <span className="field-label">ย้อนหลัง</span>
      <div className="seg" role="group" aria-label="เลือกช่วงย้อนหลัง">
        {opts.map((o) => (
          <button key={o.n} type="button" className={active === o ? 'on' : ''} aria-pressed={active === o}
            title={`${formatRange(o.from, o.to)}${o.full ? '' : ` (มีข้อมูลแค่ ${past.slice(-o.n).length} เดือน)`}`}
            onClick={() => pick(o.from, o.to)}>
            {o.n} เดือน
          </button>
        ))}
      </div>
      <span className="range-presets-note">
        ไม่นับเดือนปัจจุบัน · {opts.map((o) => `${o.n} เดือน = ${formatRange(o.from, o.to)}`).join(' · ')}
      </span>
    </div>
  );
}
