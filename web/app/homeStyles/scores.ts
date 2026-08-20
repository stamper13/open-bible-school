export const HOME_SCORE_STYLES = `        /* ============================================================
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
`;
