// ประเภทเซลล์: Credit / Van / Presale / อื่น ๆ — ใช้แยก Scorecard (วันทำงาน, Avg.Call/Day, Line/Bill) และหน้าร้านเครดิต
//   1. คอลัมน์ Channel ในชีต BEST (ถ้ามี): Credit, MAS → Credit · Van → Van · Presale, PS → Presale
//   2. ไม่มีในชีต → ดูจากรหัสเซลล์
//        SDO     : ตัวอักษรกลางรหัส MS / ASM / DSM / MAS → Credit · PS / DSP / AD → Presale (เช่น 700MS03, 708PS07)
//        PDC / DC: มี CR หรือลงท้าย C + ตัวเลข → Credit · มี VN หรือลงท้าย V / O + ตัวเลข → Van · มี PS → Presale
//   รหัสของ PDC / DC ไม่มีรูปแบบตายตัว (เช่น PSLC01 = Credit, PSLO01 = Van) จึงยึดชีตก่อนเสมอ
export type SellerType = 'CREDIT' | 'VAN' | 'PRESALE' | 'OTHER';

export const SELLER_TYPES: SellerType[] = ['CREDIT', 'VAN', 'PRESALE', 'OTHER'];
export const SELLER_TYPE_LABEL: Record<SellerType, string> = { CREDIT: 'Credit', VAN: 'Van', PRESALE: 'Presale', OTHER: 'อื่น ๆ' };

function fromChannel(channel: string | undefined): SellerType | null {
  const c = (channel ?? '').trim().toUpperCase();
  if (!c) return null;
  if (c === 'CREDIT' || c === 'MAS' || c === 'MS') return 'CREDIT';
  if (c === 'VAN') return 'VAN';
  if (c === 'PRESALE' || c === 'PS') return 'PRESALE';
  return null;
}

function fromCode(company: string, seller: string): SellerType {
  const s = seller.toUpperCase();
  if (company === 'SDO') {
    const mid = /^\d+([A-Z]+)\d*$/.exec(s)?.[1] ?? '';
    if (['MS', 'ASM', 'DSM', 'MAS'].includes(mid)) return 'CREDIT';
    if (['PS', 'DSP', 'AD'].includes(mid)) return 'PRESALE';
    return 'OTHER';
  }
  if (/CR\d|C\d+$/.test(s)) return 'CREDIT';
  if (/VN|[VO]\d+$/.test(s)) return 'VAN';
  if (/PS\d/.test(s)) return 'PRESALE';
  return 'OTHER';
}

// channels = รหัสเซลล์ → Channel จากชีต
export function sellerTypeOf(company: string, seller: string, channels: Record<string, string>): SellerType {
  return fromChannel(channels[seller]) ?? fromCode(company, seller);
}
