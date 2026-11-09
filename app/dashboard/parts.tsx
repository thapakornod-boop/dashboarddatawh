// ชิ้นส่วนที่ทุกหน้าใน /dashboard ใช้ร่วมกัน: หัวเพจสีแบรนด์ + ฟอร์มเลือกช่วงเดือน / บริษัท
import { FilterForm, LogoutButton } from '@/app/components/Loading';
import { logout } from '@/app/login/actions';
import { COMPANY_ORDER, formatRange, formatThaiMonth } from '@/app/lib/period';

export function IconLogout() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

export function Hero({ crumb, title, subtitle, chips }: { crumb: string; title: string; subtitle: string; chips: string[] }) {
  return (
    <header className="hero">
      <div className="hero-inner">
        <div>
          <div className="crumb">{crumb}</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="hero-side">
          <LogoutButton action={logout} className="hero-logout"><IconLogout /><span>ออกจากระบบ</span></LogoutButton>
          <div className="hero-chips">
            {chips.map((c) => <span key={c} className="hero-chip">{c}</span>)}
          </div>
        </div>
      </div>
    </header>
  );
}

// แถบเตือนข้อมูลไม่อัปเดต / เข้าไม่ครบ (จาก lib/health) — ไม่มีปัญหาไม่แสดงอะไร
export function HealthBanner({ issues, showLink }: { issues: { level: 'warn' | 'bad'; text: string }[]; showLink?: boolean }) {
  if (!issues.length) return null;
  const bad = issues.some((i) => i.level === 'bad');
  return (
    <div className={`health ${bad ? 'bad' : 'warn'}`} role="status">
      <b>{bad ? '⛔ ข้อมูลอาจไม่ถูกต้อง' : '⚠ ตรวจพบความผิดปกติของข้อมูล'}</b>
      <ul>{issues.map((i) => <li key={i.text}>{i.text}</li>)}</ul>
      {showLink && <a href="/dashboard/status">ดูสถานะระบบ →</a>}
    </div>
  );
}

// ฟอร์มช่วงเดือน + บริษัท (ชื่อพารามิเตอร์ from / to / company เหมือนกันทุกหน้า)
export function RangeFilter({ months, fromYM, toYM, company }: { months: string[]; fromYM: string; toYM: string; company: string }) {
  return (
    <div className="filters-wrap">
      <FilterForm id="filter-form" className="card filters">
        <label className="field">
          <span className="field-label">ตั้งแต่เดือน</span>
          <select name="from" defaultValue={fromYM}>
            {months.map((m) => <option key={m} value={m}>{formatThaiMonth(m)}</option>)}
          </select>
        </label>
        <span className="arrow">→</span>
        <label className="field">
          <span className="field-label">ถึงเดือน</span>
          <select name="to" defaultValue={toYM}>
            {months.map((m) => <option key={m} value={m}>{formatThaiMonth(m)}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">บริษัท</span>
          <select name="company" defaultValue={company}>
            <option value="all">ทั้งหมด</option>
            {COMPANY_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn-primary">ค้นหา</button>
        {months.length > 0 && <span className="filters-hint">มีข้อมูล {formatRange(months[0], months[months.length - 1])}</span>}
      </FilterForm>
    </div>
  );
}
