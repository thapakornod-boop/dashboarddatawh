'use client';

// ร้านของเซลล์เครดิตคนหนึ่ง: 1 แถว = 1 ร้าน, 1 ช่อง = 1 เดือน (มียอด = สีเข้มตามยอด / ไม่ซื้อ = ช่องว่าง)
// ดูได้ทันทีว่าร้านไหนซื้อประจำทุกเดือน ร้านไหนซื้อ ๆ หาย ๆ
import { useMemo, useState } from 'react';
import { fmtInt, fmtShort } from '@/app/lib/format';
import { monthAbbr } from '@/app/lib/period';

export type CreditStore = { cardcode: string; name: string; giv: number[]; total: number; active: number };
type Filter = 'all' | 'every' | 'some' | 'lost';
const FIRST = 40;

export default function CreditStoreGrid({ stores, months }: { stores: CreditStore[]; months: string[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [showAll, setShowAll] = useState(false);
  const n = months.length;
  const last = n - 1;

  const counts = useMemo(() => ({
    all: stores.length,
    every: stores.filter((s) => s.active === n).length,
    some: stores.filter((s) => s.active < n && s.giv[last] > 0).length,
    lost: stores.filter((s) => !(s.giv[last] > 0)).length,
  }), [stores, n, last]);

  const list = useMemo(() => stores.filter((s) =>
    filter === 'all' ? true
      : filter === 'every' ? s.active === n
        : filter === 'some' ? s.active < n && s.giv[last] > 0
          : !(s.giv[last] > 0)
  ), [stores, filter, n, last]);
  const shown = showAll ? list : list.slice(0, FIRST);
  const max = Math.max(...stores.flatMap((s) => s.giv), 1);
  // ความเข้มของช่องตามยอด (4 ระดับ)
  const level = (v: number) => (v <= 0 ? 0 : v >= max * 0.5 ? 4 : v >= max * 0.2 ? 3 : v >= max * 0.05 ? 2 : 1);

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: `ทั้งหมด (${counts.all})` },
    ...(n > 1 ? [{ key: 'every' as Filter, label: `ซื้อทุกเดือน (${counts.every})` }, { key: 'some' as Filter, label: `ซื้อบางเดือน (${counts.some})` }] : []),
    { key: 'lost', label: `เดือนล่าสุดไม่ซื้อ (${counts.lost})` },
  ];

  return (
    <div className="cg">
      <div className="seg cg-tabs" role="tablist" aria-label="กรองร้าน">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={filter === t.key} className={filter === t.key ? 'on' : ''}
            onClick={() => { setFilter(t.key); setShowAll(false); }}>{t.label}</button>
        ))}
      </div>

      {list.length === 0 ? <p className="empty">ไม่มีร้านตามตัวกรอง</p> : (
        <>
          <div className="cg-row cg-headrow" aria-hidden="true">
            <span>ร้านค้า</span>
            <span className="cg-strip">{months.map((m) => <span key={m} className="cg-mh">{monthAbbr(m)}</span>)}</span>
            <span className="r">ซื้อ</span>
            <span className="r">GIV รวม</span>
          </div>
          <ol className="cg-list">
            {shown.map((s) => (
              <li key={s.cardcode} className="cg-row">
                <span className="cg-store">
                  <b>{s.name || '(ไม่มีชื่อร้าน)'}</b>
                  <span className="code">{s.cardcode}</span>
                </span>
                <span className="cg-strip" role="img" aria-label={months.map((m, i) => `${monthAbbr(m)} ${s.giv[i] > 0 ? fmtShort(s.giv[i]) : 'ไม่ซื้อ'}`).join(', ')}>
                  {months.map((m, i) => (
                    <span key={m} className={`cg-cell l${level(s.giv[i])}`} title={`${monthAbbr(m)} ${m.slice(0, 4)}: ${s.giv[i] ? fmtInt(s.giv[i]) : 'ไม่ซื้อ'}`}>
                      <span className="cg-v">{s.giv[i] > 0 ? fmtShort(s.giv[i]) : s.giv[i] < 0 ? 'คืน' : ''}</span>
                    </span>
                  ))}
                </span>
                <span className={`r cg-act${s.active === n && n > 1 ? ' full' : ''}`}>{s.active}/{n}</span>
                <span className="r strong">{fmtInt(s.total)}</span>
              </li>
            ))}
          </ol>
          {list.length > FIRST && (
            <button type="button" className="clear-btn cg-more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'ย่อ' : `ดูทั้งหมด ${list.length} ร้าน`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
