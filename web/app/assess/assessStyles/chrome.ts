export const ASSESS_CHROME_STYLES = `
        /* ============================================================
           Root CSS variables & global reset
           ============================================================ */
        :root {
          /* --navy/--accent/--muted now come from app/globals.css */
          --accent-dim: rgba(10,163,163,.10); --accent-line: rgba(10,163,163,.22);
          --card: rgba(255,255,255,.93); --border: rgba(27,36,66,.09);
          --shadow: 0 24px 64px rgba(0,0,0,.40), 0 4px 16px rgba(0,0,0,.2);
          --correct: #059669; --correct-bg: #ecfdf5; --correct-line: rgba(5,150,105,.2);
          --wrong: #dc2626; --wrong-bg: #fef2f2; --wrong-line: rgba(220,38,38,.2);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; }
        body {
          font-family: var(--font-inter), system-ui, sans-serif;
          min-height: 100vh; background: #0b0f1e;
          display: flex; flex-direction: column; overflow-x: hidden;
        }
        canvas.stars {
          position: fixed; left: 50%; top: 50%; z-index: 0; pointer-events: none;
          transform-origin: 50% 50%; transform: translate3d(-50%,-50%,0);
        }
        /* ============================================================
           Evidence/nebula HUD label & dashboard-transition warp overlay
           ============================================================ */
        .confidence-nebula-label {
          position: fixed; right: 110px; bottom: 26px; z-index: 1;
          transform: translateX(50%);
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          pointer-events: none; text-align: center;
        }
        .confidence-nebula-label span {
          font-size: 13px; font-weight: 850; letter-spacing: .18em;
          text-transform: uppercase; color: rgba(255,255,255,.62);
          text-shadow: 0 2px 10px rgba(0,0,0,.7);
        }
        .confidence-nebula-label strong {
          max-width: 150px; font-size: 17px; line-height: 1.05; font-weight: 800; color: rgba(255,255,255,.92);
          text-shadow: 0 2px 14px rgba(0,0,0,.75);
        }
        .confidence-nebula-label small {
          font-size: 10px; font-weight: 700; color: rgba(255,255,255,.48);
          text-shadow: 0 2px 10px rgba(0,0,0,.7);
        }
        canvas.stars.dashboard-transition { animation: starSpinDissolve 2.35s linear both; }
        @keyframes starSpinDissolve {
          0% { transform: translate3d(-50%,-50%,0) rotate(0deg); filter: brightness(1); opacity: 1; }
          100% { transform: translate3d(-50%,-50%,0) rotate(90deg); filter: brightness(1.14) saturate(1.06); opacity: .98; }
        }
        .dashboard-warp {
          position: fixed; inset: 0; z-index: 35; pointer-events: none;
          background:
            radial-gradient(circle at 50% 45%, rgba(10,163,163,.24), transparent 32%),
            radial-gradient(circle at 70% 32%, rgba(212,160,23,.15), transparent 28%),
            linear-gradient(100deg, transparent 0%, rgba(255,255,255,.08) 44%, rgba(173,232,255,.16) 50%, rgba(255,255,255,.07) 56%, transparent 100%);
          mix-blend-mode: screen;
          animation: dashboardWarp 1.9s ease-in-out both;
        }
        @keyframes dashboardWarp {
          0% { opacity: 0; transform: translateX(-8vw) scale(1.02); }
          38% { opacity: .82; }
          68% { opacity: .5; }
          100% { opacity: 0; transform: translateX(8vw) scale(1.02); }
        }

        /* Nav */
        /* ============================================================
           Nav bar (brand, phase/progress readout, sign in/out + exit)
           ============================================================ */
        .nav {
          position: sticky; top: 0; z-index: 20;
          display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 760px) minmax(0, 1fr);
          align-items: center; column-gap: 16px;
          padding: 13px 28px; background: rgba(11,15,30,.85);
          backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,.07);
        }
        .scene.dashboard-transition,
        .nav.dashboard-transition {
          opacity: 0;
          transform: translateY(-4px) scale(.99);
          pointer-events: none;
          transition: opacity .78s ease, transform .78s ease;
        }
        .nav-brand {
          font-family: var(--font-crimson), Georgia, serif; font-weight: 600; font-size: 17px;
          color: #fff; text-decoration: none; opacity: .85;
        }
        .brand-wrap { display: inline-flex; align-items: center; gap: 8px; justify-self: start; }
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

        .nav-center { display: flex; flex-direction: column; align-items: center; justify-self: center; gap: 5px; width: 100%; min-width: 0; }
        .nav > .nav-actions { justify-self: end; }
        .nav-phase {
          font-size: 12px; font-weight: 850; letter-spacing: .12em;
          text-transform: uppercase; color: var(--accent);
        }
        .nav-subphase { font-size: 11px; font-weight: 600; color: rgba(255,255,255,.52); line-height: 1; }
        .nav-progress-row { display: flex; align-items: center; gap: 10px; }
        /* The readout is a ring everywhere now.
           It used to be a phase label, a sub-label and a 230px bar stacked
           three deep in the middle of the bar — "Saved Baseline", then
           "25 questions until your baseline score", then 0 ————— 25. The ring
           says the same thing in 38px: the sweep is how far through, the
           number inside is where you are, and the full phrase lives on the
           title and aria-label rather than taking a row of its own.

           The centre is punched out with a mask, not covered with a disc: the
           nav is translucent over the starfield, so a solid patch would read
           as a darker circle that shifts as the sky moves behind it. */
        .nav-phase, .nav-subphase { display: none; }
        .nav-progress-row {
          position: relative;
          flex: none;
          width: 38px; height: 38px;
          display: grid; place-items: center;
          gap: 0;
        }
        .nav-progress-row::before {
          content: "";
          position: absolute; inset: 0; border-radius: 50%;
          background: conic-gradient(
            var(--accent) calc(var(--progress, 0) * 1%),
            rgba(255, 255, 255, .16) 0
          );
          -webkit-mask: radial-gradient(circle, transparent 13px, #000 13.5px);
                  mask: radial-gradient(circle, transparent 13px, #000 13.5px);
          transition: background .5s cubic-bezier(.4,0,.2,1);
        }
        .nav-count {
          position: relative;
          flex: none; min-width: 0;
          font-size: 12.5px; font-weight: 700;
          color: rgba(255,255,255,.88); text-align: center;
        }
        .progress-bar-track, .nav-count-right { display: none; }
        .progress-bar-fill {
          height: 100%; border-radius: 999px; background: var(--accent);
        }
        .nav-exit {
          display: inline-flex; align-items: center; justify-content: center;
          box-sizing: border-box; min-height: 32px; line-height: 1; text-align: center;
          font-size: 12.5px; font-weight: 650; color: rgba(255,255,255,.72); text-decoration: none;
          padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.045);
          transition: color .14s, background .14s, border-color .14s;
        }
        .nav-exit:hover, .nav-exit:focus-visible {
          color: #fff; background: rgba(255,255,255,.10); border-color: rgba(255,255,255,.28);
          outline: none;
        }
        .nav-actions {
          display: flex; align-items: center; gap: 8px;
        }
        .nav-action-button {
          appearance: none; cursor: pointer; font-family: inherit;
        }

        /* Scene */
        /* ============================================================
           Question card scene: location head, report trigger, prompt
           ============================================================ */
        .scene {
          flex: 1; display: flex; align-items: center; justify-content: center;
          padding: 32px 24px 80px; position: relative; z-index: 1;
        }
        .card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 24px; padding: 46px 54px;
          box-shadow: var(--shadow); backdrop-filter: blur(20px);
          width: 100%; max-width: 760px;
          animation: cardIn .3s ease;
        }
        @keyframes cardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        /* Location graphic */
        .location-bar {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 18px; flex-wrap: wrap;
        }
        .question-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 14px; margin-bottom: 18px;
        }
        .question-head .location-bar { margin-bottom: 0; flex: 1; }
        .loc-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 999px;
          font-size: 11px; font-weight: 700; letter-spacing: .04em;
          border: 1px solid; white-space: nowrap;
        }
        .loc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .loc-sep { font-size: 11px; color: rgba(27,36,66,.25); }
        .tier-star { font-size: 11px; }
        .report-trigger {
          width: 34px; height: 34px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          border: 1px solid rgba(27,36,66,.10); background: rgba(255,255,255,.62);
          color: rgba(86,96,112,.82); cursor: pointer; flex-shrink: 0;
          transition: background .13s, color .13s, transform .11s, border-color .13s;
        }
        .report-trigger:hover {
          background: #fff7ed; border-color: rgba(180,83,9,.22);
          color: #b45309; transform: translateY(-1px);
        }
        .report-trigger svg { width: 17px; height: 17px; }

        /* Question */
        .card-prompt {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 25px; font-weight: 600; line-height: 1.42;
          color: var(--navy); margin-bottom: 30px;
        }
`;
