// CSS ของทุกหน้าใน /dashboard (โหลดครั้งเดียวที่ layout)
// โครงตาม design.md · สีหลักตามโลโก้ RSM
export const DASHBOARD_CSS = `
        @import url('https://api.fontshare.com/v2/css?f[]=general-sans@600&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600&family=IBM+Plex+Sans+Thai:wght@400;600&family=JetBrains+Mono&display=swap');

        /* ── tokens: โครงตาม design.md, สีหลักตามโลโก้ RSM (#3078F8) ── */
        :root {
          --brand: #3078F8; --brand-50: #EEF4FF; --brand-100: #DBE7FE; --brand-700: #1A55C2; --brand-900: #0D2B6B;
          --primary: #1F66E5; --primary-hover: #1A55C2; --ring: rgba(48,120,248,0.22);
          --neutral: #94A0B4; --bg: #F3F6FB; --surface: #FFFFFF;
          --text: #0F1B33; --text-2: #5B6478; --border: #E3E8F0; --track: #EDF1F7; --alt: #F1F5FB;
          --success: #10B981; --warning: #F59E0B; --error: #EF4444;
          --font-display: 'General Sans', 'IBM Plex Sans Thai', system-ui, sans-serif;
          --font-body: 'DM Sans', 'IBM Plex Sans Thai', system-ui, sans-serif;
          --font-mono: 'JetBrains Mono', ui-monospace, monospace;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); color: var(--text); font-family: var(--font-body); font-size: 15px; font-weight: 400; line-height: 1.5; }
        b, strong, th { font-weight: 600; }
        .muted { color: var(--text-2); }
        .eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-2); }
        .dot { display: inline-block; width: 8px; height: 8px; border-radius: 9999px; margin-right: 6px; vertical-align: 1px; flex-shrink: 0; }

        /* ── โครงหน้า: sidebar ซ้าย + เนื้อหา ── */
        .shell { display: flex; min-height: 100vh; }
        .sidebar {
          position: sticky; top: 0; height: 100vh; width: 248px; flex-shrink: 0; z-index: 20;
          display: flex; flex-direction: column; gap: 24px; padding: 20px 16px;
          background: linear-gradient(180deg, var(--primary) 0%, var(--brand-900) 100%); color: #FFFFFF;
        }
        .sb-brand { display: flex; align-items: center; gap: 12px; padding: 4px 8px; }
        .sb-logo { width: 44px; height: 44px; border-radius: 9999px; box-shadow: 0 0 0 3px rgba(255,255,255,0.9); flex-shrink: 0; }
        .sb-brand-text { display: flex; flex-direction: column; min-width: 0; }
        .sb-brand-text b { font: 600 16px var(--font-display); letter-spacing: 0.02em; }
        .sb-brand-text span { font-size: 12px; color: rgba(255,255,255,0.72); }
        .sb-group { display: flex; flex-direction: column; gap: 4px; }
        .sb-group-title { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.6); padding: 0 12px 6px; }
        .sb-item {
          display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px;
          color: rgba(255,255,255,0.85); text-decoration: none; font-size: 14px; transition: background .2s, color .2s;
        }
        .sb-item:hover { background: rgba(255,255,255,0.12); color: #FFFFFF; }
        .sb-item.active { background: #FFFFFF; color: var(--primary); font-weight: 600; box-shadow: 0 6px 16px rgba(13,43,107,0.25); }
        .sb-item svg { flex-shrink: 0; }
        .sb-spacer { flex: 1; }
        .sb-logout {
          margin-left: auto; width: 36px; height: 36px; flex-shrink: 0; display: grid; place-items: center;
          border: none; border-radius: 10px; background: rgba(255,255,255,0.14); color: #FFFFFF; cursor: pointer; transition: background .2s;
        }
        .sb-logout:hover { background: #EF4444; }
        .sb-logout:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,0.5); }
        .hero-side { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
        .hero-logout {
          display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px; border-radius: 9999px; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.45); background: rgba(255,255,255,0.14); color: #FFFFFF; font: 600 14px var(--font-body); transition: background .2s, color .2s;
        }
        .hero-logout:hover { background: #FFFFFF; color: var(--error); }
        .hero-logout:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,0.5); }
        @media (max-width: 640px) { .hero-side { align-items: flex-start; width: 100%; } }
        .sb-user { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.1); min-width: 0; }
        .sb-avatar { width: 34px; height: 34px; border-radius: 9999px; background: #FFFFFF; color: var(--primary); display: grid; place-items: center; font: 600 15px var(--font-body); flex-shrink: 0; }
        .sb-user-text { display: flex; flex-direction: column; min-width: 0; }
        .sb-user-text b { font-size: 13px; color: #FFFFFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb-user-text span { font-size: 11px; color: rgba(255,255,255,0.72); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .main { flex: 1; min-width: 0; }
        @media (max-width: 960px) {
          .sidebar { width: 72px; padding: 16px 10px; align-items: center; }
          .sb-brand { padding: 0; }
          .sb-brand-text, .sb-group-title, .sb-label, .sb-user-text { display: none; }
          .sb-user { padding: 6px; background: transparent; flex-direction: column; }
          .sb-logout { margin-left: 0; }
          .sb-item { justify-content: center; padding: 12px; }
        }
        /* โลโก้ในหัวเพจ / ปุ่มออกจากระบบในแถบล่าง: แสดงเฉพาะมือถือ (sidebar ย้ายไปเป็นแถบเมนูล่าง) */
        .hero-brand, .sb-item.sb-out { display: none; }
        /* มือถือ: เมนูเป็นแถบล่างค้างไว้ตลอด (เนื้อหาเต็มจอ) · โลโก้ย้ายไปหัวเพจ · ออกจากระบบใช้ปุ่มในหัวเพจ */
        @media (max-width: 640px) {
          .shell { display: block; }
          .main { padding-bottom: calc(68px + env(safe-area-inset-bottom)); }
          .sidebar {
            position: fixed; top: auto; bottom: 0; left: 0; right: 0; height: auto; width: 100%; z-index: 50;
            flex-direction: row; gap: 0; padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
            background: rgba(255,255,255,0.97); color: var(--text); border-top: 1px solid var(--border);
            box-shadow: 0 -6px 20px rgba(15,27,51,0.08); backdrop-filter: blur(8px);
          }
          .sb-brand, .sb-spacer, .sb-user, .sb-group-title { display: none; }
          .sb-group { flex-direction: row; justify-content: space-around; align-items: stretch; gap: 2px; width: 100%; }
          .sb-item {
            flex: 1 1 0; min-width: 0; flex-direction: column; justify-content: flex-start; align-items: center; gap: 4px;
            padding: 6px 2px; border-radius: 10px; color: var(--text-2); font-size: 11.5px; line-height: 1.25; text-align: center;
          }
          .sb-item:hover { background: var(--brand-50); color: var(--primary); }
          .sb-item.active { background: transparent; color: var(--primary); font-weight: 600; box-shadow: none; }
          .sb-item.active svg { filter: drop-shadow(0 2px 6px rgba(31,102,229,0.35)); }
          .sb-label { display: block; overflow-wrap: anywhere; }
          .sb-item.sb-out { display: flex; border: none; background: transparent; font-family: inherit; cursor: pointer; color: var(--error); }
          .sb-item.sb-out:hover { background: #FFF1F0; color: var(--error); }
          .hero-logout { display: none; }
          .hero-brand { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
          .hero-brand img { width: 36px; height: 36px; border-radius: 9999px; box-shadow: 0 0 0 2px rgba(255,255,255,0.9); }
          .hero-brand b { font: 600 14px var(--font-display); letter-spacing: 0.02em; }
          .hero-brand span { display: block; font-size: 11px; color: rgba(255,255,255,0.75); }
        }

        /* ── segmented / tabs (สิ่งที่กดได้ = สีแบรนด์) ── */
        .seg { display: inline-flex; gap: 2px; padding: 3px; background: var(--alt); border-radius: 8px; }
        .seg button { border: none; background: transparent; font: 400 13px var(--font-body); color: var(--text-2); padding: 6px 14px; border-radius: 6px; cursor: pointer; white-space: nowrap; transition: color .2s, background .2s; }
        .seg button:hover { color: var(--text); }
        .seg button.on { background: var(--primary); color: #FFFFFF; font-weight: 600; }
        .seg button:focus-visible { box-shadow: 0 0 0 3px var(--ring); }

        /* ── layout ── */
        .container { max-width: 1280px; margin: 0 auto; padding: 0 32px 64px; display: flex; flex-direction: column; gap: 24px; }
        /* หัวหน้าเพจสีแบรนด์ + ฟอร์ม filter วางทับขอบล่าง */
        .hero {
          position: relative; overflow: hidden; color: #FFFFFF; padding: 32px 32px 72px;
          background: linear-gradient(120deg, var(--primary) 0%, var(--brand) 60%, #5B9BFF 100%);
        }
        .hero::after { content: ''; position: absolute; right: -80px; top: -120px; width: 360px; height: 360px; border-radius: 9999px; background: rgba(255,255,255,0.08); }
        .hero::before { content: ''; position: absolute; right: 160px; bottom: -160px; width: 280px; height: 280px; border-radius: 9999px; background: rgba(255,255,255,0.06); }
        .hero-inner { position: relative; z-index: 1; max-width: 1280px; margin: 0 auto; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
        .hero .crumb { font-size: 13px; color: rgba(255,255,255,0.75); }
        .hero h1 { font: 600 32px/1.15 var(--font-display); letter-spacing: -0.03em; margin-top: 4px; }
        .hero p { color: rgba(255,255,255,0.85); font-size: 15px; margin-top: 6px; }
        .hero-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .hero-chip { font-size: 13px; padding: 6px 12px; border-radius: 9999px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.25); white-space: nowrap; }
        .filters-wrap { margin-top: -48px; position: relative; z-index: 2; }
        .filters-wrap .card { box-shadow: 0 12px 32px rgba(13,43,107,0.12); }
        .section { display: flex; flex-direction: column; gap: 16px; }
        .section-title { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .section-title h2 { font: 600 20px var(--font-display); letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px; }
        .section-title h2::before { content: ''; width: 4px; height: 20px; border-radius: 9999px; background: var(--brand); }
        .section-title span { font-size: 13px; color: var(--text-2); }
        .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; align-items: start; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
        @media (max-width: 1024px) { .grid-3 { grid-template-columns: 1fr; } }
        @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }

        /* ── card: แบน มีเส้นขอบ ไม่มีเงา (เงาเฉพาะของที่กดได้ตอน hover) ── */
        .card { container: card / inline-size; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px 24px; min-width: 0; box-shadow: 0 1px 2px rgba(15,27,51,0.04), 0 6px 20px rgba(15,27,51,0.04); }
        .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .card-title { font: 600 16px var(--font-display); letter-spacing: -0.02em; }
        .card-sub { font-size: 13px; color: var(--text-2); }
        .empty { color: var(--text-2); text-align: center; padding: 32px 0; font-size: 13px; }
        .pill { font-size: 12px; color: var(--text-2); background: var(--alt); border-radius: 9999px; padding: 2px 10px; white-space: nowrap; }
        .note { font-size: 12px; color: #92400E; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 8px 12px; }

        /* ── ฟอร์ม ── */
        .filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }
        .field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .field-label { font-size: 12px; color: var(--text-2); }
        .field select, .input {
          height: 38px; padding: 0 14px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface);
          font: 400 14px var(--font-body); color: var(--text); outline: none; min-width: 150px; transition: border-color .2s, box-shadow .2s;
        }
        .field select:focus, .input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--ring); }
        .field select:disabled { background: var(--alt); color: var(--neutral); }
        .arrow { color: var(--neutral); padding-bottom: 8px; }
        .filters-hint { font-size: 12px; color: var(--neutral); margin-left: auto; padding-bottom: 10px; }
        .btn { height: 38px; padding: 0 16px; border-radius: 6px; font: 600 14px var(--font-body); cursor: pointer; transition: transform .2s, box-shadow .2s, background .2s; }
        .btn:hover { transform: translateY(-1px); }
        .btn-primary { background: var(--primary); color: #FAFAFA; border: 1px solid var(--primary); }
        .btn-primary:hover { background: var(--primary-hover); box-shadow: 0 4px 12px rgba(99,102,241,0.35); }
        .btn-secondary { background: transparent; color: var(--text); border: 1px solid var(--border); }
        .btn-secondary:hover { border-color: var(--primary); color: var(--primary); }
        .btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }

        /* ── แท่ง % + ขีด Time gone + ป้ายสถานะ ── */
        /* แท่งแบบ Ant Design Progress: พื้นเทาอ่อน ขอบมน แท่งค่อย ๆ วิ่งเติมตอนโหลด */
        .bar { position: relative; display: block; width: 100%; background: #F0F0F0; border-radius: 100px; overflow: hidden; }
        .bar-md { height: 8px; }
        .bar-sm { height: 8px; }
        .bar-fill { position: absolute; inset: 0 auto 0 0; border-radius: 100px; transform-origin: left center; animation: bar-grow .9s cubic-bezier(.08,.82,.17,1) both; }
        @keyframes bar-grow { from { transform: scaleX(0); } }
        @media (prefers-reduced-motion: reduce) { .bar-fill { animation: none; } }
        /* ตำแหน่ง Time gone = ช่องขาวบาง ๆ ในแท่ง (แทนขีดดำ) */
        .bar-tick { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: #FFFFFF; box-shadow: 0 0 0 0.5px rgba(0,0,0,0.08); }
        .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 2px 10px; border-radius: 9999px; white-space: nowrap; }
        .chip-dot { width: 6px; height: 6px; border-radius: 9999px; background: currentColor; }
        /* ป้ายสถานะแบบ Ant Design Tag */
        .chip-ok   { color: #389E0D; background: #F6FFED; box-shadow: inset 0 0 0 1px #B7EB8F; }
        .chip-warn { color: #AD6800; background: #FFFBE6; box-shadow: inset 0 0 0 1px #FFE58F; }
        .chip-bad  { color: #CF1322; background: #FFF1F0; box-shadow: inset 0 0 0 1px #FFA39E; }
        .chip-none { color: var(--text-2); background: var(--alt); }
        .growth { font-size: 12px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .growth-up { color: #389E0D; }
        .growth-down { color: #CF1322; }
        .growth-none { color: var(--neutral); }
        .pct-cell { display: inline-flex; align-items: center; justify-content: flex-end; gap: 8px; width: 100%; }
        .pct-cell .bar { width: 88px; flex-shrink: 0; }
        .pct-cell b { min-width: 48px; text-align: right; font-variant-numeric: tabular-nums; }

        /* ── KPI แถวบน ── */
        .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 0; }
        .kpi { display: flex; flex-direction: column; gap: 8px; padding: 20px 24px; border-left: 1px solid var(--border); min-width: 0; }
        .kpi:first-child { border-left: none; }
        .kpi-val { font: 600 28px/1.1 var(--font-display); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
        .kpi-top { display: flex; align-items: center; gap: 10px; }
        .kpi-ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: var(--brand-50); color: var(--primary); flex-shrink: 0; }
        .kpi-cap { font-size: 12px; color: var(--text-2); }
        @media (max-width: 900px) {
          .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .kpi:nth-child(3) { border-left: none; }
          .kpi:nth-child(n+3) { border-top: 1px solid var(--border); }
        }

        /* ── การ์ด GIV / NIV ── */
        .metric-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
        .metric-name { font: 600 14px var(--font-display); letter-spacing: 0.02em; padding: 4px 12px; border-radius: 8px; }
        .metric-giv { background: var(--primary); color: #FFFFFF; }
        .metric-niv { background: var(--brand-100); color: var(--brand-700); }
        .metric-val { font: 600 clamp(26px, 3vw, 36px)/1.1 var(--font-display); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
        .rows { display: flex; flex-direction: column; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); }
        .rows-title { margin-bottom: 4px; }
        .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 0; font-size: 14px; }
        .row + .row { border-top: 1px solid #F4F4F6; }
        .row dt { color: var(--text-2); }
        .row dd { font-variant-numeric: tabular-nums; text-align: right; }
        .row dd.muted { color: var(--neutral); }
        .row-bar dd { display: flex; align-items: center; gap: 10px; flex: 1; justify-content: flex-end; }
        .row-bar dd .bar { max-width: 200px; }
        .row-bar dd b { min-width: 52px; text-align: right; }

        /* ── รายบริษัท ── */
        .co { display: flex; flex-direction: column; gap: 4px; }
        .co-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
        .card.co { border-top: 4px solid var(--co-color); }
        .co-name { font: 600 18px var(--font-display); letter-spacing: -0.02em; display: flex; align-items: center; }
        .co-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .co-col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .co-col + .co-col { border-left: 1px solid var(--border); padding-left: 16px; }
        .co-val { font: 600 20px var(--font-display); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .co-sub { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; flex-wrap: wrap; }
        .co .rows { margin-top: 12px; }
        .co .row { font-size: 13px; }

        /* ── ตาราง responsive: จอใหญ่ = ตาราง, จอเล็ก = การ์ดรายแถว (ไม่มี scroll ด้านข้าง) ── */
        .rtable { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
        .rtable th { text-align: left; font-size: 12px; color: var(--text-2); padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
        .rtable td { padding: 12px; border-bottom: 1px solid #F4F4F6; vertical-align: middle; }
        .rtable tbody tr { transition: background .2s; }
        .rtable tbody tr:hover { background: #FAFAFB; }
        .rtable tfoot td { border-top: 1px solid var(--border); border-bottom: none; background: #FAFAFB; }
        .rtable .r { text-align: right; }
        .rtable th.sortable { cursor: pointer; user-select: none; }
        .rtable th.sortable:hover, .rtable th.sorted { color: var(--primary); }
        .rtable .strong { font-weight: 600; }
        .rank-col { width: 36px; color: var(--neutral); }
        .stack { display: inline-flex; flex-direction: column; align-items: flex-end; gap: 2px; }
        .stack.left { align-items: flex-start; }
        .num-lg { font: 600 15px var(--font-display); letter-spacing: -0.01em; }
        .who { display: flex; flex-direction: column; gap: 2px; }
        .code { font-family: var(--font-mono); font-size: 12.5px; color: var(--text); }
        .warn-mark { color: #B45309; }
        .periods tbody tr:first-child td { background: #FAFAFB; }
        .sort-mobile { display: none; }
        @container card (max-width: 800px) {
          .rtable thead { display: none; }
          .rtable, .rtable tbody, .rtable tfoot, .rtable tr, .rtable td { display: block; width: 100%; }
          .rtable tr { border: 1px solid var(--border); border-radius: 12px; padding: 8px 14px; margin-bottom: 10px; background: var(--surface); }
          .rtable tfoot tr { background: #FAFAFB; }
          .rtable td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 7px 0; border: none; text-align: right; }
          .rtable td + td { border-top: 1px solid #F4F4F6; }
          .rtable td::before { content: attr(data-label); color: var(--text-2); font-size: 12px; text-align: left; flex-shrink: 0; }
          .rtable td:not([data-label])::before { content: none; }
          .rtable .rank-col { display: none; }
          .rtable .stack { align-items: flex-end; }
          .rtable .pct-cell { width: auto; }
          .sort-mobile { display: block; }
        }

        /* ── Scorecard รายบริษัท ── */
        .score { table-layout: fixed; }
        .score th:first-child { width: 30%; }
        .score th:not(:first-child) { text-align: left; }
        .score td { vertical-align: top; }
        .sc-label { display: flex; flex-direction: column; gap: 2px; }
        .sc-label b { font-size: 14px; }
        .sc-label .muted { font-size: 11.5px; line-height: 1.4; }
        .sc-stack { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .sc-line { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 13px; font-variant-numeric: tabular-nums; }
        .sc-cmp { display: flex; flex-direction: column; gap: 1px; }
        .sc-cmp + .sc-cmp { margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border); }
        .sc-nums { font-size: 12.5px; font-variant-numeric: tabular-nums; text-align: right; }
        .sc-big { font: 600 16px var(--font-display); letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
        /* หัวบริษัทค้างบนจอ + GIV เดือนนี้ · แถบสีบริษัทด้านบน */
        .score thead th { position: sticky; top: 0; z-index: 3; background: var(--surface); box-shadow: inset 0 -1px 0 var(--border); padding-top: 12px; padding-bottom: 10px; vertical-align: bottom; }
        .score thead th.sc-co { box-shadow: inset 0 3px 0 var(--co), inset 0 -1px 0 var(--border); }
        .sc-co-name { display: block; font: 600 16px var(--font-display); color: var(--text); }
        .sc-co-val { display: block; font-size: 12.5px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
        .sc-co-val .muted { font-weight: 400; }
        /* หัวหมวด */
        .score tr.sc-group td { padding: 14px 12px 6px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--brand-700); background: transparent; border-bottom: 2px solid var(--brand-100); }
        .score td:not(.sc-label) { font-size: 13.5px; }
        .sc-metric { font-size: 12px; font-weight: 600; color: var(--text-2); }
        .sc-nums b { font-size: 14px; }
        /* % เทียบฐาน: ป้ายสี */
        .sc-chip { display: inline-block; padding: 1px 8px; border-radius: 6px; font-size: 12.5px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .sc-chip.up { background: #F6FFED; color: #389E0D; }
        .sc-chip.down { background: #FFF1F0; color: #CF1322; }
        @container card (max-width: 800px) {
          .score tr.sc-group { border: none; background: transparent; padding: 10px 2px 0; margin-bottom: 6px; }
          .score tr.sc-group td { display: block; padding: 0 0 4px; border: none; border-bottom: 2px solid var(--brand-100); text-align: left; font-size: 13px; }
          .score tr.sc-group td::before { content: none; }
          .score td.sc-label { background: var(--brand-50); margin: -8px -14px 6px; padding: 10px 14px; width: auto; border-radius: 12px 12px 0 0; flex-direction: column; align-items: flex-start; text-align: left; }
          .score td:not(.sc-label) { align-items: flex-start; }
          .score td:not(.sc-label) > * { flex: 1; max-width: 60%; }
          .score .sc-stack { align-items: stretch; }
        }

        /* ── toolbar ── */
        .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; }
        .toolbar .search { flex: 1; min-width: 200px; }
        .more { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; padding-top: 16px; font-size: 13px; }

        /* ── กราฟแนวโน้ม ── */
        .trend svg { width: 100%; height: auto; display: block; }
        .trend .axis { font: 400 11px var(--font-body); fill: var(--text-2); }
        .trend .direct { font: 600 12px var(--font-body); fill: var(--primary); }
        .trend .direct.muted { fill: var(--text-2); }
        .legend { display: flex; flex-wrap: wrap; gap: 16px; font-size: 12px; margin-top: 8px; }
        .legend span { display: inline-flex; align-items: center; gap: 6px; }
        .legend-line { display: inline-block; width: 18px; height: 0; border-top: 3px solid var(--primary); }
        .legend-line.dashed { border-top: 2px dashed var(--neutral); }

        /* ── สัดส่วน บริษัท → Principal ── */
        .share-top { display: grid; grid-template-columns: 180px 1fr; gap: 24px; align-items: center; }
        .share-donut { width: 180px; height: 180px; }
        .share-slice { cursor: pointer; transition: opacity .2s; }
        .donut-cap { font: 400 11px var(--font-body); fill: var(--text-2); }
        .donut-val { font: 600 20px var(--font-display); fill: var(--text); letter-spacing: -0.02em; }
        .share-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .tile {
          display: flex; flex-direction: column; gap: 4px; text-align: left; padding: 14px 16px; min-width: 0;
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px; cursor: pointer;
          font: 400 13px var(--font-body); color: var(--text); transition: transform .2s, box-shadow .2s, border-color .2s;
        }
        .tile:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
        .tile.on { border-color: var(--primary); box-shadow: 0 0 0 3px var(--ring); }
        .tile:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
        .tile-name { font-weight: 600; display: flex; align-items: center; }
        .tile-val { font: 600 22px var(--font-display); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .tile-meta { font-size: 12px; color: var(--text-2); }
        .tile-share { height: 4px; background: var(--track); border-radius: 9999px; overflow: hidden; margin-top: 4px; }
        .tile-share > span { display: block; height: 100%; }
        .share-detail { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); }
        .share-detail-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .share-stats { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; color: var(--text-2); }
        .share-stats b { color: var(--text); font-variant-numeric: tabular-nums; }
        .princ-grid { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0 32px; }
        .princ { display: grid; grid-template-columns: 24px 1fr auto; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid #F4F4F6; }
        .princ-rank { font-size: 12px; color: var(--neutral); text-align: right; font-variant-numeric: tabular-nums; }
        .princ-main { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .princ-name { font-size: 13px; font-weight: 600; display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
        .princ-co { font-size: 11px; font-weight: 600; }
        .princ-bar { height: 4px; background: var(--track); border-radius: 9999px; overflow: hidden; }
        .princ-bar > span { display: block; height: 100%; border-radius: 9999px; }
        .princ-num { display: flex; flex-direction: column; align-items: flex-end; font-variant-numeric: tabular-nums; }
        .princ-val { font-size: 13px; font-weight: 600; }
        .princ-share { font-size: 12px; color: var(--text-2); }
        /* Principal กดเจาะดูได้: ปุ่มเต็มแถว + ลูกศร › */
        .princ.princ-click { display: block; padding: 0; }
        .princ-btn { width: 100%; display: grid; grid-template-columns: 24px 1fr auto 14px; gap: 12px; align-items: center; padding: 10px 6px 10px 0; border: none; background: transparent; font: inherit; color: inherit; text-align: left; cursor: pointer; border-radius: 8px; transition: background .2s; }
        .princ-btn::after { content: '›'; color: var(--neutral); font-size: 18px; line-height: 1; transition: transform .2s; }
        .princ-btn:hover { background: var(--brand-50); }
        .princ.on .princ-btn { background: var(--brand-50); box-shadow: inset 3px 0 0 var(--primary); }
        .princ.on .princ-btn::after { transform: rotate(90deg); color: var(--primary); }
        .princ-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
        /* แผงเจาะดู Principal */
        .drill { margin-top: 18px; padding: 18px; border: 1px solid var(--brand-100); border-radius: 12px; background: linear-gradient(180deg, var(--brand-50), var(--surface) 140px); scroll-margin-top: 16px; animation: drill-in .25s ease-out; }
        @keyframes drill-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .drill { animation: none; } }
        .drill-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
        .drill-title { font: 600 22px/1.2 var(--font-display); margin-top: 2px; }
        .drill-title .muted { font-size: 15px; font-weight: 400; }
        .drill-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
        .drill-kpi { display: grid; gap: 2px; padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; min-width: 0; }
        .drill-kpi b { font: 600 19px/1.25 var(--font-display); font-variant-numeric: tabular-nums; overflow-wrap: break-word; }
        .drill-kpi .muted { font-size: 12.5px; overflow-wrap: anywhere; }
        .drill-kpi.hl { border-color: #FFE58F; background: #FFFBE6; }
        .drill-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 24px; }
        .drill-list { list-style: none; margin: 8px 0 0; padding: 0; display: grid; }
        .drill-list li { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid #F0F2F6; }
        .drill-rank { width: 22px; height: 22px; border-radius: 999px; display: grid; place-items: center; font-size: 11.5px; font-weight: 600; background: var(--alt); color: var(--text-2); }
        .drill-rank.gold { background: #FADB14; color: #613400; }
        .drill-main { display: grid; gap: 6px; min-width: 0; }
        .drill-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 14px; font-variant-numeric: tabular-nums; }
        .drill-row .muted { font-size: 12.5px; }
        .drill-seller { display: grid; min-width: 0; }
        .drill-seller b { overflow-wrap: break-word; }
        .drill-val { white-space: nowrap; }
        .drill-more { margin-top: 10px; }
        .drill-branches { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr)); gap: 14px; margin-top: 8px; align-items: start; }
        .drill-branch { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; min-width: 0; }
        .drill-branch.top { border-color: #FFE58F; box-shadow: 0 0 0 3px #FFFBE6; }
        .drill-branch-head { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 10px; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
        .drill-branch-name { font: 600 18px var(--font-display); }
        .drill-branch .drill-list { margin-top: 2px; }
        .drill-branch .drill-list li:last-child { border-bottom: none; }
        .drill-rank.sm { width: 20px; height: 20px; font-size: 11px; background: transparent; color: var(--neutral); }
        .drill-top { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; background: #FADB14; color: #613400; font-size: 11px; font-weight: 600; vertical-align: 1px; white-space: nowrap; }
        @container card (max-width: 820px) {
          .drill-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .drill-grid { grid-template-columns: minmax(0, 1fr); gap: 18px; }
        }
        @container card (max-width: 420px) {
          .drill { padding: 14px 12px; }
          .drill-kpi { padding: 10px; }
          .drill-kpi b { font-size: 16px; }
          .drill-row { flex-wrap: wrap; }
          .drill-seller { flex: 1 1 100%; }
        }
        @media (max-width: 900px) {
          .share-top { grid-template-columns: 1fr; justify-items: center; }
          .share-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
        }

        /* ── ยอดขายตามทีม ── */
        .branch-table { font-size: 16px; table-layout: fixed; }
        .branch-table th { font-size: 13.5px; padding: 12px 16px; }
        .branch-table td { padding: 14px 16px; }
        .branch-table th:first-child { width: 14%; }
        .branch-table td.strong { font-size: 17px; font-weight: 700; }
        .branch-table tfoot td { font-weight: 700; font-size: 17px; }
        .branch-table .idx-chip { font-size: 15px; min-width: 64px; padding: 4px 12px; }
        @container card (max-width: 800px) {
          .branch-table { font-size: 15px; table-layout: auto; }
          .branch-table td { padding: 9px 0; }
          .branch-table td::before { font-size: 13px; }
          .branch-table td.strong, .branch-table tfoot td { font-size: 16px; }
        }
        .pr-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }
        .princ-table { font-size: 15px; }
        .princ-table td.strong { font-size: 15.5px; }
        .princ-table tfoot td { font-weight: 700; }
        .pr-pct { display: inline-block; min-width: 52px; padding: 3px 10px; border-radius: 6px; font-weight: 600; text-align: center; }
        .pr-pct.good { background: #C6EFCE; color: #006100; }
        .pr-pct.bad { background: #FFC7CE; color: #9C0006; }
        @container card (max-width: 800px) { .pr-actions { margin-left: 0; width: 100%; } .pr-actions > * { flex: 1 1 auto; } }
        .store-search { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
        .store-input { flex: 1 1 260px; min-width: 0; height: 44px; padding: 0 14px; font: inherit; font-size: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); }
        .store-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--ring); }
        /* ── แถบเตือนความครบของข้อมูล / หน้าสถานะระบบ ── */
        .health { border-radius: 12px; padding: 12px 16px; font-size: 14px; display: grid; gap: 4px; border: 1px solid; }
        .health ul { margin: 0; padding-left: 20px; display: grid; gap: 2px; }
        .health a { color: inherit; font-weight: 600; width: fit-content; }
        .health.warn { background: #FFFBE6; border-color: #FFE58F; color: #874D00; }
        .health.bad { background: #FFF1F0; border-color: #FFCCC7; color: #A8071A; }
        .health.ok { background: #F6FFED; border-color: #B7EB8F; color: #237804; display: block; }
        .sc-chip.mid { background: #FFFBE6; color: #AD6800; }
        .status-table td { vertical-align: middle; }
        .st-job { font-family: var(--font-mono); font-size: 12px; }
        .st-err { display: block; margin-top: 4px; font-size: 12px; color: #A8071A; font-family: var(--font-mono); overflow-wrap: anywhere; }
        .status-table tr.st-fail td { background: #FFF8F7; }
        .st-backfill { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 8px; }
        .st-backfill li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #F0F2F6; font-size: 14px; }

        /* ── หน้ายอดขายรายร้าน ── */
        .st-search .card-sub { margin-bottom: 14px; }
        .st-count { margin: 14px 0 0; font-size: 13px; color: var(--text-2); }
        .store-chip-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
        .store-chip { min-width: 0; }
        .store-examples > *, .st-search > * { min-width: 0; }
        .store-chip-val { flex-shrink: 0; }
        /* มือถือ: ชิปร้านเต็มแถว ชื่อยาวตัด … ไม่ล้นการ์ด · โปรไฟล์ร้าน รูปเล็กลงอยู่ข้างชื่อ */
        @container card (max-width: 520px) {
          .store-chips { display: grid; grid-template-columns: minmax(0, 1fr); }
          .store-chip { width: 100%; }
          .store-chip-name { max-width: none; flex: 1 1 auto; }
          .card.st-profile { gap: 12px 14px; }
          .st-profile .st-avatar { width: 48px; height: 48px; border-radius: 12px; }
          .st-profile .st-who { flex: 1 1 180px; }
          .st-profile .st-name h2 { font-size: 19px; }
          .st-search .card-sub { display: none; }
          .st-search .card-title { margin-bottom: 10px; }
          /* ร้านตัวอย่าง: โชว์ 4 ร้าน ที่เหลือกด "ดูเพิ่ม" */
          .store-chip.extra { display: none; }
          .st-search .store-more { display: block; }
          .st-meta { grid-auto-flow: row; justify-items: start; text-align: left; font-size: 13px; gap: 2px; }
          .st-codes { font-size: 12px; }
        }
        .store-more { display: none; }
        .store-more summary { cursor: pointer; font-size: 13px; color: var(--primary); padding: 4px 0; width: fit-content; }
        .store-more .store-chips { margin-top: 8px; }
        /* ตารางรายละเอียดร้านบนจอแคบ: แถวละ 2 บรรทัด (Princ | GIV · บริษัทรหัส | สัดส่วน) แทนการ์ด 6 บรรทัด */
        @container card (max-width: 800px) {
          .store-table tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 12px; row-gap: 2px; padding: 10px 12px; margin-bottom: 8px; }
          .store-table td { display: block; padding: 0; border: none !important; text-align: left; }
          .store-table td::before { content: none; }
          .store-table tbody tr:not(.grp) td:nth-child(2) { grid-area: 1 / 1; font-size: 15px; }
          .store-table tbody tr:not(.grp) td:nth-child(3) { grid-area: 1 / 2; text-align: right; font-size: 15px; }
          .store-table tbody tr:not(.grp) td:nth-child(1) { grid-area: 2 / 1; font-size: 12px; overflow-wrap: anywhere; }
          .store-table tbody tr:not(.grp) td:nth-child(6) { grid-area: 2 / 2; text-align: right; font-size: 12px; }
          .store-table tbody tr:not(.grp) td:nth-child(4), .store-table tbody tr:not(.grp) td:nth-child(5) { display: none; }
          .store-table tr.grp td:nth-child(1), .store-table tfoot td:nth-child(1) { grid-area: 1 / 1; }
          .store-table tr.grp td:nth-child(2), .store-table tfoot td:nth-child(2) { grid-area: 1 / 2; text-align: right; }
          .store-table tr.grp td:nth-child(5), .store-table tfoot td:nth-child(5) { grid-area: 2 / 2; text-align: right; font-size: 12px; color: var(--text-2); }
          .store-table tr.grp td:nth-child(3), .store-table tr.grp td:nth-child(4),
          .store-table tfoot td:nth-child(3), .store-table tfoot td:nth-child(4) { display: none; }
        }
        .store-chip-val { margin-left: 8px; font-weight: 600; color: var(--text-2); font-variant-numeric: tabular-nums; }
        .st-profile { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 20px; background: linear-gradient(135deg, var(--brand-50), var(--surface) 60%); }
        .st-avatar { width: 64px; height: 64px; flex-shrink: 0; border-radius: 16px; display: grid; place-items: center; background: var(--brand); color: #fff; font: 600 28px var(--font-display); box-shadow: 0 6px 16px rgba(48,120,248,.28); }
        .st-who { flex: 1 1 320px; min-width: 0; display: grid; gap: 8px; }
        .st-name { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
        .st-name h2 { font: 600 clamp(20px, 2.4vw, 26px)/1.25 var(--font-display); overflow-wrap: anywhere; }
        .st-ids { display: flex; flex-wrap: wrap; gap: 6px; }
        .st-id { display: inline-flex; align-items: center; padding: 3px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); font-size: 13px; font-family: var(--font-mono); white-space: nowrap; }
        .st-codes summary { cursor: pointer; font-size: 13px; color: var(--primary); width: fit-content; }
        .st-codes .st-ids { margin-top: 8px; }
        .st-id-rsm { background: var(--brand-100); border-color: transparent; color: var(--brand-700); font-weight: 600; }
        .st-meta { display: grid; gap: 4px; justify-items: end; text-align: right; font-size: 14px; }
        .st-last { margin-top: 4px; padding: 3px 10px; border-radius: 999px; background: #F6FFED; color: #389E0D; font-size: 13px; font-weight: 600; }
        .st-last.warn { background: #FFF7E6; color: #AD6800; }
        @container card (max-width: 640px) { .st-meta { justify-items: start; text-align: left; } }
        .st-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        .st-kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; display: grid; gap: 4px; min-width: 0; box-shadow: 0 1px 2px rgba(15,27,51,0.04); }
        .st-kpi-main { background: var(--brand); border-color: var(--brand); color: #fff; }
        .st-kpi-main .eyebrow, .st-kpi-main .st-kpi-cap { color: rgba(255,255,255,.82); }
        .st-kpi-val { font: 600 clamp(22px, 2.6vw, 30px)/1.2 var(--font-display); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
        .st-kpi-cap { font-size: 13px; color: var(--text-2); }
        @media (max-width: 1024px) { .st-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 420px) { .st-kpis { gap: 10px; } .st-kpi { padding: 14px; } }
        /* การ์ดกราฟกับการ์ด Princ สูงเท่ากัน — กราฟยืดตามความสูงของการ์ด Princ */
        .st-grid { align-items: stretch; }
        .st-grid > .card { display: flex; flex-direction: column; }
        .st-grid .trend-chart { flex: 1; display: flex; flex-direction: column; }
        .st-grid .tc-plot { flex: 1; height: auto; min-height: 240px; }
        .st-split { margin: 6px 0 18px; display: grid; gap: 8px; }
        .st-split-bar { display: flex; gap: 2px; height: 12px; border-radius: 6px; overflow: hidden; background: var(--track); }
        .st-split-bar span { min-width: 3px; }
        .st-split-legend, .trend-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; }
        .st-split-legend i, .trend-legend i, .tc-tip i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
        .st-princ { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 12px; }
        .st-princ-head { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; font-variant-numeric: tabular-nums; }
        .st-princ-name { font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
        .st-princ-pct { display: inline-block; min-width: 52px; text-align: right; color: var(--text-2); }
        .st-princ-track { display: block; height: 8px; margin-top: 5px; border-radius: 4px; background: var(--track); overflow: hidden; }
        .st-princ-track span { display: block; height: 100%; border-radius: 4px; background: var(--brand); }
        .trend-chart { container: trend / inline-size; display: grid; gap: 10px; margin-top: 8px; }
        @container trend (max-width: 520px) { .tc-x.thin { visibility: hidden; } }
        .tc-plot { position: relative; height: 240px; padding-left: 44px; }
        .tc-grid { position: absolute; inset: 0 0 24px 44px; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; }
        .tc-gridline { position: relative; border-top: 1px dashed #E6EAF0; height: 0; }
        .tc-gridline span { position: absolute; right: calc(100% + 6px); top: -8px; font-size: 11px; color: var(--text-2); white-space: nowrap; font-variant-numeric: tabular-nums; }
        .tc-cols { position: absolute; inset: 0 0 0 44px; display: flex; gap: 2px; }
        .tc-col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding: 0 0 24px; border: none; background: transparent; cursor: pointer; font: inherit; border-radius: 6px; }
        .tc-col.on { background: rgba(48,120,248,.06); }
        .tc-stack { width: min(70%, 36px); display: flex; flex-direction: column-reverse; gap: 2px; border-radius: 4px 4px 0 0; overflow: hidden; }
        .tc-seg { display: block; min-height: 2px; }
        .tc-x { position: absolute; bottom: 0; font-size: 11px; color: var(--text-2); white-space: nowrap; transform: translateY(0); }
        .tc-col { position: relative; }
        .tc-tip { position: absolute; top: 0; transform: translateX(-50%); z-index: 5; min-width: 150px; padding: 10px 12px; border-radius: 10px; background: #0F1B33; color: #fff; font-size: 12.5px; display: grid; gap: 4px; pointer-events: none; box-shadow: 0 8px 24px rgba(0,0,0,.2); }
        .tc-tip-row { display: flex; justify-content: space-between; gap: 12px; font-variant-numeric: tabular-nums; }
        .store-box { position: relative; flex: 1 1 260px; min-width: 0; display: flex; }
        .store-box .store-input { flex: 1; width: 100%; }
        .store-suggest { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 50; list-style: none; margin: 0; padding: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 12px 32px rgba(15,27,51,.14); max-height: min(420px, 60vh); overflow-y: auto; }
        .store-suggest-empty { padding: 10px 12px; color: var(--text-2); font-size: 14px; }
        .store-suggest-item { width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 9px 12px; border: none; border-radius: 8px; background: transparent; font: inherit; color: var(--text); text-align: left; cursor: pointer; }
        .store-suggest-item.active { background: var(--brand-50); }
        .store-examples { margin-top: 14px; display: grid; gap: 8px; }
        .store-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .store-chip { display: inline-flex; align-items: center; max-width: 100%; padding: 6px 12px; border: 1px solid var(--border); border-radius: 999px; font-size: 13px; color: var(--text); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .store-chip:hover { background: #FAFAFB; }
        .store-chip.active { border-color: var(--primary); background: #F0F6FF; }
        .store-badge { display: inline-block; margin-right: 8px; padding: 2px 8px; border-radius: 6px; background: var(--brand-50); color: var(--brand-700); font-size: 12px; vertical-align: 2px; }
        .store-hits { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 8px; }
        .store-hit { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 16px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; color: var(--text); text-decoration: none; transition: background .2s, border-color .2s; }
        .store-hit:hover { background: #FAFAFB; }
        .store-hit.active { border-color: var(--primary); background: #F0F6FF; }
        .store-hit-name { font-weight: 600; font-size: 15px; overflow-wrap: anywhere; }
        .store-hit-codes { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; font-size: 13px; color: var(--text-2); }
        .store-tag { white-space: nowrap; }
        .store-table { font-size: 15px; }
        /* หัวกลุ่มบริษัท (ยอดรวมบริษัท) อยู่บนรายการของบริษัทนั้น · แถบสีบริษัทด้านซ้าย */
        .store-table .st-co-head td { background: #F6F9FF; border-top: 1px solid var(--border); font-weight: 600; }
        .store-table .st-co-head td:first-child { box-shadow: inset 4px 0 0 var(--co); }
        .store-table .st-co-name { font-size: 16px; }
        .store-table .st-co-sub { font-weight: 400; font-size: 13px; }
        .store-table .st-co-row td:first-child { padding-left: 34px; }
        @container card (max-width: 800px) {
          .store-table .st-co-head { border-left: 4px solid var(--co); background: #F6F9FF; margin-top: 14px; }
          .store-table .st-co-head td { background: transparent; border: none; box-shadow: none !important; }
          .store-table .st-co-row { margin-left: 10px; width: calc(100% - 10px); }
          .store-table .st-co-row td:first-child { padding-left: 0; }
        }
        .store-table tfoot td { font-weight: 700; }
        .shots-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(15,27,51,.55); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .shots { background: var(--surface); border-radius: 14px; width: min(860px, 100%); max-height: calc(100dvh - 32px); display: flex; flex-direction: column; padding: 16px; gap: 10px; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
        .shots-head { display: flex; justify-content: space-between; align-items: center; font-size: 17px; }
        .shots-close { border: none; background: transparent; font-size: 20px; cursor: pointer; color: var(--text-2); padding: 4px 8px; }
        .shots-tip { margin: 0; font-size: 13px; color: var(--text-2); }
        .shots-all { display: flex; flex-wrap: wrap; gap: 8px; }
        .shots-all > * { flex: 1 1 auto; }
        .shots-list { overflow-y: auto; display: grid; gap: 14px; overscroll-behavior: contain; }
        .shot { margin: 0; border: 1px solid var(--border); border-radius: 10px; padding: 10px; }
        .shot img { display: block; width: 100%; height: auto; border-radius: 6px; -webkit-touch-callout: default; }
        .shot figcaption { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; margin-top: 8px; font-size: 13px; color: var(--text-2); }
        .shot-btns { display: flex; gap: 8px; }
        .xl-offscreen { position: fixed; left: -10000px; top: 0; pointer-events: none; }
        .xl-sheet { width: 760px; padding: 16px; background: #fff; color: #000; font-size: 15px; font-variant-numeric: tabular-nums; }
        .xl-top { display: flex; gap: 40px; margin-bottom: 10px; font-size: 15px; }
        .xl-top span { background: #DDEBF7; border: 1px solid #9BC2E6; padding: 3px 12px; }
        .xl-sheet table { width: 100%; border-collapse: collapse; }
        .xl-sheet th, .xl-sheet td { border: 1px solid #A6A6A6; padding: 4px 8px; text-align: right; white-space: nowrap; }
        .xl-sheet th { background: #DDEBF7; font-weight: 700; white-space: normal; vertical-align: bottom; }
        .xl-sheet .l { text-align: left; }
        .xl-sheet td.good { background: #C6EFCE; color: #006100; }
        .xl-sheet td.bad { background: #FFC7CE; color: #9C0006; }
        .xl-sheet tfoot td { background: #DDEBF7; font-weight: 700; border-top: 2px solid #5B9BD5; }
        .xl-foot { margin-top: 8px; font-size: 12px; color: #595959; }
        .idx-chip { display: inline-block; min-width: 56px; padding: 3px 10px; border-radius: 6px; font-weight: 600; text-align: center; }
        .idx-chip.up { background: #D9F7BE; color: #237804; }
        .idx-chip.down { background: #FFF1F0; color: #CF1322; }
        .team-filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 16px; }
        .team-summary { display: grid; grid-template-columns: 1.3fr repeat(3, 1fr); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 16px; }
        .ts-item { display: flex; flex-direction: column; gap: 4px; padding: 14px 18px; border-left: 1px solid var(--border); min-width: 0; }
        .ts-item:first-child { border-left: none; }
        .ts-big { font: 600 24px var(--font-display); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
        .ts-val { font: 600 17px var(--font-display); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .ts-cap { font-size: 12px; color: var(--text-2); }
        .ts-pace { display: flex; align-items: center; gap: 8px; font-size: 12px; }
        .ts-pace .bar { flex: 1; }
        @media (max-width: 900px) {
          .team-summary { grid-template-columns: 1fr 1fr; }
          .ts-item:nth-child(3) { border-left: none; }
          .ts-item:nth-child(n+3) { border-top: 1px solid var(--border); }
        }
        /* ตารางทีม: แถวหัวกลุ่ม หัวหน้า (SM) → Sup พร้อมยอดรวมกลุ่ม */
        .team-table .grp td { font-weight: 600; }
        .team-table .grp-sm td { background: #E8F0FE; border-top: 2px solid var(--brand-100); }
        .team-table .grp-sup td { background: #F6F9FF; }
        .team-table .grp:hover td { filter: none; }
        .grp-name { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .grp-tag { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 9999px; background: var(--primary); color: #FFFFFF; }
        .grp-sup .grp-tag { background: var(--brand-100); color: var(--brand-700); }
        .grp-count { font-size: 12px; font-weight: 400; color: var(--text-2); }
        .grp-open { border: none; background: none; padding: 0; font: 600 12px var(--font-body); color: var(--primary); cursor: pointer; }
        .grp-open:hover { text-decoration: underline; }
        .grp-open:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); border-radius: 4px; }
        .team-table td.seller-cell { padding-left: 28px; }
        .clear-btn { height: 38px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--primary); font: 600 13px var(--font-body); cursor: pointer; }
        .clear-btn:hover { border-color: var(--primary); }
        .clear-btn:disabled { color: var(--neutral); cursor: default; border-color: var(--border); }
        @container card (max-width: 800px) {
          .team-table .grp td { background: transparent !important; border: none; }
          .team-table tr.grp-sm { background: #E8F0FE; border-color: var(--brand-100); }
          .team-table tr.grp-sup { background: #F6F9FF; }
          .team-table td.seller-cell { padding-left: 0; }
          /* การ์ดแบบกะทัดรัด: Target | GIV · % เต็มแถว · BE | NIV */
          .team-table tr { display: grid; grid-template-columns: 1fr 1fr; column-gap: 16px; }
          .team-table td { min-width: 0; }
          .team-table td:nth-child(1), .team-table td:nth-child(2), .team-table td[data-label="% ถึง Target"] { grid-column: 1 / -1; }
          .team-table td[data-label="Target"], .team-table td[data-label="BE"] { border-top: 1px solid #F4F4F6; }
        }

        @media (max-width: 640px) {
          .container { padding-left: 16px; padding-right: 16px; }
          .hero { padding: 24px 16px 64px; }
          .hero h1 { font-size: 26px; }
          .card { padding: 16px; }
          .kpis { padding: 0; }
          .kpi { padding: 16px; }
          .kpi-val { font-size: 22px; }
          .field, .field select { width: 100%; }
          .arrow { display: none; }
          .filters .btn { width: 100%; }
          .filters-hint { margin-left: 0; }
          .co-cols { grid-template-columns: 1fr; }
          .co-col + .co-col { border-left: none; padding-left: 0; border-top: 1px solid var(--border); padding-top: 12px; }

          /* ── มือถือ: บีบให้เลื่อนน้อยที่สุด ── */
          .container { gap: 14px; padding-bottom: 32px; }
          .hero { padding: 18px 16px 56px; }
          .hero h1 { font-size: 23px; }
          .hero p { margin-top: 2px; font-size: 14px; }
          .hero-inner { gap: 10px; }
          .hero-side { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 8px; }
          .hero-chip { padding: 4px 10px; font-size: 12px; }
          /* ตัวกรองช่วงเดือน: 2 คอลัมน์ (ตั้งแต่ | ถึง · บริษัท | ปุ่มค้นหา) */
          .filters { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
          .filters > * { min-width: 0; }
          .filters select { width: 100%; min-width: 0; }
          /* ช่องค้นหาร้าน + ปุ่มค้นหา อยู่บรรทัดเดียวกัน */
          .store-search { flex-wrap: nowrap; }
          .store-box { flex: 1 1 0; }
          .store-search .btn { flex-shrink: 0; height: 44px; }
          .filters .field-label { font-size: 12px; }
          .filters .btn { align-self: end; }
          .filters-hint { display: none; }
          .card { padding: 14px; }
        }

        /* ── SweetAlert2 ให้เข้ากับธีม ── */
        .swal2-popup.swal-genesis { border-radius: 12px; font-family: var(--font-body); padding: 24px; }
        .swal-genesis .swal2-title { font: 600 20px var(--font-display); letter-spacing: -0.02em; color: var(--text); }
        .swal-genesis .swal2-html-container { font-size: 14px; color: var(--text-2); }
        .swal-genesis .swal2-loader { border-color: var(--primary) transparent var(--primary) transparent; }
        .swal-actions { gap: 8px; }
        .swal-btn-ghost { background: transparent !important; color: var(--text) !important; border: 1px solid var(--border) !important; }
        .swal-btn { height: 38px; padding: 0 20px; border-radius: 6px; border: none; background: var(--primary); color: #FAFAFA; font: 600 14px var(--font-body); cursor: pointer; }

        /* ── skeleton ระหว่างโหลด ── */
        .sk { display: block; border-radius: 6px; background: linear-gradient(90deg, #EDF1F7 25%, #F7F9FC 50%, #EDF1F7 75%); background-size: 200% 100%; animation: sk-shine 1.2s ease-in-out infinite; }
        .sk-light { background: linear-gradient(90deg, rgba(255,255,255,0.18) 25%, rgba(255,255,255,0.32) 50%, rgba(255,255,255,0.18) 75%); background-size: 200% 100%; }
        .sk-col { display: flex; flex-direction: column; gap: 12px; }
        .sk-status { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--primary); font-weight: 600; }
        .sk-spinner { width: 16px; height: 16px; border-radius: 9999px; border: 2px solid var(--brand-100); border-top-color: var(--primary); animation: sk-spin .8s linear infinite; }
        @keyframes sk-shine { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        @keyframes sk-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .sk, .sk-spinner { animation: none; } }
`;
