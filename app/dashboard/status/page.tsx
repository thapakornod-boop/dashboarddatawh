// สถานะระบบ (เฉพาะ admin): ความครบของข้อมูล / รอบอัปเดตอัตโนมัติ (pg_cron) / คำนวณย้อนหลัง
// ไม่ต้องเข้าไปเช็คใน Supabase เอง · ข้อมูล cron มาจาก RPC cron_status (supabase/security.sql)
import { redirect } from 'next/navigation';
import { getBackfillStatus, getCronStatus, getLatestDate, type CronJob } from '@/app/lib/api';
import { requireEmployee } from '@/app/lib/session';
import { checkHealth, type Health } from '@/app/lib/health';
import { formatDate } from '@/app/lib/period';
import { fmtInt } from '@/app/lib/format';
import { LoadingDone } from '@/app/components/Loading';
import RefreshButton from '@/app/components/RefreshButton';
import { HealthBanner, Hero } from '../parts';

// ชื่องาน cron → คำอธิบายภาษาไทย
const JOB_LABEL: Record<string, string> = {
  'dashboard-refresh': 'ยอดขายรายเซลล์ (หน้าภาพรวม)',
  'kpi-refresh': 'ข้อมูลระดับร้าน (Scorecard)',
  'branch-refresh': 'ยอดรายสาขา / Princ / รายชื่อร้าน',
  'dashboard-backfill': 'คำนวณย้อนหลัง: ยอดรายเซลล์',
  'kpi-backfill': 'คำนวณย้อนหลัง: ข้อมูลระดับร้าน',
  'branch-backfill': 'คำนวณย้อนหลัง: รายสาขา',
};
const BACKFILL_LABEL: Record<string, string> = { dashboard: 'ยอดรายเซลล์', kpi: 'ข้อมูลระดับร้าน', branch: 'รายสาขา / Princ' };

// "23,5,10" UTC → เวลาไทย เช่น "30 23,5,10 * * *" → "06:30 / 12:30 / 17:30"
function scheduleText(s: string) {
  if (s.trim() === '* * * * *') return 'ทุกนาที';
  const [min, hour] = s.split(/\s+/);
  if (!/^\d+$/.test(min) || !/^[\d,]+$/.test(hour)) return s;
  return hour.split(',').map((h) => `${String((Number(h) + 7) % 24).padStart(2, '0')}:${min.padStart(2, '0')}`).sort().join(' / ');
}
const th = (iso: string | null) => (iso ? new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' }) : '–');

export default async function StatusPage() {
  const me = await requireEmployee();
  if (me.role !== 'admin') redirect('/dashboard');

  let errorMessage: string | null = null;
  let health: Health | null = null;
  let jobs: CronJob[] | null = null;
  let backfill: { name: string; next_month: string }[] | null = null;
  try {
    const latest = await getLatestDate();
    [health, jobs, backfill] = await Promise.all([checkHealth(latest), getCronStatus(), getBackfillStatus()]);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
  }
  const failing = (jobs ?? []).filter((j) => j.last_status === 'failed' || j.fails_24h > 0);

  return (
    <>
      <LoadingDone error={errorMessage} />
      <Hero crumb="แดชบอร์ด / สถานะระบบ" title="สถานะระบบ" subtitle="ความครบของข้อมูล · รอบอัปเดตอัตโนมัติ · คำนวณย้อนหลัง"
        chips={health ? [`ข้อมูลถึง ${formatDate(health.latestDate)}`] : []} />
      <main className="container">
        {health && (health.issues.length
          ? <HealthBanner issues={health.issues} />
          : <div className="health ok" role="status"><b>✅ ข้อมูลปกติ</b> อัปเดตถึง {formatDate(health.latestDate)} · ยอด 7 วันล่าสุดของทุกบริษัทอยู่ในเกณฑ์ปกติ</div>)}

        {/* ── ความครบของข้อมูลรายบริษัท ── */}
        {health && (
          <section className="card">
            <header className="card-head">
              <div>
                <h3 className="card-title">ความครบของข้อมูล (จำนวนบรรทัดขาย)</h3>
                <p className="card-sub">7 วันล่าสุด เทียบค่าเฉลี่ยต่อสัปดาห์ของ 4 สัปดาห์ก่อนหน้า · ต่ำกว่า 60% = อาจเข้าไม่ครบ · ใช้จำนวนบรรทัดเพราะยอดเงินขึ้นลงตามรอบเดือน</p>
              </div>
              <RefreshButton />
            </header>
            <table className="rtable status-table">
              <thead>
                <tr><th>บริษัท</th><th className="r">บรรทัดวันล่าสุด ({formatDate(health.latestDate)})</th><th className="r">บรรทัด 7 วันล่าสุด</th><th className="r">เฉลี่ย / สัปดาห์ (4 สัปดาห์ก่อน)</th><th className="r">เทียบ</th><th className="r">GIV 7 วันล่าสุด</th></tr>
              </thead>
              <tbody>
                {health.weekly.map((w) => (
                  <tr key={w.company}>
                    <td className="strong">{w.company}</td>
                    <td data-label="บรรทัดวันล่าสุด" className="r">{fmtInt(w.lastDay)}</td>
                    <td data-label="บรรทัด 7 วันล่าสุด" className="r strong">{fmtInt(w.last7)}</td>
                    <td data-label="เฉลี่ย / สัปดาห์" className="r">{fmtInt(w.avgWeek)}</td>
                    <td data-label="เทียบ" className="r">
                      {w.ratio === null ? '–' : <span className={`sc-chip ${w.ratio >= 80 ? 'up' : w.ratio >= 60 ? 'mid' : 'down'}`}>{w.ratio.toFixed(0)}%</span>}
                    </td>
                    <td data-label="GIV 7 วันล่าสุด" className="r muted">{fmtInt(w.giv7)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── รอบอัปเดตอัตโนมัติ ── */}
        <section className="card">
          <header className="card-head">
            <div>
              <h3 className="card-title">รอบอัปเดตอัตโนมัติ (pg_cron)</h3>
              <p className="card-sub">{!jobs ? 'ยังอ่านสถานะไม่ได้' : failing.length ? `⚠ มี ${failing.length} งานที่ล้มใน 24 ชม.` : 'ทุกงานทำงานปกติ'} · เวลาไทย</p>
            </div>
          </header>
          {!jobs ? (
            <p className="empty">รอข้อมูล — รัน supabase/security.sql ใน Supabase ก่อน</p>
          ) : (
            <table className="rtable status-table">
              <thead>
                <tr><th>งาน</th><th>รอบเวลา</th><th>รอบล่าสุด</th><th>สำเร็จล่าสุด</th><th className="r">ล้มใน 24 ชม.</th></tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.jobname} className={j.last_status === 'failed' ? 'st-fail' : ''}>
                    <td>
                      <b>{JOB_LABEL[j.jobname] ?? j.jobname}</b>
                      <span className="muted st-job"> {j.jobname}{j.active ? '' : ' · ปิดอยู่'}</span>
                      {j.last_status === 'failed' && j.last_message && <span className="st-err">{j.last_message}</span>}
                    </td>
                    <td data-label="รอบเวลา">{scheduleText(j.schedule)}</td>
                    <td data-label="รอบล่าสุด">
                      <span className={`sc-chip ${j.last_status === 'succeeded' ? 'up' : j.last_status === 'failed' ? 'down' : 'mid'}`}>
                        {j.last_status === 'succeeded' ? 'สำเร็จ' : j.last_status === 'failed' ? 'ล้ม' : j.last_status ?? 'ยังไม่เคยรัน'}
                      </span>{' '}
                      <span className="muted">{th(j.last_start)}</span>
                    </td>
                    <td data-label="สำเร็จล่าสุด">{th(j.last_ok)}</td>
                    <td data-label="ล้มใน 24 ชม." className="r">{j.fails_24h ? <b className="growth-down">{j.fails_24h}</b> : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ── คำนวณย้อนหลัง ── */}
        {backfill && (
          <section className="card">
            <h3 className="card-title">คำนวณย้อนหลัง</h3>
            <p className="card-sub">เดือนถัดไปที่จะคำนวณ — ย้อนถึงต้นข้อมูลแล้ว = เสร็จ</p>
            <ul className="st-backfill">
              {backfill.map((b) => {
                const done = !jobs?.some((j) => j.jobname === `${b.name}-backfill` && j.active);
                return (
                  <li key={b.name}>
                    <span>{BACKFILL_LABEL[b.name] ?? b.name}</span>
                    <span className={`sc-chip ${done ? 'up' : 'mid'}`}>{done ? 'เสร็จแล้ว' : `กำลังคำนวณ · ถึง ${b.next_month.slice(0, 7)}`}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
