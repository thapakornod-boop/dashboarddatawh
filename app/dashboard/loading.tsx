// โครงหน้าระหว่างรอข้อมูล (skeleton) — sidebar อยู่ที่ layout จึงยังแสดงค้างไว้
// ใช้ทั้งตอนเข้าหน้าแรก เปลี่ยนเมนู และเลือกช่วงเดือนเก่า ๆ ที่ต้องรอนาน
function Bar({ w = '100%', h = 14 }: { w?: string | number; h?: number }) {
  return <span className="sk" style={{ width: w, height: h }} />;
}

export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="กำลังโหลดข้อมูล">
      <header className="hero">
        <div className="hero-inner">
          <div className="sk-col">
            <span className="sk sk-light" style={{ width: 160, height: 12 }} />
            <span className="sk sk-light" style={{ width: 260, height: 30 }} />
            <span className="sk sk-light" style={{ width: 200, height: 14 }} />
          </div>
        </div>
      </header>
      <main className="container">
        <div className="filters-wrap">
          <div className="card filters">
            {[150, 150, 150, 90].map((w, i) => <Bar key={i} w={w} h={38} />)}
            <span className="sk-status"><span className="sk-spinner" />กำลังโหลดข้อมูล…</span>
          </div>
        </div>
        <section className="card kpis">
          {[0, 1, 2, 3].map((i) => (
            <div className="kpi" key={i}><Bar w="50%" h={12} /><Bar w="70%" h={28} /><Bar h={8} /><Bar w="60%" h={12} /></div>
          ))}
        </section>
        <div className="grid-2">
          {[0, 1].map((i) => (
            <section className="card sk-col" key={i}>
              <Bar w={60} h={24} /><Bar w="70%" h={34} />
              {[0, 1, 2, 3, 4].map((j) => <Bar key={j} h={14} />)}
            </section>
          ))}
        </div>
        <section className="card sk-col">
          <Bar w={220} h={18} />
          {[0, 1, 2, 3, 4, 5].map((j) => <Bar key={j} h={22} />)}
        </section>
      </main>
    </div>
  );
}
