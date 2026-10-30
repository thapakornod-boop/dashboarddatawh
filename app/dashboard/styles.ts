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
        @container card (max-width: 800px) {
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
        @media (max-width: 900px) {
          .share-top { grid-template-columns: 1fr; justify-items: center; }
          .share-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
        }

        /* ── ยอดขายตามทีม ── */
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
