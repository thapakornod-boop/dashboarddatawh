// ยอดขายรายร้านของเซลล์ 1 คน ใน 1 วัน (หน้า STANGS: กด "ดูร้าน") — GET /dashboard/stangs/day?company=&seller=&d=
//   จาก vw_lg014: เลขที่เอกสาร / GIV / NIV / จำนวน SKU ต่อร้าน
//   กติกาเดียวกับ dashboard: ไม่นับ series CMP / DMP / -VAT · ของแถม (ยอดสุทธิ 0) = GIV 0 ยกเว้นคูปองส่วนลด · ไม่นับเอกสารใน doc_exclude
import type { NextRequest } from 'next/server';
import { addDays, selectTable } from '@/app/lib/api';
import { currentEmployee } from '@/app/lib/session';

type Line = {
  series: string; doc_type: string; document_no: number; cardcode: string; card_name: string | null; item_code: string; dscription: string | null;
  quantity: number; price_bef_di: number; line_total: number; total_disc: number;
};
export type DayDoc = { no: string; credit: boolean; giv: number; niv: number };
export type DayStore = { store: string; name: string; docs: DayDoc[]; giv: number; niv: number; skus: number };

const giv = (company: string, l: Line) => {
  const lt = Number(l.line_total) || 0, disc = Number(l.total_disc) || 0;
  if (lt === 0 && !(l.dscription ?? '').includes('คูปอง')) return 0; // ของแถม
  if (company === 'SDO') {
    const sign = /credit/i.test(l.doc_type) ? -1 : 1;
    return sign * Math.max(Math.abs(lt + disc), Math.round(Math.abs((Number(l.quantity) || 0) * (Number(l.price_bef_di) || 0)) * 100) / 100);
  }
  return lt + disc;
};

export async function GET(request: NextRequest) {
  if (!(await currentEmployee())) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const p = request.nextUrl.searchParams;
  const company = (p.get('company') ?? '').toUpperCase();
  const seller = (p.get('seller') ?? '').trim();
  const d = (p.get('d') ?? '').trim();
  if (!/^(SDO|PDC|DC)$/.test(company) || !seller || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return Response.json({ error: 'bad request' }, { status: 400 });

  try {
    const [lines, excluded] = await Promise.all([
      selectTable<Line>(
        `vw_lg014?select=series,doc_type,document_no,cardcode,card_name,item_code,dscription,quantity,price_bef_di,line_total,total_disc` +
        `&company_code=eq.${company}&seller=eq.${encodeURIComponent(seller)}&document_date=gte.${d}&document_date=lt.${addDays(d, 1)}&limit=10000`
      ),
      selectTable<{ series: string; document_no: number }>(`doc_exclude?select=series,document_no&company_code=eq.${company}`).catch(() => []),
    ]);
    const skip = new Set(excluded.map((x) => `${x.series}|${x.document_no}`));
    const byStore = new Map<string, DayStore & { docMap: Map<string, DayDoc>; skuSet: Set<string> }>();
    for (const l of lines) {
      if (/(CMP|DMP|-VAT)$/.test(l.series) || skip.has(`${l.series}|${l.document_no}`)) continue;
      const store = (l.cardcode ?? '').trim();
      let s = byStore.get(store);
      if (!s) byStore.set(store, (s = { store, name: (l.card_name ?? '').trim(), docs: [], giv: 0, niv: 0, skus: 0, docMap: new Map(), skuSet: new Set() }));
      const no = `${l.series} ${l.document_no}`;
      let doc = s.docMap.get(no);
      if (!doc) s.docMap.set(no, (doc = { no, credit: /credit/i.test(l.doc_type), giv: 0, niv: 0 }));
      const g = giv(company, l), n = Number(l.line_total) || 0;
      doc.giv += g; doc.niv += n; s.giv += g; s.niv += n;
      // SKU ที่ขายได้ = รหัสสินค้าไม่ซ้ำในบิลขาย ที่ยอดสุทธิ > 0 (ไม่นับของแถม / ใบลดหนี้)
      if (!doc.credit && n > 0) s.skuSet.add(l.item_code);
    }
    const stores: DayStore[] = [...byStore.values()].map(({ docMap, skuSet, ...s }) => ({
      ...s,
      docs: [...docMap.values()].map((x) => ({ ...x, giv: Math.round(x.giv * 100) / 100, niv: Math.round(x.niv * 100) / 100 })),
      giv: Math.round(s.giv * 100) / 100, niv: Math.round(s.niv * 100) / 100, skus: skuSet.size,
    }));
    return Response.json({ stores });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'error' }, { status: 502 });
  }
}
