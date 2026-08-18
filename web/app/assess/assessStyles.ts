// Extracted from app/assess/page.tsx during a file-size cleanup (2026-08-16).
// Pure CSS text, rendered via a <style> tag on the assessment page. No behavior change intended.
export const ASSESS_PAGE_STYLES = `
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
        .nav.dashboard-transition,
        .results-fab.dashboard-transition {
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
        .nav-count { font-size: 12.5px; color: rgba(255,255,255,.58); min-width: 44px; text-align: right; font-weight: 650; }
        .progress-bar-track {
          width: 230px; height: 5px; border-radius: 999px;
          background: rgba(255,255,255,.12); overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%; border-radius: 999px; background: var(--accent);
          transition: width .5s cubic-bezier(.4,0,.2,1);
        }
        .nav-count-right { font-size: 12.5px; color: rgba(255,255,255,.58); min-width: 44px; font-weight: 650; }
        .nav-exit {
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
          cursor: pointer; font-family: inherit;
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
        /* ============================================================
           Multiple-choice answer buttons
           ============================================================ */
        .choices { display: flex; flex-direction: column; gap: 12px; }
        .choice {
          display: flex; align-items: center; gap: 15px;
          padding: 16px 18px; border-radius: 15px;
          border: 1.5px solid var(--border); background: rgba(255,255,255,.65);
          cursor: pointer; font-size: 15px; color: var(--navy); line-height: 1.45;
          transition: border-color .13s, background .13s, transform .11s;
          text-align: left; width: 100%; font-family: inherit;
        }
        .choice:hover:not(:disabled) {
          border-color: var(--accent-line); background: var(--accent-dim);
          transform: translateX(3px);
        }
        .choice:disabled { cursor: default; }
        .choice.correct { border-color: var(--correct-line); background: var(--correct-bg); }
        .choice.wrong   { border-color: var(--wrong-line);   background: var(--wrong-bg); }
        .choice.skipped { border-color: rgba(86,96,112,.22); background: rgba(27,36,66,.045); }
        .choice.recorded { border-color: var(--accent-line); background: var(--accent-dim); }
        .choice-letter {
          width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700;
          background: rgba(27,36,66,.07); color: var(--muted);
          transition: background .13s, color .13s;
        }
        .choice.correct .choice-letter { background: var(--correct); color: #fff; }
        .choice.wrong   .choice-letter { background: var(--wrong);   color: #fff; }
        .choice.skipped .choice-letter { background: var(--muted); color: #fff; }
        .choice.recorded .choice-letter { background: var(--accent); color: #fff; }
        /* ============================================================
           Sequence-question interaction (drag events into order)
           ============================================================ */
        .sequence-instruction {
          margin: -18px 0 14px; color: var(--muted);
          font-size: 13px; line-height: 1.45;
        }
        .sequence-list { display: flex; flex-direction: column; gap: 9px; }
        .sequence-item {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 32px 38px minmax(0,1fr) auto;
          align-items: center; gap: 10px; min-height: 66px; padding: 10px 12px;
          border: 1.5px solid var(--border); border-radius: 8px;
          background: rgba(255,255,255,.76); color: var(--navy);
          box-shadow: 0 4px 12px rgba(27,36,66,.045);
        }
        .sequence-item.is-dragging {
          z-index: 4; border-color: var(--accent);
          background: #fff; box-shadow: 0 16px 34px rgba(27,36,66,.18);
        }
        .sequence-number {
          width: 30px; height: 30px; border-radius: 50%;
          display: grid; place-items: center;
          background: var(--navy); color: #fff;
          font-size: 12px; font-weight: 800;
        }
        .sequence-handle {
          width: 36px; height: 36px; border-radius: 7px;
          display: grid; place-items: center; border: 1px solid var(--border);
          background: rgba(27,36,66,.045); color: var(--muted);
          font: 800 20px/1 system-ui, sans-serif; cursor: grab;
          touch-action: none;
        }
        .sequence-handle:active { cursor: grabbing; }
        .sequence-handle:disabled { cursor: default; opacity: .5; }
        .sequence-text { font-size: 14.5px; line-height: 1.4; font-weight: 600; }
        .sequence-step-controls { display: inline-flex; gap: 5px; }
        .sequence-step-controls button {
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid var(--border); background: rgba(255,255,255,.78);
          color: var(--navy); font: 800 14px/1 system-ui, sans-serif; cursor: pointer;
        }
        .sequence-step-controls button:hover:not(:disabled) {
          border-color: var(--accent-line); background: var(--accent-dim);
        }
        .sequence-step-controls button:disabled { opacity: .28; cursor: default; }
        .sequence-actions {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-top: 16px;
        }
        .sequence-submit, .sequence-skip {
          min-height: 43px; border-radius: 999px; padding: 0 19px;
          font: 750 13px/1 inherit; cursor: pointer;
        }
        .sequence-submit {
          border: 0; background: var(--navy); color: #fff;
          box-shadow: 0 9px 22px rgba(27,36,66,.22);
        }
        .sequence-submit:hover:not(:disabled) { background: #253566; transform: translateY(-1px); }
        .sequence-skip {
          border: 1px solid var(--border); background: rgba(255,255,255,.64);
          color: var(--muted);
        }
        .sequence-submit:disabled, .sequence-skip:disabled { opacity: .55; cursor: default; }
        /* ============================================================
           Section-sort-question interaction (drag books into their section)
           ============================================================ */
        .section-sort-question { display: flex; flex-direction: column; gap: 16px; }
        .section-sort-bank {
          min-height: 62px; display: flex; align-items: center; flex-wrap: wrap; gap: 9px;
          padding: 12px; border-radius: 8px;
          border: 1.5px dashed rgba(27,36,66,.16);
          background: rgba(27,36,66,.035);
        }
        .section-sort-chip {
          position: relative; z-index: 2;
          min-height: 34px; padding: 0 12px; border-radius: 999px;
          border: 1px solid rgba(27,36,66,.12);
          background: #fff; color: var(--navy);
          font: 760 13px/1 var(--font-inter), system-ui, sans-serif;
          box-shadow: 0 4px 11px rgba(27,36,66,.075);
          cursor: grab; touch-action: none;
        }
        .section-sort-chip:active { cursor: grabbing; }
        .section-sort-chip:disabled { cursor: default; opacity: .68; }
        .section-sort-chip.is-dragging {
          z-index: 8; opacity: .92;
          box-shadow: 0 16px 34px rgba(27,36,66,.18);
        }
        .section-sort-zones {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;
        }
        .section-sort-zone {
          min-height: 154px; padding: 13px; border-radius: 50%;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px;
          border: 1.5px solid rgba(27,36,66,.12);
          background: rgba(255,255,255,.62);
          box-shadow: inset 0 0 0 8px rgba(10,163,163,.035);
          transition: border-color .14s, background .14s, transform .12s;
        }
        .section-sort-zone.is-over {
          border-color: var(--accent);
          background: rgba(10,163,163,.10);
          transform: scale(1.015);
        }
        .section-sort-zone-title {
          max-width: 112px; text-align: center;
          color: var(--navy); font-size: 12px; font-weight: 850; line-height: 1.15;
        }
        .section-sort-zone-labels {
          display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; min-height: 38px;
        }
        .section-sort-zone .section-sort-chip {
          min-height: 30px; padding: 0 10px; font-size: 12px;
        }
        .section-sort-empty {
          color: rgba(86,96,112,.52); font-size: 12px; font-weight: 650;
        }

        /* Feedback */
        /* ============================================================
           Retry notice & post-answer feedback bar
           ============================================================ */
        .retry-notice {
          display: flex; align-items: flex-start; gap: 10px;
          margin-bottom: 16px; padding: 11px 13px; border-radius: 10px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          color: #0a5f5f; font-size: 13px; line-height: 1.5;
        }
        .retry-notice svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }
        .retry-notice span { flex: 1; }
        .retry-notice button {
          flex-shrink: 0; width: 24px; height: 24px; border-radius: 6px;
          border: 0; background: transparent; cursor: pointer;
          color: #0a5f5f; font-size: 17px; line-height: 1; font-family: inherit;
        }
        .retry-notice button:hover { background: rgba(10,163,163,.16); }
        .retry-notice button:focus-visible { outline: 2px solid #0aa3a3; outline-offset: 1px; }
        .feedback-bar {
          margin-top: 20px; padding: 14px 18px; border-radius: 13px;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .feedback-bar.correct { background: var(--correct-bg); border: 1px solid var(--correct-line); }
        .feedback-bar.wrong   { background: var(--wrong-bg);   border: 1px solid var(--wrong-line); }
        .feedback-bar.skipped { background: rgba(27,36,66,.045); border: 1px solid rgba(86,96,112,.18); }
        .feedback-bar.recorded { background: var(--accent-dim); border: 1px solid var(--accent-line); }
        .feedback-text { font-size: 13.5px; font-weight: 600; }
        .feedback-bar.correct .feedback-text { color: var(--correct); }
        .feedback-bar.wrong   .feedback-text { color: var(--wrong); }
        .feedback-bar.skipped .feedback-text { color: var(--muted); }
        .feedback-bar.recorded .feedback-text { color: #0a6969; }
        .canon-note {
          margin-top: 12px; padding: 13px 15px; border-radius: 10px;
          background: rgba(212,160,23,.11); border: 1px solid rgba(212,160,23,.28);
          color: #5f4308; font-size: 13px; line-height: 1.55;
          display: grid; gap: 3px;
        }
        .canon-note strong {
          color: #3b2a05; font-size: 12px; text-transform: uppercase; letter-spacing: .08em;
        }
        .next-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 18px; border-radius: 999px;
          background: var(--navy); color: #fff;
          font-size: 13px; font-weight: 600; border: none; cursor: pointer;
          white-space: nowrap; flex-shrink: 0; font-family: inherit;
          transition: background .13s, transform .11s; text-decoration: none;
        }
        .next-btn:hover { background: #253566; transform: translateY(-1px); }

        /* Score row */
        /* ============================================================
           NT running-score row
           ============================================================ */
        .score-row {
          display: flex; gap: 20px; margin-top: 20px; padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        .score-item { font-size: 12.5px; color: var(--muted); }
        .score-item strong { color: var(--navy); font-size: 15px; display: block; }

        /* Milestone banner — this fires once, at the moment a full baseline
           or targeted test actually finishes, so it earns a bit more
           presence than the routine teal UI around it: gold marks
           achievement elsewhere in the app (first-assessment-card, Torah
           bar), so this borrows that language instead of the standard
           interactive teal. */
        /* ============================================================
           OT milestone banner (baseline/retest complete)
           ============================================================ */
        .milestone-banner {
          position: relative; overflow: hidden;
          margin-top: 16px; padding: 16px 18px; border-radius: 14px;
          background:
            linear-gradient(135deg, rgba(245,200,66,.20), rgba(212,160,23,.07)),
            rgba(255,255,255,.7);
          border: 1px solid rgba(212,160,23,.38);
          box-shadow: 0 10px 28px rgba(212,160,23,.12);
          font-size: 13px; color: #4a3a08; font-weight: 500;
          display: flex; align-items: center; gap: 14px;
          animation: milestoneIn .5s cubic-bezier(.22,.72,.18,1) both;
        }
        @keyframes milestoneIn {
          from { opacity: 0; transform: translateY(6px) scale(.98); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .milestone-banner { animation: none; }
        }
        .milestone-icon {
          flex-shrink: 0; width: 34px; height: 34px; border-radius: 999px;
          display: grid; place-items: center;
          background: radial-gradient(circle at 34% 30%, #fff4bd, #e6ad12 60%, #91680e);
          box-shadow: 0 0 0 4px rgba(230,173,18,.14), 0 4px 14px rgba(212,160,23,.35);
        }
        .milestone-icon svg { width: 17px; height: 17px; color: #4a3208; }
        .milestone-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; line-height: 1.45; }
        .milestone-kicker {
          font-size: 10.5px; font-weight: 850; letter-spacing: .09em; text-transform: uppercase;
          color: #8a6208;
        }
        .milestone-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .milestone-results, .milestone-dashboard {
          min-height: 36px; display: inline-flex; align-items: center; justify-content: center;
          border-radius: 999px; padding: 0 14px; font: 750 12px var(--font-inter), sans-serif;
          text-decoration: none; cursor: pointer; white-space: nowrap;
        }
        .milestone-results {
          color: #241a02; background: linear-gradient(135deg, #f5c842, #d4a017);
          border: 1px solid rgba(212,160,23,.5);
          box-shadow: 0 8px 20px rgba(212,160,23,.32);
        }
        .milestone-dashboard { color: #4a3a08; background: rgba(255,255,255,.65); border: 1px solid rgba(212,160,23,.28); }

        /* ============================================================
           Correct-answer celebration burst (fireworks)
           ============================================================ */
        .cosmic-burst {
          position: fixed; inset: 0; z-index: 12; pointer-events: none; overflow: hidden;
          mix-blend-mode: screen;
        }
        .firework {
          --spark-length: 34px;
          --delay: 0s;
          position: absolute; width: 112px; height: 96px;
          left: 10vw; top: 24vh;
          color: rgba(173,232,255,1);
          opacity: 0;
          animation: fireworkPop 1.75s ease-out var(--delay) both;
        }
        .firework::before {
          content: ""; position: absolute; left: 50%; top: 50%;
          width: 8px; height: 8px; border-radius: 999px;
          background: currentColor;
          box-shadow: 0 0 18px currentColor, 0 0 36px rgba(255,255,255,.32);
          transform: translate(-50%, -50%);
          animation: fireworkCore 1.75s ease-out var(--delay) both;
        }
        .spark {
          position: absolute; left: 50%; top: 50%;
          width: var(--spark-length); height: 3px; border-radius: 999px;
          background: linear-gradient(90deg, rgba(255,255,255,.95), currentColor 55%, transparent);
          filter: drop-shadow(0 0 7px currentColor);
          transform-origin: 0 50%;
          opacity: 0;
          animation: fireworkSpark 1.75s ease-out var(--delay) both;
        }
        .spark-a { --x: -7px;  --y: -8px;  --r: -125deg; }
        .spark-b { --x: -3px;  --y: -10px; --r: -98deg; }
        .spark-c { --x: 4px;   --y: -8px;  --r: -62deg; }
        .spark-d { --x: 8px;   --y: -2px;  --r: -28deg; }
        .spark-e { --x: 4px;   --y: 7px;   --r: 32deg; opacity: .72; }
        .spark-f { --x: -8px;  --y: 6px;   --r: 148deg; opacity: .72; }
        .firework-one { left: 8vw; top: 25vh; color: rgba(173,232,255,1); --delay: 0s; }
        .firework-two { left: 13vw; top: 18vh; color: rgba(212,160,23,.98); --delay: .16s; transform: scale(.9); }
        .firework-three { left: 17vw; top: 28vh; color: rgba(10,163,163,.98); --delay: .32s; transform: scale(.82); }
        @keyframes fireworkPop {
          0% { opacity: 0; }
          12% { opacity: 1; }
          72% { opacity: .88; }
          100% { opacity: 0; }
        }
        @keyframes fireworkCore {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(.25); }
          16% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(.55); }
        }
        @keyframes fireworkSpark {
          0% { opacity: 0; width: 8px; transform: translate(var(--x), var(--y)) rotate(var(--r)) scaleX(.2); }
          18% { opacity: 1; width: var(--spark-length); }
          100% { opacity: 0; width: calc(var(--spark-length) * 1.12); transform: translate(calc(var(--x) * 3.2), calc(var(--y) * 3.2)) rotate(var(--r)) scaleX(1); }
        }

        /* Floating results button */
        /* ============================================================
           DEAD CSS below (.results-fab): no JSX references this class anymore.
           ============================================================ */
        .results-fab {
          position: fixed; bottom: 28px; right: 28px; z-index: 30;
          display: flex; align-items: center; gap: 11px;
          padding: 18px 28px; border-radius: 999px;
          background: linear-gradient(135deg, var(--navy), #253566 58%, #0a6e6e);
          color: #fff;
          font-size: 16px; font-weight: 800; border: none; cursor: pointer;
          box-shadow: 0 16px 38px rgba(0,0,0,.32), 0 0 28px rgba(10,163,163,.18);
          transition: transform .12s, box-shadow .15s;
          animation: fabIn .4s ease;
        }
        @keyframes fabIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .results-fab:hover { transform: translateY(-3px); box-shadow: 0 20px 44px rgba(0,0,0,.36), 0 0 34px rgba(10,163,163,.24); }
        .results-fab svg { width: 18px; height: 18px; }

        /* Results overlay */
        /* ============================================================
           Report-a-problem & OT results overlay modals
           ============================================================ */
        .overlay-backdrop {
          position: fixed; inset: 0; z-index: 40;
          background: rgba(0,0,0,.6); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 24px;
        }
        .overlay-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 24px; padding: 36px 40px;
          box-shadow: var(--shadow); width: 100%; max-width: 480px;
          position: relative; animation: cardIn .25s ease;
        }
        .overlay-close {
          position: absolute; top: 16px; right: 16px;
          width: 32px; height: 32px; border-radius: 999px;
          background: rgba(27,36,66,.07); border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--muted); transition: background .13s;
        }
        .overlay-close:hover { background: rgba(27,36,66,.12); }
        .report-card { max-width: 520px; }
        .report-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 24px; font-weight: 650; color: var(--navy); margin-bottom: 8px;
        }
        .report-desc { font-size: 13.5px; color: var(--muted); line-height: 1.55; margin-bottom: 16px; }
        .report-question {
          padding: 12px 14px; border-radius: 12px;
          background: rgba(27,36,66,.045); border: 1px solid rgba(27,36,66,.08);
          color: var(--navy); font-size: 13.5px; line-height: 1.45; margin-bottom: 16px;
        }
        .report-options {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px; margin-bottom: 14px;
        }
        .report-option {
          border: 1.5px solid var(--border); background: rgba(255,255,255,.72);
          color: var(--navy); border-radius: 12px; padding: 11px 12px;
          font-size: 13.5px; font-weight: 700; cursor: pointer; font-family: inherit;
          transition: border-color .13s, background .13s, color .13s;
        }
        .report-option.is-active {
          background: var(--accent-dim); border-color: var(--accent-line); color: #0a5a5a;
        }
        .report-textarea {
          width: 100%; min-height: 108px; resize: vertical;
          border: 1.5px solid var(--border); border-radius: 12px;
          padding: 12px 14px; font-size: 14px; line-height: 1.5;
          font-family: inherit; color: var(--navy); outline: none;
          background: rgba(255,255,255,.74);
        }
        .report-textarea:focus { border-color: var(--accent-line); background: #fff; }
        .report-error { color: var(--wrong); font-size: 12.5px; font-weight: 650; margin-top: 10px; }
        .report-actions {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 10px; margin-top: 16px;
        }
        .report-submit {
          border: none; border-radius: 999px; background: var(--navy); color: #fff;
          padding: 10px 18px; font-size: 13.5px; font-weight: 750;
          cursor: pointer; font-family: inherit;
        }
        .report-submit:disabled { opacity: .62; cursor: default; }
        .report-cancel {
          border: 1px solid var(--border); border-radius: 999px;
          background: rgba(255,255,255,.58); color: var(--muted);
          padding: 9px 16px; font-size: 13px; font-weight: 650;
          cursor: pointer; font-family: inherit;
        }
        .report-sent {
          padding: 22px 6px 4px; text-align: center;
          color: var(--correct); font-size: 15px; font-weight: 750;
        }
        .overlay-score {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 64px; font-weight: 700; color: var(--navy);
          line-height: 1; text-align: center; margin-bottom: 4px;
        }
        .overlay-label { text-align: center; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 20px; }
        .overlay-stats { display: flex; justify-content: center; gap: 28px; margin-bottom: 24px; }
        .overlay-stat { text-align: center; }
        .overlay-stat strong { display: block; font-size: 20px; font-weight: 700; color: var(--navy); font-family: var(--font-crimson), Georgia, serif; }
        .overlay-stat span { font-size: 12px; color: var(--muted); }
        .overlay-divider { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
        .overlay-heading { font-family: var(--font-crimson), Georgia, serif; font-size: 18px; font-weight: 600; color: var(--navy); margin-bottom: 12px; }
        .overlay-desc { font-size: 13.5px; color: var(--muted); line-height: 1.65; margin-bottom: 16px; }
        /* ============================================================
           Google sign-in & magic-link sign-in
           ============================================================ */
        .google-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; padding: 12px 20px; border-radius: 12px;
          background: #fff; color: #1f2937; font-size: 14px; font-weight: 600;
          border: 1.5px solid rgba(27,36,66,.12); cursor: pointer; font-family: inherit;
          box-shadow: 0 2px 8px rgba(0,0,0,.08); transition: box-shadow .14s, transform .12s;
          margin-bottom: 12px;
        }
        .google-btn:hover { box-shadow: 0 4px 16px rgba(0,0,0,.12); transform: translateY(-1px); }
        .google-btn svg { width: 18px; height: 18px; flex-shrink: 0; }
        .divider-or { display: flex; align-items: center; gap: 10px; margin: 12px 0; }
        .divider-or::before, .divider-or::after { content: ""; flex: 1; height: 1px; background: var(--border); }
        .divider-or span { font-size: 12px; color: var(--muted); }
        .magic-row { display: flex; gap: 8px; }
        .magic-input {
          flex: 1; padding: 11px 14px; border-radius: 10px;
          border: 1.5px solid var(--border); font-size: 14px; font-family: inherit;
          outline: none; transition: border-color .13s;
        }
        .magic-input:focus { border-color: var(--accent-line); }
        .magic-btn {
          padding: 11px 18px; border-radius: 10px;
          background: var(--navy); color: #fff; font-size: 13.5px; font-weight: 600;
          border: none; cursor: pointer; font-family: inherit; white-space: nowrap;
          transition: background .13s;
        }
        .magic-btn:hover { background: #253566; }
        .save-success { font-size: 13.5px; color: var(--correct); font-weight: 600; text-align: center; padding: 12px; }
        .skip-link { display: block; text-align: center; margin-top: 12px; font-size: 13px; color: var(--muted); cursor: pointer; }
        .skip-link:hover { color: var(--navy); }

        /* Center card (loading/error/complete) */
        /* ============================================================
           Generic center-card / button / spinner primitives
           ============================================================ */
        .center-card { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; }
        .big-num { font-family: var(--font-crimson), Georgia, serif; font-size: 72px; font-weight: 700; color: var(--navy); line-height: 1; }
        .card-heading { font-family: var(--font-crimson), Georgia, serif; font-size: 26px; font-weight: 600; color: var(--navy); }
        .card-sub { font-size: 15px; color: var(--muted); line-height: 1.6; max-width: 400px; }
        .btn-primary {
          display: flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 999px;
          background: var(--navy); color: #fff; font-size: 15px; font-weight: 600;
          text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 10px 28px rgba(27,36,66,.35); transition: background .15s, transform .13s;
        }
        .btn-primary:hover { background: #253566; transform: translateY(-2px); }
        .btn-secondary {
          font-size: 14px; color: var(--muted); text-decoration: none;
          padding: 10px 20px; border-radius: 999px;
          border: 1px solid var(--border); background: rgba(255,255,255,.5);
          transition: color .14s, background .14s;
        }
        .btn-secondary:hover { color: var(--navy); background: rgba(255,255,255,.8); }
        .spinner {
          width: 40px; height: 40px; border-radius: 50%;
          border: 3px solid rgba(27,36,66,.1); border-top-color: var(--accent);
          animation: spin .8s linear infinite; margin: 0 auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        /* ============================================================
           Between-question loader (orbit spinner)
           ============================================================ */
        .orbit-loader {
          position: relative; width: 96px; height: 96px; margin: 0 auto 2px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 50% 50%, rgba(255,246,201,.96) 0 9px, rgba(212,160,23,.96) 10px 21px, transparent 22px),
            radial-gradient(circle at 50% 50%, rgba(10,163,163,.08), transparent 62%);
          box-shadow: 0 18px 42px rgba(27,36,66,.16), inset 0 0 34px rgba(10,163,163,.08);
          isolation: isolate;
        }
        .orbit-loader::before,
        .orbit-loader::after {
          content: ""; position: absolute; border-radius: 50%;
          pointer-events: none;
        }
        .orbit-loader::before {
          inset: 18px; border: 1px dashed rgba(10,163,163,.42);
          transform: rotate(-16deg) scaleX(1.36);
        }
        .orbit-loader::after {
          width: 14px; height: 14px; left: 50%; top: 50%;
          margin: -7px 0 0 -7px;
          background: radial-gradient(circle at 35% 30%, #dbfffb, #0aa3a3 68%, #076d6d);
          box-shadow: 0 0 18px rgba(10,163,163,.58);
          animation: orbitLoaderTravel 1.45s linear infinite;
          transform-origin: 7px 7px;
        }
        .orbit-loader-star {
          position: absolute; left: 50%; top: 50%; z-index: 1;
          width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
          background:
            radial-gradient(circle at 38% 32%, #fffdf0 0 8px, #f4c73b 9px 25px, #b27608 100%);
          box-shadow: 0 0 26px rgba(212,160,23,.62), 0 0 52px rgba(212,160,23,.22);
        }
        .orbit-loader-spark {
          position: absolute; border-radius: 50%; background: rgba(255,255,255,.82);
          box-shadow: 0 0 10px rgba(255,255,255,.72);
        }
        .orbit-loader-spark.one { width: 3px; height: 3px; left: 18px; top: 30px; animation: orbitSpark 1.8s ease-in-out infinite; }
        .orbit-loader-spark.two { width: 2px; height: 2px; right: 20px; bottom: 28px; animation: orbitSpark 2.1s ease-in-out .4s infinite; }
        .orbit-loader-spark.three { width: 2px; height: 2px; right: 28px; top: 19px; animation: orbitSpark 1.6s ease-in-out .7s infinite; }
        @keyframes orbitLoaderTravel {
          from { transform: rotate(0deg) translateX(42px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(42px) rotate(-360deg); }
        }
        @keyframes orbitSpark {
          0%, 100% { opacity: .25; transform: scale(.72); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        .between-question-loader {
          align-items: center; text-align: center;
          /* Transparent dark glass instead of the near-opaque card
             background — this loader sits over the starfield only for a
             moment between questions, so let it show through rather than
             blotting it out with a solid card. .card's own 20px
             backdrop-filter blur was smearing the stars into an indistinct
             haze even at low alpha, so this drops the blur way down and
             lightens the tint further to actually read as glass. */
          background:
            radial-gradient(circle at 50% 22%, rgba(212,160,23,.14), transparent 34%),
            radial-gradient(circle at 82% 70%, rgba(10,163,163,.12), transparent 34%),
            rgba(11,15,30,.16);
          border-color: rgba(255,255,255,.16);
          backdrop-filter: blur(3px);
          box-shadow: 0 20px 50px rgba(0,0,0,.28);
        }
        .between-question-loader .startup-title { color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,.5); }
        .between-question-loader .startup-note { color: rgba(255,255,255,.72); text-shadow: 0 2px 10px rgba(0,0,0,.4); }
        .startup-status {
          display: grid; gap: 7px; max-width: 440px;
        }
        .startup-title {
          font-size: 15px; font-weight: 750; color: var(--navy);
        }
        .startup-note {
          font-size: 13px; line-height: 1.55; color: var(--muted);
        }
        .startup-actions {
          display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin-top: 4px;
        }
        /* ============================================================
           Mode-select & OT/NT testament chooser cards
           ============================================================ */
        .selection-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px; width: 100%;
        }
        .testament-card {
          text-align: left; border: 1.5px solid var(--border);
          background: rgba(255,255,255,.68); border-radius: 18px;
          padding: 22px; cursor: pointer; font-family: inherit;
          transition: transform .14s, border-color .14s, background .14s, box-shadow .14s;
        }
        .testament-card:hover,
        .testament-card:focus-visible {
          outline: none; transform: translateY(-2px);
          border-color: var(--accent-line); background: #fff;
          box-shadow: 0 14px 30px rgba(27,36,66,.13);
        }
        .testament-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
        .testament-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 24px; font-weight: 700; color: var(--navy);
        }
        .pilot-badge {
          display: inline-flex; align-items: center; border-radius: 999px;
          padding: 5px 9px; font-size: 10.5px; font-weight: 850;
          letter-spacing: .08em; text-transform: uppercase;
          background: #fef3c7; color: #92400e; border: 1px solid #fde68a;
        }
        .testament-desc { color: var(--muted); font-size: 14px; line-height: 1.55; }
        /* ============================================================
           DEAD CSS below (.nt-scope-grid/.nt-scope-btn/.nt-results-grid/
           .nt-result-row): no JSX references these classes anymore.
           ============================================================ */
        .nt-scope-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px; width: 100%; max-height: 330px; overflow: auto; padding-right: 4px;
        }
        .nt-scope-btn {
          text-align: left; border: 1.5px solid var(--border);
          border-radius: 13px; background: rgba(255,255,255,.66);
          padding: 12px 13px; cursor: pointer; font-family: inherit;
          transition: border-color .13s, background .13s, transform .11s;
        }
        .nt-scope-btn:hover,
        .nt-scope-btn:focus-visible {
          outline: none; border-color: var(--accent-line);
          background: var(--accent-dim); transform: translateY(-1px);
        }
        .nt-scope-btn.is-active {
          border-color: var(--accent-line); background: var(--accent-dim);
        }
        .nt-scope-btn strong { display: block; color: var(--navy); font-size: 13.5px; margin-bottom: 3px; }
        .nt-scope-btn span { color: var(--muted); font-size: 11.5px; line-height: 1.35; }
        .pilot-note {
          padding: 12px 14px; border-radius: 12px;
          background: rgba(212,160,23,.12); border: 1px solid rgba(212,160,23,.26);
          color: #744a08; font-size: 13px; line-height: 1.5; font-weight: 600;
        }
        .nt-results-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px; width: 100%;
        }
        .nt-result-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 11px 13px; border-radius: 12px; background: rgba(27,36,66,.045);
          color: var(--navy); font-size: 13px;
        }
        .nt-result-row span { color: var(--muted); font-weight: 650; }
        /* ============================================================
           Sky-discovery button & Bible-fact modal
           ============================================================ */
        .sky-discovery {
          position: fixed; z-index: 12;
          top: clamp(112px, 18vh, 180px); right: clamp(22px, 9vw, 150px);
          width: 32px; height: 32px; border-radius: 999px; border: 0;
          background:
            radial-gradient(circle at 34% 30%, rgba(255,255,255,.98) 0 8%, rgba(255,234,166,.96) 18%, rgba(212,160,23,.92) 44%, rgba(111,78,14,.88) 100%);
          box-shadow: 0 0 12px rgba(255,226,153,.72), 0 0 28px rgba(212,160,23,.28);
          cursor: pointer; animation: discoveryFloat 4.6s ease-in-out infinite;
        }
        .sky-discovery::after {
          content: ""; position: absolute; inset: -7px; border-radius: 999px;
          border: 1px solid rgba(255,231,169,.34);
          transform: rotate(-16deg) scaleX(1.38);
        }
        .sky-discovery:hover,
        .sky-discovery:focus-visible {
          outline: none; transform: translateY(-2px) scale(1.06);
          box-shadow: 0 0 16px rgba(255,238,190,.86), 0 0 38px rgba(212,160,23,.38);
        }
        @keyframes discoveryFloat {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -8px; }
        }
        .fact-card { max-width: 500px; }
        .fact-kicker {
          color: #9a6a09; font-size: 11px; font-weight: 850;
          text-transform: uppercase; letter-spacing: .08em; margin-bottom: 7px;
        }
        .fact-title {
          font-family: var(--font-crimson), Georgia, serif;
          color: var(--navy); font-size: 27px; font-weight: 700; margin-bottom: 8px;
        }
        .fact-copy { color: var(--muted); font-size: 15px; line-height: 1.62; }

        @media (prefers-reduced-motion: reduce) {
          /* Keep every transition/animation functional but instant, so the
             assessment still navigates without the slosh, spin, and fireworks. */
          *, *::before, *::after {
            animation-duration: .001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .001ms !important;
            scroll-behavior: auto !important;
          }
          canvas.stars.dashboard-transition { animation: none !important; }
          .dashboard-warp { display: none !important; }
        }
        .testament-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
        /* ============================================================
           Responsive: narrow-viewport overrides
           ============================================================ */
        @media (max-width: 640px) {
          .card { padding: 30px 22px; max-width: 100%; }
          .nav { display: flex; justify-content: space-between; padding: 12px 16px; }
          .card-prompt { font-size: 20px; }
          .question-head { align-items: flex-start; }
          .report-options { grid-template-columns: 1fr; }
          .nav-center { min-width: 0; }
          .nav-subphase { display: none; }
          .progress-bar-track { width: 112px; }
          .results-fab { bottom: 16px; right: 16px; padding: 10px 16px; font-size: 13px; }
          .overlay-card { padding: 28px 24px; }
          .overlay-score { font-size: 52px; }
          .selection-grid, .nt-scope-grid, .nt-results-grid { grid-template-columns: 1fr; }
          .milestone-banner { align-items: stretch; flex-direction: column; }
          .milestone-actions { display: grid; grid-template-columns: 1fr 1fr; }
          .sequence-item { grid-template-columns: 30px 34px minmax(0,1fr); padding: 9px; gap: 8px; }
          .sequence-step-controls { grid-column: 2 / -1; justify-content: flex-end; }
          .sequence-actions { align-items: stretch; flex-direction: column-reverse; }
          .sequence-submit, .sequence-skip { width: 100%; }
          .section-sort-zones { grid-template-columns: 1fr; }
          .section-sort-zone { min-height: 132px; border-radius: 8px; }
          .section-sort-zone-title { max-width: none; }
        }
`;
