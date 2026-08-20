export const HOME_SCOPE_DRAWER_STYLES = `        /* ============================================================
           Knowledge-profile section cards (sections/books/domains grid)
           ============================================================ */
        .section-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 16px; padding: 20px 22px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(16px);
          position: relative; overflow: hidden; opacity: .9;
          width: 100%; color: inherit; font: inherit; text-align: left;
          transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease, opacity .16s ease;
        }
        .section-card:hover, .section-card:focus-within {
          transform: translateY(-2px); border-color: rgba(10,163,163,.32);
          box-shadow: 0 13px 30px rgba(0,0,0,.22); outline: none;
        }
        .section-card.has-score { opacity: 1; }
        .section-card.low-evidence { opacity: .92; }
        .section-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
        .section-card.ot::before { background: linear-gradient(90deg,#0aa3a3,#d4a017,#2563c4,#7c3aed); }
        .section-card.nt::before { background: linear-gradient(90deg,#14b8a6,#2563eb,#7c3aed); }
        .section-card.torah::before   { background: var(--torah-bar); }
        .section-card.former::before  { background: var(--former-bar); }
        .section-card.latter::before  { background: var(--latter-bar); }
        .section-card.prophets::before { background: linear-gradient(90deg,#0e8c6a,#2563c4); }
        .section-card.writings::before { background: var(--writings-bar); }
        .section-card.gospels::before { background: linear-gradient(90deg,#0d9488,#2dd4bf); }
        .section-card.acts::before { background: linear-gradient(90deg,#0284c7,#38bdf8); }
        .section-card.pauline::before { background: linear-gradient(90deg,#4f46e5,#818cf8); }
        .section-card.general::before { background: linear-gradient(90deg,#7c3aed,#c084fc); }
        .section-card.revelation::before { background: linear-gradient(90deg,#be123c,#fb7185); }
        .section-card.domain-events::before { background: linear-gradient(90deg,#d4a017,#f5c842); }
        .section-card.domain-characters::before { background: linear-gradient(90deg,#0e8c6a,#34d399); }
        .section-card.domain-geography::before { background: linear-gradient(90deg,#0aa3a3,#67e8f9); }
        .section-card.domain-significance::before { background: linear-gradient(90deg,#2563c4,#60a5fa); }
        .section-card.domain-speech::before { background: linear-gradient(90deg,#7c3aed,#a78bfa); }
        .section-card.domain-law::before { background: linear-gradient(90deg,#b45309,#f59e0b); }
        .section-card.domain-numbers::before { background: linear-gradient(90deg,#566070,#9aa3b2); }
        .section-card-main {
          display: block; width: 100%; border: 0; padding: 0;
          color: inherit; background: transparent; font: inherit;
          text-align: left; cursor: pointer;
        }
        .section-card-main:focus-visible { outline: 2px solid rgba(10,163,163,.58); outline-offset: 6px; border-radius: 8px; }
        .sc-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .sc-name { font-size: 15px; font-weight: 650; color: var(--navy); }
        .sc-books { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .sc-pct-empty { font-family: var(--font-crimson),Georgia,serif; font-size: 24px; font-weight: 700; color: rgba(27,36,66,.18); line-height: 1; text-align: right; }
        .sc-provisional-label { display: block; margin-top: 4px; font-family: var(--font-inter),system-ui,sans-serif; font-size: 8.5px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; color: #92400e; }
        .sc-bar-track { height: 6px; border-radius: 999px; background: rgba(27,36,66,.07); margin-bottom: 12px; }
        .sc-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .sc-chip-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
        .sc-chip-empty { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: rgba(27,36,66,.05); border: 1px solid var(--border); color: var(--muted); }
        .sc-chip-empty.evidence-high,
        .sc-chip-empty.evidence-moderate { background: var(--accent-dim); border-color: var(--accent-line); color: #0a6e6e; }
        .sc-chip-empty.evidence-low { background: #fef3c7; border-color: #fde68a; color: #92400e; }
        .sc-chip-empty.evidence-none { background: rgba(27,36,66,.05); border-color: var(--border); color: var(--muted); }
        .sc-test-link {
          flex: 0 0 auto; display: inline-flex; align-items: center; gap: 5px;
          min-height: 30px; padding: 6px 10px; border: 1px solid rgba(27,36,66,.14);
          border-radius: 999px; color: var(--navy); background: rgba(255,255,255,.66);
          font: inherit; font-size: 11px; font-weight: 800; text-decoration: none; cursor: pointer;
          transition: color .16s ease, background .16s ease, border-color .16s ease, transform .16s ease;
        }
        .sc-test-link:hover, .sc-test-link:focus-visible {
          color: #fff; background: var(--navy); border-color: var(--navy);
          transform: translateX(1px); outline: none;
        }
        .sc-test-link svg { width: 13px; height: 13px; }
        /* ============================================================
           Scope-detail drawer
           ============================================================ */
        .scope-drawer-backdrop {
          position: fixed; inset: 0; z-index: 120; display: flex; justify-content: flex-end;
          background: rgba(3,8,20,.58); backdrop-filter: blur(5px);
          animation: scopeBackdropIn .18s ease-out both;
        }
        /* This drawer is a data readout over the dashboard's starfield, not
           a settings panel — deliberately translucent dark glass (blurred)
           rather than the opaque light card every other data surface here
           uses, so the sky and its stars stay visible behind the numbers
           they explain. --navy/--muted are redefined locally so every
           var(--navy)/var(--muted) text color below still resolves
           correctly against the dark background without editing each rule
           individually; a handful of spots that hardcode a *background*
           (not just text) tied to the light-mode meaning of --navy are
           overridden explicitly further down instead. */
        .scope-drawer {
          --navy: #fff;
          --muted: rgba(255,255,255,.62);
          width: min(480px, 100%); height: 100%; overflow-y: auto;
          background: rgba(9,14,28,.72); color: #fff;
          backdrop-filter: blur(20px);
          border-left: 1px solid rgba(255,255,255,.14);
          box-shadow: -24px 0 60px rgba(0,0,0,.45);
          animation: scopeDrawerIn .24s cubic-bezier(.22,.72,.18,1) both;
        }
        @keyframes scopeBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scopeDrawerIn { from { transform: translateX(34px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .scope-drawer-head {
          position: sticky; top: 0; z-index: 2; display: flex;
          justify-content: space-between; align-items: flex-start; gap: 18px;
          padding: 28px 28px 20px; background: rgba(9,14,28,.55);
          border-bottom: 1px solid rgba(255,255,255,.12); backdrop-filter: blur(14px);
        }
        .scope-drawer-kicker {
          margin-bottom: 6px; color: #7de5e5; font-size: 10px;
          font-weight: 850; letter-spacing: .12em; text-transform: uppercase;
        }
        .scope-drawer-title {
          font-family: var(--font-crimson), Georgia, serif; font-size: 31px;
          font-weight: 700; line-height: 1.05;
        }
        .scope-drawer-sub { margin-top: 5px; color: var(--muted); font-size: 12.5px; }
        .scope-drawer-close {
          flex: 0 0 auto; width: 36px; height: 36px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.08); color: #fff;
          font: 500 24px/1 system-ui, sans-serif; cursor: pointer;
        }
        .scope-drawer-close:hover, .scope-drawer-close:focus-visible {
          border-color: rgba(125,229,229,.55); color: #7de5e5; outline: none;
        }
        .scope-drawer-body { padding: 24px 28px 34px; }
        /* BLI-adjacent drawers/accordion triggers — small icon chips sitting
           where full-width score support cards used to live in the main scroll. */
        /* ============================================================
           Score-panel triggers & knowledge-profile panel wrapper
           ============================================================ */
        .score-panel-triggers {
          display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 28px;
        }
        .score-panel-trigger {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 16px; border-radius: 999px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(212,160,23,.38);
          color: rgba(255,255,255,.8); font: inherit; font-size: 12.5px; font-weight: 700;
          cursor: pointer; transition: background .15s ease, border-color .15s ease, color .15s ease;
        }
        .score-panel-trigger:hover, .score-panel-trigger:focus-visible {
          background: rgba(255,255,255,.11); border-color: rgba(212,160,23,.65); color: #fff; outline: none;
        }
        .score-panel-trigger.is-active {
          background: rgba(94,234,212,.16); border-color: rgba(94,234,212,.42); color: #fff;
          box-shadow: 0 0 0 1px rgba(94,234,212,.12), 0 12px 30px rgba(10,163,163,.12);
        }
        .score-panel-trigger-icon { display: inline-flex; color: #5eead4; }
        .knowledge-profile-panel {
          margin: -10px 0 30px; padding: 22px;
          border-radius: 18px; border: 1px solid rgba(255,255,255,.16);
          background: rgba(255,255,255,.08);
          box-shadow: 0 22px 58px rgba(0,0,0,.20);
          backdrop-filter: blur(16px);
          animation: knowledgeProfileIn .22s cubic-bezier(.22,.72,.18,1) both;
        }
        .knowledge-profile-panel .breakdown-head { margin-top: 0; }
        .knowledge-profile-panel .section-eyebrow { margin-top: 0; }
        .knowledge-profile-panel .sections-grid { margin-top: 0; }
        @keyframes knowledgeProfileIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: none; }
        }
        .scope-state {
          min-height: 280px; display: grid; place-content: center; text-align: center;
          color: var(--muted); font-size: 13px; line-height: 1.55;
        }
        .scope-state strong {
          display: block; margin-bottom: 5px; color: var(--navy);
          font-family: var(--font-crimson), Georgia, serif; font-size: 22px;
        }
        .scope-evidence {
          display: flex; justify-content: space-between; align-items: center; gap: 16px;
          padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,.14);
        }
        .scope-evidence-label {
          display: inline-flex; padding: 6px 10px; border-radius: 999px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          color: #7de5e5; font-size: 11px; font-weight: 850;
        }
        .scope-evidence-copy { margin-top: 7px; color: var(--muted); font-size: 12px; line-height: 1.45; }
        .scope-evidence-score {
          color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 32px; font-weight: 700; text-align: right;
        }
        .scope-evidence-score span {
          display: block; margin-top: 2px; color: var(--muted);
          font-family: var(--font-inter), system-ui, sans-serif; font-size: 9px;
          font-weight: 800; letter-spacing: .09em; text-transform: uppercase;
        }
        .scope-metrics {
          display: grid; grid-template-columns: repeat(3,1fr);
          padding: 19px 0; border-bottom: 1px solid rgba(255,255,255,.14);
        }
        .scope-metric { padding-right: 12px; }
        .scope-metric strong { display: block; font-size: 17px; }
        .scope-metric span {
          color: var(--muted); font-size: 9px; font-weight: 800;
          letter-spacing: .08em; text-transform: uppercase;
        }
        .scope-period { padding: 15px 0; color: var(--muted); font-size: 11.5px; line-height: 1.5; }
        .scope-breakdown { padding-top: 18px; border-top: 1px solid rgba(255,255,255,.14); }
        .scope-breakdown + .scope-breakdown { margin-top: 20px; }
        .scope-breakdown h3 {
          margin-bottom: 9px; font-size: 10px; font-weight: 850;
          letter-spacing: .11em; text-transform: uppercase; color: var(--muted);
        }
        .scope-breakdown-row {
          display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 14px;
          padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.09);
        }
        .scope-breakdown-row:last-child { border-bottom: 0; }
        .scope-breakdown-name { font-size: 13px; font-weight: 750; }
        .scope-breakdown-meta { color: var(--muted); font-size: 11px; margin-top: 2px; }
        .scope-breakdown-value { font-size: 13px; font-weight: 800; text-align: right; }
        .scope-focused-action {
          display: flex; justify-content: space-between; align-items: center; gap: 18px;
          margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,.14);
        }
        .scope-focused-action p { color: var(--muted); font-size: 11.5px; line-height: 1.45; }
        .scope-focused-link {
          flex: 0 0 auto; border-radius: 999px; padding: 10px 15px;
          color: #fff; background: #0aa3a3; text-decoration: none;
          font-size: 12px; font-weight: 800; box-shadow: 0 8px 20px rgba(0,0,0,.3);
        }
`;
