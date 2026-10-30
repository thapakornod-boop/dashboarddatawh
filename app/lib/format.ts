// ตัวช่วยจัดรูปแบบตัวเลข + สี ใช้ได้ทั้งฝั่ง server และ client component
// สีตาม design.md (Genesis): indigo ใช้กับสิ่งที่กดได้เท่านั้น, เขียว/เหลือง/แดง = สถานะ

// สีประจำบริษัท (categorical) — ผ่าน validator ของ dataviz แล้ว และไม่ชนกับ indigo / สีสถานะ
export const COMPANY_COLORS: Record<string, string> = {
  SDO: '#0891B2',
  PDC: '#DB2777',
  DC:  '#7C3AED',
};

export function fmtNum(n: number | null | undefined) {
  if (n == null) return '-';
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ตัวเลขเต็มไม่มีทศนิยม ใช้ในตารางที่คอลัมน์แน่น
export function fmtInt(n: number | null | undefined) {
  if (n == null) return '-';
  return Math.round(Number(n)).toLocaleString('th-TH');
}

// 381,607,715 → "381.61M"
export function fmtShort(n: number): string {
  // มีคอมมาคั่นหลักพันด้วย เช่น 2,330.44M
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'M';
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}

export function fmtPct(n: number | null) {
  return n == null ? '–' : `${n.toFixed(1)}%`;
}

export function pctOf(value: number, base: number): number | null {
  return base ? (value / base) * 100 : null;
}

export function pctGrowth(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

// สถานะเทียบ Time gone: ถึง/เกิน = ok, ขาดไม่เกิน 10% ของ time gone = warn, มากกว่านั้น = bad
export type Pace = 'ok' | 'warn' | 'bad' | 'none';
export function paceOf(pct: number | null, timeGonePct: number): Pace {
  if (pct == null) return 'none';
  if (pct >= timeGonePct) return 'ok';
  if (pct >= timeGonePct * 0.9) return 'warn';
  return 'bad';
}

// สีตามมาตรฐาน Ant Design: success / warning / error (ตัวอักษรใช้เฉดเข้มให้อ่านบนพื้นขาวได้ชัด)
const PACE_TEXT: Record<Pace, string> = { ok: '#389E0D', warn: '#AD6800', bad: '#CF1322', none: '#8C8C8C' };
const PACE_FILL: Record<Pace, string> = { ok: '#52C41A', warn: '#FAAD14', bad: '#FF4D4F', none: '#D9D9D9' };
export const PACE_LABEL: Record<Pace, string> = { ok: 'ตามเป้า', warn: 'ใกล้เป้า', bad: 'ต่ำกว่าเป้า', none: 'ไม่มีเป้า' };

export function paceColor(pct: number | null, timeGonePct: number) {
  return PACE_TEXT[paceOf(pct, timeGonePct)];
}
export function paceFill(pct: number | null, timeGonePct: number) {
  return PACE_FILL[paceOf(pct, timeGonePct)];
}
