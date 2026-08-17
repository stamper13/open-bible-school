// Extracted from app/knowledge-map/StarMap.tsx during a file-size cleanup.
// Pure CSS text, rendered via <style> tag(s). No behavior change intended.

export const STAR_MAP_STYLES = `
        .starmap { position: relative; }
        .sm-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        .sm-crumb { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; letter-spacing: .04em; color: rgba(255,255,255,.5); }
        .sm-crumb button { background: none; border: 0; padding: 2px 4px; cursor: pointer; font: inherit; color: #4fd6d6; border-radius: 5px; }
        .sm-crumb button:hover { text-decoration: underline; }
        .sm-crumb span[aria-current] { color: #fff; }
        .sm-back {
          margin-left: auto; display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 14px; border-radius: 999px; cursor: pointer; font: inherit;
          font-size: 12.5px; font-weight: 650;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16); color: #fff;
        }
        .sm-back:hover { background: rgba(255,255,255,.14); }
        .sm-back:disabled { opacity: .3; cursor: not-allowed; }
        .sm-stage {
          position: relative; border-radius: 18px; overflow: hidden; max-width: 900px; margin: 0 auto;
          border: 1px solid rgba(255,255,255,.12);
          background: radial-gradient(ellipse at 62% 30%, rgba(20,28,54,.92), rgba(9,12,26,.97));
          box-shadow: inset 0 0 80px rgba(0,0,0,.5);
        }
        .sm-svg { display: block; width: 100%; height: auto; touch-action: manipulation; }
        .sm-hint { position: absolute; left: 14px; bottom: 10px; font-size: 11px; font-weight: 600; color: rgba(255,255,255,.32); pointer-events: none; }

        .sm-body { cursor: pointer; }
        .sm-body:focus { outline: none; }
        .sm-body:focus-visible .sm-hit { stroke: #fff; stroke-width: 2; }
        .sm-body:hover .sm-core { filter: brightness(1.4); }
        .sm-static { cursor: default; }
        .sm-hit { fill: transparent; stroke: transparent; }
        .sm-core { stroke: rgba(255,255,255,.28); stroke-width: 1; }
        .sm-label {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 13px; font-weight: 700; fill: rgba(255,255,255,.88);
          pointer-events: none; dominant-baseline: middle;
        }
        .sm-sub {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 10px; font-weight: 600; fill: rgba(255,255,255,.42);
          pointer-events: none; dominant-baseline: middle;
        }
        .sm-edge { fill: none; stroke-linecap: round; }
        .sm-edge.dep { stroke-dasharray: 5 6; animation: smFlow 1.6s linear infinite; }
        @keyframes smFlow { to { stroke-dashoffset: -22; } }
        .sm-edge-halo { fill: none; stroke-width: 5; opacity: .13; filter: blur(2px); }
        .sm-dust { animation: smDust ease-in-out infinite alternate; }
        @keyframes smDust { from { opacity: .12; } to { opacity: .7; } }
        .sm-corona { animation: smBreathe 6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes smBreathe {
          0%, 100% { transform: scale(.92); opacity: .8; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        .sm-spikes { animation: smSpike 4.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes smSpike {
          0%, 100% { transform: scale(.8); opacity: .55; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        .sm-rail-line { stroke: rgba(255,255,255,.13); stroke-width: 1; }
        .sm-rail-tick { stroke: rgba(255,255,255,.2); stroke-width: 1; }
        .sm-rail-label {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 10.5px; font-weight: 750; fill: rgba(255,255,255,.62);
          text-anchor: end; dominant-baseline: middle;
        }
        .sm-rail-sub {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 9px; font-weight: 600; fill: rgba(255,255,255,.34);
          text-anchor: end; dominant-baseline: middle;
        }
        .sm-rail-title {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 9.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
          fill: rgba(255,255,255,.4); text-anchor: end;
        }
        /* transform-based, not filter:brightness() — see FocusStarMap.tsx's
           .fsm-twinkle for why: filter animations on many simultaneous
           stars force a repaint per frame instead of a cheap
           compositor-only pass, which showed up as intermittent color
           flicker/"glitching" under load. */
        .sm-twinkle { animation: smTwinkle 3.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes smTwinkle { 0%,100% { transform: scale(.96); } 50% { transform: scale(1.06); } }

        .sm-panel {
          margin-top: 14px; display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 16px; align-items: center;
          padding: 16px 18px; border-radius: 14px;
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12);
        }
        .sm-panel-title { font-family: var(--font-crimson), Georgia, serif; font-size: 20px; font-weight: 600; color: #fff; }
        .sm-panel-when { font-family: var(--font-inter), system-ui, sans-serif; font-size: 11.5px; font-weight: 750; color: #f0c674; margin-top: 3px; letter-spacing: .03em; }
        .sm-panel-sub { font-size: 12.5px; color: rgba(255,255,255,.5); margin-top: 4px; line-height: 1.5; }
        .sm-panel-copy { font-size: 13px; line-height: 1.6; color: rgba(255,255,255,.62); margin-top: 8px; }
        .sm-chip { display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
        .sm-dot { width: 8px; height: 8px; border-radius: 50%; }
        .sm-stats { display: flex; gap: 18px; margin-top: 10px; }
        .sm-stat { font-size: 11px; color: rgba(255,255,255,.42); font-weight: 650; }
        .sm-stat b { display: block; font-size: 17px; color: #fff; font-weight: 750; font-family: var(--font-crimson), Georgia, serif; }
        .sm-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
        .sm-legend span { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 650; color: rgba(255,255,255,.45); }
        .sm-temp-bar {
          width: 120px; height: 8px; border-radius: 999px;
          background: linear-gradient(90deg, #d96a4f, #e8a04c, #f3d38a, #f5f2ea, #a8c5ff);
        }
        .sm-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

        @media (prefers-reduced-motion: reduce) {
          .sm-twinkle, .sm-edge.dep, .sm-dust, .sm-corona, .sm-spikes { animation: none !important; }
        }
        @media (max-width: 640px) {
          .sm-panel { grid-template-columns: 1fr; }
          .sm-label { font-size: 20px; }
          .sm-sub { font-size: 15px; }
          .sm-rail-label { font-size: 16px; }
          .sm-rail-sub { font-size: 13px; }
          .sm-rail-title { font-size: 14px; }
        }
`;
