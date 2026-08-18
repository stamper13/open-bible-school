// Extracted from app/results/[attemptId]/page.tsx during a file-size cleanup.
// Pure CSS text, rendered via <style> tag(s). No behavior change intended.

export const RESULTS_PAGE_STYLES = `
        :root {
          /* --navy/--accent/--muted now come from app/globals.css */
          --gold: #d4a017;
          --card: rgba(255,255,255,.95);
          --line: rgba(27,36,66,.11);
          --soft: rgba(27,36,66,.055);
          --correct: #08785f;
          --wrong: #b63b4b;
        }
        *, *::before, *::after { box-sizing: border-box; }
        html { background: #0b0f1e; }
        body { margin: 0; background: #0b0f1e; color: var(--navy); font-family: var(--font-inter), system-ui, sans-serif; }
        .results-page { min-height: 100vh; position: relative; isolation: isolate; padding-bottom: 72px; }
        .action-primary:focus-visible,
        .action-secondary:focus-visible,
        .results-nav-link:focus-visible,
        .results-brand:focus-visible,
        .filter-btn:focus-visible,
        .review-trigger:focus-visible {
          outline: 2px solid #4fd6d6; outline-offset: 3px;
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: .001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .001ms !important;
          }
        }
        .results-page::before {
          content: ""; position: fixed; inset: 0; z-index: -3;
          background: linear-gradient(180deg, #0b0f1e 0%, #111827 54%, #0d1530 100%);
        }
        .results-stars { position: fixed; inset: 0; z-index: -2; pointer-events: none; }
        .results-nav {
          min-height: 64px; display: flex; align-items: center; justify-content: space-between;
          padding: 0 32px; border-bottom: 1px solid rgba(255,255,255,.08);
          background: rgba(8,12,25,.78); backdrop-filter: blur(14px);
        }
        .results-brand { color: #fff; text-decoration: none; font: 700 17px var(--font-crimson), Georgia, serif; }
        .results-nav-link {
          color: rgba(255,255,255,.67); text-decoration: none; font-size: 13px; font-weight: 650;
          padding: 8px 13px; border: 1px solid rgba(255,255,255,.12); border-radius: 999px;
        }
        .results-shell { width: min(980px, calc(100% - 32px)); margin: 0 auto; padding-top: 52px; }
        .results-kicker {
          color: rgba(255,255,255,.58); font-size: 11px; font-weight: 800;
          letter-spacing: .16em; text-transform: uppercase; margin: 0 0 10px;
        }
        .results-title {
          color: #fff; font: 700 clamp(30px, 5vw, 48px)/1.02 var(--font-crimson), Georgia, serif;
          letter-spacing: 0; margin: 0;
        }
        .results-date { color: rgba(255,255,255,.56); font-size: 13px; margin: 9px 0 26px; }
        .results-summary {
          display: grid; grid-template-columns: 250px minmax(0, 1fr);
          background: var(--card); border: 1px solid rgba(255,255,255,.55);
          border-radius: 8px; box-shadow: 0 24px 70px rgba(0,0,0,.34); overflow: hidden;
        }
        .results-summary.is-in-progress { grid-template-columns: 1fr; }
        .score-signal {
          min-height: 220px; padding: 28px; display: flex; flex-direction: column; justify-content: center;
          border-right: 1px solid var(--line); background: rgba(10,163,163,.07);
        }
        .score-value { font: 750 66px/1 var(--font-crimson), Georgia, serif; color: var(--navy); }
        .score-value span { font: 700 28px/1 var(--font-inter), sans-serif; }
        .score-label { margin-top: 8px; color: var(--muted); font-size: 12px; font-weight: 750; line-height: 1.45; }
        .summary-body { min-width: 0; padding: 28px 30px; }
        .summary-heading { margin: 0; font: 700 25px/1.1 var(--font-crimson), Georgia, serif; }
        .summary-copy { color: var(--muted); font-size: 14px; line-height: 1.55; margin: 7px 0 24px; }
        .metric-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-block: 1px solid var(--line); }
        .metric { padding: 15px 12px; border-right: 1px solid var(--line); }
        .metric:first-child { padding-left: 0; }
        .metric:last-child { border-right: 0; }
        .metric strong { display: block; font: 750 23px/1 var(--font-crimson), Georgia, serif; }
        .metric span { display: block; color: var(--muted); font-size: 11px; font-weight: 700; margin-top: 5px; }
        .scope-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
        .scope-chip { color: var(--navy); background: var(--soft); border: 1px solid var(--line); border-radius: 999px; padding: 7px 10px; font-size: 11px; font-weight: 700; }
        .results-actions { display: flex; align-items: center; gap: 14px; margin: 22px 0 40px; }
        .action-primary, .action-secondary {
          min-height: 54px; display: inline-flex; align-items: center; justify-content: center;
          border-radius: 999px; padding: 0 32px; font-size: 15.5px; font-weight: 750;
          text-decoration: none; cursor: pointer; font-family: inherit;
          transition: background .15s ease, transform .15s ease, box-shadow .15s ease;
        }
        .action-primary {
          color: #fff; border: 0; background: var(--navy); box-shadow: 0 12px 28px rgba(0,0,0,.3);
        }
        .action-primary:hover { background: #232f57; transform: translateY(-2px); box-shadow: 0 16px 34px rgba(0,0,0,.36); }
        .action-secondary {
          color: rgba(255,255,255,.85); border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.07);
        }
        .action-secondary:hover { background: rgba(255,255,255,.13); transform: translateY(-2px); }
        .review-section { background: var(--card); border: 1px solid rgba(255,255,255,.46); border-radius: 8px; overflow: hidden; }
        .review-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; padding: 24px 26px 18px; border-bottom: 1px solid var(--line); }
        .review-title { margin: 0; font: 700 25px/1.1 var(--font-crimson), Georgia, serif; }
        .review-sub { color: var(--muted); font-size: 12px; margin: 5px 0 0; }
        .review-filters { display: inline-flex; padding: 3px; gap: 2px; border: 1px solid var(--line); border-radius: 999px; background: var(--soft); }
        .filter-btn {
          border: 0; border-radius: 999px; padding: 8px 12px; background: transparent;
          color: var(--muted); font: 700 11px var(--font-inter), sans-serif; cursor: pointer;
        }
        .filter-btn.active { color: var(--navy); background: #fff; box-shadow: 0 2px 8px rgba(27,36,66,.11); }
        .review-list { display: block; }
        .review-row { border-bottom: 1px solid var(--line); }
        .review-row:last-child { border-bottom: 0; }
        .review-trigger {
          width: 100%; display: grid; grid-template-columns: 30px minmax(0,1fr) auto 24px;
          gap: 12px; align-items: center; padding: 17px 24px; border: 0; background: transparent;
          color: var(--navy); text-align: left; cursor: pointer; font-family: inherit;
        }
        .review-trigger:hover { background: rgba(10,163,163,.04); }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; justify-self: center; background: var(--correct); box-shadow: 0 0 0 5px rgba(8,120,95,.10); }
        .status-dot.missed { background: var(--wrong); box-shadow: 0 0 0 5px rgba(182,59,75,.10); }
        .status-dot.skipped { background: #6b7280; box-shadow: 0 0 0 5px rgba(107,114,128,.10); }
        .review-prompt { min-width: 0; font-size: 13px; font-weight: 700; line-height: 1.4; }
        .review-meta { color: var(--muted); font-size: 10px; font-weight: 650; margin-top: 4px; }
        .review-state { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--correct); }
        .review-state.missed { color: var(--wrong); }
        .review-state.skipped { color: #6b7280; }
        .chevron { font-size: 18px; color: var(--muted); transform: rotate(0); transition: transform .18s ease; }
        .chevron.open { transform: rotate(90deg); }
        .review-detail { padding: 0 24px 22px 66px; }
        .answer-line { display: grid; grid-template-columns: 112px minmax(0,1fr); gap: 12px; padding: 9px 0; border-top: 1px solid var(--line); font-size: 12px; line-height: 1.5; }
        .answer-line strong { color: var(--muted); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
        .answer-line.correct-answer span { color: var(--correct); font-weight: 700; }
        .sequence-review-list {
          list-style: none; display: grid; gap: 7px; margin: 0; padding: 0;
          counter-reset: sequence-review;
        }
        .sequence-review-list li {
          counter-increment: sequence-review; display: grid;
          grid-template-columns: 23px minmax(0,1fr); align-items: start; gap: 8px;
          color: var(--navy); font-weight: 600;
        }
        .sequence-review-list li::before {
          content: counter(sequence-review); width: 21px; height: 21px;
          display: grid; place-items: center; border-radius: 50%;
          background: rgba(27,36,66,.08); color: var(--navy);
          font-size: 10px; font-weight: 800;
        }
        .correct-answer .sequence-review-list li { color: var(--correct); }
        .correct-answer .sequence-review-list li::before {
          background: rgba(8,120,95,.10); color: var(--correct);
        }
        .explanation { color: var(--muted); }
        .empty-review { color: var(--muted); font-size: 13px; padding: 30px 26px; }
        .results-state {
          min-height: calc(100vh - 64px); display: grid; place-items: center; padding: 30px;
          color: #fff; text-align: center;
        }
        .state-panel { width: min(430px, 100%); }
        .state-title { font: 700 30px var(--font-crimson), Georgia, serif; margin-bottom: 8px; }
        .state-copy { color: rgba(255,255,255,.62); font-size: 13px; line-height: 1.55; }
        .loader { width: 34px; height: 34px; margin: 0 auto 18px; border-radius: 50%; border: 3px solid rgba(255,255,255,.15); border-top-color: var(--accent); animation: spin .75s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 720px) {
          .results-nav { padding: 0 16px; }
          .results-shell { width: min(100% - 20px, 980px); padding-top: 32px; }
          .results-summary { grid-template-columns: 1fr; }
          .score-signal { min-height: 150px; border-right: 0; border-bottom: 1px solid var(--line); padding: 22px; }
          .score-value { font-size: 56px; }
          .summary-body { padding: 22px 18px; }
          .metric-row { grid-template-columns: repeat(2, 1fr); }
          .metric:nth-child(2) { border-right: 0; }
          .metric:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
          .metric:nth-child(3) { padding-left: 0; }
          .results-actions { align-items: stretch; flex-direction: column; }
          .review-head { align-items: stretch; flex-direction: column; padding: 21px 18px 16px; }
          .review-filters { width: 100%; }
          .filter-btn { flex: 1; padding-inline: 6px; }
          .review-trigger { grid-template-columns: 22px minmax(0,1fr) 20px; padding: 15px 14px; gap: 9px; }
          .review-state { display: none; }
          .review-detail { padding: 0 14px 18px 45px; }
          .answer-line { grid-template-columns: 1fr; gap: 4px; }
        }
`;
