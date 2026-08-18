// Extracted from app/admin/questions/page.tsx during a file-size cleanup.
// Pure CSS text, rendered via <style> tag(s). No behavior change intended.

export const ADMIN_QUESTIONS_STYLES_1 = `
        /* --navy/--muted now come from app/globals.css */
        :root { --teal:#0a8989; --line:#d9dee7; --soft:#f4f6f8; --danger:#a52a2a; }
        * { box-sizing:border-box; }
        body { margin:0; background:#edf0f3; color:var(--navy); font-family:var(--font-inter),system-ui,sans-serif; }
        button, input, select, textarea { font:inherit; }
        .admin-shell { min-height:100vh; }
        .admin-nav {
          height:58px; padding:0 24px; display:flex; align-items:center; justify-content:space-between;
          background:#11182b; color:#fff; border-bottom:1px solid rgba(255,255,255,.10);
        }
        .admin-brand { font:700 18px/1 var(--font-crimson),Georgia,serif; }
        .admin-nav-meta { display:flex; align-items:center; gap:14px; font-size:11px; color:rgba(255,255,255,.64); }
        .admin-nav a { color:#fff; text-decoration:none; font-weight:750; }
        .admin-main { max-width:1480px; margin:0 auto; padding:24px; }
        .admin-head { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-bottom:18px; }
        .admin-kicker { margin:0 0 5px; color:var(--teal); font-size:10px; font-weight:850; letter-spacing:.12em; text-transform:uppercase; }
        .admin-title { margin:0; font:700 29px/1.08 var(--font-crimson),Georgia,serif; }
        .admin-sub { margin:5px 0 0; color:var(--muted); font-size:12px; }
        .view-tabs { display:inline-flex; padding:3px; border:1px solid var(--line); background:#fff; border-radius:999px; }
        .view-tab { border:0; border-radius:999px; padding:8px 13px; background:transparent; color:var(--muted); font-size:11px; font-weight:800; cursor:pointer; }
        .view-tab.is-active { background:var(--navy); color:#fff; }
        .toolbar {
          display:grid; grid-template-columns:repeat(4,minmax(130px,1fr)) auto; gap:10px; align-items:end;
          padding:14px; background:#fff; border:1px solid var(--line); border-radius:8px; margin-bottom:14px;
        }
        .field { display:grid; gap:5px; }
        .field label { color:var(--muted); font-size:9px; font-weight:850; letter-spacing:.09em; text-transform:uppercase; }
        .field select, .field input, .review-panel select, .review-panel textarea {
          width:100%; border:1px solid var(--line); border-radius:6px; background:#fff; color:var(--navy); padding:9px 10px; font-size:12px;
        }
        .attention-toggle { display:flex; align-items:center; gap:8px; min-height:36px; color:var(--navy); font-size:11px; font-weight:750; }
        .attention-toggle input { width:16px; height:16px; accent-color:var(--teal); }
        .workspace {
          display:grid; grid-template-columns:minmax(0,1fr) 370px; min-height:610px;
          background:#fff; border:1px solid var(--line); border-radius:8px; overflow:hidden;
        }
        .queue-pane { min-width:0; overflow:auto; }
        .queue-table { width:100%; border-collapse:collapse; font-size:11px; }
        .queue-table th {
          position:sticky; top:0; z-index:1; padding:10px 9px; background:#f6f7f9;
          border-bottom:1px solid var(--line); color:var(--muted); text-align:left;
          font-size:9px; letter-spacing:.08em; text-transform:uppercase;
        }
        .queue-table td { padding:9px; border-bottom:1px solid #eceff3; vertical-align:top; }
        .queue-table tr.is-selected td { background:#eef8f8; }
        .question-select { display:block; width:100%; border:0; padding:0; background:transparent; color:var(--navy); text-align:left; cursor:pointer; }
        .question-select:hover, .question-select:focus-visible { color:#087171; outline:none; }
        .question-prompt { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; font-weight:700; line-height:1.35; }
        .question-id { margin-top:3px; color:#8a92a1; font:9px/1.3 ui-monospace,SFMono-Regular,monospace; }
        .queue-code { font-weight:800; white-space:nowrap; }
        .queue-dimension { max-width:130px; color:var(--muted); overflow-wrap:anywhere; }
        .status-pill {
          display:inline-flex; padding:4px 7px; border-radius:999px; background:#eef1f5;
          color:#4f5969; font-size:9px; font-weight:850; text-transform:uppercase;
        }
        .status-pill.approved { background:#dcf7ea; color:#176642; }
        .status-pill.revise { background:#fff0c9; color:#835d00; }
        .status-pill.quarantined { background:#fbe2e2; color:#8d2424; }
        .attention-mark { color:#a52a2a; font-weight:850; }
        .review-panel { border-left:1px solid var(--line); background:#fbfcfd; padding:20px; overflow-y:auto; }
        .review-empty { min-height:500px; display:grid; place-content:center; text-align:center; color:var(--muted); font-size:12px; }
        .review-kicker { margin:0 0 6px; color:var(--teal); font-size:9px; font-weight:850; letter-spacing:.1em; text-transform:uppercase; }
        .review-title { margin:0; font:700 22px/1.18 var(--font-crimson),Georgia,serif; }
        .review-id { margin:7px 0 16px; color:#7b8492; font:9px/1.4 ui-monospace,SFMono-Regular,monospace; overflow-wrap:anywhere; }
        .review-meta { display:grid; grid-template-columns:1fr 1fr; gap:0; margin-bottom:18px; border-top:1px solid var(--line); }
        .review-meta div { padding:10px 8px 10px 0; border-bottom:1px solid var(--line); }
        .review-meta span { display:block; color:var(--muted); font-size:8px; font-weight:850; letter-spacing:.08em; text-transform:uppercase; }
        .review-meta strong { display:block; margin-top:3px; font-size:11px; overflow-wrap:anywhere; }
        .detail-block { padding:14px 0; border-top:1px solid var(--line); }
        .detail-block h3 { margin:0 0 7px; color:var(--muted); font-size:9px; letter-spacing:.09em; text-transform:uppercase; }
        .detail-block pre { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; color:#424b5b; font:10px/1.5 ui-monospace,SFMono-Regular,monospace; }
        .review-form { display:grid; gap:11px; padding-top:16px; border-top:1px solid var(--line); }
        .review-form textarea { min-height:112px; resize:vertical; line-height:1.45; }
        .review-actions { display:flex; gap:8px; flex-wrap:wrap; }
        .review-save, .review-quarantine {
          border:0; border-radius:6px; padding:10px 13px; font-size:11px; font-weight:850; cursor:pointer;
        }
        .review-save { background:var(--navy); color:#fff; }
        .review-quarantine { background:#fff; color:var(--danger); border:1px solid #e9bcbc; }
        .review-save:disabled, .review-quarantine:disabled { opacity:.5; cursor:not-allowed; }
        .save-message { min-height:16px; color:var(--muted); font-size:10px; }
        .queue-state { min-height:500px; display:grid; place-content:center; text-align:center; padding:30px; color:var(--muted); font-size:12px; }
        .queue-state strong { display:block; margin-bottom:6px; color:var(--navy); font:700 20px/1.1 var(--font-crimson),Georgia,serif; }
        .pager { display:flex; justify-content:space-between; align-items:center; padding:11px 13px; border-top:1px solid var(--line); background:#f8f9fa; }
        .pager span { color:var(--muted); font-size:10px; }
        .pager button { border:1px solid var(--line); border-radius:5px; background:#fff; padding:7px 10px; color:var(--navy); font-size:10px; font-weight:800; cursor:pointer; }
        .pager button:disabled { opacity:.45; cursor:not-allowed; }
        .coverage-pane { overflow:auto; background:#fff; border:1px solid var(--line); border-radius:8px; }
        .coverage-note { padding:14px 16px; color:var(--muted); font-size:11px; border-bottom:1px solid var(--line); }
        .coverage-table { width:100%; border-collapse:collapse; font-size:11px; }
        .coverage-table th { padding:10px; background:#f6f7f9; color:var(--muted); text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.07em; }
        .coverage-table td { padding:9px 10px; border-top:1px solid #eceff3; max-width:240px; overflow-wrap:anywhere; }
        .audit-view { display:grid; gap:16px; }
        .audit-summary {
          display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px;
        }
        .audit-metric {
          min-height:116px; padding:14px; background:#fff; border:1px solid var(--line);
          border-top:3px solid #8d96a5; border-radius:7px;
        }
        .audit-metric.high { border-top-color:#a52a2a; }
        .audit-metric.review { border-top-color:#b57a00; }
        .audit-metric.ok { border-top-color:#16805b; }
        .audit-metric-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
        .audit-metric-label { margin:0; font-size:11px; font-weight:850; line-height:1.35; }
        .audit-metric-count { font:750 25px/1 var(--font-crimson),Georgia,serif; }
        .audit-metric-detail { margin:9px 0 0; color:var(--muted); font-size:10px; line-height:1.4; }
        .audit-panel { overflow:auto; background:#fff; border:1px solid var(--line); border-radius:8px; }
        .audit-panel-head { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; padding:14px 16px; border-bottom:1px solid var(--line); }
        .audit-panel-title { margin:0; font:700 18px/1.15 var(--font-crimson),Georgia,serif; }
        .audit-panel-copy { margin:4px 0 0; color:var(--muted); font-size:10px; line-height:1.4; }
        .audit-panel-count { color:var(--muted); font-size:10px; font-weight:800; white-space:nowrap; }
        .audit-table { width:100%; border-collapse:collapse; font-size:10px; }
        .audit-table th { padding:9px 10px; background:#f6f7f9; color:var(--muted); text-align:left; font-size:8px; text-transform:uppercase; letter-spacing:.07em; }
        .audit-table td { padding:9px 10px; border-top:1px solid #eceff3; max-width:310px; overflow-wrap:anywhere; vertical-align:top; }
        .audit-table td:last-child { font-weight:750; }
        .audit-empty { padding:22px 16px; color:#176642; font-size:11px; font-weight:750; }
        .audit-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start; }
        @media (max-width:900px) {
          .toolbar { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .workspace { grid-template-columns:1fr; }
          .review-panel { border-left:0; border-top:1px solid var(--line); }
          .audit-summary { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .audit-grid { grid-template-columns:1fr; }
        }
        @media (max-width:560px) {
          .admin-nav { padding:0 14px; }
          .admin-nav-meta span { display:none; }
          .admin-main { padding:16px 12px 30px; }
          .admin-head { align-items:flex-start; flex-direction:column; }
          .toolbar { grid-template-columns:1fr; }
          .audit-summary { grid-template-columns:1fr; }
        }
`;

export const ADMIN_QUESTIONS_STYLES_2 = `
          .state-action {
            border:1px solid rgba(255,255,255,.18); border-radius:999px; padding:10px 17px;
            background:#fff; color:#1b2442; font:800 12px/1 Inter,system-ui,sans-serif; cursor:pointer;
          }
`;
