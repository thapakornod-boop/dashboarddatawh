// สถานะระบบ (เฉพาะ admin): ความครบของข้อมูล / รอบอัปเดตอัตโนมัติ (pg_cron) / คำนวณย้อนหลัง
// ไม่ต้องเข้าไปเช็คใน Supabase เอง · ข้อมูล cron มาจาก RPC cron_status (supabase/security.sql)
import { redirect } from 'next/navigation';
import { getBackfillStatus, getCronStatus, getLatestDate, getManualRefresh, getSellerAuto, type CronJob, type ManualRefresh, type SellerAuto, type SellerUnmapped } from '@/app/lib/api';
import DataRefreshButton from '@/app/components/DataRefreshButton';
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
  'seller-auto-add': 'เพิ่มรหัสเซลล์ใหม่ (PDC / DC) อัตโนมัติ',
  'manual-refresh': 'อัปเดตยอดขาย (กดจากหน้านี้)',
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
  let sellerAuto: { recent: SellerAuto[]; pending: SellerUnmapped[] } | null = null;
  let manual: ManualRefresh | null = null;
  try {
    const latest = await getLatestDate();
    [health, jobs, backfill, sellerAuto, manual] = await Promise.all([
      checkHealth(latest), getCronStatus(), getBackfillStatus(), getSellerAuto().catch(() => null), getManualRefresh().catch(() => null),
    ]);
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
          : <div className="health ok" role="status"><b>✅ ข้อมูลปกติ</b> อัปเดตถึง {formatDate(health.latestDate)} · ทุกบริษัทมีข้อมูลขายเข้าตามปกติ และรอบอัปเดตอัตโนมัติทำงานปกติ</div>)}

        {/* ── อัปเดตยอดขายทันที (ไม่ต้องรอรอบ 06:30 / 12:30 / 17:30) ── */}
        <section className="card">
          <h3 className="card-title">อัปเดตยอดขายตอนนี้</h3>
          <p className="card-sub">
            หลังบ้านโหลดยอดใหม่เข้า vw_lg014 แล้ว กดปุ่มนี้ให้ dashboard คำนวณใหม่ทันที (ต้นเดือนก่อน → วันนี้ · ยอดรายเซลล์ / ระดับร้าน / รายสาขา + เพิ่มรหัสเซลล์ใหม่)
            · ใช้เวลาราว 1–3 นาที เสร็จแล้วหน้าเว็บอัปเดตเอง
          </p>
          <DataRefreshButton initial={manual} />
        </section>

        {/* ── ความครบของข้อมูลรายบริษัท ── */}
        {health && (
          <section className="card">
            <header className="card-head">
              <div>
                <h3 className="card-title">ความครบของข้อมูล (จำนวนบรรทัดขาย)</h3>
                <p className="card-sub">
                  เตือนเมื่อบริษัทไหนไม่มีข้อมูลขายเข้าเลย 2 วันติดกัน (ไม่นับวันนี้ / วันที่ 1–3 ของเดือน / หยุดยาว) ·
                  ยอด 7 วันเทียบ 4 สัปดาห์ก่อนแสดงไว้ดูประกอบ — ช่วงปิดเดือน PDC / DC ต่ำกว่าปกติเป็นเรื่องปกติ
                </p>
              </div>
              <RefreshButton />
            </header>
            <table className="rtable status-table">
              <thead>
                <tr><th>บริษัท</th><th>สถานะ</th><th className="r">บรรทัดเมื่อวาน ({formatDate(health.checkDay)})</th><th className="r">บรรทัด 7 วันล่าสุด</th><th className="r">เฉลี่ย / สัปดาห์ (4 สัปดาห์ก่อน)</th><th className="r">เทียบ</th><th className="r">GIV 7 วันล่าสุด</th></tr>
              </thead>
              <tbody>
                {health.weekly.map((w) => (
                  <tr key={w.company}>
                    <td className="strong">{w.company}</td>
                    <td data-label="สถานะ">
                      {w.streak >= 2
                        ? <span className="sc-chip down">ไม่มีข้อมูล {w.streak} วัน</span>
                        : <span className="sc-chip up">ข้อมูลเข้าปกติ</span>}
                    </td>
                    <td data-label="บรรทัดเมื่อวาน" className="r">{fmtInt(w.lastDay)}</td>
                    <td data-label="บรรทัด 7 วันล่าสุด" className="r strong">{fmtInt(w.last7)}</td>
                    <td data-label="เฉลี่ย / สัปดาห์" className="r">{fmtInt(w.avgWeek)}</td>
                    <td data-label="เทียบ" className="r muted">{w.ratio === null ? '–' : `${w.ratio.toFixed(0)}%`}</td>
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

        {/* ── รหัสเซลล์ใหม่ (PDC / DC): เพิ่มอัตโนมัติ + ที่ยังเพิ่มเองไม่ได้ ── */}
        <section className="card">
          <header className="card-head">
            <div>
              <h3 className="card-title">รหัสเซลล์ใหม่ (PDC / DC)</h3>
              <p className="card-sub">
                PDC / DC นับยอดเฉพาะเซลล์ที่อยู่ในตาราง seller_principal · ระบบเพิ่มรหัสใหม่ให้เองทุกรอบอัปเดต (06:45 / 12:45 / 17:45)
                เมื่อมียอดใน 45 วัน ≥ 1,000 บาท · Princ ดูจากหัวรหัสสินค้าที่ขาย · ไม่นับรหัสระบบ ADMIN / ADS / GSM / -No Sales Employee-
              </p>
            </div>
          </header>
          {!sellerAuto ? (
            <p className="empty">รอข้อมูล — รัน supabase/seller_auto.sql ใน Supabase ก่อน</p>
          ) : (
            <>
              <h4 className="cg-title">เพิ่มอัตโนมัติล่าสุด</h4>
              {sellerAuto.recent.length === 0 ? <p className="muted">ยังไม่มีรหัสใหม่ที่ระบบเพิ่มให้</p> : (
                <table className="rtable status-table">
                  <thead><tr><th>เพิ่มเมื่อ</th><th>บริษัท</th><th>เซลล์</th><th>สาขา</th><th>Princ</th><th className="r">GIV ช่วงที่ตรวจ</th><th>ขายครั้งแรก – ล่าสุด</th></tr></thead>
                  <tbody>
                    {sellerAuto.recent.map((r) => (
                      <tr key={`${r.company_code}|${r.seller}|${r.added_at}`}>
                        <td>{th(r.added_at)}</td>
                        <td data-label="บริษัท" className="strong">{r.company_code}</td>
                        <td data-label="เซลล์"><span className="code">{r.seller}</span></td>
                        <td data-label="สาขา">{r.branch ?? '–'}</td>
                        <td data-label="Princ">{r.principals}</td>
                        <td data-label="GIV" className="r">{fmtInt(r.giv)}</td>
                        <td data-label="ขายครั้งแรก – ล่าสุด" className="muted">{r.first_d ? formatDate(r.first_d) : '–'} – {r.last_d ? formatDate(r.last_d) : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {sellerAuto.pending.length > 0 && (
                <>
                  <h4 className="cg-title">ยังไม่ได้เพิ่ม (45 วันล่าสุด) — ยอดน้อย / ติดลบ หรือหา Princ ไม่ได้ ถ้าเป็นเซลล์จริงให้เพิ่มเอง</h4>
                  <table className="rtable status-table">
                    <thead><tr><th>บริษัท</th><th>เซลล์</th><th>สาขา</th><th>Princ ที่เดาได้</th><th className="r">GIV 45 วัน</th><th>ขายล่าสุด</th></tr></thead>
                    <tbody>
                      {sellerAuto.pending.map((r) => (
                        <tr key={`${r.company_code}|${r.seller}`}>
                          <td className="strong">{r.company_code}</td>
                          <td data-label="เซลล์"><span className="code">{r.seller}</span></td>
                          <td data-label="สาขา">{r.branch ?? '–'}</td>
                          <td data-label="Princ">{r.principals ?? '–'}</td>
                          <td data-label="GIV 45 วัน" className="r">{fmtInt(r.giv)}</td>
                          <td data-label="ขายล่าสุด" className="muted">{formatDate(r.last_d)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
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
