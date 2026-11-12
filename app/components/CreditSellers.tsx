'use client';

// ตารางเซลล์เครดิต: ตัวกรอง บริษัท (ทั้งหมดได้) / ค้นหาเซลล์ / Princ
// คอลัมน์ต่อเดือน: Active Store (ร้านไม่ซ้ำ — ซื้อกี่บิลก็นับ 1) · บิล (ขายกี่ครั้งนับเท่านั้น) · ท้ายตาราง = ค่าเฉลี่ยต่อเดือน + GIV
import { useMemo, useState } from 'react';
import { COMPANY_COLORS, fmtInt } from '@/app/lib/format';
import { monthAbbr } from '@/app/lib/period';
import LoadingLink from '@/app/components/LoadingLink';

export type CreditSeller = {
  key: string; company: string; seller: string; name: string; branch: string; princ: string;
  stores: number; giv: number; bills: number;
  months: Record<string, { stores: number; bills: number; giv: number; repeat: number }>;
};

const ALL = '';
const f1 = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 1 });

export default function CreditSellers({ sellers, months, companies, pickedKey, hrefFor }: {
  sellers: CreditSeller[]; months: string[]; companies: string[]; pickedKey: string;
  hrefFor: Record<string, string>;
}) {
  const [co, setCo] = useState(ALL);
  const [princ, setPrinc] = useState(ALL);
  const [q, setQ] = useState('');
  const n = months.length;

  const coRows = useMemo(() => sellers.filter((s) => !co || s.company === co), [sellers, co]);
  const princOptions = useMemo(
    () => Array.from(new Set(coRows.flatMap((s) => s.princ.split('/').filter(Boolean)))).sort(),
    [coRows]
  );
  const term = q.trim().toLowerCase();
  const list = useMemo(() => coRows.filter((s) =>
    (!princ || s.princ.split('/').includes(princ)) &&
    (!term || s.seller.toLowerCase().includes(term) || s.name.toLowerCase().includes(term) || s.branch.toLowerCase().includes(term))
  ), [coRows, princ, term]);

  // รวมทุกเซลล์ที่กรอง (Active Store รวม = นับร้านของแต่ละเซลล์รวมกัน)
  const tot = useMemo(() => {
    const m = Object.fromEntries(months.map((ym) => [ym, { stores: 0, bills: 0 }]));
    let stores = 0, bills = 0, giv = 0;
    for (const s of list) {
      stores += s.stores; bills += s.bills; giv += s.giv;
      for (const ym of months) { m[ym].stores += s.months[ym]?.stores ?? 0; m[ym].bills += s.months[ym]?.bills ?? 0; }
    }
    return { m, stores, bills, giv };
  }, [list, months]);

  const avg = (s: CreditSeller, k: 'stores' | 'bills') => months.reduce((t, ym) => t + (s.months[ym]?.[k] ?? 0), 0) / Math.max(n, 1);

  return (
    <>
      <div className="team-filters">
        <label className="field">
          <span className="field-label">บริษัท</span>
          <select value={co} onChange={(e) => { setCo(e.target.value); setPrinc(ALL); }} disabled={companies.length < 2}>
            {companies.length > 1 && <option value={ALL}>ทั้งหมด</option>}
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Princ</span>
          <select value={princ} onChange={(e) => setPrinc(e.target.value)}>
            <option value={ALL}>ทั้งหมด ({princOptions.length})</option>
            {princOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="field credit-search">
          <span className="field-label">ค้นหาเซลล์</span>
          <input className="store-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="รหัส / ชื่อเซลล์ / สาขา" />
        </label>
        <button type="button" className="clear-btn" onClick={() => { setCo(ALL); setPrinc(ALL); setQ(''); }} disabled={!co && !princ && !q}>ล้างตัวกรอง</button>
        <span className="muted credit-count">{list.length} คน</span>
      </div>

      {list.length === 0 ? <p className="empty">ไม่มีเซลล์ตามตัวกรอง</p> : (
        <div className="credit-wrap">
          <table className="rtable credit-table">
            <thead>
              <tr>
                <th rowSpan={2}>เซลล์</th>
                {months.map((ym) => <th key={ym} colSpan={2} className="c credit-mhead">{monthAbbr(ym)} {ym.slice(2, 4)}</th>)}
                <th colSpan={2} className="c credit-mhead credit-avg">เฉลี่ย / เดือน</th>
                <th rowSpan={2} className="r">GIV รวม</th>
                <th rowSpan={2} className="r">Active Store<br /><small>ทั้งช่วง</small></th>
              </tr>
              <tr>
                {[...months, 'avg'].map((ym) => (
                  <th key={ym} colSpan={2} className="credit-sub">
                    <span><span title="ร้านไม่ซ้ำที่ซื้อ (ซื้อกี่บิลก็นับ 1)">Active</span><span title="จำนวนบิล (ขายกี่ครั้งนับเท่านั้น)">บิล</span></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.key} className={pickedKey === s.key ? 'credit-on' : ''}>
                  <td>
                    <LoadingLink className="credit-seller" scrollToId="credit-detail" href={hrefFor[s.key]}>
                      <b>{s.name || s.seller}</b>
                      <span className="muted"><span className="dot" style={{ background: COMPANY_COLORS[s.company] }} />{s.company} · {s.seller}{s.branch ? ` · ${s.branch}` : ''}{s.princ ? ` · ${s.princ}` : ''}</span>
                    </LoadingLink>
                  </td>
                  {months.map((ym) => {
                    const m = s.months[ym];
                    return [
                      <td key={`${ym}a`} className="r credit-a" data-label={`${monthAbbr(ym)} Active`}>{m ? fmtInt(m.stores) : <span className="muted">–</span>}</td>,
                      <td key={`${ym}b`} className="r credit-b" data-label={`${monthAbbr(ym)} บิล`}>{m ? fmtInt(m.bills) : <span className="muted">–</span>}</td>,
                    ];
                  })}
                  <td className="r credit-a credit-avg strong" data-label="เฉลี่ย Active">{f1(avg(s, 'stores'))}</td>
                  <td className="r credit-b credit-avg strong" data-label="เฉลี่ย บิล">{f1(avg(s, 'bills'))}</td>
                  <td className="r strong" data-label="GIV รวม">{fmtInt(s.giv)}</td>
                  <td className="r" data-label="Active Store ทั้งช่วง">{fmtInt(s.stores)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><b>รวม {list.length} คน</b></td>
                {months.map((ym) => [
                  <td key={`${ym}a`} className="r credit-a strong" data-label={`${monthAbbr(ym)} Active`}>{fmtInt(tot.m[ym].stores)}</td>,
                  <td key={`${ym}b`} className="r credit-b strong" data-label={`${monthAbbr(ym)} บิล`}>{fmtInt(tot.m[ym].bills)}</td>,
                ])}
                <td className="r credit-a credit-avg strong" data-label="เฉลี่ย Active">{f1(months.reduce((t, ym) => t + tot.m[ym].stores, 0) / Math.max(n, 1))}</td>
                <td className="r credit-b credit-avg strong" data-label="เฉลี่ย บิล">{f1(months.reduce((t, ym) => t + tot.m[ym].bills, 0) / Math.max(n, 1))}</td>
                <td className="r strong" data-label="GIV รวม">{fmtInt(tot.giv)}</td>
                <td className="r strong" data-label="Active Store ทั้งช่วง">{fmtInt(tot.stores)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
