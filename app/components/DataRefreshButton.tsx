'use client';

// ปุ่ม "อัปเดตยอดขายตอนนี้" (หน้าสถานะระบบ): สั่งคำนวณใหม่ → เช็คสถานะทุก 10 วินาที → เสร็จแล้วรีเฟรชหน้า
import { useEffect, useRef, useState } from 'react';
import { dataRefreshStatus, finishDataRefresh, startDataRefresh } from '@/app/dashboard/status/actions';
import { showError, showToast } from '@/app/components/Loading';
import type { ManualRefresh } from '@/app/lib/api';

const th = (iso: string | null) => (iso ? new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' }) : '–');
const busy = (s?: ManualRefresh | null) => s?.status === 'queued' || s?.status === 'running';

export default function DataRefreshButton({ initial }: { initial: ManualRefresh | null }) {
  const [st, setSt] = useState<ManualRefresh | null>(initial);
  const [sending, setSending] = useState(false);
  const wasBusy = useRef(busy(initial));

  // ระหว่างทำงาน: ถามสถานะทุก 10 วินาที · เสร็จ → ล้าง cache แล้ววาดหน้าใหม่
  useEffect(() => {
    if (!busy(st)) return;
    const id = setInterval(async () => {
      try {
        const s = await dataRefreshStatus();
        setSt(s);
        if (!busy(s) && wasBusy.current) {
          wasBusy.current = false;
          if (s?.status === 'done') { await finishDataRefresh(); showToast('อัปเดตยอดขายเรียบร้อย'); }
          if (s?.status === 'failed') showError('อัปเดตไม่สำเร็จ', s.message ?? '');
        }
      } catch { /* ลองใหม่รอบหน้า */ }
    }, 10_000);
    return () => clearInterval(id);
  }, [st]);

  const start = async () => {
    setSending(true);
    try {
      const r = await startDataRefresh();
      if (r === 'busy') showToast('กำลังอัปเดตอยู่แล้ว รอสักครู่');
      wasBusy.current = true;
      setSt(await dataRefreshStatus());
    } catch (err) {
      showError('สั่งอัปเดตไม่สำเร็จ', err instanceof Error ? err.message : String(err));
    } finally { setSending(false); }
  };

  const label = !st ? null
    : st.status === 'queued' ? <span className="sc-chip mid">รอเริ่ม (ไม่เกิน 1 นาที) · สั่งเมื่อ {th(st.requested_at)}</span>
    : st.status === 'running' ? <span className="sc-chip mid">กำลังคำนวณ · เริ่ม {th(st.started_at)}</span>
    : st.status === 'done' ? <span className="sc-chip up">อัปเดตล่าสุด {th(st.finished_at)}{st.message ? ` · ${st.message}` : ''}</span>
    : st.status === 'failed' ? <span className="sc-chip down">ล้ม {th(st.finished_at)} · {st.message}</span>
    : <span className="muted">ยังไม่เคยกด</span>;

  return (
    <div className="data-refresh">
      <button type="button" className="btn btn-primary" onClick={start} disabled={sending || busy(st) || !st}>
        {busy(st) ? 'กำลังอัปเดต…' : '⟳ อัปเดตยอดขายตอนนี้'}
      </button>
      {st ? label : <span className="muted">รัน supabase/manual_refresh.sql ใน Supabase ก่อน</span>}
    </div>
  );
}
