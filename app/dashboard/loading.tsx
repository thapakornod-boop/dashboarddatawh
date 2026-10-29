// โครงหน้าระหว่างรอข้อมูล (ยอดขาย + Target จาก Google Sheet) — โชว์ทันทีที่กดเข้าหน้า dashboard
export default function DashboardLoading() {
  const block = (h: number, w: string = '100%') => (
    <div className="sk" style={{ height: h, width: w }} />
  );
  return (
    <>
      <style>{`
        body { background: #F4F7FC; margin: 0; font-family: 'Inter', 'Segoe UI', sans-serif; }
        .sk-shell { display: flex; min-height: 100vh; }
        .sk-side { width: 76px; background: #FFFFFF; border-right: 1px solid #E7ECF5; }
        .sk-main { flex: 1; min-width: 0; }
        .sk-head { background: #FFFFFF; border-bottom: 1px solid #E7ECF5; padding: 18px 32px; display: flex; flex-direction: column; gap: 8px; }
        .sk-body { padding: 24px 32px 48px; max-width: 1360px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
        .sk-card { background: #FFFFFF; border: 1px solid #E7ECF5; border-radius: 16px; padding: 20px 22px; display: flex; flex-direction: column; gap: 12px; }
        .sk-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 1000px) { .sk-row { grid-template-columns: 1fr; } }
        @media (max-width: 640px) { .sk-side { width: 60px; } .sk-head, .sk-body { padding-left: 16px; padding-right: 16px; } }
        .sk { border-radius: 8px; background: linear-gradient(90deg, #EEF1F7 25%, #F7F9FC 50%, #EEF1F7 75%); background-size: 200% 100%; animation: sk-shine 1.2s ease-in-out infinite; }
        .sk-note { font-size: 13px; color: #8A93A6; font-weight: 600; }
        @keyframes sk-shine { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        @media (prefers-reduced-motion: reduce) { .sk { animation: none; } }
      `}</style>
      <div className="sk-shell" aria-busy="true">
        <aside className="sk-side" />
        <div className="sk-main">
          <header className="sk-head">
            {block(12, '160px')}
            {block(24, '220px')}
          </header>
          <div className="sk-body">
            <div className="sk-card">{block(36, '320px')}</div>
            <div className="sk-card">
              <span className="sk-note">กำลังโหลดยอดขายและ Target…</span>
              {block(40, '60%')}
            </div>
            <div className="sk-row">
              {[0, 1, 2].map((i) => (
                <div className="sk-card" key={i}>
                  {block(14, '40%')}
                  {block(30, '80%')}
                  {block(12, '100%')}
                  {block(12, '100%')}
                  {block(12, '70%')}
                </div>
              ))}
            </div>
            <div className="sk-card">{block(220)}</div>
          </div>
        </div>
      </div>
    </>
  );
}
