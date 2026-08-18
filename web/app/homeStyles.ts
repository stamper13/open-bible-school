// Extracted from app/page.tsx during a file-size cleanup (2026-08-16).
// Pure CSS text, rendered via a <style> tag on the homepage. No behavior change intended.
export const HOME_PAGE_STYLES = `
        /* ============================================================
           Root CSS variables & global reset
           ============================================================ */
        :root {
          /* --navy/--accent/--muted now come from app/globals.css */
          --ink: #0e1116;
          --accent-dim: rgba(10,163,163,.10);
          --accent-line: rgba(10,163,163,.22);
          --card: rgba(255,255,255,.96); --border: rgba(27,36,66,.09);
          --shadow: 0 22px 58px rgba(0,0,0,.35), 0 4px 14px rgba(0,0,0,.2);
          --shadow-sm: 0 6px 20px rgba(0,0,0,.25);
          --torah-bar: linear-gradient(90deg,#d4a017,#f5c842);
          --former-bar: linear-gradient(90deg,#0e8c6a,#34d399);
          --latter-bar: linear-gradient(90deg,#2563c4,#60a5fa);
          --writings-bar: linear-gradient(90deg,#7c3aed,#a78bfa);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; }
        body {
          font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
          color: var(--ink); min-height: 100vh;
          background: #0b0f1e;
        }
        canvas.stars {
          position: fixed; left: 50%; top: 50%; z-index: 0; pointer-events: none;
          transform-origin: 50% 50%; transform: translate3d(-50%,-50%,0) rotate(var(--sky-start-rotation, 0deg));
        }
        /* ============================================================
           Nav bar (brand, links, Learn More menu, account menu)
           ============================================================ */
        .nav {
          position: sticky; top: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 32px;
          background: rgba(11,15,30,.80);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .nav-brand {
          font-family: var(--font-crimson), Georgia, serif;
          font-weight: 600; font-size: 18px;
          color: #fff; text-decoration: none; letter-spacing: .01em;
        }
        .brand-wrap { display: inline-flex; align-items: center; gap: 8px; }
        .beta-badge {
          position: relative;
          display: inline-flex; align-items: center;
          padding: 2px 8px; border-radius: 999px;
          font-family: system-ui, sans-serif;
          font-size: 10px; font-weight: 800; letter-spacing: .10em;
          text-transform: uppercase;
          color: rgba(255,255,255,.82);
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.16);
          cursor: help; outline: none;
        }
        .beta-tooltip {
          position: absolute; top: calc(100% + 10px); left: 0;
          width: 260px; padding: 10px 12px;
          border-radius: 10px;
          background: rgba(14,18,38,.98);
          border: 1px solid rgba(255,255,255,.14);
          box-shadow: 0 12px 34px rgba(0,0,0,.5);
          font-family: system-ui, sans-serif;
          font-size: 12px; font-weight: 500; letter-spacing: 0;
          text-transform: none; line-height: 1.45;
          color: rgba(255,255,255,.86);
          opacity: 0; visibility: hidden; transform: translateY(-4px);
          transition: opacity .16s ease, transform .16s ease, visibility .16s;
          z-index: 50; pointer-events: none;
        }
        .beta-badge:hover .beta-tooltip,
        .beta-badge:focus .beta-tooltip { opacity: 1; visibility: visible; transform: translateY(0); }

        .nav-right { display: flex; align-items: center; gap: 10px; }
        .nav-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 16px; border-radius: 999px;
          font-size: 13px; font-weight: 600;
          border: 1px solid rgba(255,255,255,.15); cursor: pointer; text-decoration: none;
          background: transparent; color: rgba(255,255,255,.7);
          transition: transform .14s ease, background .15s ease, color .15s ease;
        }
        .nav-btn:hover { background: rgba(255,255,255,.1); color: #fff; transform: translateY(-1px); }
        .learn-more { position: relative; }
        .learn-more-trigger svg { transition: transform .14s ease; }
        .learn-more-trigger[aria-expanded="true"] {
          background: rgba(255,255,255,.12);
          color: #fff;
        }
        .learn-more-trigger[aria-expanded="true"] svg { transform: rotate(180deg); }
        .learn-more-menu {
          position: absolute; top: calc(100% + 14px); right: 0; z-index: 60;
          width: min(268px, calc(100vw - 32px));
          padding: 10px; border-radius: 16px;
          background: rgba(11,15,30,.97);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,.14);
          box-shadow: 0 24px 60px rgba(0,0,0,.5);
          transform-origin: top right;
          animation: learnMoreMenuIn .22s cubic-bezier(.22,.9,.32,1) both;
        }
        /* A faint dashed ring drifting slowly behind the panel — the same
           orbit motif as the brand mark and the knowledge map, just quiet
           enough not to compete with the menu items. */
        .learn-more-menu::before {
          content: ""; position: absolute; top: -52px; right: -34px; z-index: -1;
          width: 190px; height: 190px; border-radius: 50%;
          border: 1px dashed rgba(111,224,224,.22);
          pointer-events: none;
          animation: learnMoreOrbitSpin 48s linear infinite;
        }
        @keyframes learnMoreMenuIn {
          0% { opacity: 0; transform: scale(.92) translateY(-6px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes learnMoreOrbitSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .learn-more-item {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 10px 11px; border-radius: 10px;
          color: #fff; text-decoration: none;
          transition: background .14s ease;
          opacity: 0;
        }
        /* Three slightly different arrival curves so the items read as
           separate bodies swinging into place rather than one block sliding
           in — the closest a transform-only animation gets to an orbit path. */
        .learn-more-item:nth-child(1) { animation: learnMoreItemIn1 .5s cubic-bezier(.22,.9,.32,1) .02s both; }
        .learn-more-item:nth-child(2) { animation: learnMoreItemIn2 .5s cubic-bezier(.22,.9,.32,1) .10s both; }
        .learn-more-item:nth-child(3) { animation: learnMoreItemIn3 .5s cubic-bezier(.22,.9,.32,1) .18s both; }
        @keyframes learnMoreItemIn1 {
          0% { opacity: 0; transform: translate(26px,-20px) scale(.5); }
          60% { opacity: 1; transform: translate(-4px,4px) scale(1.06); }
          100% { opacity: 1; transform: translate(0,0) scale(1); }
        }
        @keyframes learnMoreItemIn2 {
          0% { opacity: 0; transform: translate(10px,-26px) scale(.5); }
          60% { opacity: 1; transform: translate(-2px,5px) scale(1.05); }
          100% { opacity: 1; transform: translate(0,0) scale(1); }
        }
        @keyframes learnMoreItemIn3 {
          0% { opacity: 0; transform: translate(-6px,-22px) scale(.5); }
          60% { opacity: 1; transform: translate(3px,4px) scale(1.05); }
          100% { opacity: 1; transform: translate(0,0) scale(1); }
        }
        .learn-more-planet {
          flex-shrink: 0; margin-top: 4px;
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--planet-color);
          box-shadow: 0 0 9px var(--planet-color);
        }
        .learn-more-item-copy { display: flex; flex-direction: column; gap: 2px; }
        .learn-more-item-title { font-size: 13px; font-weight: 700; line-height: 1.25; }
        .learn-more-item span:not(.learn-more-item-title) {
          display: block;
          color: rgba(255,255,255,.56); font-size: 11px; font-weight: 600;
        }
        .learn-more-item:hover,
        .learn-more-item:focus-visible {
          background: rgba(255,255,255,.08);
          outline: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .learn-more-menu::before { display: none; }
        }
        /* ============================================================
           Page shell & dashboard header (title, subject switcher, OT/NT toggle)
           ============================================================ */
        .page {
          max-width: 1180px; margin: 0 auto; padding: 44px 24px 88px; position: relative; z-index: 1;
          /* backwards (not both): holds the "from" state during the .08s
             delay so there's no flash-before-fade-in, but — critically —
             does NOT hold the "to" state once the animation finishes.
             "both" was leaving a resolved (non-"none") transform matrix on
             this element indefinitely via getComputedStyle, which creates a
             new containing block and silently breaks every
             position:fixed descendant (e.g. the scope-drawer modal) into
             positioning relative to .page instead of the viewport. */
          animation: dashboardPageReveal .7s cubic-bezier(.22,.72,.18,1) .08s backwards;
        }
        .page.is-new-assessment-landing {
          max-width: 1240px;
          padding-top: 54px;
        }
        .page.is-dashboard-loading {
          min-height: calc(100vh - 80px);
          display: grid;
          place-items: center;
          padding-top: 0;
          padding-bottom: 0;
        }
        @keyframes dashboardPageReveal {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: none; }
        }
        .page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; margin-bottom: 36px; flex-wrap: wrap;
        }
        .page-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 30px; font-weight: 600; line-height: 1.1;
          color: #fff; letter-spacing: .005em;
        }
        .page-title-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        /* Subject switcher — replaces the old three-tile dashboard-tabs grid
           for returning users, reclaiming that whole row. Reuses the nav's
           learn-more-menu visual language (dark panel, planet-dot rows) for
           the dropdown itself so it doesn't feel like a third pattern. */
        .subject-switcher { position: relative; }
        .subject-trigger {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 6px 12px 6px 10px; border-radius: 999px; margin-top: 2px;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16);
          color: rgba(255,255,255,.85); font: inherit; font-size: 12.5px; font-weight: 750;
          cursor: pointer; transition: background .15s ease, border-color .15s ease;
        }
        .subject-trigger:hover, .subject-trigger:focus-visible { background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.26); outline: none; }
        .subject-trigger svg { color: rgba(255,255,255,.5); }
        .subject-trigger-dot {
          width: 7px; height: 7px; border-radius: 50%;
          box-shadow: 0 0 8px currentColor;
        }
        .subject-menu { top: calc(100% + 10px); left: 0; right: auto; transform-origin: top left; }
        .subject-menu::before { left: -34px; right: auto; }
        .subject-menu-item { width: 100%; border: 0; background: transparent; cursor: pointer; }
        .subject-menu-item.is-active { background: rgba(255,255,255,.07); }
        .subject-menu-item.is-active .learn-more-item-title::after {
          content: "· current"; margin-left: 6px; font-weight: 600;
          color: rgba(255,255,255,.4); text-transform: none; letter-spacing: 0;
        }
        .page-meta {
          font-size: 13px; color: rgba(255,255,255,.45); margin-top: 5px;
          display: flex; align-items: center; gap: 6px;
        }
        .page-meta::before {
          content: ""; display: inline-block;
          width: 7px; height: 7px; border-radius: 50%;
          background: rgba(255,255,255,.25);
        }
        /* ============================================================
           Dashboard subject tabs & loading card
           ============================================================ */
        .dashboard-tabs {
          display: inline-grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px; width: 100%; max-width: 760px;
          padding: 6px; margin: -14px 0 28px;
          border: 1px solid rgba(212,160,23,.28); border-radius: 16px;
          background: rgba(255,255,255,.07); backdrop-filter: blur(14px);
          box-shadow: 0 16px 40px rgba(0,0,0,.22), 0 0 30px rgba(212,160,23,.055), inset 0 0 0 1px rgba(245,200,66,.06);
        }
        .page.is-new-assessment-landing .dashboard-tabs {
          max-width: 820px;
          margin: 0 0 28px;
        }
        .dashboard-tab {
          border: 0; border-radius: 11px; padding: 12px 14px;
          background: transparent; color: rgba(255,255,255,.62);
          display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
          cursor: pointer; font-family: inherit; text-align: left;
          transition: background .16s ease, color .16s ease, transform .14s ease;
        }
        .dashboard-tab strong {
          font-size: 13px; font-weight: 800; letter-spacing: .02em;
        }
        .dashboard-tab span {
          font-size: 11px; font-weight: 650; color: rgba(255,255,255,.38);
        }
        .dashboard-tab:hover { background: rgba(255,255,255,.08); color: #fff; transform: translateY(-1px); }
        .dashboard-tab.is-active {
          background: rgba(255,255,255,.92); color: var(--navy);
          box-shadow: 0 10px 24px rgba(0,0,0,.2);
        }
        .dashboard-tab.is-active span { color: var(--muted); }
        .dashboard-loading-card {
          position: relative;
          min-height: min(460px, 62vh); width: 100%; padding: 32px;
          display: grid; place-items: center;
          color: #fff; text-align: center;
        }
        .dashboard-loading-orbit {
          position: relative; width: 58px; height: 58px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,.18);
          box-shadow: 0 0 28px rgba(10,163,163,.16), inset 0 0 22px rgba(255,255,255,.04);
          animation: dashboardLoadingSpin 2.8s linear infinite;
        }
        .dashboard-loading-orbit::before,
        .dashboard-loading-orbit::after {
          content: ""; position: absolute; border-radius: 999px;
        }
        .dashboard-loading-orbit::before {
          width: 16px; height: 16px; left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle at 35% 30%, #fff6c9, #d4a017 58%, #8c640a);
          box-shadow: 0 0 18px rgba(212,160,23,.48);
        }
        .dashboard-loading-orbit::after {
          width: 10px; height: 10px; right: 2px; top: 24px;
          background: radial-gradient(circle at 35% 30%, #dbfffb, #0aa3a3);
          box-shadow: 0 0 14px rgba(10,163,163,.58);
        }
        .dashboard-loading-sr {
          position: absolute; width: 1px; height: 1px; overflow: hidden;
          clip: rect(0 0 0 0); white-space: nowrap;
        }
        @keyframes dashboardLoadingSpin { to { transform: rotate(1turn); } }
        /* ============================================================
           Save-results card (signed-out snapshot prompt)
           ============================================================ */
        .save-results-card {
          position: relative; overflow: hidden;
          background: rgba(255,255,255,.92);
          border: 1px solid rgba(226,232,240,.92); border-radius: 12px;
          box-shadow: 0 12px 28px rgba(0,0,0,.14);
          backdrop-filter: blur(14px);
          padding: 15px 18px; margin-bottom: 22px;
          display: grid; grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px; align-items: center;
        }
        .save-results-card::before {
          content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
          background: linear-gradient(180deg, #0aa3a3, #d4a017);
          pointer-events: none;
        }
        .save-results-graphic,
        .save-results-content,
        .save-results-actions { position: relative; z-index: 1; }
        .save-results-graphic {
          display: none;
          width: 72px; aspect-ratio: 1; border-radius: 50%;
          border: 1px solid rgba(10,163,163,.22);
          background:
            radial-gradient(circle at 50% 50%, rgba(255,246,201,.92) 0 8px, rgba(212,160,23,.95) 9px 15px, transparent 16px),
            radial-gradient(circle at 74% 28%, rgba(219,255,251,.95) 0 5px, rgba(10,163,163,.90) 6px 10px, transparent 11px),
            radial-gradient(circle at 28% 75%, rgba(255,255,255,.92) 0 4px, rgba(124,58,237,.82) 5px 8px, transparent 9px),
            rgba(255,255,255,.46);
          box-shadow: inset 0 0 30px rgba(10,163,163,.10), 0 14px 30px rgba(27,36,66,.14);
        }
        .save-results-graphic::before,
        .save-results-graphic::after {
          content: ""; position: absolute; border-radius: 50%; pointer-events: none;
        }
        .save-results-graphic::before {
          inset: 13px; border: 1px dashed rgba(10,163,163,.42);
          transform: rotate(-18deg) scaleX(1.18);
        }
        .save-results-graphic::after {
          right: -3px; bottom: 7px; width: 22px; height: 22px;
          background: #fff; border: 1px solid rgba(10,163,163,.22);
          box-shadow: 0 8px 18px rgba(27,36,66,.13);
        }
        .save-results-check {
          position: absolute; right: 3px; bottom: 14px; z-index: 2;
          width: 11px; height: 7px;
          border-left: 2px solid #0a6e6e; border-bottom: 2px solid #0a6e6e;
          transform: rotate(-45deg);
        }
        .save-results-kicker {
          display: inline-flex; align-items: center; gap: 7px;
          color: #0a6e6e; font-size: 10px; font-weight: 900;
          letter-spacing: .11em; text-transform: uppercase;
          margin-bottom: 4px;
        }
        .save-results-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 22px; font-weight: 650; line-height: 1.08;
          color: var(--navy); margin-bottom: 4px;
        }
        .save-results-copy {
          color: var(--muted); font-size: 12.5px; line-height: 1.45;
          max-width: 720px;
        }
        .save-results-actions {
          display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
        }
        .save-results-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          border: none; border-radius: 999px; padding: 10px 16px;
          background: var(--navy);
          color: #fff; font-family: inherit; font-size: 12.5px; font-weight: 850;
          cursor: pointer; box-shadow: 0 10px 22px rgba(27,36,66,.24);
          transition: transform .13s ease, box-shadow .15s ease;
          white-space: nowrap;
        }
        .save-results-btn:hover { transform: translateY(-1px); box-shadow: 0 14px 28px rgba(27,36,66,.30); }
        .save-results-note {
          font-size: 11px; color: rgba(86,96,112,.76); font-weight: 650;
          text-align: right;
        }
        @keyframes saveResultsGlow { to { transform: rotate(1turn); } }
        /* ============================================================
           First-assessment card & feature grid
           ============================================================ */
        .first-assessment-card {
          position: relative; overflow: hidden;
          display: grid; grid-template-columns: minmax(280px, 420px) minmax(0, 1fr);
          gap: 34px; align-items: center;
          min-height: 430px; padding: 38px;
          color: #fff;
          background:
            radial-gradient(circle at 21% 38%, rgba(255,214,92,.36), transparent 36%),
            radial-gradient(circle at 76% 18%, rgba(229,173,35,.28), transparent 34%),
            radial-gradient(circle at 88% 74%, rgba(10,163,163,.16), transparent 35%),
            linear-gradient(145deg, rgba(79,58,17,.74), rgba(37,31,27,.70) 44%, rgba(10,22,38,.78));
          border: 1px solid rgba(245,200,66,.48); border-radius: 22px;
          box-shadow: 0 30px 90px rgba(0,0,0,.28), 0 0 58px rgba(212,160,23,.18), inset 0 0 82px rgba(255,220,126,.10), inset 0 0 0 1px rgba(255,237,171,.12);
          backdrop-filter: blur(18px);
        }
        .first-assessment-card::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background-image:
            radial-gradient(circle, rgba(255,255,255,.78) 0 1px, transparent 1.4px),
            radial-gradient(circle, rgba(255,255,255,.38) 0 1px, transparent 1.5px);
          background-size: 92px 92px, 137px 137px;
          background-position: 10px 18px, 42px 56px;
          opacity: .55;
        }
        .first-assessment-orbit,
        .first-assessment-content { position: relative; z-index: 1; }
        .first-assessment-orbit {
          width: min(100%, 380px); aspect-ratio: 1; border-radius: 999px;
          border: 1px dashed rgba(255,255,255,.24);
          margin: 0 auto;
          background: radial-gradient(circle at 50% 50%, rgba(212,160,23,.10), transparent 38%);
        }
        .first-assessment-orbit::before,
        .first-assessment-orbit::after {
          content: ""; position: absolute; border-radius: 999px; pointer-events: none;
        }
        .first-assessment-orbit::before {
          inset: 56px; border: 1px dashed rgba(10,163,163,.34);
          transform: rotate(-22deg) scaleX(1.18);
        }
        .first-assessment-orbit::after {
          inset: 110px; border: 1px solid rgba(255,255,255,.14);
          transform: rotate(18deg) scaleX(1.42);
        }
        .first-assessment-sun,
        .first-assessment-planet,
        .first-assessment-moon {
          position: absolute; display: block; border-radius: 999px;
          box-shadow: 0 0 34px currentColor;
        }
        .first-assessment-sun {
          width: 102px; height: 102px; left: 50%; top: 50%;
          color: rgba(212,160,23,.72);
          background: radial-gradient(circle at 38% 38%, #fff2b8, #d4a017 45%, #91680e);
          transform: translate(-50%, -50%);
        }
        .first-assessment-planet {
          width: 56px; height: 56px; left: 73%; top: 35%;
          color: rgba(10,163,163,.58);
          background: radial-gradient(circle at 36% 34%, #d6fffa, #0aa3a3 48%, #075e61);
        }
        .first-assessment-moon {
          width: 24px; height: 24px; left: 82%; top: 52%;
          color: rgba(255,255,255,.38);
          background: radial-gradient(circle at 38% 38%, #fff, #cfd6df 55%, #7f8b99);
        }
        .first-assessment-kicker {
          margin-bottom: 11px; color: #5eead4;
          font-size: 12px; font-weight: 900; letter-spacing: .13em; text-transform: uppercase;
        }
        .first-assessment-content h2 {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(36px, 5vw, 58px); line-height: .98; font-weight: 700;
          max-width: 520px; margin-bottom: 16px;
        }
        .first-assessment-content p {
          max-width: 560px; color: rgba(255,255,255,.76);
          font-size: 16px; line-height: 1.65; margin-bottom: 24px;
        }
        .first-assessment-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .first-assessment-primary,
        .first-assessment-secondary {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          min-height: 44px; padding: 12px 18px; border-radius: 999px;
          font-size: 14px; font-weight: 850; text-decoration: none;
          font-family: inherit; cursor: pointer;
        }
        .first-assessment-primary {
          border: 0;
          background: #e6ad12; color: #141827;
          box-shadow: 0 14px 34px rgba(230,173,18,.28);
        }
        .first-assessment-secondary {
          border: 1px solid rgba(255,255,255,.24); color: rgba(255,255,255,.88);
          background: rgba(255,255,255,.06);
        }
        .first-assessment-choice-panel {
          margin-top: 18px; width: min(100%, 540px);
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
          animation: firstAssessmentChoiceIn .2s ease both;
        }
        .first-assessment-choice {
          display: grid; gap: 5px; min-height: 92px;
          padding: 16px; border-radius: 14px;
          text-decoration: none; color: #fff;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.075);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.035);
          transition: transform .14s ease, border-color .14s ease, background .14s ease;
        }
        .first-assessment-choice:hover,
        .first-assessment-choice:focus-visible {
          transform: translateY(-2px);
          border-color: rgba(230,173,18,.48);
          background: rgba(255,255,255,.11);
          outline: none;
        }
        .first-assessment-choice strong {
          font-size: 14px; font-weight: 900;
        }
        .first-assessment-choice span {
          color: rgba(255,255,255,.62);
          font-size: 12px; line-height: 1.35; font-weight: 650;
        }
        @keyframes firstAssessmentChoiceIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .first-assessment-steps {
          display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
          margin-top: 28px; color: rgba(255,255,255,.68);
          font-size: 12px; font-weight: 850; text-transform: uppercase; letter-spacing: .08em;
        }
        .first-assessment-steps span {
          padding: 7px 10px; border-radius: 999px;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.13);
        }
        .oba-feature-grid {
          display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px; margin-top: 34px;
        }
        .oba-feature-card {
          position: relative; overflow: hidden;
          min-height: 238px; padding: 20px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,.16);
          background:
            linear-gradient(145deg, rgba(255,255,255,.94), rgba(240,247,251,.88));
          box-shadow: 0 18px 52px rgba(0,0,0,.22), inset 0 0 34px rgba(255,255,255,.42);
          backdrop-filter: blur(16px);
          color: var(--navy);
        }
        .oba-feature-card::before {
          content: ""; position: absolute; inset: -35% -20% auto auto;
          width: 180px; height: 180px; border-radius: 999px;
          background: color-mix(in srgb, var(--feature-hue) 22%, transparent);
          filter: blur(4px); pointer-events: none;
        }
        .oba-feature-graphic {
          position: relative; height: 88px; margin-bottom: 15px;
          border-radius: 14px;
          background:
            radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--feature-hue) 18%, transparent), transparent 58%),
            rgba(27,36,66,.045);
          border: 1px solid rgba(27,36,66,.08);
        }
        .oba-feature-graphic span {
          position: absolute; display: block;
        }
        .oba-feature-graphic.is-signal .signal-node {
          width: 16px; height: 16px; border-radius: 999px;
          background: var(--feature-hue);
          box-shadow: 0 0 0 7px color-mix(in srgb, var(--feature-hue) 16%, transparent), 0 0 24px color-mix(in srgb, var(--feature-hue) 40%, transparent);
        }
        .oba-feature-graphic.is-signal .signal-node:nth-child(1) { left: 18%; top: 54%; }
        .oba-feature-graphic.is-signal .signal-node:nth-child(2) { left: 46%; top: 26%; }
        .oba-feature-graphic.is-signal .signal-node:nth-child(3) { left: 72%; top: 50%; }
        .oba-feature-graphic.is-signal .signal-line {
          height: 2px; width: 34%; left: 28%; top: 46%;
          background: linear-gradient(90deg, transparent, var(--feature-hue), transparent);
          transform: rotate(-22deg);
        }
        .oba-feature-graphic.is-signal .signal-line:nth-child(5) {
          left: 53%; top: 43%; width: 26%; transform: rotate(18deg);
        }
        .oba-feature-graphic.is-map .map-orbit {
          inset: 16px 31%; border-radius: 999px;
          border: 1.5px dashed color-mix(in srgb, var(--feature-hue) 46%, transparent);
          transform: rotate(-13deg) scaleX(1.55);
        }
        .oba-feature-graphic.is-map .map-star {
          width: 34px; height: 34px; left: 42%; top: 28%;
          border-radius: 999px;
          background: radial-gradient(circle at 35% 30%, #fff7c9, var(--feature-hue) 58%, #8c640a);
          box-shadow: 0 0 24px color-mix(in srgb, var(--feature-hue) 48%, transparent);
        }
        .oba-feature-graphic.is-map .map-planet {
          width: 18px; height: 18px; left: 67%; top: 48%;
          border-radius: 999px; background: #0aa3a3;
          box-shadow: 0 0 16px rgba(10,163,163,.45);
        }
        .oba-feature-graphic.is-path .path-step {
          width: 22px; height: 22px; border-radius: 7px;
          border: 2px solid var(--feature-hue);
          background: color-mix(in srgb, var(--feature-hue) 15%, #ffffff);
        }
        .oba-feature-graphic.is-path .path-step:nth-child(1) { left: 16%; top: 48%; opacity: .58; }
        .oba-feature-graphic.is-path .path-step:nth-child(2) { left: 42%; top: 34%; opacity: .8; }
        .oba-feature-graphic.is-path .path-step:nth-child(3) { left: 68%; top: 22%; background: var(--feature-hue); }
        .oba-feature-graphic.is-path .path-line {
          height: 2px; width: 58%; left: 23%; top: 45%;
          background: linear-gradient(90deg, color-mix(in srgb, var(--feature-hue) 32%, transparent), var(--feature-hue));
          transform: rotate(-15deg);
        }
        .oba-feature-kicker {
          margin: 0 0 7px; color: color-mix(in srgb, var(--feature-hue) 72%, #17213d);
          font-size: 10px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase;
        }
        .oba-feature-title {
          margin: 0; font-family: var(--font-crimson), Georgia, serif;
          font-size: 22px; line-height: 1.05; color: var(--navy);
        }
        .oba-feature-copy {
          margin: 8px 0 0; color: rgba(57,67,87,.78);
          font-size: 13px; line-height: 1.5; font-weight: 650;
        }
        /* ============================================================
           Placeholder dashboard (Church History / Biblical Languages)
           ============================================================ */
        .placeholder-dashboard {
          background: var(--card); border: 1px solid var(--border); border-radius: 20px;
          box-shadow: var(--shadow); backdrop-filter: blur(16px);
          padding: 44px 46px; min-height: 420px;
          display: grid; grid-template-columns: 1fr 240px; gap: 32px; align-items: center;
        }
        .placeholder-eyebrow {
          font-size: 12px; font-weight: 850; letter-spacing: .13em; text-transform: uppercase;
          color: #0a6e6e; margin-bottom: 12px;
        }
        .placeholder-title {
          font-family: var(--font-crimson), Georgia, serif; font-size: 36px; line-height: 1.04;
          color: var(--navy); margin-bottom: 14px;
        }
        .placeholder-copy { color: var(--muted); font-size: 15px; line-height: 1.65; max-width: 560px; }
        .placeholder-list { display: grid; gap: 10px; margin-top: 24px; }
        .placeholder-pill {
          width: fit-content; padding: 9px 13px; border-radius: 999px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          color: #0a6e6e; font-size: 12px; font-weight: 800;
        }
        .placeholder-orbit {
          width: 220px; aspect-ratio: 1; border-radius: 999px; position: relative;
          border: 1px solid rgba(10,163,163,.22);
          background: radial-gradient(circle, rgba(255,255,255,.85) 0 18%, rgba(10,163,163,.12) 19% 46%, transparent 47%);
          box-shadow: inset 0 0 42px rgba(10,163,163,.13), 0 18px 42px rgba(27,36,66,.12);
        }
        .placeholder-orbit::before,
        .placeholder-orbit::after {
          content: ""; position: absolute; inset: 24px; border-radius: inherit;
          border: 1px solid rgba(27,36,66,.12); transform: rotate(-18deg) scaleX(1.28);
        }
        .placeholder-orbit::after {
          inset: 54px; border-color: rgba(212,160,23,.32); transform: rotate(28deg) scaleX(1.42);
        }
        /* No card here on purpose — the score sits straight on the
           starfield, like the header-assess controls above it. */
        /* ============================================================
           Score strip: combined-BLI note & score/level/confidence blocks
           ============================================================ */
        .score-strip {
          display: grid; grid-template-columns: auto 1fr auto;
          background: transparent; border: 1px solid rgba(212,160,23,.4); border-radius: 14px;
          box-shadow: none;
          overflow: visible;
          margin-bottom: 28px; position: relative; z-index: 40;
        }
        .score-block, .level-block, .conf-block { animation: scoreTabIn .35s ease both; }
        @keyframes scoreTabIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: none; }
        }
        /* Combined BLI used to be a third tab alongside OT/NT in its own
           row; now that the header's OT/NT toggle drives this panel
           directly, Combined isn't something you "switch to" (there's no
           combined assessment) — it's a standing fact shown alongside
           whichever testament is active. */
        .combined-note {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 14px; color: rgba(255,255,255,.6);
          font-size: 12.5px; font-weight: 650;
        }
        .combined-note strong { color: #fff; font-weight: 800; }
        .combined-note-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #0aa3a3; box-shadow: 0 0 8px rgba(10,163,163,.7);
          flex-shrink: 0;
        }
        /* ============================================================
           Progress-over-time panel
           ============================================================ */
        .progress-card {
          position: relative; z-index: 3; overflow: hidden;
          margin: 0 0 18px; padding: 24px 26px 20px;
          color: var(--navy); background: var(--card);
          border: 1px solid var(--border); border-radius: 20px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(16px);
        }
        .progress-panel {
          margin: -10px 0 30px;
          animation: knowledgeProfileIn .22s cubic-bezier(.22,.72,.18,1) both;
        }
        .progress-card::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(circle at 14% 26%, rgba(10,163,163,.12), transparent 28%),
            radial-gradient(circle at 86% 18%, rgba(212,160,23,.10), transparent 30%);
          opacity: .9;
        }
        .progress-head {
          position: relative; z-index: 1;
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 22px; margin-bottom: 18px;
        }
        .progress-eyebrow {
          margin-bottom: 5px; color: #0a6e6e;
          font-size: 10px; font-weight: 850; letter-spacing: .13em;
          text-transform: uppercase;
        }
        .progress-title {
          color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 25px; font-weight: 650; line-height: 1.1;
        }
        .progress-sub {
          max-width: 500px; margin-top: 5px;
          color: var(--muted); font-size: 12.5px; line-height: 1.45;
        }
        .progress-controls { display: flex; align-items: center; gap: 13px; }
        .progress-tabs {
          display: inline-grid; grid-template-columns: repeat(2, 1fr); padding: 3px;
          border: 1px solid rgba(27,36,66,.10); border-radius: 999px;
          background: rgba(27,36,66,.055);
        }
        .progress-tab {
          min-width: 48px; border: 0; border-radius: 999px; padding: 7px 11px;
          color: var(--muted); background: transparent;
          font: inherit; font-size: 11px; font-weight: 800; cursor: pointer;
        }
        .progress-tab:hover, .progress-tab:focus-visible { color: var(--navy); outline: none; }
        .progress-tab.is-active {
          color: #fff; background: var(--accent); box-shadow: 0 3px 10px rgba(10,163,163,.20);
        }
        .progress-latest {
          min-width: 66px; text-align: right;
          color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 27px; font-weight: 700; line-height: 1;
        }
        .progress-latest span {
          display: block; margin-top: 3px; color: var(--muted);
          font-family: var(--font-inter), system-ui, sans-serif; font-size: 9px;
          font-weight: 750; letter-spacing: .10em; text-transform: uppercase;
        }
        .progress-chart-shell {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 34px minmax(0,1fr); gap: 9px;
        }
        .progress-axis {
          height: 174px; display: flex; flex-direction: column;
          justify-content: space-between; padding: 3px 0 2px;
          color: rgba(27,36,66,.60); font-size: 11.5px; font-weight: 800;
          text-align: right; letter-spacing: .02em;
        }
        .progress-chart-scroll {
          min-width: 0; overflow-x: auto; overflow-y: hidden;
          /* The native scrollbar here fades in/out on hover/scroll (most
             visibly on macOS), which right under the x-axis reads as the
             chart itself flickering. Scrolling (drag/swipe/trackpad) still
             works; it just never paints a visible track. */
          scrollbar-width: none;
        }
        .progress-chart-scroll::-webkit-scrollbar { display: none; }
        .progress-chart {
          position: relative; min-width: 620px; height: 174px;
          margin-bottom: 24px;
        }
        .progress-xaxis {
          position: absolute; top: 100%; left: 0; right: 0; height: 22px;
          pointer-events: none;
        }
        .progress-xaxis span {
          position: absolute; top: 7px; transform: translateX(-50%);
          color: rgba(86,96,112,.78); font-size: 10.5px; font-weight: 750;
          letter-spacing: .04em; white-space: nowrap;
        }
        .progress-xaxis span:first-child { transform: translateX(-20%); }
        .progress-xaxis span:last-child { transform: translateX(-80%); }
        .progress-chart svg {
          position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible;
        }
        .progress-guide {
          stroke: rgba(27,36,66,.14); stroke-width: 1; vector-effect: non-scaling-stroke;
          stroke-dasharray: 3 5;
        }
        .progress-line-glow {
          fill: none; stroke: rgba(10,163,163,.20); stroke-width: 8;
          stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke;
        }
        .progress-area { fill: url(#progressArea); }
        .progress-line {
          fill: none; stroke: url(#progressStroke); stroke-width: 2.4;
          stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke;
        }
        .progress-line-flow {
          fill: none; stroke: rgba(255,255,255,.85); stroke-width: 1.6;
          stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke;
          stroke-dasharray: 2.5 13.5;
          animation: progressFlow 3.2s linear infinite;
          opacity: .55;
        }
        @keyframes progressFlow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -16; }
        }
        .progress-point {
          position: absolute; width: 8px; height: 8px; padding: 0;
          transform: translate(-50%,-50%); border-radius: 50%;
          border: 1px solid rgba(10,163,163,.38); background: #fff;
          box-shadow: inset 0 0 4px rgba(111,218,221,.9), 0 0 8px rgba(111,218,221,.4);
          cursor: pointer; transition: transform .16s cubic-bezier(.34,1.56,.64,1), background .16s ease, box-shadow .16s ease;
        }
        .progress-point:hover, .progress-point:focus-visible, .progress-point.is-active {
          transform: translate(-50%,-50%) scale(1.7);
          background: #f5c842; border-color: #fff8d6;
          box-shadow: 0 0 0 4px rgba(245,200,66,.16), 0 0 18px rgba(245,200,66,.6);
          outline: none;
        }
        .progress-point.is-latest {
          width: 10px; height: 10px;
          background: #f5c842; border-color: #fff8d6;
          box-shadow: 0 0 12px rgba(245,200,66,.7), 0 0 26px rgba(245,200,66,.35);
        }
        .progress-point.is-latest::after {
          content: ""; position: absolute; inset: -3px; border-radius: 50%;
          border: 1.5px solid rgba(245,200,66,.65);
          animation: progressRadar 2.2s ease-out infinite;
        }
        @keyframes progressRadar {
          0% { transform: scale(1); opacity: .9; }
          100% { transform: scale(3.2); opacity: 0; }
        }
        .progress-detail {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: minmax(150px,1.2fr) repeat(3,minmax(80px,.65fr)) auto;
          gap: 14px; align-items: center; margin-top: 14px; padding-top: 15px;
          border-top: 1px solid rgba(27,36,66,.10);
        }
        .progress-detail-primary strong {
          display: block; color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 20px; line-height: 1.1;
        }
        .progress-detail-primary span,
        .progress-stat span {
          display: block; margin-top: 4px; color: var(--muted);
          font-size: 9px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase;
        }
        .progress-stat strong { color: var(--navy); font-size: 13px; font-weight: 750; }
        .progress-review-link {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 34px; padding: 0 13px; border-radius: 999px;
          border: 1px solid var(--accent-line);
          background: var(--accent-dim); color: #0a6e6e;
          font-size: 11px; font-weight: 800; text-decoration: none; white-space: nowrap;
          transition: background .15s ease, border-color .15s ease;
        }
        .progress-review-link:hover, .progress-review-link:focus-visible {
          background: var(--navy); border-color: var(--navy); color: #fff;
          outline: none;
        }
        .progress-note {
          position: relative; z-index: 1; margin-top: 13px;
          color: rgba(86,96,112,.74); font-size: 10.5px; line-height: 1.4;
        }
        .progress-empty {
          position: relative; z-index: 1; min-height: 132px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; color: var(--muted);
        }
        .progress-empty strong {
          color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 20px; font-weight: 650;
        }
        .progress-empty span { max-width: 420px; margin-top: 6px; font-size: 12px; line-height: 1.5; }
        .progress-error { color: #b4402f; }
        /* ============================================================
           Score strip continued: score number, BLI/level tooltips, verse of day
           ============================================================ */
        .score-block {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 30px 40px; gap: 6px; border-right: 1px solid rgba(255,255,255,.12);
          position: relative; z-index: 2;
        }
        /* Bold, solid numerals straight on the starfield — no card, no
           outline. The per-testament accent (gold/purple/teal) shows up as
           a quiet glow and carries over to the level pill beside it, so
           color-coding survives without the number itself needing to be
           anything but plain, confident text. */
        .score-number {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 64px; font-weight: 700; line-height: 1;
          letter-spacing: -.02em; user-select: none;
          color: rgba(255,255,255,.22);
          transition: color .4s ease, text-shadow .4s ease;
        }
        .score-block.has-score .score-number {
          color: #fff;
          text-shadow:
            0 2px 18px rgba(0,0,0,.5),
            0 0 26px color-mix(in srgb, var(--score-accent, var(--accent)) 45%, transparent);
        }
        .score-label-row {
          position: relative;
          display: inline-flex; align-items: center; justify-content: center;
          gap: 6px;
        }
        .bli-info-btn {
          width: 18px; height: 18px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,.22);
          background: rgba(255,255,255,.06); color: rgba(255,255,255,.7);
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; line-height: 1;
          cursor: pointer; font-family: inherit;
        }
        .bli-info-btn:hover, .bli-info-btn:focus-visible {
          border-color: rgba(255,255,255,.4); color: #fff; outline: none;
          background: rgba(255,255,255,.12);
        }
        .bli-tooltip {
          position: absolute; top: 28px; left: 50%; transform: translateX(-50%);
          width: min(320px, calc(100vw - 48px));
          background: rgba(14,18,38,.98); color: rgba(255,255,255,.86);
          border: 1px solid rgba(255,255,255,.14); border-radius: 12px;
          box-shadow: 0 12px 34px rgba(0,0,0,.5); padding: 14px 15px;
          text-align: left; z-index: 80;
          font-size: 12.5px; line-height: 1.55; font-weight: 500;
          letter-spacing: 0; text-transform: none; text-decoration: none;
          display: none; opacity: 0; visibility: hidden; pointer-events: none;
          transition: opacity .12s ease, visibility .12s ease;
        }
        .score-label-row:hover .bli-tooltip,
        .score-label-row:focus-within .bli-tooltip,
        .bli-tooltip.is-open {
          display: block; opacity: 1; visibility: visible; pointer-events: auto;
        }
        .bli-tooltip::before {
          content: ""; position: absolute; top: -6px; left: 50%;
          width: 12px; height: 12px; transform: translateX(-50%) rotate(45deg);
          background: rgba(14,18,38,.98); border-left: 1px solid rgba(255,255,255,.14); border-top: 1px solid rgba(255,255,255,.14);
        }
        .bli-tooltip span {
          display: inline-flex; margin-top: 8px;
          color: color-mix(in srgb, var(--score-accent, var(--accent)) 70%, #fff);
          font-weight: 700; text-decoration: none;
        }
        .bli-tooltip:hover span { text-decoration: underline; }
        .level-block {
          padding: 30px 32px;
          display: flex; flex-direction: column; justify-content: center; gap: 10px;
        }
        .level-badge-empty {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.18);
          border-radius: 999px; padding: 5px 13px;
          font-size: 12px; font-weight: 700; color: rgba(255,255,255,.6);
          letter-spacing: .05em; text-transform: uppercase; width: fit-content;
        }
        .level-badge-empty::before {
          content: ""; width: 7px; height: 7px;
          border-radius: 50%; background: rgba(255,255,255,.3);
        }
        .level-desc-empty {
          font-size: 14.5px; line-height: 1.6; color: rgba(255,255,255,.55); max-width: 420px;
        }
        .level-desc-empty strong { color: #fff; }
        /* Verse of the day fills the same middle column once a score
           exists — see lib/verseOfTheDay.ts for the (deterministic,
           public-domain KJV) rotation. */
        .verse-of-day {
          margin: 0; max-width: 380px; align-self: center; text-align: center;
        }
        .verse-of-day-kicker {
          margin: 0 0 11px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          font-size: 10.5px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase;
          color: var(--score-accent, var(--accent));
        }
        .verse-of-day-kicker::before,
        .verse-of-day-kicker::after {
          content: ""; width: 15px; height: 1px;
          background: color-mix(in srgb, var(--score-accent, var(--accent)) 70%, transparent);
        }
        .verse-of-day-text {
          margin: 0; padding: 0; border: 0;
          font-family: var(--font-crimson), Georgia, serif;
          font-style: italic; font-weight: 500;
          font-size: 16.5px; line-height: 1.56;
          color: rgba(255,255,255,.90);
        }
        .verse-of-day-ref {
          margin: 12px 0 0; padding: 0;
          font-family: var(--font-inter), system-ui, sans-serif;
          font-style: normal; font-size: 11.5px; font-weight: 750;
          letter-spacing: .03em; color: rgba(255,255,255,.5);
        }
        .verse-of-day-ref::before { content: "— "; }
        /* Same slot as the verse of the day, swapped in for a brand-new
           signed-out result — deliberately just the two lines, no card,
           no graphic. See .save-results-card below for the fuller version
           of this same prompt shown elsewhere on the page. */
        .save-progress-mini {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          align-self: center; text-align: center;
        }
        .save-progress-mini-text {
          margin: 0; color: rgba(255,255,255,.75);
          font-size: 13px; font-weight: 750; letter-spacing: .02em;
        }
        .save-progress-mini-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 20px; border-radius: 999px; border: 0; cursor: pointer;
          background: var(--score-accent, var(--accent)); color: #16110a;
          font: inherit; font-size: 12.5px; font-weight: 850;
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .save-progress-mini-btn:hover, .save-progress-mini-btn:focus-visible {
          transform: translateY(-1px); box-shadow: 0 10px 22px rgba(0,0,0,.32); outline: none;
        }
        .level-label-row {
          position: relative; display: inline-flex; align-items: center; gap: 8px;
          width: fit-content; min-height: 28px;
        }
        /* The level pill is the one place the per-testament accent still
           shows up as color (gold/purple/teal) now that the numeral itself
           is plain white — a tinted chip on dark reads cleanly without the
           "outlined balloon" look the numeral used to have. */
        .level-badge-btn {
          cursor: pointer; font-family: inherit;
          background: color-mix(in srgb, var(--score-accent, var(--accent)) 16%, transparent);
          border-color: color-mix(in srgb, var(--score-accent, var(--accent)) 45%, transparent);
          color: var(--score-accent, var(--accent));
          transition: background .15s ease, border-color .15s ease, box-shadow .15s ease;
        }
        .level-badge-btn::before {
          background: var(--score-accent, var(--accent));
        }
        .level-badge-btn:hover, .level-badge-btn:focus-visible {
          background: color-mix(in srgb, var(--score-accent, var(--accent)) 26%, transparent);
          border-color: color-mix(in srgb, var(--score-accent, var(--accent)) 65%, transparent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--score-accent, var(--accent)) 16%, transparent);
          outline: none;
        }
        .level-tooltip {
          position: absolute; top: calc(100% + 10px); left: 0;
          width: min(320px, calc(100vw - 48px));
          background: rgba(14,18,38,.98); color: rgba(255,255,255,.86);
          border: 1px solid rgba(255,255,255,.14); border-radius: 12px;
          box-shadow: 0 12px 34px rgba(0,0,0,.5); padding: 14px 15px;
          text-align: left; z-index: 80;
          font-size: 13.5px; line-height: 1.6; font-weight: 500;
          letter-spacing: 0; text-transform: none; text-decoration: none;
          display: none; opacity: 0; visibility: hidden; pointer-events: none;
          transition: opacity .12s ease, visibility .12s ease;
        }
        .level-tooltip.is-open {
          display: block; opacity: 1; visibility: visible; pointer-events: auto;
        }
        .level-tooltip::before {
          content: ""; position: absolute; top: -6px; left: 20px;
          width: 12px; height: 12px; transform: rotate(45deg);
          background: rgba(14,18,38,.98); border-left: 1px solid rgba(255,255,255,.14); border-top: 1px solid rgba(255,255,255,.14);
        }
        .level-tooltip span {
          display: inline-flex; margin-top: 8px;
          color: color-mix(in srgb, var(--score-accent, var(--accent)) 70%, #fff);
          font-weight: 700; text-decoration: none;
        }
        .level-tooltip:hover span { text-decoration: underline; }
        /* ============================================================
           Knowledge cone panel (water-slosh visual, tier popovers)
           ============================================================ */
        .knowledge-cone-card {
          position: relative; z-index: 1;
          background: rgba(255,255,255,.94); border: 1px solid var(--border);
          border-radius: 20px; box-shadow: var(--shadow);
          backdrop-filter: blur(16px); padding: 28px 32px 30px;
          margin-bottom: 18px; overflow: visible;
        }
        .knowledge-cone-panel {
          margin: -10px 0 30px;
          animation: knowledgeProfileIn .22s cubic-bezier(.22,.72,.18,1) both;
        }
        .knowledge-cone-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 18px; margin-bottom: 22px;
        }
        .knowledge-cone-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 25px; font-weight: 650; color: var(--navy); line-height: 1.1;
        }
        .knowledge-cone-sub { font-size: 13px; color: var(--muted); margin-top: 5px; }
        .knowledge-cone-score {
          display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
          color: var(--navy); font-weight: 700; font-size: 28px;
          font-family: var(--font-crimson), Georgia, serif;
        }
        .knowledge-cone-score span {
          font-family: var(--font-inter), system-ui, sans-serif; font-size: 10px;
          letter-spacing: .10em; text-transform: uppercase; color: var(--muted);
        }
        .knowledge-cone-wrap {
          position: relative; min-height: 440px;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          perspective: 900px;
        }
        .knowledge-cone {
          position: relative; width: min(560px, 100%); height: 378px;
          transform: rotateX(7deg);
          filter: drop-shadow(0 34px 42px rgba(27,36,66,.38)) drop-shadow(0 13px 24px rgba(10,163,163,.22));
        }
        .glass-vessel {
          position: absolute; inset: 0;
          clip-path: polygon(1% 0, 99% 0, 74.5% 100%, 25.5% 100%);
          background:
            linear-gradient(90deg, rgba(255,255,255,.55), rgba(255,255,255,.12) 28%, rgba(255,255,255,.28) 50%, rgba(27,36,66,.10) 100%),
            linear-gradient(180deg, rgba(255,255,255,.20), rgba(10,163,163,.06));
          border: 1px solid rgba(255,255,255,.58);
          box-shadow:
            inset 20px 0 34px rgba(255,255,255,.36),
            inset -22px 0 34px rgba(27,36,66,.28),
            inset 0 -28px 40px rgba(8,74,104,.24),
            inset 0 0 0 1px rgba(27,36,66,.12);
          overflow: hidden; z-index: 1;
        }
        .glass-vessel::before {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 0 16%, rgba(255,255,255,.42) 18%, transparent 25% 100%);
          pointer-events: none;
        }
        .glass-vessel::after {
          content: ""; position: absolute; left: 1%; right: 1%; top: -9px; height: 24px;
          border-radius: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,.70), rgba(255,255,255,.10));
          border: 1px solid rgba(255,255,255,.56);
          box-shadow: 0 10px 22px rgba(27,36,66,.26), inset 0 -3px 10px rgba(27,36,66,.16);
          pointer-events: none;
        }
        .water-fill {
          position: absolute; left: 0; right: 0; bottom: 0;
          height: var(--water-level);
          background:
            linear-gradient(112deg, rgba(255,255,255,.18) 0%, transparent 24% 62%, rgba(255,255,255,.12) 100%),
            linear-gradient(180deg, rgba(189,248,255,.68) 0%, rgba(55,197,213,.72) 50%, rgba(18,123,154,.80) 100%);
          box-shadow:
            inset 18px 0 26px rgba(255,255,255,.22),
            inset -20px 0 34px rgba(8,74,104,.32),
            inset 0 22px 36px rgba(255,255,255,.36),
            inset 0 -30px 42px rgba(8,74,104,.42),
            0 -12px 34px rgba(10,163,163,.30),
            0 0 0 1px rgba(255,255,255,.22);
          animation: waterRise 6.4s cubic-bezier(.18,.76,.12,1) both;
          transform-origin: bottom;
          transform: skewX(calc(var(--slosh-x, 0) * -2.6deg)) translateX(calc(var(--slosh-x, 0) * -1.8%));
          will-change: transform;
          z-index: 3;
        }
        .water-fill::before {
          content: ""; position: absolute; left: -9%; right: -9%; top: -15px; height: 30px;
          border-radius: 46% 54% 50% 50% / 55% 55% 45% 45%;
          background:
            linear-gradient(90deg, rgba(255,255,255,.14), rgba(255,255,255,.74), rgba(255,255,255,.16)),
            radial-gradient(ellipse, rgba(217,251,255,.96), rgba(82,205,224,.68) 56%, rgba(82,205,224,0) 75%);
          filter: blur(.12px);
          transform-origin: 50% 50%;
          translate: calc(var(--slosh-x, 0) * -7%) calc(var(--slosh-x2, 0) * 5px);
          rotate: calc(var(--slosh-x, 0) * -6.5deg + var(--slosh-x2, 0) * -1.6deg);
          scale: calc(1 + var(--slosh-amp, 0) * .09) calc(1 - var(--slosh-amp, 0) * .11);
          will-change: translate, rotate, scale;
          animation: waterSurface 6.4s cubic-bezier(.18,.76,.12,1) both, surfaceMorph 5.2s ease-in-out infinite;
        }
        .water-fill::after {
          content: ""; position: absolute; inset: 0;
          background:
            linear-gradient(112deg, transparent 0 30%, rgba(255,255,255,.22) 41%, transparent 53% 100%),
            radial-gradient(ellipse at 50% 18%, rgba(255,255,255,.16), transparent 50%);
          mix-blend-mode: screen;
          opacity: .42;
          animation: internalSheen 6.2s ease-in-out infinite;
          pointer-events: none;
        }
        .water-wave {
          position: absolute; left: -18%; width: 136%; height: 34px;
          top: -17px; overflow: hidden; border-radius: 999px;
          pointer-events: none; mix-blend-mode: screen; opacity: .55;
          transform-origin: 50% 50%;
        }
        .water-wave::before {
          content: ""; position: absolute; left: 50%; top: var(--wave-top, -92px);
          width: var(--wave-size, 220px); height: var(--wave-size, 220px);
          border-radius: 43% 57% 46% 54% / 56% 44% 56% 44%;
          background:
            radial-gradient(circle at 35% 32%, rgba(255,255,255,.72), transparent 0 9%, rgba(255,255,255,0) 17%),
            radial-gradient(circle at 62% 66%, rgba(255,255,255,.30), transparent 0 12%, rgba(255,255,255,0) 22%),
            linear-gradient(135deg, rgba(217,251,255,.70), rgba(82,205,224,.28) 52%, rgba(18,123,154,.16));
          transform: translateX(-50%) rotate(0deg);
          animation: liquidRoll var(--wave-speed, 8s) linear infinite, liquidBob 5.4s ease-in-out infinite;
          filter: blur(.08px);
        }
        .water-wave-a { --wave-size: 245px; --wave-top: -105px; --wave-speed: 8.8s; opacity: calc(.62 + var(--slosh-amp, 0) * .22); translate: calc(var(--slosh-x, 0) * 3.6%) calc(var(--slosh-x2, 0) * -3px); }
        .water-wave-b { --wave-size: 205px; --wave-top: -82px; --wave-speed: 7.1s; top: -11px; opacity: calc(.42 + var(--slosh-amp, 0) * .22); transform: scaleX(1.06); translate: calc(var(--slosh-x, 0) * -2.4% + var(--slosh-x2, 0) * 2.8%) calc(var(--slosh-x2, 0) * 3px); }
        .water-wave-b::before { animation-direction: reverse, normal; background: linear-gradient(135deg, rgba(189,248,255,.54), rgba(10,163,163,.26) 55%, rgba(18,123,154,.14)); }
        .water-wave-c { --wave-size: 270px; --wave-top: -128px; --wave-speed: 11s; top: -23px; opacity: calc(.25 + var(--slosh-amp, 0) * .18); transform: scaleX(.96); translate: calc(var(--slosh-x2, 0) * -3.2%) 0; }
        .water-wave-c::before { background: linear-gradient(135deg, rgba(255,255,255,.44), rgba(189,248,255,.16) 58%, transparent); }
        @keyframes waterRise { from { height: 0; } to { height: var(--water-level); } }
        @keyframes waterSurface { 0% { opacity: .10; transform: scaleX(.48); } 22% { opacity: .92; transform: scaleX(.76); } 100% { opacity: 1; transform: scaleX(1); } }
        @keyframes surfaceMorph {
          0%, 100% { border-radius: 42% 58% 52% 48% / 53% 60% 40% 47%; }
          50% { border-radius: 60% 40% 47% 53% / 60% 52% 48% 40%; }
        }
        @keyframes liquidRoll {
          to { transform: translateX(-50%) rotate(1turn); }
        }
        @keyframes liquidBob {
          0%, 100% { top: var(--wave-top); border-radius: 43% 57% 46% 54% / 56% 44% 56% 44%; }
          50% { top: calc(var(--wave-top) + 7px); border-radius: 55% 45% 58% 42% / 44% 57% 43% 56%; }
        }
        @keyframes internalSheen { 0%, 100% { transform: translateX(-16%) skewX(-7deg); opacity: .30; } 48% { transform: translateX(16%) skewX(-7deg); opacity: .64; } }
        .cone-tier {
          position: relative; width: 100%; height: calc(100% / 7);
          display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px;
          padding: 0 calc(var(--text-inset) + 18px); color: var(--navy);
          background: transparent;
          border: 0; border-bottom: 1px solid rgba(27,36,66,.18);
          clip-path: polygon(var(--top-left) 0, var(--top-right) 0, var(--bottom-right) 100%, var(--bottom-left) 100%);
          transition: background .18s, box-shadow .18s, color .18s, transform .18s;
          transform-origin: center;
          z-index: 8;
          cursor: pointer; font-family: inherit; text-align: left;
        }
        .cone-tier:hover, .cone-tier:focus-visible {
          background: rgba(255,255,255,.24); outline: none;
          box-shadow: inset 0 0 0 2px rgba(255,255,255,.30);
        }
        .cone-tier:last-child { border-bottom: 0; }
        .cone-tier.is-active {
          background: rgba(255,255,255,.20);
          box-shadow: inset 0 0 0 2px rgba(27,36,66,.16);
        }
        .cone-tier.is-expanded {
          background: linear-gradient(90deg, rgba(13,21,48,.86), rgba(27,36,66,.74));
          box-shadow: inset 0 0 0 2px rgba(255,255,255,.24), 0 14px 30px rgba(8,13,30,.34);
          color: #fff;
          transform: scale(1.035, 1.22);
          z-index: 18;
        }
        .cone-tier.is-expanded .cone-tier-name,
        .cone-tier.is-expanded .cone-tier-range { transform: translateY(-8px); text-shadow: 0 1px 12px rgba(0,0,0,.35); }
        .cone-tier-name { position: relative; z-index: 1; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; text-shadow: 0 1px 0 rgba(255,255,255,.50); transition: transform .18s, text-shadow .18s; }
        .cone-tier-range { position: relative; z-index: 1; font-size: 12px; font-weight: 800; opacity: .76; white-space: nowrap; text-shadow: 0 1px 0 rgba(255,255,255,.50); transition: transform .18s, text-shadow .18s; }
        .cone-layer-popover {
          position: absolute; left: calc(100% + 20px); top: calc(var(--popover-y) * 1%); width: min(340px, 46vw);
          padding: 17px 19px; border-radius: 10px; z-index: 30;
          background: rgba(255,255,255,.94); border: 1px solid rgba(27,36,66,.10);
          box-shadow: 0 20px 42px rgba(27,36,66,.34), 0 0 0 1px rgba(255,255,255,.56) inset;
          color: rgba(27,36,66,.88); transform: translateY(-50%);
          backdrop-filter: blur(14px); animation: coneDescriptionIn .18s ease-out both;
          pointer-events: none;
        }
        .cone-layer-popover::before {
          content: ""; position: absolute; left: -10px; top: 50%; width: 18px; height: 18px;
          background: rgba(255,255,255,.94); border-left: 1px solid rgba(27,36,66,.10); border-bottom: 1px solid rgba(27,36,66,.10);
          transform: translateY(-50%) rotate(45deg);
        }
        .cone-layer-popover strong { display: block; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 7px; color: var(--navy); }
        .cone-layer-popover span { display: block; font-size: 14px; line-height: 1.48; font-weight: 650; }
        @keyframes coneDescriptionIn { from { opacity: 0; transform: translateY(-50%) translateX(-8px) scale(.96); } to { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); } }
        .knowledge-cone-panel .cone-layer-popover {
          left: 50%; top: calc(var(--popover-y) * 1% + 42px); width: min(340px, calc(100% - 28px));
          padding: 15px 17px; transform: translateX(-50%);
          animation: coneDescriptionInDrawer .18s ease-out both;
        }
        .knowledge-cone-panel .cone-layer-popover::before {
          left: 50%; top: -9px; transform: translateX(-50%) rotate(135deg);
        }
        @keyframes coneDescriptionInDrawer { from { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(.96); } to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } }
        .cone-marker {
          position: absolute; right: -96px;
          top: calc(var(--marker-y) * 1%);
          transform: translateY(-50%);
          display: flex; align-items: center; gap: 10px;
          color: var(--navy); font-size: 12px; font-weight: 800;
          z-index: 20;
        }
        .cone-marker::before {
          content: ""; width: 74px; height: 2px;
          background: linear-gradient(90deg, rgba(27,36,66,.10), var(--navy));
        }
        .cone-marker-dot {
          width: 18px; height: 18px; border-radius: 50%;
          background: #fff; border: 4px solid var(--navy);
          box-shadow: 0 7px 18px rgba(0,0,0,.30);
        }
        .cone-empty-note {
          text-align: center; color: var(--muted); font-size: 14px; line-height: 1.6;
          max-width: 460px; margin: 0 auto;
        }
        /* ============================================================
           Score strip: score-evidence column
           ============================================================ */
        .conf-block {
          display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
          padding: 30px 32px; gap: 9px;
          border-left: 1px solid rgba(255,255,255,.12); min-width: 210px; position: relative;
        }
        .conf-empty-label {
          display: inline-flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
          font-size: 13px; font-weight: 850; letter-spacing: .075em;
          text-transform: uppercase; color: rgba(255,255,255,.55); text-align: left;
        }
        .conf-percent {
          font-family: var(--font-crimson), Georgia, serif; font-size: 27px; line-height: 1;
          font-weight: 750; color: #fff; letter-spacing: 0; text-transform: none;
        }
        .conf-note { display: flex; align-items: center; gap: 9px; font-size: 13px; color: rgba(255,255,255,.55); text-align: left; line-height: 1.35; }
        .conf-level {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 5px 10px; border-radius: 999px;
          background: color-mix(in srgb, var(--score-accent, var(--accent)) 16%, transparent);
          border: 1px solid color-mix(in srgb, var(--score-accent, var(--accent)) 45%, transparent);
          color: var(--score-accent, var(--accent)); font-size: 12px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase;
        }
        .evidence-info-btn {
          width: 21px; height: 21px; display: inline-flex; align-items: center; justify-content: center;
          border-radius: 50%; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.6); font: 800 11px var(--font-inter), sans-serif; cursor: pointer;
        }
        .evidence-tooltip {
          position: absolute; right: 22px; top: calc(100% - 10px); z-index: 80;
          width: min(300px, calc(100vw - 42px)); padding: 13px 15px; border-radius: 8px;
          background: rgba(14,18,38,.98); border: 1px solid rgba(255,255,255,.14); box-shadow: 0 12px 34px rgba(0,0,0,.5);
          color: rgba(255,255,255,.86); font-size: 12px; font-weight: 600; line-height: 1.5;
          opacity: 0; visibility: hidden; transform: translateY(-5px);
          transition: opacity .14s, transform .14s, visibility .14s; pointer-events: none;
        }
        .evidence-tooltip.is-open { opacity: 1; visibility: visible; transform: translateY(0); pointer-events: auto; }
        /* Standard-assessment controls — used to live in their own card;
           now they're just the page header's primary action (see
           .header-assess below), so these are themed for sitting directly
           on the dark starfield instead of on a light card. */
        /* ============================================================
           Dashboard header: OT/NT testament toggle
           ============================================================ */
        .header-assess {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          animation: stdAssessIn .4s ease both;
        }
        @keyframes stdAssessIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
        .std-assess-toggle {
          position: relative; display: inline-flex; padding: 4px; border-radius: 999px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16);
        }
        .std-assess-toggle-thumb {
          position: absolute; top: 4px; left: 4px;
          width: calc(50% - 4px); height: calc(100% - 8px); border-radius: 999px;
          background: var(--suite-hue); box-shadow: 0 4px 12px rgba(0,0,0,.3);
          transition: transform .32s cubic-bezier(.34,1.56,.64,1), background .3s ease;
        }
        .std-assess-toggle-btn {
          position: relative; z-index: 1; border: 0; background: transparent;
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 15px; border-radius: 999px; cursor: pointer;
          font: inherit; font-size: 12.5px; font-weight: 800; color: rgba(255,255,255,.55);
          transition: color .2s ease; white-space: nowrap;
        }
        .std-assess-toggle-btn svg { opacity: .6; transition: opacity .2s ease; }
        .std-assess-toggle-btn.is-active { color: #fff; }
        .std-assess-toggle-btn.is-active svg { opacity: .95; }
        .std-assess-actions { display: flex; align-items: center; gap: 12px; }
        .std-assess-cta {
          position: relative; overflow: hidden;
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 18px; border-radius: 999px;
          background: var(--suite-hue); color: #fff; text-decoration: none;
          font-size: 13.5px; font-weight: 800; white-space: nowrap;
          transition: filter .15s ease, transform .15s ease, background .3s ease;
        }
        .std-assess-cta:hover { filter: brightness(1.08); transform: translateY(-1px); }
        /* A slow, occasional sheen sweep — reads as "this is the thing to
           click" without being an constant distraction. */
        .std-assess-cta::after {
          content: ""; position: absolute; top: 0; left: -60%;
          width: 40%; height: 100%;
          background: linear-gradient(115deg, transparent, rgba(255,255,255,.6), transparent);
          transform: skewX(-20deg);
          animation: ctaSheen 3.6s ease-in-out infinite;
        }
        @keyframes ctaSheen {
          0% { left: -60%; }
          35%, 100% { left: 130%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .std-assess-cta::after { animation: none; opacity: 0; }
        }
        .scope-text-btn {
          border: 0; padding: 5px 0; background: transparent; color: rgba(255,255,255,.5);
          font: inherit; font-size: 11.5px; font-weight: 750; cursor: pointer; white-space: nowrap;
        }
        .scope-text-btn:hover, .scope-text-btn:focus-visible { color: #fff; outline: none; }
        @media (max-width: 640px) {
          .header-assess { width: 100%; }
          .std-assess-toggle { flex: 1; }
          .std-assess-toggle-btn { flex: 1; }
          .std-assess-actions { width: 100%; justify-content: space-between; }
        }
        /* ============================================================
           DEAD CSS below (.recommendation-engine*, .recommended-card/-side/
           -priority/-actions/-action, .frontier-*): no JSX references these
           classes anymore -- superseded by CoverageMapSection's
           coverage-focus-card. Still LIVE in this stretch: .recommended-guidance*,
           .recommended-resource*, .recommended-review (CoverageMapSection's
           "is-skill" branch still renders them).
           ============================================================ */
        .recommendation-engine {
          margin-bottom: 28px;
        }
        .recommendation-engine-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 18px; margin-bottom: 14px;
        }
        .recommendation-engine-eyebrow {
          margin: 0 0 5px; color: rgba(255,255,255,.58);
          font-size: 11px; font-weight: 850; letter-spacing: .12em;
          text-transform: uppercase;
        }
        .recommendation-engine-title {
          margin: 0; color: #fff;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 28px; font-weight: 650; line-height: 1.05;
          text-shadow: 0 2px 14px rgba(0,0,0,.28);
        }
        .recommendation-engine-copy {
          max-width: 540px; margin: 6px 0 0;
          color: rgba(255,255,255,.68); font-size: 13px; line-height: 1.5;
        }
        .recommendation-toggle {
          display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px;
          background: rgba(255,255,255,.88); border: 1px solid var(--border);
          box-shadow: var(--shadow-sm); backdrop-filter: blur(14px);
          flex-shrink: 0;
        }
        .recommendation-toggle-btn {
          border: 0; border-radius: 999px; padding: 8px 13px;
          background: transparent; color: var(--muted);
          font: inherit; font-size: 12px; font-weight: 850; cursor: pointer;
          transition: background .16s ease, color .16s ease, box-shadow .16s ease;
        }
        .recommendation-toggle-btn:hover,
        .recommendation-toggle-btn:focus-visible {
          color: var(--navy); outline: none;
        }
        .recommendation-toggle-btn.is-active {
          background: var(--navy); color: #fff;
          box-shadow: 0 6px 15px rgba(27,36,66,.20);
        }
        .recommendation-toggle-btn:disabled {
          opacity: .48; cursor: not-allowed;
        }
        .recommendation-engine-body {
          animation: recommendationPanelIn .22s ease both;
        }
        @keyframes recommendationPanelIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
        .recommendation-engine-body .recommended-card,
        .recommendation-engine-body .dmm-card {
          margin-bottom: 0;
        }
        .recommended-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 20px; padding: 24px 26px; margin-bottom: 28px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(16px);
          display: grid; grid-template-columns: minmax(0,1fr) minmax(210px, auto); gap: 22px; align-items: center;
          position: relative; overflow: hidden;
        }
        .recommended-card::before {
          content: ""; position: absolute; inset: 0 auto 0 0; width: 5px;
          background: linear-gradient(180deg, var(--accent), #d4a017);
        }
        .recommended-eyebrow { font-size: 11px; font-weight: 850; letter-spacing: .11em; text-transform: uppercase; color: #0a6e6e; margin-bottom: 4px; }
        .recommended-subhead { margin: 0 0 10px; font-size: 11.5px; font-weight: 600; color: var(--muted); max-width: 420px; }
        .recommended-title { font-family: var(--font-crimson), Georgia, serif; font-size: 25px; font-weight: 650; color: var(--navy); line-height: 1.05; }
        .recommended-books { margin-top: 5px; font-size: 13px; color: var(--muted); font-weight: 650; }
        .recommended-focus {
          margin-top: 12px; font-size: 13.5px; line-height: 1.5; color: rgba(27,36,66,.84); max-width: 620px;
        }
        .recommended-guidance {
          margin-top: 14px; padding: 13px 14px;
          border-radius: 12px; border: 1px solid rgba(10,163,163,.16);
          background: rgba(10,163,163,.055); max-width: 660px;
        }
        .recommended-guidance-title {
          margin-bottom: 8px; color: #0a6e6e;
          font-size: 11px; font-weight: 850; letter-spacing: .10em; text-transform: uppercase;
        }
        .recommended-guidance-list {
          display: grid; gap: 6px; margin: 0; padding: 0; list-style: none;
        }
        .recommended-guidance-list li {
          position: relative; padding-left: 16px;
          color: rgba(27,36,66,.82); font-size: 12.5px; line-height: 1.45; font-weight: 650;
        }
        .recommended-guidance-list li::before {
          content: ""; position: absolute; left: 0; top: .62em;
          width: 6px; height: 6px; border-radius: 50%; background: #0aa3a3;
        }
        .recommended-resources {
          display: flex; flex-wrap: wrap; gap: 8px; margin-top: 11px;
        }
        .recommended-resource {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 10px; border-radius: 999px;
          color: #0a6e6e; background: rgba(255,255,255,.68);
          border: 1px solid rgba(10,163,163,.18);
          font-size: 12px; font-weight: 800; text-decoration: none;
        }
        .recommended-resource:hover, .recommended-resource:focus-visible {
          color: var(--navy); border-color: rgba(10,163,163,.34); outline: none;
        }
        .recommended-side { display: flex; flex-direction: column; align-items: flex-end; }
        .recommended-priority { font-size: 12.5px; line-height: 1.45; color: var(--muted); max-width: 260px; }
        .recommended-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 9px; margin-top: 12px; }
        .recommended-action { display: flex; align-items: center; gap: 8px; color: var(--navy); font-size: 13px; font-weight: 800; text-decoration: none; }
        .recommended-action svg { width: 16px; height: 16px; }
        .recommended-review {
          display: inline-flex; align-items: center; gap: 7px;
          color: #0a6e6e; font-size: 12px; font-weight: 800; text-decoration: none;
        }
        .recommended-review:hover, .recommended-review:focus-visible {
          color: var(--navy); outline: none; text-decoration: underline;
          text-underline-offset: 3px;
        }
        .frontier-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 20px; padding: 20px 22px; margin-bottom: 28px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(16px);
          display: grid; grid-template-columns: minmax(0,1fr) minmax(0,.72fr);
          gap: 22px; align-items: start;
          position: relative; overflow: hidden;
        }
        .frontier-card::before {
          content: ""; position: absolute; inset: 0 auto 0 0; width: 4px;
          background: var(--frontier-hue, var(--accent));
        }
        .frontier-eyebrow {
          font-size: 11px; font-weight: 850; letter-spacing: .11em;
          text-transform: uppercase; color: #0a6e6e; margin-bottom: 7px;
        }
        .frontier-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 23px; font-weight: 650; color: var(--navy); line-height: 1.08;
        }
        .frontier-ref { margin-top: 4px; font-size: 12.5px; color: var(--muted); font-weight: 700; }
        .frontier-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 14px; }
        .frontier-cta {
          display: inline-flex; align-items: center; gap: 8px;
          min-height: 40px; padding: 10px 15px; border-radius: 10px;
          background: var(--navy); color: #fff; text-decoration: none;
          font-size: 13px; font-weight: 800;
        }
        .frontier-cta:hover { background: #253566; }
        .frontier-map {
          display: inline-flex; align-items: center; gap: 7px;
          color: var(--navy); font-size: 12px; font-weight: 800; text-decoration: none;
        }
        .frontier-map:hover, .frontier-map:focus-visible {
          outline: none; text-decoration: underline; text-underline-offset: 3px;
        }
        .frontier-context { border-left: 1px solid var(--border); padding-left: 20px; }
        .frontier-context-label {
          font-size: 10px; font-weight: 850; letter-spacing: .09em;
          text-transform: uppercase; color: var(--muted); margin-bottom: 9px;
        }
        .frontier-item {
          display: grid; grid-template-columns: minmax(0,1fr) auto;
          gap: 10px; align-items: baseline; padding: 7px 0;
          border-bottom: 1px solid var(--border);
        }
        .frontier-item:last-child { border-bottom: 0; }
        .frontier-item-name { font-size: 12.5px; font-weight: 750; color: var(--navy); line-height: 1.3; }
        .frontier-item-ref { font-size: 10.5px; color: var(--muted); font-weight: 650; margin-top: 2px; }
        .frontier-item-score {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 15px; font-weight: 700; color: var(--muted);
        }
        /* ============================================================
           Retest confirmation modal
           ============================================================ */
        .retest-modal-backdrop {
          position: fixed; inset: 0; z-index: 90;
          background: rgba(7,12,28,.66); backdrop-filter: blur(8px);
          display: grid; place-items: center; padding: 24px;
        }
        .retest-modal {
          width: min(100%, 480px); border-radius: 20px;
          background: rgba(255,255,255,.96); border: 1px solid var(--border);
          box-shadow: var(--shadow); padding: 28px 30px;
          position: relative; overflow: hidden;
        }
        .retest-modal::before {
          content: ""; position: absolute; inset: 0 auto 0 0; width: 5px;
          background: linear-gradient(180deg, var(--accent), #d4a017);
        }
        .retest-modal-kicker {
          color: #0a6e6e; font-size: 11px; font-weight: 850;
          letter-spacing: .11em; text-transform: uppercase; margin-bottom: 10px;
        }
        .retest-modal-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 28px; line-height: 1.08; font-weight: 650;
          color: var(--navy); margin-bottom: 10px;
        }
        .retest-modal-copy {
          color: var(--muted); font-size: 14px; line-height: 1.6;
          margin-bottom: 18px;
        }
        .retest-modal-actions {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 10px; flex-wrap: wrap;
        }
        .retest-modal-primary,
        .retest-modal-secondary {
          border-radius: 999px; padding: 11px 18px;
          font-family: inherit; font-size: 13.5px; font-weight: 800;
          cursor: pointer;
        }
        .retest-modal-primary {
          border: none; color: #fff; background: var(--navy);
          box-shadow: 0 10px 24px rgba(27,36,66,.28);
        }
        .retest-modal-secondary {
          border: 1px solid var(--border); color: var(--muted);
          background: rgba(255,255,255,.70);
        }
        /* ============================================================
           Coverage map section (mode switcher, focus/recommended card, grid wrapper)
           ============================================================ */
        .section-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: .10em;
          text-transform: uppercase; color: rgba(255,255,255,.45);
          margin-bottom: 14px; margin-top: 32px;
        }
        .breakdown-head {
          display: flex; justify-content: space-between; align-items: center;
          gap: 14px; margin-top: 32px; margin-bottom: 14px;
        }
        .breakdown-head .section-eyebrow { margin: 0; }
        .coverage-map-section { margin-top: 32px; position: relative; }
        .coverage-map-head {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 14px; margin-bottom: 14px;
        }
        .coverage-map-section .section-eyebrow { margin-bottom: 6px; }
        .coverage-map-title {
          margin: 0; color: #fff;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(22px, 3vw, 30px); line-height: 1;
        }
        .coverage-map-copy {
          margin: 8px 0 0; max-width: 620px;
          color: rgba(255,255,255,.66); font-size: 12.5px; line-height: 1.45;
        }
        .coverage-mode-controls {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px; border-radius: 999px;
          background: rgba(255,255,255,.08); border: 1px solid rgba(212,160,23,.42);
        }
        .coverage-mode-btn {
          min-height: 34px; border: 0; border-radius: 999px; padding: 7px 11px;
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          background: transparent; color: rgba(255,255,255,.64);
          font: inherit; font-size: 11.5px; font-weight: 850; cursor: pointer;
          transition: background .15s ease, color .15s ease, box-shadow .15s ease;
        }
        .coverage-mode-btn svg {
          width: 15px; height: 15px; fill: none; stroke: currentColor;
          stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
        }
        .coverage-mode-btn:hover,
        .coverage-mode-btn:focus-visible {
          color: #fff; background: rgba(255,255,255,.10); outline: none;
        }
        .coverage-mode-btn.is-active {
          background: rgba(255,255,255,.95); color: var(--navy);
          box-shadow: 0 8px 20px rgba(0,0,0,.18);
        }
        .coverage-mode-btn:disabled {
          opacity: .42; cursor: not-allowed;
        }
        .coverage-map-link {
          display: inline-flex; align-items: center; gap: 7px;
          width: 34px; height: 34px; justify-content: center;
          padding: 0; border-radius: 999px; white-space: nowrap;
          background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18);
          color: rgba(255,255,255,.85); text-decoration: none;
          font-size: 12px; font-weight: 800;
          transition: background .15s ease, border-color .15s ease;
        }
        .coverage-map-link:hover { background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.30); }
        /* A tiny star-and-orbiting-planet in place of a generic map glyph —
           the same slow-drift orbit motif as the brand mark and the
           Learn More menu (see learnMoreOrbitSpin above), just built from
           plain rotating elements rather than SVG so it stays cheap and
           avoids SVG transform-origin quirks. Always drifting quietly;
           speeds up on hover as the one bit of direct feedback that this
           icon leads to the knowledge map. */
        .cml-icon { position: relative; width: 20px; height: 20px; flex: 0 0 auto; }
        .cml-star {
          position: absolute; top: 50%; left: 50%; width: 5px; height: 5px;
          margin: -2.5px 0 0 -2.5px; border-radius: 50%;
          background: #f0c674; box-shadow: 0 0 6px rgba(240,198,116,.85);
          animation: cmlTwinkle 2.6s ease-in-out infinite;
        }
        .cml-orbit {
          position: absolute; inset: 0;
          border: 1px dashed rgba(255,255,255,.32); border-radius: 50%;
          animation: cmlSpin 7s linear infinite;
        }
        .cml-planet {
          position: absolute; top: -1.5px; left: 50%; width: 4px; height: 4px;
          margin-left: -2px; border-radius: 50%;
          background: #7de5e5; box-shadow: 0 0 5px rgba(125,229,229,.85);
        }
        @keyframes cmlSpin { to { transform: rotate(360deg); } }
        @keyframes cmlTwinkle {
          0%, 100% { opacity: .68; transform: scale(.82); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        .coverage-map-link:hover .cml-orbit { animation-duration: 1.3s; }
        .coverage-map-link:hover .cml-star { animation-duration: .9s; }
        @media (prefers-reduced-motion: reduce) {
          .cml-orbit, .cml-star { animation: none; }
        }
        /* One continuous card for the recommendation callout and the
           chapter board — previously separate boxes. They're divided by a
           fine gold line (.coverage-focus-card's border-bottom) instead of
           each carrying its own background/border/shadow. The legend lives
           outside this card entirely — see .coverage-legend-rail below. */
        .coverage-map-card {
          border-radius: 10px; border: 1px solid rgba(226,232,240,.95);
          background: rgba(255,255,255,.97);
          box-shadow: 0 20px 48px rgba(0,0,0,.20);
          overflow: hidden;
        }
        /* The legend has no box of its own — it sits directly on the dark
           starfield backdrop. On wide viewports it breaks out of the .page
           column entirely, floating in the left margin beside the card
           (position: relative on .coverage-map-section is what makes
           right: 100% land at that column's left edge) — there's room there
           for the section-by-completion-level matrix. Below this width
           there's no margin to float a ~220px panel into, so it drops back
           into normal flow above the card instead. */
        .coverage-legend-rail {
          margin-bottom: 14px;
        }
        @media (min-width: 1680px) {
          .coverage-legend-rail {
            position: absolute; top: 58px; right: 100%;
            width: 224px; margin: 0 28px 0 0;
          }
        }
        .coverage-focus-card {
          position: relative;
          display: grid; grid-template-columns: minmax(0,1fr) minmax(190px, auto);
          gap: 18px; align-items: center;
          padding: 20px 22px;
          color: var(--navy);
          border-bottom: 1px solid rgba(212,160,23,.4);
        }
        .coverage-focus-card.is-skill {
          align-items: start;
          background:
            linear-gradient(135deg, rgba(255,255,255,.98), rgba(255,248,225,.96) 58%, rgba(236,253,245,.92));
        }
        .coverage-focus-card.is-skill::before {
          content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
          background: linear-gradient(180deg, #d4a017, #0aa3a3);
        }
        .coverage-diagnostic-head {
          display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
          margin-bottom: 6px;
        }
        .coverage-focus-eyebrow {
          margin: 0 0 5px; color: #0a6e6e;
          font-size: 10.5px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase;
        }
        .coverage-focus-card.is-skill .coverage-focus-eyebrow {
          margin: 0; color: #8a5d00;
        }
        .coverage-focus-title {
          margin: 0; color: var(--navy);
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 24px; font-weight: 650; line-height: 1.08;
        }
        /* The dimension name (e.g. "Law") doubling as the title, when
           there's a dimension gap to click into. Underline only shows on
           hover/focus so it doesn't look like a broken link at rest. */
        .coverage-focus-title-link {
          appearance: none; border: 0; padding: 0; margin: 0; background: transparent;
          font: inherit; color: inherit; cursor: pointer; text-align: left;
          text-decoration-line: underline; text-decoration-color: transparent; text-underline-offset: 4px;
          transition: text-decoration-color .15s ease, color .15s ease;
        }
        .coverage-focus-title-link:hover, .coverage-focus-title-link:focus-visible {
          text-decoration-color: currentColor; color: #0a6e6e; outline: none;
        }
        .coverage-focus-meta {
          margin: 5px 0 0; color: var(--muted);
          font-size: 12.5px; font-weight: 700; line-height: 1.4;
        }
        .coverage-focus-copy {
          margin: 10px 0 0; color: #435168;
          font-size: 13px; line-height: 1.52; max-width: 760px;
        }
        .coverage-focus-actions {
          display: flex; flex-direction: column; align-items: flex-end; gap: 9px;
        }
        .coverage-focus-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          border: 0; border-radius: 8px; padding: 10px 14px;
          background: var(--navy); color: #fff; text-decoration: none;
          font-size: 12.5px; font-weight: 850; white-space: nowrap;
          box-shadow: 0 10px 22px rgba(27,36,66,.22);
        }
        .coverage-focus-primary svg { width: 14px; height: 14px; }
        .coverage-focus-priority {
          margin: 0; color: var(--muted);
          font-size: 12px; line-height: 1.45; text-align: right; max-width: 260px;
        }
        .coverage-focus-card.is-skill .recommended-guidance {
          margin-top: 14px; padding: 13px 14px;
          border-radius: 10px; border: 1px solid rgba(212,160,23,.20);
          background: rgba(255,255,255,.64);
        }
        .coverage-focus-card.is-skill .scope-text-btn {
          background: rgba(255,255,255,.68);
        }
        .coverage-map-empty {
          min-height: 132px; padding: 24px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; gap: 6px;
          border: 1px solid var(--border); border-radius: 10px;
          background: rgba(255,255,255,.97); color: var(--muted);
        }
        .coverage-map-empty strong {
          color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 20px; font-weight: 650;
        }
        .coverage-map-empty span { max-width: 480px; font-size: 12px; line-height: 1.5; }
        @media (max-width: 560px) {
          .coverage-map-head { flex-direction: column; align-items: start; }
          .coverage-mode-controls { width: 100%; overflow-x: auto; border-radius: 12px; }
          .coverage-mode-btn { flex: 1 0 auto; }
          .coverage-focus-card { grid-template-columns: 1fr; padding: 18px; }
          .coverage-focus-actions { align-items: flex-start; }
          .coverage-focus-priority { text-align: left; max-width: none; }
          .coverage-focus-primary { white-space: normal; }
        }
        .breakdown-controls {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 10px; flex-wrap: wrap;
        }
        .breakdown-tabs {
          display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px;
          background: rgba(255,255,255,.88); border: 1px solid var(--border);
          box-shadow: var(--shadow-sm); backdrop-filter: blur(14px);
        }
        .breakdown-tab {
          border: none; border-radius: 999px; padding: 7px 12px;
          background: transparent; color: var(--muted);
          font: inherit; font-size: 12px; font-weight: 800; cursor: pointer;
        }
        .breakdown-tab:hover, .breakdown-tab:focus-visible {
          color: var(--navy); outline: none;
        }
        .breakdown-tab.is-active { background: var(--navy); color: #fff; }
        .breakdown-note {
          margin: -4px 0 14px; color: rgba(255,255,255,.68);
          font-size: 12.5px; line-height: 1.45;
        }
        .sections-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .sections-grid.books { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .sections-grid.domains { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        /* ============================================================
           DEAD CSS below (.domain-radar-card / .radar-*): styling for the legacy
           hidden knowledge-profile radar chart deleted from page.tsx in an
           earlier cleanup pass. No JSX references these classes anymore.
           ============================================================ */
        .domain-radar-card {
          position: relative; overflow: hidden;
          background:
            radial-gradient(circle at 18% 20%, rgba(10,163,163,.10), transparent 32%),
            radial-gradient(circle at 82% 78%, rgba(212,160,23,.08), transparent 34%),
            var(--card);
          border: 1px solid var(--border);
          border-radius: 20px; padding: 26px 28px;
          box-shadow: var(--shadow-sm);
          backdrop-filter: blur(16px);
          display: grid; grid-template-columns: minmax(300px, 1fr) minmax(250px, .85fr);
          gap: 28px; align-items: center;
        }
        .domain-radar-card::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(circle at 50% 48%, rgba(10,163,163,.10), transparent 32%),
            radial-gradient(circle at 50% 48%, rgba(255,255,255,.55), transparent 54%);
          opacity: .75;
        }
        .domain-radar-card::after {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(115deg, transparent 0 42%, rgba(10,163,163,.07) 50%, transparent 58% 100%);
          opacity: .44;
        }
        .domain-radar-wrap {
          position: relative; z-index: 1; min-height: 390px;
          display: grid; place-items: center;
        }
        .domain-radar-svg {
          width: min(100%, 430px); height: auto; display: block;
          overflow: visible;
        }
        .radar-ring {
          fill: none; stroke: rgba(27,36,66,.10); stroke-width: .9;
        }
        .radar-axis {
          stroke: rgba(27,36,66,.09); stroke-width: .8;
        }
        .radar-shape {
          fill: rgba(10,163,163,.10);
          stroke: rgba(10,163,163,.78); stroke-width: 1.8;
          filter: drop-shadow(0 0 10px rgba(10,163,163,.24));
          animation: constellationPulse 4.8s ease-in-out infinite;
        }
        .radar-point {
          fill: #fff; stroke: rgba(10,163,163,.90); stroke-width: 2.5;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 8px rgba(10,163,163,.35));
          animation: constellationStar 3.8s ease-in-out infinite;
        }
        .radar-point-glow {
          fill: rgba(10,163,163,.12);
          stroke: rgba(10,163,163,.16);
          stroke-width: 1;
          animation: constellationStar 3.8s ease-in-out infinite;
        }
        @keyframes constellationPulse {
          0%, 100% { opacity: .82; }
          50% { opacity: 1; }
        }
        @keyframes constellationStar {
          0%, 100% { opacity: .86; }
          50% { opacity: 1; }
        }
        .radar-label {
          fill: rgba(27,36,66,.82); font-size: 10.5px; font-weight: 850;
          letter-spacing: .06em; text-transform: uppercase;
        }
        .radar-score-label {
          fill: var(--navy); font-size: 14px; font-weight: 800;
        }
        .domain-radar-side {
          position: relative; z-index: 1;
          display: flex; flex-direction: column; gap: 12px;
        }
        .domain-radar-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 26px; line-height: 1.08; color: var(--navy);
          font-weight: 650; margin-bottom: 2px;
        }
        .domain-radar-copy {
          color: var(--muted); font-size: 13.5px; line-height: 1.55;
          margin-bottom: 8px;
        }
        .domain-radar-list {
          display: grid; gap: 8px;
        }
        .domain-radar-row {
          display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px;
          align-items: center; padding: 9px 11px; border-radius: 12px;
          background: rgba(27,36,66,.045); border: 1px solid rgba(27,36,66,.08);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.34);
          width: 100%; color: inherit; font: inherit; text-align: left; cursor: pointer;
          transition: background .15s ease, border-color .15s ease, transform .15s ease;
        }
        .domain-radar-row:hover, .domain-radar-row:focus-visible {
          background: rgba(10,163,163,.08); border-color: var(--accent-line);
          transform: translateX(2px); outline: none;
        }
        .domain-radar-row.is-locked {
          background: rgba(27,36,66,.035);
          border-style: dashed;
          opacity: .72; cursor: default;
        }
        .domain-radar-name {
          color: var(--navy); font-size: 13px; font-weight: 760;
        }
        .domain-radar-meta {
          color: var(--muted); font-size: 11.5px; font-weight: 650;
        }
        .domain-radar-score {
          color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 20px; font-weight: 700;
        }
        .domain-radar-score.is-locked {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 11px; letter-spacing: .09em; text-transform: uppercase;
          color: var(--muted);
        }
        /* ============================================================
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
        /* ============================================================
           Responsive: narrow-viewport overrides
           ============================================================ */
        @media (max-width: 640px) {
          .score-strip { grid-template-columns: 1fr; }
          .score-block { border-right: none; border-bottom: 1px solid rgba(255,255,255,.12); }
          .conf-block { border-left: none; border-top: 1px solid rgba(255,255,255,.12); align-items: center; text-align: center; }
          .progress-card { padding: 22px 16px 18px; }
          .progress-head { flex-direction: column; gap: 14px; }
          .progress-controls { width: 100%; justify-content: space-between; }
          .progress-chart { min-width: 560px; }
          .progress-detail { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px 12px; }
          .progress-detail-primary { grid-column: 1 / -1; }
          .progress-review-link { grid-column: 1 / -1; }
          .recommendation-engine-head { flex-direction: column; align-items: flex-start; }
          .recommendation-toggle { width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .recommendation-toggle-btn { padding-inline: 8px; }
          .breakdown-head { flex-direction: column; align-items: flex-start; }
          .breakdown-controls { width: 100%; justify-content: flex-start; }
          .breakdown-tabs { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); }
          .breakdown-tab { padding-inline: 8px; }
          .sections-grid,
          .sections-grid.books,
          .sections-grid.domains { grid-template-columns: 1fr; }
          .domain-radar-card { grid-template-columns: 1fr; padding: 22px 18px; }
          .domain-radar-wrap { min-height: 330px; }
          .domain-radar-svg { width: min(100%, 340px); }
          .recommended-card { grid-template-columns: 1fr; }
          .frontier-card { grid-template-columns: 1fr; }
          .frontier-context { border-left: 0; border-top: 1px solid var(--border); padding: 14px 0 0; }
          .recommended-side, .recommended-actions { align-items: flex-start; }
          .recommended-priority { max-width: none; }
          .retest-modal { padding: 24px 22px; }
          .retest-modal-actions { align-items: stretch; flex-direction: column-reverse; }
          .retest-modal-primary,
          .retest-modal-secondary { width: 100%; }
          .save-results-card { grid-template-columns: 1fr; padding: 16px 18px; }
          .save-results-actions { align-items: stretch; }
          .save-results-btn { width: 100%; }
          .save-results-note { text-align: center; }
          .first-assessment-card { grid-template-columns: 1fr; padding: 28px 20px; min-height: auto; }
          .first-assessment-orbit { width: min(100%, 280px); }
          .first-assessment-content h2 { font-size: 36px; }
          .first-assessment-primary,
          .first-assessment-secondary { width: 100%; }
          .first-assessment-choice-panel { grid-template-columns: 1fr; }
          .oba-feature-grid { grid-template-columns: 1fr; gap: 12px; }
          .oba-feature-card { min-height: 0; padding: 18px; }
          .oba-feature-graphic { height: 76px; }
          .knowledge-cone-card { padding: 24px 18px; }
          .knowledge-cone-head { align-items: flex-start; flex-direction: column; }
          .knowledge-cone-score { align-items: flex-start; }
          .knowledge-cone-wrap { min-height: 360px; padding: 18px 8px 58px; }
          .knowledge-cone { height: 320px; transform: rotateX(5deg); }
          .cone-tier { padding: 0 calc(var(--text-inset) + 10px); }
          .cone-tier-name { font-size: 10px; }
          .cone-tier-range { font-size: 10px; }
          .cone-layer-popover { left: 50%; top: calc(var(--popover-y) * 1% + 42px); width: min(340px, 90vw); padding: 15px 17px; transform: translateX(-50%); }
          .cone-layer-popover::before { left: 50%; top: -9px; transform: translateX(-50%) rotate(135deg); }
          .cone-layer-popover strong { font-size: 13px; }
          .cone-layer-popover span { font-size: 13px; line-height: 1.46; }
          @keyframes coneDescriptionIn { from { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(.96); } to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } }
          .cone-marker { right: 50%; transform: translate(50%, -50%); }
          .cone-marker::before { width: 46px; }
          .dashboard-tabs { grid-template-columns: 1fr; margin-top: -8px; }
          .placeholder-dashboard { grid-template-columns: 1fr; padding: 30px 24px; min-height: 360px; }
          .placeholder-orbit { width: min(210px, 70vw); margin: 0 auto; }
          .scope-drawer-backdrop { align-items: flex-end; }
          .scope-drawer {
            width: 100%; height: min(88vh, 760px); border-left: 0;
            border-top: 1px solid rgba(255,255,255,.42);
          }
          .scope-drawer-head { padding: 22px 20px 17px; }
          .scope-drawer-body { padding: 20px 20px 30px; }
          .scope-focused-action { align-items: flex-start; flex-direction: column; }
          /* The nav links exceed a phone's width, so let them wrap onto a
             second row rather than being clipped off the right edge. */
          .nav { padding: 11px 16px; flex-wrap: wrap; gap: 8px; }
          /* The beta tooltip is only visually hidden, so it still occupies
             layout and pushed the document 71px wider than the viewport.
             Anchor it to the nav instead of the badge so it can never
             extend past the right edge. */
          .beta-badge { position: static; }
          .beta-tooltip { left: 12px; right: 12px; width: auto; top: calc(100% + 6px); }
          .nav-right { flex-wrap: wrap; gap: 7px; }
          .nav-btn { padding: 7px 12px; font-size: 12px; }
          .bli-tooltip,
          .level-tooltip {
            position: fixed;
            left: 16px;
            right: 16px;
            top: auto;
            bottom: 18px;
            width: auto;
            max-width: none;
            transform: none;
            z-index: 140;
          }
          .bli-tooltip::before,
          .level-tooltip::before {
            display: none;
          }
          .learn-more-menu {
            position: fixed;
            left: 16px;
            right: 16px;
            top: 86px;
            width: auto;
          }
          .learn-more-menu::before { display: none; }
          .page { padding: 28px 16px 72px; }
        }
        /* ============================================================
           Reduced-motion overrides
           ============================================================ */
        @media (prefers-reduced-motion: reduce) {
          .water-fill, .water-fill::before, .water-fill::after,
          .water-wave, .water-wave::before,
          .progress-point,
          .scope-drawer-backdrop, .scope-drawer,
          .placeholder-orbit, .placeholder-orbit::before, .placeholder-orbit::after {
            animation: none !important;
          }
          /* Catch-all: the page reveal and any future decorative animation
             should be instant rather than a multi-second transition. The
             content must still arrive, so opacity is forced back to full. */
          .page { animation: none !important; opacity: 1 !important; filter: none !important; transform: none !important; }
          *, *::before, *::after {
            animation-duration: .001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .001ms !important;
            scroll-behavior: auto !important;
          }
        }
`;
