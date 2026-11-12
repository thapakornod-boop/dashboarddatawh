'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getFontEmbedCSS, toBlob } from 'html-to-image';
import type { PrincReportRow } from '@/app/lib/princReport';
import { fmtInt } from '@/app/lib/format';
import { rank } from '@/app/components/BranchSales';
import { closeLoading, showError, showLoading, showToast } from '@/app/components/Loading';
import RefreshButton from '@/app/components/RefreshButton';

// ตาราง Princ ต่อสาขา: Target / GIV MTD / BE / % GIV MTD (เทียบ Time gone) / % BE (BE ÷ Target)
// ส่งออก: รูป (คัดลอก / แชร์ / บันทึก ทีละสาขาหรือทุกสาขา) และไฟล์ Excel (1 ชีตต่อสาขา)
const ALL = '';

type Agg = { target: number; be: number; giv: number };
type Shot = { name: string; url: string; file: File };

const pctText = (n: number) => `${Math.round(n)}%`;
const givTone = (pct: number, tg: number) => (pct >= tg ? 'good' : 'bad');
const beTone = (pct: number) => (Math.round(pct) > 100 ? 'good' : Math.round(pct) < 100 ? 'bad' : '');

function lines(rows: PrincReportRow[], branch: string) {
  const m = new Map<string, Agg>();
  for (const r of rows) {
    if (branch && r.branch !== branch) continue;
    const x = m.get(r.principal) ?? { target: 0, be: 0, giv: 0 };
    x.target += r.target; x.be += r.be; x.giv += r.giv;
    m.set(r.principal, x);
  }
  const list = [...m.entries()]
    .filter(([, v]) => v.target || v.be || Math.abs(v.giv) >= 1)
    .sort(([a], [b]) => (a === 'P&G' ? 1 : b === 'P&G' ? -1 : a.localeCompare(b)));
  const total = list.reduce((s, [, v]) => ({ target: s.target + v.target, be: s.be + v.be, giv: s.giv + v.giv }), { target: 0, be: 0, giv: 0 });
  return { list, total };
}

// showBe = false (เลือกเดือนย้อนหลัง) → ไม่มีคอลัมน์ BE / % BE ทั้งในตาราง รูป และ Excel
function Cells({ v, tg, showBe }: { v: Agg; tg: number; showBe: boolean }) {
  const pg = v.target ? (v.giv / v.target) * 100 : null;
  const pb = v.target ? (v.be / v.target) * 100 : null;
  return (
    <>
      <td className="r" data-label="Target">{v.target ? fmtInt(v.target) : '–'}</td>
      <td className="r" data-label="GIV MTD">{fmtInt(v.giv)}</td>
      {showBe && <td className="r" data-label="BE">{v.be ? fmtInt(v.be) : '–'}</td>}
      <td className="r" data-label="% GIV MTD">{pg === null ? '–' : <span className={`pr-pct ${givTone(pg, tg)}`}>{pctText(pg)}</span>}</td>
      {showBe && <td className="r" data-label="% BE">{pb === null ? '–' : <span className={`pr-pct ${beTone(pb)}`}>{pctText(pb)}</span>}</td>}
    </>
  );
}

// รูปแบบรูปภาพ (คล้ายตาราง Excel ที่ส่งในไลน์) ความกว้างคงที่ ไม่ขึ้นกับจอ
function Sheet({ rows, branch, tg, targetLabel, dataLabel, showBe }: {
  rows: PrincReportRow[]; branch: string; tg: number; targetLabel: string; dataLabel: string; showBe: boolean;
}) {
  const { list, total } = lines(rows, branch);
  const cell = (v: Agg) => {
    const pg = v.target ? (v.giv / v.target) * 100 : null;
    const pb = v.target ? (v.be / v.target) * 100 : null;
    return (
      <>
        <td>{v.target ? fmtInt(v.target) : '-'}</td>
        <td>{fmtInt(v.giv)}</td>
        {showBe && <td>{v.be ? fmtInt(v.be) : '-'}</td>}
        <td className={pg === null ? '' : givTone(pg, tg)}>{pg === null ? '-' : pctText(pg)}</td>
        {showBe && <td className={pb === null ? '' : beTone(pb)}>{pb === null ? '-' : pctText(pb)}</td>}
      </>
    );
  };
  return (
    <div className="xl-sheet">
      <div className="xl-top">
        <span><b>Branch</b> {branch || '(All)'}</span>
        <span><b>Timegone</b> {pctText(tg)}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th className="l">Princ</th>
            <th>Sum of Target {targetLabel}</th>
            <th>Sum of ยอดขาย GIV MTD</th>
            {showBe && <th>Sum of BE</th>}
            <th>% GIV MTD</th>
            {showBe && <th>% BE</th>}
          </tr>
        </thead>
        <tbody>
          {list.map(([p, v]) => (
            <tr key={p}><td className="l">{p}</td>{cell(v)}</tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td className="l">Grand Total</td>{cell(total)}</tr>
        </tfoot>
      </table>
      <div className="xl-foot">{dataLabel}</div>
    </div>
  );
}

// ไฟล์ Excel: ชีตเดียว "All" — ตาราง All แล้วตามด้วยตารางทุกสาขาเรียงลงมา สี / รูปแบบเหมือนรูป — โหลด exceljs เฉพาะตอนกด
async function buildExcel(rows: PrincReportRow[], keys: string[], tg: number, targetLabel: string, dataLabel: string, showBe: boolean) {
  const ExcelJS = await import('exceljs');
  const Workbook = ExcelJS.Workbook ?? ExcelJS.default.Workbook;
  const wb = new Workbook();
  const head = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } } as const;
  const good = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } } as const, font: { color: { argb: 'FF006100' } } };
  const bad = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } } as const, font: { color: { argb: 'FF9C0006' } } };
  const border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } as const;

  const ws = wb.addWorksheet('All');
  ws.columns = showBe
    ? [{ width: 14 }, { width: 22 }, { width: 22 }, { width: 18 }, { width: 13 }, { width: 11 }]
    : [{ width: 14 }, { width: 22 }, { width: 22 }, { width: 13 }];
  ws.addRow([dataLabel]);

  for (const b of keys) {
    ws.addRow([]);
    ws.addRow([]);
    const top = ws.addRow(['Branch', b || '(All)', '', 'Timegone', tg / 100]);
    top.getCell(5).numFmt = '0%';
    [1, 2, 4, 5].forEach((i) => { top.getCell(i).fill = head; top.getCell(i).font = { bold: true }; });
    ws.addRow([]);
    const h = ws.addRow(showBe
      ? ['Princ', `Sum of Target ${targetLabel}`, 'Sum of ยอดขาย GIV MTD', 'Sum of BE', '% GIV MTD', '% BE']
      : ['Princ', `Sum of Target ${targetLabel}`, 'Sum of ยอดขาย GIV MTD', '% GIV MTD']);
    h.eachCell((c) => { c.fill = head; c.font = { bold: true }; c.border = border; c.alignment = { wrapText: true, vertical: 'bottom', horizontal: 'center' }; });

    const { list, total } = lines(rows, b);
    const put = (label: string, v: Agg, isTotal = false) => {
      const pg = v.target ? v.giv / v.target : null;
      const pb = v.target ? v.be / v.target : null;
      const r = ws.addRow(showBe ? [label, v.target || null, Math.round(v.giv), v.be || null, pg, pb] : [label, v.target || null, Math.round(v.giv), pg]);
      const pctFrom = showBe ? 5 : 4;
      r.eachCell({ includeEmpty: true }, (c, i) => {
        c.border = border;
        if (i >= 2 && i < pctFrom) c.numFmt = '#,##0';
        if (i >= pctFrom) { c.numFmt = '0%'; c.alignment = { horizontal: 'right' }; }
        if (isTotal) { c.fill = head; c.font = { bold: true }; }
      });
      const tone = (cell: number, t: string) => {
        const style = t === 'good' ? good : t === 'bad' ? bad : null;
        if (!style) return;
        ws.getCell(r.number, cell).fill = style.fill;
        ws.getCell(r.number, cell).font = { ...style.font, bold: isTotal };
      };
      if (pg !== null) tone(pctFrom, givTone(pg * 100, tg));
      if (showBe && pb !== null) tone(6, beTone(pb * 100));
    };
    for (const [p, v] of list) put(p, v);
    put('Grand Total', total, true);
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// มือถือ / แท็บเล็ต (จอสัมผัส) — คัดลอกรูปไปวางในไลน์ไม่ได้ ต้องใช้ "แชร์" แทน
const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
const noSubscribe = () => () => {};

export default function PrincReport({ rows, timeGonePct, targetLabel, dataLabel, fileTag, showBe = true }: {
  rows: PrincReportRow[]; timeGonePct: number; targetLabel: string; dataLabel: string; fileTag: string; showBe?: boolean;
}) {
  const [branch, setBranch] = useState(ALL);
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState<Shot[] | null>(null);
  const sheets = useRef<Map<string, HTMLDivElement>>(new Map());

  const branches = useMemo(
    () => Array.from(new Set(rows.map((r) => r.branch))).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)),
    [rows]
  );
  const { list, total } = useMemo(() => lines(rows, branch), [rows, branch]);
  const tg = timeGonePct;
  const keys = [ALL, ...branches];
  const fileName = (b: string) => `GIV-${b || 'All'}-${fileTag}.png`;

  // ปิดหน้าต่างรูป → คืนหน่วยความจำของรูป
  useEffect(() => () => shots?.forEach((s) => URL.revokeObjectURL(s.url)), [shots]);

  // ฟอนต์ฝังครั้งเดียวใช้ทุกรูป (ไม่งั้นทุกรูปต้องโหลดฟอนต์ใหม่)
  const fontCss = useRef<Promise<string> | null>(null);
  const render = async (b: string) => {
    const node = sheets.current.get(b);
    if (!node) throw new Error('ไม่พบตาราง');
    fontCss.current ??= getFontEmbedCSS(node).catch(() => '');
    const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: '#ffffff', fontEmbedCSS: await fontCss.current });
    if (!blob) throw new Error('สร้างรูปไม่สำเร็จ');
    return blob;
  };
  const run = async (title: string, job: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    showLoading(title, 'รอสักครู่');
    try {
      await job();
      closeLoading();
    } catch (err) {
      closeLoading();
      showError('ทำไม่สำเร็จ', err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  // ทำรูปแล้วเปิดหน้าต่างรูป: กดแชร์ (ส่งไลน์) / บันทึก / คัดลอก ได้ทีละรูป
  const openShots = (bs: string[]) => run('กำลังทำรูป', async () => {
    const out: Shot[] = [];
    for (const b of bs) {
      const blob = await render(b);
      out.push({ name: fileName(b), url: URL.createObjectURL(blob), file: new File([blob], fileName(b), { type: 'image/png' }) });
    }
    setShots(out);
  });

  const copy = async () => {
    // มือถือ: คัดลอกรูปแล้ววางในไลน์ไม่ได้ → เปิดหน้าต่างรูปให้กดแชร์แทน
    if (isTouch() || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return openShots([branch]);
    try {
      // ส่ง Promise ให้ ClipboardItem ทันที (Safari ต้องเรียกในจังหวะที่กดปุ่ม)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': render(branch) })]);
      showToast('คัดลอกรูปแล้ว — วางในไลน์ได้เลย (Ctrl+V)');
    } catch {
      openShots([branch]);
    }
  };

  const excel = () => run('กำลังทำไฟล์ Excel', async () => {
    download(await buildExcel(rows, keys, tg, targetLabel, dataLabel, showBe), `GIV-Princ-${fileTag}.xlsx`);
    showToast('ดาวน์โหลดไฟล์ Excel แล้ว');
  });

  const share = async (files: File[]) => {
    if (!navigator.canShare?.({ files })) {
      showError('แชร์ไม่ได้', 'เบราว์เซอร์นี้แชร์รูปไม่ได้ — กดค้างที่รูปแล้วเลือก "บันทึกรูป" หรือกดปุ่มบันทึกแทน (ถ้าเปิดจากในไลน์ ให้เปิดด้วย Chrome / Safari)');
      return;
    }
    try { await navigator.share({ files }); } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showError('แชร์ไม่สำเร็จ', 'ลองแชร์ทีละรูป หรือกดบันทึกรูปแล้วส่งจากแกลเลอรีในไลน์');
    }
  };
  const copyShot = async (s: Shot) => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': s.file })]);
      showToast('คัดลอกรูปแล้ว');
    } catch {
      showError('คัดลอกไม่ได้', 'กดค้างที่รูปแล้วเลือกคัดลอก / บันทึกรูป หรือกดปุ่มแชร์แทน');
    }
  };
  const saveAllShots = async (list: Shot[]) => {
    for (const s of list) { download(s.file, s.name); await new Promise((r) => setTimeout(r, 300)); }
  };
  const touch = useSyncExternalStore(noSubscribe, isTouch, () => false);

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h3 className="card-title">{showBe ? 'GIV MTD เทียบ Target / BE ราย Princ' : 'GIV เทียบ Target ราย Princ'}</h3>
          <p className="card-sub">{showBe ? 'Target / BE' : 'Target'} จาก Google Sheet · GIV จาก vw_lg014 · % GIV MTD เขียว = ถึง Time gone {pctText(tg)}{showBe ? ' · % BE = BE ÷ Target' : ' · เดือนย้อนหลังไม่แสดง BE'}</p>
        </div>
        <RefreshButton />
      </header>

      <div className="team-filters">
        <label className="field">
          <span className="field-label">สาขา</span>
          <select value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value={ALL}>ทั้งหมด (All)</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <div className="pr-actions">
          <button type="button" className="btn btn-primary" onClick={copy} disabled={busy}>{touch ? 'แชร์รูป' : 'คัดลอกรูป'}</button>
          <button type="button" className="clear-btn" onClick={() => openShots(keys)} disabled={busy}>รูปทุกสาขา ({keys.length})</button>
          <button type="button" className="clear-btn" onClick={excel} disabled={busy}>Excel</button>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="empty">ไม่มีข้อมูลในช่วงที่เลือก</p>
      ) : (
        <table className="rtable princ-table">
          <thead>
            <tr>
              <th>Princ</th>
              <th className="r">Target {targetLabel}</th>
              <th className="r">GIV MTD</th>
              {showBe && <th className="r">BE</th>}
              <th className="r">% GIV MTD</th>
              {showBe && <th className="r">% BE</th>}
            </tr>
          </thead>
          <tbody>
            {list.map(([p, v]) => (
              <tr key={p}><td className="strong">{p}</td><Cells v={v} tg={tg} showBe={showBe} /></tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td className="strong">Grand Total</td><Cells v={total} tg={tg} showBe={showBe} /></tr>
          </tfoot>
        </table>
      )}

      {/* หน้าต่างรูป: มือถือกด "แชร์" → เลือก LINE / กดค้างที่รูปเพื่อบันทึก */}
      {shots && createPortal(
        <div className="shots-backdrop" role="dialog" aria-modal="true" aria-label="รูปตาราง" onClick={() => setShots(null)}>
          <div className="shots" onClick={(e) => e.stopPropagation()}>
            <div className="shots-head">
              <b>{shots.length > 1 ? `รูปทุกสาขา (${shots.length} รูป)` : 'รูปตาราง'}</b>
              <button type="button" className="shots-close" onClick={() => setShots(null)} aria-label="ปิด">✕</button>
            </div>
            <p className="shots-tip">
              {touch
                ? 'กด "แชร์" แล้วเลือก LINE · หรือกดค้างที่รูปเพื่อบันทึกลงเครื่อง'
                : 'กด "คัดลอก" แล้ววางในไลน์ (Ctrl+V) · หรือกด "บันทึก"'}
            </p>
            {shots.length > 1 && (
              <div className="shots-all">
                {touch && <button type="button" className="btn btn-primary" onClick={() => share(shots.map((s) => s.file))}>แชร์ทั้งหมด</button>}
                <button type="button" className="clear-btn" onClick={() => saveAllShots(shots)}>บันทึกทั้งหมด</button>
              </div>
            )}
            <div className="shots-list">
              {shots.map((s) => (
                <figure key={s.name} className="shot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt={s.name} />
                  <figcaption>
                    <span>{s.name}</span>
                    <span className="shot-btns">
                      {touch
                        ? <button type="button" className="btn btn-primary" onClick={() => share([s.file])}>แชร์</button>
                        : <button type="button" className="btn btn-primary" onClick={() => copyShot(s)}>คัดลอก</button>}
                      <button type="button" className="clear-btn" onClick={() => download(s.file, s.name)}>บันทึก</button>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ตารางสำหรับทำรูป วางไว้นอกจอ (ต้องอยู่ในหน้าถึงจะถ่ายรูปได้) */}
      <div className="xl-offscreen" aria-hidden="true">
        {keys.map((b) => (
          <div key={b || 'all'} ref={(el) => { if (el) sheets.current.set(b, el); else sheets.current.delete(b); }}>
            <Sheet rows={rows} branch={b} tg={tg} targetLabel={targetLabel} dataLabel={dataLabel} showBe={showBe} />
          </div>
        ))}
      </div>
    </section>
  );
}
