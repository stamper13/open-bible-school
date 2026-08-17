// Extracted from app/knowledge-map/MapOverview.tsx during a file-size cleanup.
// Pure CSS text, rendered via <style> tag(s). No behavior change intended.

export const MAP_OVERVIEW_STYLES = `
        .mov { position: relative; }
        .mov.is-motion-paused .mov-edge,
        .mov.is-motion-paused .mov-twinkle,
        .mov.is-motion-paused .mov-ring {
          animation-play-state: paused !important;
        }
        .mov-tools {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .mov-filter-label {
          color: rgba(237,244,251,.76); font-size: 11px; font-weight: 900;
          letter-spacing: .09em; text-transform: uppercase;
        }
        .mov-filter-btn {
          appearance: none; border: 1px solid rgba(255,255,255,.15);
          background: rgba(255,255,255,.055); color: rgba(255,255,255,.86);
          min-height: 32px; padding: 7px 11px; border-radius: 999px;
          cursor: pointer; font: inherit; font-size: 12px; font-weight: 850;
        }
        .mov-filter-btn:hover,
        .mov-filter-btn.is-active { color: #fff; background: rgba(255,255,255,.13); border-color: rgba(255,255,255,.30); }
        .mov-filter-btn.is-active { box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
        .mov-shell {
          display: grid; grid-template-columns: minmax(0,1fr) 320px; gap: 14px; align-items: start;
        }
        .mov-stage {
          position: relative; border-radius: 18px; overflow: hidden;
          border: 1px solid rgba(255,255,255,.12);
          background: radial-gradient(ellipse at 50% 20%, rgba(20,28,54,.85), rgba(9,12,26,.97));
          box-shadow: inset 0 0 90px rgba(0,0,0,.5);
        }
        .mov-svg { display: block; width: 100%; height: auto; }
        .mov-mobile-note { display: none; }
        .mov-rail-line { stroke: rgba(255,255,255,.22); stroke-width: 1; }
        .mov-rail-tick { stroke: rgba(255,255,255,.34); stroke-width: 1; }
        .mov-rail-label {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 13.5px; font-weight: 900; fill: rgba(255,255,255,.90);
          text-anchor: end; dominant-baseline: middle;
          paint-order: stroke fill; stroke: rgba(0,0,12,.90); stroke-width: 3.5px; stroke-linejoin: round;
        }
        .mov-rail-sub {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 11px; font-weight: 800; fill: rgba(255,255,255,.72);
          text-anchor: end; dominant-baseline: middle;
          paint-order: stroke fill; stroke: rgba(0,0,12,.78); stroke-width: 2.5px; stroke-linejoin: round;
        }
        .mov-lane-label {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 15px; font-weight: 950; letter-spacing: .09em; text-transform: uppercase;
          text-anchor: middle; pointer-events: none;
          paint-order: stroke fill; stroke: rgba(0,0,12,.72); stroke-width: 3px; stroke-linejoin: round;
        }
        .mov-axis-label {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 10px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase;
          fill: rgba(255,255,255,.72); pointer-events: none;
          paint-order: stroke fill; stroke: rgba(0,0,12,.82); stroke-width: 2.5px; stroke-linejoin: round;
        }
        .mov-axis-note {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 10px; font-weight: 850; fill: rgba(255,255,255,.68);
          pointer-events: none; paint-order: stroke fill; stroke: rgba(0,0,12,.78); stroke-width: 2.5px; stroke-linejoin: round;
        }
        .mov-edge { fill: none; stroke-linecap: round; stroke-dasharray: 5 6; animation: movFlow 1.8s linear infinite; }
        @keyframes movFlow { to { stroke-dashoffset: -22; } }
        .mov-edge-halo { fill: none; stroke-width: 6; opacity: .14; filter: blur(2px); }
        .mov-tether { fill: none; stroke: rgba(255,255,255,.14); stroke-width: 1; stroke-dasharray: 2 4; }
        .mov-body { cursor: pointer; transition: opacity .18s ease; }
        .mov-body:focus { outline: none; }
        .mov-body:focus-visible .mov-hit { stroke: #fff; stroke-width: 2; }
        .mov-body:hover .mov-core { filter: brightness(1.35); }
        .mov-body:hover .mov-hit { stroke: rgba(255,255,255,.45); stroke-width: 1.3; }
        .mov-body.is-dimmed { opacity: .16; }
        .mov-hit { fill: transparent; stroke: transparent; }
        .mov-core { stroke: rgba(255,255,255,.24); stroke-width: 1; }
        .mov-label {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 12.5px; font-weight: 900; fill: rgba(255,255,255,.98);
          pointer-events: none; dominant-baseline: middle;
          paint-order: stroke fill; stroke: rgba(0,0,12,.96); stroke-width: 4.5px; stroke-linejoin: round;
        }
        /* In dense stretches (the eighth-century prophets, mainly) not every
           book's label fits without running into a neighbour. Rather than
           drop that book's name outright, it's just held back until the
           body is hovered or focused — the label still exists, one
           interaction away, instead of a name that's simply gone. */
        .mov-label-onhover { opacity: 0; transition: opacity .15s ease; }
        .mov-body:hover .mov-label-onhover,
        .mov-body:focus-visible .mov-label-onhover { opacity: 1; }
        /* transform-based, not filter:brightness() — see FocusStarMap.tsx's
           .fsm-twinkle for why: filter animations on many simultaneous
           planets force a repaint per frame instead of a cheap
           compositor-only pass, which showed up as intermittent color
           flicker/"glitching" under load. */
        .mov-twinkle { animation: movTwinkle 4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes movTwinkle { 0%,100% { transform: scale(.96); } 50% { transform: scale(1.06); } }
        .mov-ring { animation: movRing 3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes movRing { 0%,100% { opacity: .55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.14); } }

        .mov-panel {
          position: sticky; top: 76px; display: grid; gap: 14px;
          padding: 16px 17px; border-radius: 14px;
          background: rgba(5,8,20,.92); border: 1px solid rgba(255,255,255,.14);
          box-shadow: 0 18px 36px rgba(0,0,0,.28);
        }
        .mov-panel-kicker {
          margin: 0 0 6px; color: rgba(255,255,255,.72);
          font-size: 10px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase;
        }
        .mov-panel-title { margin: 0; font-family: var(--font-crimson), Georgia, serif; font-size: 23px; line-height: 1.05; font-weight: 700; color: #fff; }
        .mov-panel-ref {
          display: inline-flex; width: fit-content; margin: 0 0 7px;
          padding: 5px 9px; border-radius: 999px;
          background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.17);
          color: #fff1b8; font-size: 11.5px; font-weight: 900; line-height: 1;
        }
        .mov-panel-sub { font-size: 13px; color: rgba(255,255,255,.78); margin: 7px 0 0; line-height: 1.4; }
        .mov-chip {
          display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 999px;
          font-size: 11.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap;
        }
        .mov-dot { width: 8px; height: 8px; border-radius: 50%; }
        .mov-open-btn {
          margin-top: 10px; display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 14px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 650;
          background: rgba(255,255,255,.09); border: 1px solid rgba(255,255,255,.22); color: #fff;
        }
        .mov-open-btn:hover { background: rgba(255,255,255,.16); }
        .mov-panel-empty { color: rgba(237,244,251,.76); font-size: 13px; line-height: 1.5; }
        .mov-panel-meta { display: grid; gap: 9px; }
        .mov-panel-actions { display: flex; flex-wrap: wrap; gap: 8px; }

        .mov-legend {
          display: flex; align-items: center; gap: 22px; flex-wrap: wrap;
          margin-bottom: 12px; padding: 10px 16px; border-radius: 12px;
          background: rgba(4,6,16,0.9); border: 1px solid rgba(255,255,255,0.20);
        }
        .mov-legend-item { display: flex; align-items: center; gap: 9px; }
        .mov-legend-dots { display: flex; gap: 4px; }
        .mov-legend-label { font-size: 13.5px; font-weight: 800; color: rgba(255,255,255,0.92); white-space: nowrap; }
        @media (max-width: 640px) {
          .mov-legend { gap: 14px 20px; }
        }
        @media (max-width: 900px) {
          .mov-shell { display: block; }
          .mov-panel { position: static; margin-bottom: 12px; }
        }
        @media (max-width: 640px) {
          .mov-tools { gap: 8px; }
          .mov-filter-label { width: 100%; }
          .mov-filter-btn { font-size: 11.5px; padding: 7px 9px; }
          .mov-mobile-note {
            display: block; margin: 0 0 12px; padding: 10px 12px;
            border: 1px solid rgba(255,255,255,.14); border-radius: 10px;
            background: rgba(255,255,255,.055); color: rgba(237,244,251,.70);
            font-size: 12px; font-weight: 750; line-height: 1.45;
          }
          .mov-stage { pointer-events: none; }
        }
`;
