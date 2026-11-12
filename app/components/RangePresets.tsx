'use client';

// ปุ่มลัดเลือกช่วงเดือน: เดือนปัจจุบัน · 3 / 6 เดือนย้อนหลัง · ต้นปี (ม.ค. ถึงเดือนก่อน)
//   ย้อนหลัง / ต้นปี ไม่นับเดือนปัจจุบัน (ยังไม่จบเดือน) เช่น เดือนนี้ พ.ย. → 3 เดือน = ส.ค.–ต.ค. · ต้นปี = ม.ค.–ต.ค.
// กดแล้วตั้งค่า "ตั้งแต่เดือน / ถึงเดือน" ในฟอร์มแล้วค้นหาทันที (ใช้ loading เดียวกับปุ่มค้นหา)
import { formatRange } from '@/app/lib/period';

type Opt = { key: string; label: string; note: string; from: string; to: string };

export function RangePresets({ formId, months, fromYM, toYM }: { formId: string; months: string[]; fromYM: string; toYM: string }) {
  if (months.length === 0) return null;
  // เดือนปัจจุบัน (เวลาไทย) — ตัดออกจากช่วงย้อนหลัง
  const nowYM = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
  const past = months.filter((m) => m < nowYM);
  const latest = months[months.length - 1];

  const opts: Opt[] = [{ key: 'cur', label: 'เดือนปัจจุบัน', note: 'เดือนปัจจุบัน', from: latest, to: latest }];
  for (const n of [3, 6]) {
    const ms = past.slice(-n);
    if (ms.length) opts.push({ key: `p${n}`, label: `${n} เดือนย้อนหลัง`, note: `${n} เดือน`, from: ms[0], to: ms[ms.length - 1] });
  }
  // ต้นปี: ม.ค. ของปีนี้ ถึงเดือนก่อนเดือนปัจจุบัน (เดือน ม.ค. ยังไม่มีเดือนที่จบ → ไม่แสดง)
  const ytd = past.filter((m) => m.slice(0, 4) === nowYM.slice(0, 4));
  if (ytd.length) opts.push({ key: 'ytd', label: `ต้นปี ${ytd.length} เดือน`, note: 'ต้นปี', from: ytd[0], to: ytd[ytd.length - 1] });

  const pick = (from: string, to: string) => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    (form.elements.namedItem('from') as HTMLSelectElement).value = from;
    (form.elements.namedItem('to') as HTMLSelectElement).value = to;
    form.requestSubmit();
  };

  return (
    <div className="range-presets">
      <span className="field-label">เลือกเร็ว</span>
      <div className="seg" role="group" aria-label="เลือกช่วงเดือน">
        {opts.map((o) => {
          const on = o.from === fromYM && o.to === toYM;
          return (
            <button key={o.key} type="button" className={on ? 'on' : ''} aria-pressed={on}
              title={formatRange(o.from, o.to)} onClick={() => pick(o.from, o.to)}>
              {o.label}
            </button>
          );
        })}
      </div>
      <span className="range-presets-note">
        {opts.map((o) => `${o.note} = ${formatRange(o.from, o.to)}`).join(' · ')} · ย้อนหลัง / ต้นปี ไม่นับเดือนปัจจุบัน
      </span>
    </div>
  );
}
