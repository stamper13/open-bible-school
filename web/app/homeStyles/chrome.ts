export const HOME_CHROME_STYLES = `
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
          /* Column flex so the footer can be pushed to the bottom. min-height
             alone only guaranteed the body filled the viewport, not that the
             footer sat at the end of it: on a tall window the content ran out
             and the footer stopped wherever the last card did, leaving a strip
             of starfield beneath it. */
          display: flex;
          flex-direction: column;
        }
        canvas.stars {
          position: fixed; left: 50%; top: 50%; z-index: 0; pointer-events: none;
          transform-origin: 50% 50%; transform: translate3d(-50%,-50%,0) rotate(var(--sky-start-rotation, 0deg));
        }
        .home-shell {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          flex: 1 0 auto;
          display: flex;
          flex-direction: column;
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
        .learn-more-label-mobile,
        .mobile-menu-only { display: none; }
        /* Sets the phone-only subject group off from the navigation links
           beneath it, so the menu reads as "which subject" then "where to". */
        .learn-more-group {
          gap: 2px; padding-bottom: 6px; margin-bottom: 6px;
          border-bottom: 1px solid rgba(255,255,255,.1);
        }
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
        /* Slightly different arrival curves so the items read as separate
           bodies swinging into place rather than one block sliding in — the
           closest a transform-only animation gets to an orbit path.
           There must be one rule per menu item: .learn-more-item starts at
           opacity 0, so an item past the last :nth-child rule here would
           never become visible. */
        .learn-more-item:nth-child(1) { animation: learnMoreItemIn1 .5s cubic-bezier(.22,.9,.32,1) .02s both; }
        .learn-more-item:nth-child(2) { animation: learnMoreItemIn2 .5s cubic-bezier(.22,.9,.32,1) .10s both; }
        .learn-more-item:nth-child(3) { animation: learnMoreItemIn3 .5s cubic-bezier(.22,.9,.32,1) .18s both; }
        .learn-more-item:nth-child(4) { animation: learnMoreItemIn4 .5s cubic-bezier(.22,.9,.32,1) .26s both; }
        .learn-more-item:nth-child(5) { animation: learnMoreItemIn2 .5s cubic-bezier(.22,.9,.32,1) .34s both; }
        /* Catch-all. .learn-more-item starts at opacity 0 and is only revealed
           by these arrival animations, so an item past the last hand-tuned rule
           would render permanently invisible — a menu entry that silently is
           not there. This makes adding one safe by default. */
        .learn-more-item:nth-child(n+6) { animation: learnMoreItemIn1 .5s cubic-bezier(.22,.9,.32,1) .40s both; }
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
        @keyframes learnMoreItemIn4 {
          0% { opacity: 0; transform: translate(-18px,-16px) scale(.5); }
          60% { opacity: 1; transform: translate(5px,3px) scale(1.05); }
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
          /* Grows to take the slack, which is what pushes the footer down.
             Never shrinks, so short viewports still scroll normally. */
          flex: 1 0 auto;
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
          display: inline-flex; align-items: center; gap: 7px; min-height: 32px;
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
`;
