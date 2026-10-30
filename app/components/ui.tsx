// ชิ้น UI ที่ใช้ซ้ำทั้งหน้า (server / client ใช้ได้ทั้งคู่ — ไม่มี state)
import { fmtPct, paceFill, paceOf, PACE_LABEL } from '@/app/lib/format';

// หลอด % พร้อมขีด Time gone — สีแท่งบอกสถานะ (เขียว ตามเป้า / เหลือง ใกล้เป้า / แดง ต่ำกว่าเป้า)
export function PaceBar({ pct, timeGonePct, size = 'md' }: { pct: number | null; timeGonePct: number; size?: 'sm' | 'md' }) {
  return (
    <span className={`bar bar-${size}`} role="img" aria-label={`${fmtPct(pct)} · Time gone ${timeGonePct.toFixed(1)}%`}>
      <span className="bar-fill" style={{ width: `${Math.min(Math.max(pct ?? 0, 0), 100)}%`, background: paceFill(pct, timeGonePct) }} />
      {timeGonePct > 0 && timeGonePct < 100 && <span className="bar-tick" style={{ left: `${timeGonePct}%` }} />}
    </span>
  );
}

// ป้ายสถานะ: มีจุดสี + ข้อความเสมอ (ไม่สื่อด้วยสีอย่างเดียว)
export function PaceChip({ pct, timeGonePct }: { pct: number | null; timeGonePct: number }) {
  const p = paceOf(pct, timeGonePct);
  return <span className={`chip chip-${p}`}><span className="chip-dot" />{PACE_LABEL[p]}</span>;
}

// % เติบโตเทียบปีก่อน: ▲ เขียว / ▼ แดง
export function Growth({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="growth growth-none">–</span>;
  const up = pct >= 0;
  return <span className={`growth ${up ? 'growth-up' : 'growth-down'}`}>{up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>;
}
