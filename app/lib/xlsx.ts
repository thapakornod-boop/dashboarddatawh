// สร้างไฟล์ Excel หน้าตาเดียวกันทุกไฟล์ (ใช้ได้ทั้งฝั่ง browser และ server · โหลด exceljs เฉพาะตอนใช้)
//   แถบหัวสีแบรนด์ + ข้อมูลช่วง / ตัวกรอง · หัวตารางสีน้ำเงิน ตัวขาว · แถวสลับสี · ตัวเลขมีคอมมา
//   ตรึงหัวตาราง + ปุ่มกรอง (AutoFilter) · แถวรวมตัวหนา · แถบข้อมูล (data bar) ในคอลัมน์ยอดขาย · หมายเหตุท้ายตาราง
import type { Workbook, Worksheet, Fill, Borders } from 'exceljs';

export type XCell = string | number | null;
export type XCol = {
  header: string;
  width?: number;
  fmt?: 'int' | 'dec1' | 'pct' | 'text' | 'date';
  bar?: boolean; // แถบข้อมูลในช่อง (ยอดขาย)
  color?: string; // สีตัวอักษรทั้งคอลัมน์ (เช่น บริษัท)
};
export type XSheet = {
  name: string;
  title: string;
  info: [string, string][]; // แถวข้อมูลใต้หัว เช่น ["ช่วงเดือน", "ส.ค.–ต.ค. 2026"]
  groups?: { label: string; span: number }[]; // หัวกลุ่มเหนือหัวคอลัมน์ (เช่น ชื่อเดือน คลุม Active / บิล)
  cols: XCol[];
  rows: XCell[][];
  total?: XCell[];
  notes?: string[];
  coColor?: number; // index คอลัมน์ที่เป็นชื่อบริษัท → ระบายสีตามบริษัท
  band?: (row: XCell[]) => boolean; // แถวหัวกลุ่ม (พื้นฟ้าอ่อน ตัวหนา)
};

const BRAND = 'FF1F66E5';
const BRAND_DARK = 'FF0D2B6B';
const BRAND_50 = 'FFEEF4FF';
const BRAND_100 = 'FFDBE7FE';
const ZEBRA = 'FFF7F9FC';
const LINE = 'FFD9E1EC';
const FONT = 'Tahoma';
const CO_ARGB: Record<string, string> = { SDO: 'FF0891B2', PDC: 'FFDB2777', DC: 'FF7C3AED' };

const solid = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin' as const, color: { argb: LINE } };
const box: Partial<Borders> = { top: thin, left: thin, bottom: thin, right: thin };
const FMT: Record<string, string> = { int: '#,##0', dec1: '#,##0.0', pct: '0.0%', date: 'dd/mm/yyyy' };

function colLetter(n: number) {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

function addSheet(wb: Workbook, sh: XSheet) {
  const n = sh.cols.length;
  const last = colLetter(Math.max(n, 4));
  const ws: Worksheet = wb.addWorksheet(sh.name.slice(0, 31), {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 20 },
    pageSetup: { orientation: n > 8 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  ws.columns = sh.cols.map((c) => ({ width: c.width ?? Math.max(12, c.header.length + 4) }));
  // คอลัมน์แรกใช้เป็นป้ายข้อมูลด้านบนด้วย (ช่วงเดือน / Export เมื่อ) → กว้างพอให้อ่านครบ
  ws.getColumn(1).width = Math.max(ws.getColumn(1).width ?? 0, 14);

  // ── แถบหัว ──
  ws.mergeCells(`A1:${last}1`);
  const t = ws.getCell('A1');
  t.value = sh.title;
  t.font = { name: FONT, size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = solid(BRAND_DARK);
  t.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 34;
  ws.mergeCells(`A2:${last}2`);
  const s = ws.getCell('A2');
  s.value = 'RSM Group · Sales Dashboard';
  s.font = { name: FONT, size: 10, color: { argb: 'FFDBE7FE' } };
  s.fill = solid(BRAND);
  s.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(2).height = 20;

  let r = 3;
  for (const [k, v] of sh.info) {
    r += 1;
    ws.getCell(r, 1).value = k;
    ws.getCell(r, 1).font = { name: FONT, size: 10, bold: true, color: { argb: 'FF5B6478' } };
    ws.mergeCells(r, 2, r, Math.max(n, 4));
    ws.getCell(r, 2).value = v;
    ws.getCell(r, 2).font = { name: FONT, size: 10, color: { argb: 'FF0F1B33' } };
  }
  r += 2;

  // ── หัวกลุ่ม (ถ้ามี) ──
  if (sh.groups?.length) {
    let c = 1;
    for (const g of sh.groups) {
      if (g.span > 1) ws.mergeCells(r, c, r, c + g.span - 1);
      const cell = ws.getCell(r, c);
      cell.value = g.label || null;
      for (let i = c; i < c + g.span; i++) {
        const x = ws.getCell(r, i);
        x.fill = solid(g.label ? BRAND_100 : 'FFFFFFFF');
        x.border = g.label ? box : {};
      }
      cell.font = { name: FONT, size: 10, bold: true, color: { argb: BRAND_DARK } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      c += g.span;
    }
    ws.getRow(r).height = 22;
    r += 1;
  }

  // ── หัวคอลัมน์ ──
  const headRow = r;
  sh.cols.forEach((c, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = solid(BRAND);
    cell.border = { ...box, bottom: { style: 'medium', color: { argb: BRAND_DARK } } };
    cell.alignment = { horizontal: !c.fmt || c.fmt === 'text' ? 'left' : 'center', vertical: 'middle', wrapText: true };
  });
  ws.getRow(r).height = 32;

  // ── ข้อมูล ──
  const first = r + 1;
  const paint = (rowNo: number, vals: XCell[], kind: 'data' | 'band' | 'total', zebra: boolean) => {
    vals.forEach((v, i) => {
      const col = sh.cols[i];
      const cell = ws.getCell(rowNo, i + 1);
      cell.value = col?.fmt === 'pct' && typeof v === 'number' ? v / 100 : v;
      cell.font = {
        name: FONT, size: 10, bold: kind !== 'data',
        color: { argb: i === sh.coColor && typeof v === 'string' && CO_ARGB[v] ? CO_ARGB[v] : col?.color ?? 'FF0F1B33' },
      };
      if (col?.fmt && FMT[col.fmt]) cell.numFmt = FMT[col.fmt];
      cell.alignment = { vertical: 'middle', horizontal: typeof v === 'number' ? 'right' : 'left' };
      cell.border = kind === 'total' ? { ...box, top: { style: 'medium', color: { argb: BRAND_DARK } } } : box;
      cell.fill = solid(kind === 'total' ? BRAND_100 : kind === 'band' ? BRAND_50 : zebra ? ZEBRA : 'FFFFFFFF');
    });
  };
  sh.rows.forEach((row, i) => {
    r += 1;
    paint(r, row, sh.band?.(row) ? 'band' : 'data', i % 2 === 1);
  });
  const lastData = r;
  if (sh.total) {
    r += 1;
    paint(r, sh.total, 'total', false);
    ws.getRow(r).height = 22;
  }

  // ── ตรึงหัว + ปุ่มกรอง + แถบข้อมูล ──
  ws.views = [{ state: 'frozen', ySplit: headRow, xSplit: 1, showGridLines: false }];
  ws.pageSetup.printTitlesRow = `${headRow}:${headRow}`; // พิมพ์หลายหน้า หัวตารางขึ้นทุกหน้า
  if (sh.rows.length) {
    ws.autoFilter = { from: { row: headRow, column: 1 }, to: { row: lastData, column: n } };
    sh.cols.forEach((c, i) => {
      if (!c.bar) return;
      const L = colLetter(i + 1);
      ws.addConditionalFormatting({
        ref: `${L}${first}:${L}${lastData}`,
        rules: [{
          type: 'dataBar', priority: 1,
          cfvo: [{ type: 'min' }, { type: 'max' }],
          color: { argb: 'FF8DB4F8' },
          gradient: true,
        } as never],
      });
    });
  }

  // ── หมายเหตุ ──
  if (sh.notes?.length) {
    r += 2;
    ws.getCell(r, 1).value = 'หมายเหตุ';
    ws.getCell(r, 1).font = { name: FONT, size: 10, bold: true, color: { argb: BRAND_DARK } };
    for (const note of sh.notes) {
      r += 1;
      ws.mergeCells(r, 1, r, Math.max(n, 6));
      ws.getCell(r, 1).value = `• ${note}`;
      ws.getCell(r, 1).font = { name: FONT, size: 9, color: { argb: 'FF5B6478' } };
      ws.getCell(r, 1).alignment = { wrapText: true, vertical: 'top' };
      ws.getRow(r).height = note.length > 120 ? 30 : 16;
    }
  }
}

export async function buildWorkbook(sheets: XSheet[]): Promise<ArrayBuffer> {
  const ExcelJS = await import('exceljs');
  const WB = ExcelJS.Workbook ?? ExcelJS.default.Workbook;
  const wb: Workbook = new WB();
  wb.creator = 'RSM Group Sales Dashboard';
  wb.created = new Date();
  for (const s of sheets) addSheet(wb, s);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ฝั่ง browser: ดาวน์โหลดไฟล์
export function downloadBuffer(buf: ArrayBuffer, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: XLSX_TYPE }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// วันเวลาที่ export (เวลาไทย) ไว้ใส่ในหัวไฟล์
export const exportedAt = () =>
  new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
