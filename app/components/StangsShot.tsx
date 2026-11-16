'use client';

// STANGS: ปุ่มทำรูปตาราง Seller Monitoring (ตามตัวกรองที่เลือก) — คัดลอกไปวางในไลน์ / บันทึก / แชร์ (มือถือ)
// ตารางสำหรับถ่ายรูปวางไว้นอกจอ (ต้องอยู่ในหน้าถึงจะถ่ายได้) แล้วใช้ html-to-image แปลงเป็น PNG
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getFontEmbedCSS, toBlob } from 'html-to-image';
import { fmtInt } from '@/app/lib/format';
import { hhmm, RULES, type SellerRow } from '@/app/lib/stangsCalc';
import { closeLoading, showError, showLoading, showToast } from '@/app/components/Loading';

const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
const noSubscribe = () => () => {};
const pct = (a: number, b: number) => (b ? (a / b) * 100 : null);
const per = (a: number, b: number, d = 1) => (b ? (a / b).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
const n0 = (v: number) => (v ? fmtInt(v) : '–');

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

type Shot = { url: string; file: File };

export default function StangsShot({ rows, title, sub, fileTag, problemText, actionText, disabled }: {
  rows: SellerRow[]; title: string; sub: string; fileTag: string;
  problemText: (r: SellerRow) => string; actionText: (r: SellerRow) => string; disabled?: boolean;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const fontCss = useRef<Promise<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const touch = useSyncExternalStore(noSubscribe, isTouch, () => false);
  const name = `STANGS-Seller-Monitoring-${fileTag}.png`;

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const render = async () => {
    const node = sheet.current;
    if (!node) throw new Error('ไม่พบตาราง');
    fontCss.current ??= getFontEmbedCSS(node).catch(() => '');
    const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: '#ffffff', fontEmbedCSS: await fontCss.current });
    if (!blob) throw new Error('สร้างรูปไม่สำเร็จ');
    return blob;
  };

  const make = async () => {
    if (busy) return;
    setBusy(true);
    showLoading('กำลังทำรูปตาราง', `${rows.length} เซลล์`);
    try {
      const blob = await render();
      setShot({ url: URL.createObjectURL(blob), file: new File([blob], name, { type: 'image/png' }) });
      closeLoading();
    } catch (err) {
      closeLoading();
      showError('ทำรูปไม่สำเร็จ', err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  const copy = async (s: Shot) => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': s.file })]);
      showToast('คัดลอกรูปแล้ว — วางในไลน์ได้เลย (Ctrl+V)');
    } catch {
      showError('คัดลอกไม่ได้', 'กดปุ่มบันทึกแทน หรือคลิกขวาที่รูปแล้วเลือกคัดลอกรูป');
    }
  };
  const share = async (s: Shot) => {
    if (!navigator.canShare?.({ files: [s.file] })) {
      showError('แชร์ไม่ได้', 'กดค้างที่รูปแล้วเลือก "บันทึกรูป" หรือกดปุ่มบันทึกแทน (ถ้าเปิดจากในไลน์ ให้เปิดด้วย Chrome / Safari)');
      return;
    }
    try { await navigator.share({ files: [s.file] }); } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showError('แชร์ไม่สำเร็จ', 'กดบันทึกรูปแล้วส่งจากแกลเลอรีแทน');
    }
  };

  // ไฮไลท์แดง = เกินเกณฑ์ (เหมือนชีต Seller Monitoring)
  const bad = (on: boolean) => (on ? 'bad' : undefined);
  const tot = rows.reduce((t, r) => ({
    planned: t.planned + r.plannedTrip, toDate: t.toDate + r.plannedToDate, visits: t.visits + r.visits, planVisited: t.planVisited + r.planVisited,
    missed: t.missed + r.missed, adhoc: t.adhoc + r.adhoc, buying: t.buying + r.buyingStores, bills: t.bills + r.bills, sales: t.sales + r.sales,
    lines: t.lines + r.lines, late: t.late + r.lateStart, early: t.early + r.earlyFinish, short: t.short + r.shortHours,
    quick: t.quick + r.shortVisits, far: t.far + r.farCheckin, issues: t.issues + r.totalIssues,
  }), { planned: 0, toDate: 0, visits: 0, planVisited: 0, missed: 0, adhoc: 0, buying: 0, bills: 0, sales: 0, lines: 0, late: 0, early: 0, short: 0, quick: 0, far: 0, issues: 0 });

  return (
    <>
      <button type="button" className="clear-btn" onClick={make} disabled={disabled || busy || !rows.length} title="ทำรูปตาราง Seller Monitoring ตามตัวกรองที่เลือก">
        รูปตาราง
      </button>

      {shot && createPortal(
        <div className="shots-backdrop" role="dialog" aria-modal="true" aria-label="รูปตาราง STANGS" onClick={() => setShot(null)}>
          <div className="shots shots-wide" onClick={(e) => e.stopPropagation()}>
            <div className="shots-head">
              <b>รูปตาราง Seller Monitoring</b>
              <button type="button" className="shots-close" onClick={() => setShot(null)} aria-label="ปิด">✕</button>
            </div>
            <p className="shots-tip">
              {touch ? 'กด "แชร์" แล้วเลือก LINE · หรือกดค้างที่รูปเพื่อบันทึกลงเครื่อง' : 'กด "คัดลอก" แล้ววางในไลน์ (Ctrl+V) · หรือกด "บันทึก"'}
            </p>
            <div className="shots-list">
              <figure className="shot">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shot.url} alt={name} onLoad={(e) => { e.currentTarget.style.width = `${e.currentTarget.naturalWidth / 2}px`; }} />
                <figcaption>
                  <span>{name}</span>
                  <span className="shot-btns">
                    {touch
                      ? <button type="button" className="btn btn-primary" onClick={() => share(shot)}>แชร์</button>
                      : <button type="button" className="btn btn-primary" onClick={() => copy(shot)}>คัดลอก</button>}
                    <button type="button" className="clear-btn" onClick={() => download(shot.file, name)}>บันทึก</button>
                  </span>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ตารางสำหรับทำรูป (นอกจอ) */}
      <div className="xl-offscreen" aria-hidden="true">
        <div ref={sheet} className="stg-sheet">
          <div className="stg-sheet-top">
            <b>{title}</b>
            <span>{sub}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Area Manager</th><th>Supervisor</th><th>Seller</th><th>ชื่อเซลล์</th>
                <th>Working Days</th><th>Avg Start</th><th>Avg Finish</th><th>Avg Work Hours</th><th>Avg Store Hours</th>
                <th>Planned Stores</th><th>Actual Visits</th><th>Plan Compliance %</th><th>Missed Visits</th><th>Adhoc Visits</th>
                <th>Buying Stores</th><th>Total Bills</th><th>Total Sales (GIV)</th><th>SKU per Bill</th><th>Baht per Bill</th>
                <th>Late Start</th><th>Early Finish</th><th>Short Hours</th><th>Quick Visits</th><th>Far Check-in</th><th>Total Issues</th>
                <th className="l">Main Problem</th><th className="l">Next Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const comp = pct(r.planVisited, r.plannedToDate);
                return (
                  <tr key={`${r.company}|${r.seller}`}>
                    <td>{i + 1}</td>
                    <td className="l">{r.manager || '–'}</td>
                    <td className="l">{r.supervisor || '–'}</td>
                    <td className="l">{r.seller}</td>
                    <td className="l">{r.name || '–'}</td>
                    <td className={bad(r.planDays > 0 && r.workDays < r.planDays)}>{r.workDays} / {r.planDays || '–'}</td>
                    <td className={bad(r.avgStart != null && r.avgStart > RULES.lateStart)}>{hhmm(r.avgStart)}</td>
                    <td className={bad(r.avgFinish != null && r.avgFinish < RULES.earlyFinish)}>{hhmm(r.avgFinish)}</td>
                    <td className={bad(r.avgWork != null && r.avgWork < RULES.shortHours)}>{hhmm(r.avgWork)}</td>
                    <td>{hhmm(r.avgStore)}</td>
                    <td>{n0(r.plannedTrip)}</td>
                    <td>{n0(r.visits)}</td>
                    <td className={bad(comp != null && comp < 80)}>{comp == null ? '–' : `${comp.toFixed(1)}%`}</td>
                    <td className={bad(r.missed > 0)}>{n0(r.missed)}</td>
                    <td>{n0(r.adhoc)}</td>
                    <td>{n0(r.buyingStores)}</td>
                    <td>{n0(r.bills)}</td>
                    <td>{n0(Math.round(r.sales))}</td>
                    <td>{per(r.lines, r.bills, 2)}</td>
                    <td>{r.bills ? fmtInt(r.sales / r.bills) : '–'}</td>
                    <td className={bad(r.lateStart > 0)}>{n0(r.lateStart)}</td>
                    <td className={bad(r.earlyFinish > 0)}>{n0(r.earlyFinish)}</td>
                    <td className={bad(r.shortHours > 0)}>{n0(r.shortHours)}</td>
                    <td className={bad(r.shortVisits > 0)}>{n0(r.shortVisits)}</td>
                    <td className={bad(r.farCheckin > 0)}>{n0(r.farCheckin)}</td>
                    <td className={`strong ${r.totalIssues ? 'bad' : ''}`}>{n0(r.totalIssues)}</td>
                    <td className="l wrap">{problemText(r)}</td>
                    <td className="l wrap">{actionText(r)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="l" colSpan={5}>รวม {rows.length} คน</td>
                <td /><td /><td /><td /><td />
                <td>{fmtInt(tot.planned)}</td>
                <td>{fmtInt(tot.visits)}</td>
                <td>{tot.toDate ? `${((tot.planVisited / tot.toDate) * 100).toFixed(1)}%` : '–'}</td>
                <td>{fmtInt(tot.missed)}</td>
                <td>{fmtInt(tot.adhoc)}</td>
                <td>{fmtInt(tot.buying)}</td>
                <td>{fmtInt(tot.bills)}</td>
                <td>{fmtInt(Math.round(tot.sales))}</td>
                <td>{per(tot.lines, tot.bills, 2)}</td>
                <td>{tot.bills ? fmtInt(tot.sales / tot.bills) : '–'}</td>
                <td>{fmtInt(tot.late)}</td>
                <td>{fmtInt(tot.early)}</td>
                <td>{fmtInt(tot.short)}</td>
                <td>{fmtInt(tot.quick)}</td>
                <td>{fmtInt(tot.far)}</td>
                <td>{fmtInt(tot.issues)}</td>
                <td /><td />
              </tr>
            </tfoot>
          </table>
          <p className="stg-sheet-note">
            แดง = เกินเกณฑ์ · Late Start หลัง {hhmm(RULES.lateStart)} · Early Finish ก่อน {hhmm(RULES.earlyFinish)} · Short Hours &lt; {RULES.shortHours / 60} ชม. ·
            Quick Visit &lt; {RULES.shortVisit} นาที · Far Check-in &gt; {RULES.farCheckinM} ม. · Plan Compliance &lt; 80% · Late / Early / Short Hours นับเป็นวัน, Quick / Far นับเป็นครั้ง
          </p>
        </div>
      </div>
    </>
  );
}
