// Extracted from app/knowledge-map/FocusStarMap.tsx during a file-size cleanup.
// Pure CSS text, rendered via <style> tag(s). No behavior change intended.

export const FOCUS_STAR_MAP_STYLES = `
        .fsm { display: block; }
        .fsm.is-motion-paused .fsm-twinkle,
        .fsm.is-motion-paused .fsm-corona,
        .fsm.is-motion-paused .fsm-ring,
        .fsm.is-motion-paused .fsm-spikes,
        .fsm.is-motion-paused .fsm-orbit,
        .fsm.is-motion-paused .fsm-counter,
        .fsm.is-motion-paused .fsm-moon-orbit {
          animation-play-state: paused !important;
        }
        .fsm-layout {
          --fsm-left-bleed: max(24px, calc((100vw - 1575px) / 2));
          display: grid;
          grid-template-columns: minmax(430px, .46fr) minmax(0, .54fr);
          gap: 24px;
          align-items: start;
          width: calc(100% + (var(--fsm-left-bleed) * 2));
          margin-left: calc(-1 * var(--fsm-left-bleed));
        }
        .fsm-stage {
          position: relative;
          order: 2;
          width: 100%;
          max-width: 980px;
          justify-self: center;
        }
        .fsm.is-full-view .fsm-layout {
          grid-template-columns: 1fr;
          width: 100%;
          margin-left: 0;
        }
        .fsm.is-full-view .fsm-stage {
          order: 1;
          max-width: min(1280px, 100%);
          padding-inline: clamp(32px, 6vw, 84px);
        }
        .fsm.is-full-view .fsm-side { display: none; }
        .fsm-svg { display: block; width: 100%; height: auto; overflow: visible; touch-action: manipulation; }

        .fsm-body { cursor: pointer; }
        .fsm-body:focus { outline: none; }
        .fsm-body:focus-visible .fsm-hit { stroke: #fff; stroke-width: 2; }
        .fsm-body:hover .fsm-core { filter: brightness(1.4); }
        .fsm-body.is-linked .fsm-core { filter: brightness(1.55) saturate(1.25); }
        .fsm-body.is-linked .fsm-label,
        .fsm-body.is-linked .fsm-moon-label { fill: #fff; stroke-width: 6px; }
        .fsm-hit { fill: transparent; stroke: transparent; }
        /* magnetic swap: a section slides between its slot and the centre.
           Opacity is included so the reveal animation (mount hidden, then
           fade/scale in) rides the same transition as the ordinary swap. */
        .fsm-section { transition: transform .5s cubic-bezier(.34, 1.32, .5, 1), opacity .5s ease-out; }
        .fsm-reveal-fade { transition: opacity .5s ease-out .18s; }
        .fsm-dep { fill: none; stroke-width: 1.5; opacity: .68; stroke-dasharray: 4 4; }
        .fsm-home { stroke-width: 1.7; opacity: .72; }
        .fsm-ghost { fill: rgba(255,255,255,.015); stroke-width: 1.4; stroke-dasharray: 4 4; opacity: .55; }
        .fsm-ghost-label {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 15px; font-weight: 850; fill: rgba(255,255,255,.86);
          pointer-events: none; dominant-baseline: middle;
          paint-order: stroke fill;
          stroke: rgba(0,0,12,0.94); stroke-width: 4.5px; stroke-linejoin: round;
        }
        .fsm-core { stroke: rgba(255,255,255,.26); stroke-width: 1; }

        .fsm-label {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-weight: 850; fill: rgba(255,255,255,.98);
          pointer-events: none; dominant-baseline: middle;
          paint-order: stroke fill;
          stroke: rgba(0,0,12,0.95); stroke-width: 5px; stroke-linejoin: round;
        }
        .fsm-moon-label {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 13px; font-weight: 900; fill: rgba(255,255,255,.98);
          pointer-events: none; dominant-baseline: middle;
          paint-order: stroke fill;
          stroke: rgba(0,0,12,0.96); stroke-width: 4.5px; stroke-linejoin: round;
        }
        .fsm-orbit-ring { fill: none; stroke: rgba(255,255,255,.14); stroke-width: 1; stroke-dasharray: 3 7; }
        .fsm-rail-track {
          stroke: rgba(255,255,255,.20);
          stroke-width: 1.2;
          stroke-linecap: round;
          stroke-dasharray: 4 8;
        }
        .fsm-section-rail .fsm-section {
          transition: transform .62s cubic-bezier(.25, 1.42, .34, 1), opacity .5s ease-out;
        }
        .fsm-section-rail .fsm-label {
          font-size: 13px;
          fill: rgba(255,255,255,.9);
          stroke-width: 4px;
        }
        .fsm-section-rail .fsm-section.is-open .fsm-label {
          fill: #fff;
        }
        .fsm-section-rail .fsm-section.is-open .fsm-core {
          filter: brightness(1.32) saturate(1.18);
        }
        .fsm-rail-ghost {
          pointer-events: none;
          opacity: .72;
        }
        .fsm-rail-ghost-orb {
          fill: rgba(255,255,255,.018);
          stroke: var(--hue);
          stroke-width: 1.6;
          stroke-dasharray: 5 6;
        }
        .fsm-rail-ghost-label {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 13px; font-weight: 850;
          fill: rgba(255,255,255,.72);
          dominant-baseline: middle; text-anchor: middle;
          paint-order: stroke fill;
          stroke: rgba(0,0,12,.92); stroke-width: 4px; stroke-linejoin: round;
        }
        .fsm-orbit, .fsm-moon-orbit {
          animation-name: fsmSpin; animation-timing-function: linear; animation-iteration-count: infinite;
          transition: opacity .5s ease-out .15s;
        }
        .fsm-counter {
          animation-name: fsmSpin; animation-timing-function: linear; animation-iteration-count: infinite;
          animation-direction: reverse;
        }
        @keyframes fsmSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .fsm-edge { fill: none; stroke-linecap: round; }
        .fsm-edge-halo { fill: none; stroke-width: 5; opacity: .12; filter: blur(2px); }

        /* transform-based, not filter:brightness() — filter animations on
           many simultaneous stars force a repaint per frame (rather than a
           cheap compositor-only pass like transform/opacity get), which is
           what was showing up as intermittent color flicker/"glitching"
           under load. transform-box/transform-origin match the same
           technique already used by .fsm-corona etc. just below. */
        .fsm-twinkle { animation: fsmTwinkle 3.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes fsmTwinkle { 0%,100% { transform: scale(.96); } 50% { transform: scale(1.06); } }
        .fsm-corona { animation: fsmBreathe 6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes fsmBreathe { 0%,100% { transform: scale(.94); opacity: .82; } 50% { transform: scale(1.08); opacity: 1; } }
        .fsm-ring { animation: fsmRing 3.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes fsmRing { 0%,100% { opacity: .5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.12); } }
        .fsm-spikes { animation: fsmSpike 4.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes fsmSpike { 0%,100% { opacity: .35; transform: scale(.82); } 50% { opacity: .9; transform: scale(1.12); } }

        /* Left column, Khan-Academy-style: the open book's outline stays put
           beside the map instead of trailing below it, so picking a
           different book doesn't require scrolling back up past a long
           section list to see the map react. */
        .fsm-side {
          display: grid; gap: 14px; order: 1; align-self: start;
          width: 100%; position: sticky; top: 76px;
        }
        .fsm-panel {
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(8,13,29,.84);
          box-shadow: 0 14px 30px rgba(0,0,0,.22);
          overflow: hidden;
        }
        .fsm-next {
          padding: 17px 18px;
          border-left: 6px solid var(--hue);
          background:
            linear-gradient(105deg, color-mix(in srgb, var(--hue) 20%, transparent), rgba(8,13,29,.88) 54%),
            rgba(8,13,29,.90);
        }
        .fsm-next-kicker,
        .fsm-panel-kicker {
          margin: 0 0 6px;
          font-size: 10px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase;
        }
        .fsm-next-kicker { color: color-mix(in srgb, var(--hue) 74%, #ffffff); }
        .fsm-next-title {
          margin: 0;
          font-family: var(--font-crimson), Georgia, serif;
          color: #fff; font-size: 26px; font-weight: 750; line-height: 1.04;
        }
        .fsm-next-ref {
          display: inline-flex; width: fit-content; margin: 0 0 8px;
          padding: 5px 9px; border-radius: 999px;
          background: rgba(255,255,255,.11);
          border: 1px solid rgba(255,255,255,.20);
          color: #fff1b8; font-size: 12px; font-weight: 950; line-height: 1;
        }
        .fsm-breadcrumb {
          margin: 7px 0 0; color: rgba(237,244,251,.76);
          font-size: 12px; font-weight: 800; line-height: 1.35;
        }
        .fsm-next-state {
          display: inline-flex; align-items: center; gap: 7px;
          margin-top: 11px; padding: 7px 9px; border-radius: 999px;
          background: rgba(255,255,255,.07); color: #fff;
          font-size: 12px; font-weight: 850;
        }
        .fsm-next-state::before,
        .fsm-status-dot {
          content: ""; display: inline-block; flex: 0 0 auto;
          width: 9px; height: 9px; border-radius: 50%;
          background: var(--dot); opacity: var(--dot-opacity, 1);
          box-shadow: 0 0 8px color-mix(in srgb, var(--dot) 70%, transparent);
        }
        .fsm-next-actions { display: flex; gap: 9px; flex-wrap: wrap; margin-top: 14px; }
        .fsm-action {
          display: inline-flex; min-height: 36px; align-items: center; justify-content: center;
          padding: 8px 12px; border-radius: 7px; text-decoration: none;
          font-size: 12px; font-weight: 900;
        }
        .fsm-action.primary { background: #fff; color: var(--navy); }
        .fsm-action.secondary { border: 1px solid rgba(255,255,255,.20); color: #fff; background: rgba(255,255,255,.06); }
        .fsm-legend {
          padding: 14px 16px;
          border-left: 6px solid var(--hue);
        }
        .fsm-legend-title {
          margin: 0 0 11px; padding-bottom: 10px;
          border-bottom: 1px solid rgba(255,255,255,.16);
          font-size: 11px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase;
          color: rgba(255,255,255,.78);
        }
        .fsm-legend-row { display: flex; align-items: center; gap: 10px; margin-top: 9px; color: rgba(255,255,255,.88); font-size: 13px; font-weight: 850; }
        .fsm-legend-dot { width: 13px; height: 13px; border-radius: 50%; background: var(--dot); opacity: var(--dot-opacity, 1); flex: 0 0 auto; }
        .fsm-course { border-left: 6px solid var(--hue); }
        .fsm-course-head {
          display: flex; align-items: start; justify-content: space-between; gap: 12px;
          padding: 15px 17px 12px; border-bottom: 1px solid rgba(255,255,255,.10);
        }
        .fsm-panel-kicker { color: color-mix(in srgb, var(--hue) 70%, #ffffff); }
        .fsm-course-title { margin: 0; color: #fff; font-family: var(--font-crimson), Georgia, serif; font-size: 22px; line-height: 1.05; }
        .fsm-course-sub { margin: 5px 0 0; color: rgba(237,244,251,.75); font-size: 12px; font-weight: 750; }
        .fsm-course-status { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; color: rgba(237,244,251,.88); font-size: 12px; font-weight: 850; }
        .fsm-book-group { border-bottom: 1px solid rgba(255,255,255,.08); }
        .fsm-book-group:last-child { border-bottom: 0; }
        .fsm-book-row {
          width: 100%; display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 12px;
          align-items: center; padding: 12px 17px; border: 0;
          text-align: left; color: #fff; background: transparent; cursor: pointer;
        }
        .fsm-book-row:hover,
        .fsm-book-row.is-selected,
        .fsm-book-row.is-linked { background: rgba(255,255,255,.07); }
        .fsm-book-row.is-linked { box-shadow: inset 4px 0 0 var(--row-hue); }
        .fsm-book-name { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 14px; font-weight: 900; }
        .fsm-book-meta { margin-top: 4px; color: rgba(237,244,251,.74); font-size: 11.5px; font-weight: 750; }
        .fsm-pips { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; max-width: 132px; }
        .fsm-pip { width: 10px; height: 10px; border-radius: 3px; background: var(--dot); opacity: var(--dot-opacity, 1); }
        .fsm-inline-units {
          padding: 7px 14px 14px 42px;
          background: rgba(255,255,255,.035);
          border-top: 1px solid rgba(255,255,255,.08);
        }
        .fsm-inline-head {
          display: flex; align-items: center; justify-content: space-between; gap: 8px 10px; flex-wrap: wrap;
          margin-bottom: 8px; color: rgba(237,244,251,.74);
          font-size: 11px; font-weight: 850;
        }
        .fsm-inline-head span:first-child { color: rgba(237,244,251,.88); }
        .fsm-inline-head span:last-child { text-align: right; max-width: 62%; }
        .fsm-inline-unit {
          display: grid; grid-template-columns: minmax(0,1fr) auto auto;
          gap: 10px; align-items: center;
          padding: 9px 0 9px 14px;
          border-left: 1px solid rgba(255,255,255,.14);
          border-bottom: 1px solid rgba(255,255,255,.07);
        }
        .fsm-inline-unit:last-child { border-bottom: 0; }
        .fsm-inline-unit.is-focus,
        .fsm-inline-unit.is-selected,
        .fsm-inline-unit.is-linked {
          margin-left: -8px; padding-left: 18px; border-radius: 8px;
          background: color-mix(in srgb, var(--hue) 11%, rgba(255,255,255,.05));
          border-left-color: var(--dot);
          box-shadow: inset 4px 0 0 var(--dot);
        }
        .fsm-inline-unit-main {
          appearance: none; border: 0; background: transparent; color: inherit;
          display: grid; grid-template-columns: 14px minmax(0,1fr);
          gap: 10px; align-items: center; padding: 0; text-align: left; min-width: 0;
          cursor: pointer; font: inherit;
        }
        .fsm-inline-unit-main:focus-visible { outline: 2px solid var(--hue); outline-offset: 3px; border-radius: 6px; }
        .fsm-inline-dot { width: 14px; height: 14px; border-radius: 4px; background: var(--dot); opacity: var(--dot-opacity, 1); }
        .fsm-inline-unit.is-thin .fsm-inline-dot { background: transparent; border: 1.5px dashed var(--dot); }
        .fsm-inline-kicker {
          display: block; margin-bottom: 4px;
          color: color-mix(in srgb, var(--hue) 68%, #ffffff);
          font-size: 8.5px; font-weight: 950; letter-spacing: .1em; text-transform: uppercase;
        }
        .fsm-inline-name { display: block; color: rgba(255,255,255,.98); font-size: 13.5px; font-weight: 900; line-height: 1.25; }
        .fsm-inline-ref {
          display: inline-flex; width: fit-content; margin: 0 0 5px;
          padding: 3px 7px; border-radius: 999px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.18);
          color: rgba(255,255,255,.94); font-size: 11.5px; font-weight: 950; line-height: 1.1;
        }
        .fsm-inline-state {
          display: block; margin-top: 4px;
          color: rgba(237,244,251,.78); font-size: 11px; font-weight: 800; line-height: 1.25;
        }
        .fsm-inline-score {
          min-width: 34px; text-align: right; color: rgba(237,244,251,.78);
          font-family: var(--font-crimson), Georgia, serif; font-size: 17px; font-weight: 750;
        }
        .fsm-inline-reread {
          display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;
          padding: 6px 9px; border-radius: 7px;
          border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.08); color: #fff;
          text-decoration: none; font-size: 10.5px; font-weight: 900;
        }
        .fsm-inline-reread:hover { border-color: var(--hue); background: rgba(255,255,255,.13); }
        .fsm-outline {
          border-radius: 0 12px 12px 0; overflow: hidden;
          border: 1px solid rgba(255,255,255,.12);
          border-left: 6px solid var(--hue);
          background: rgba(252,253,255,.98); color: var(--navy);
          box-shadow: 0 18px 34px rgba(0,0,0,.28);
        }
        .fsm-outline-head { padding: 16px 18px 14px; border-bottom: 1px solid rgba(27,36,66,.11); }
        .fsm-outline-kicker {
          margin: 0 0 5px; color: color-mix(in srgb, var(--hue) 70%, #17213d);
          font-size: 10px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase;
        }
        .fsm-outline-name { margin: 0; font-family: var(--font-crimson), Georgia, serif; font-size: 24px; font-weight: 750; line-height: 1; }
        .fsm-outline-mode { margin: 8px 0 0; color: #35425a; font-size: 13px; line-height: 1.45; }
        .fsm-outline-breadcrumb { margin: 7px 0 0; color: #4d5b73; font-size: 11px; font-weight: 800; line-height: 1.35; }
        .fsm-unit-grid {
          display: flex; gap: 5px; flex-wrap: wrap; margin-top: 12px;
        }
        .fsm-unit-pip { width: 13px; height: 13px; border-radius: 4px; background: var(--dot); opacity: var(--dot-opacity, 1); }
        .fsm-leaf {
          display: grid; grid-template-columns: 18px minmax(0,1fr) auto;
          gap: 12px; align-items: center;
          padding: 12px 18px; border-bottom: 1px solid rgba(27,36,66,.09);
        }
        .fsm-leaf:last-child { border-bottom: 0; }
        .fsm-leaf.is-focus { background: color-mix(in srgb, var(--hue) 8%, #ffffff); }
        .fsm-leaf.is-selected,
        .fsm-leaf.is-linked {
          background: color-mix(in srgb, var(--hue) 12%, #ffffff);
          box-shadow: inset 4px 0 0 var(--dot);
        }
        /* A small filled box rather than a dot — the same mastery-state
           square Khan Academy's unit lists use, so "how far along is this
           chapter section" reads the same familiar way at a glance. */
        .fsm-dot { width: 18px; height: 18px; border-radius: 5px; background: var(--dot); }
        .fsm-leaf .fsm-dot { opacity: var(--dot-opacity, 1); }
        .fsm-leaf.is-thin .fsm-dot { background: transparent; border: 1.5px dashed var(--dot); }
        .fsm-leaf-focuskicker {
          display: inline-block; margin-bottom: 3px;
          color: color-mix(in srgb, var(--hue) 74%, #17213d);
          font-size: 9px; font-weight: 950; letter-spacing: .1em; text-transform: uppercase;
        }
        .fsm-leaf-name { display: block; margin: 0; font-size: 14px; font-weight: 850; line-height: 1.25; color: #17213d; }
        .fsm-leaf-ref { display: inline-flex; width: fit-content; margin: 0 0 5px; padding: 3px 7px; border-radius: 999px; background: #eef2f8; color: #253149; font-size: 11.5px; font-weight: 900; line-height: 1.2; }
        .fsm-leaf-right { display: flex; align-items: center; gap: 12px; }
        .fsm-leaf-score { font-family: var(--font-crimson), Georgia, serif; font-size: 17px; font-weight: 750; color: #4d596b; min-width: 30px; text-align: right; }
        .fsm-reread {
          display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;
          padding: 7px 11px; border-radius: 7px;
          border: 1px solid rgba(27,36,66,.16); background: #fff; color: var(--navy);
          text-decoration: none; font-size: 11px; font-weight: 900; letter-spacing: .03em;
        }
        .fsm-reread:hover { border-color: var(--hue); color: #086567; }
        .fsm-leaf.is-focus .fsm-reread { background: var(--navy); border-color: var(--navy); color: #fff; }
        .fsm-leaf.is-focus .fsm-reread:hover { background: #12193a; }
        .fsm-leaf-select {
          appearance: none; border: 0; background: transparent; color: inherit;
          display: grid; grid-template-columns: 18px minmax(0,1fr);
          gap: 12px; align-items: center; padding: 0; text-align: left; min-width: 0;
          cursor: pointer; font: inherit; grid-column: 1 / 3;
        }
        .fsm-leaf-select:focus-visible { outline: 2px solid var(--hue); outline-offset: 3px; border-radius: 6px; }

        .fsm-readout {
          display: grid; grid-template-columns: auto minmax(0,1fr); gap: 10px 14px; align-items: center;
          padding: 14px 17px; border-radius: 0 12px 12px 0;
          background: rgba(8,13,29,.82); border: 1px solid rgba(255,255,255,.16);
          border-left: 6px solid var(--dot, rgba(255,255,255,.25));
          box-shadow: 0 14px 30px rgba(0,0,0,.22);
        }
        .fsm-readout-chip {
          display: grid; place-items: center; min-width: 56px; padding: 8px;
          border-radius: 10px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.12);
        }
        .fsm-readout-score { font-family: var(--font-crimson), Georgia, serif; font-size: 22px; font-weight: 750; color: #fff; line-height: 1; }
        .fsm-readout-scorelbl { margin-top: 3px; font-size: 8px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; color: rgba(237,244,251,.72); }
        .fsm-readout-ref { display: inline-flex; width: fit-content; margin: 0 0 5px; padding: 4px 8px; border-radius: 999px; background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.16); color: #fff1b8; font-size: 11px; font-weight: 900; line-height: 1; }
        .fsm-readout-name { margin: 0; font-family: var(--font-crimson), Georgia, serif; font-size: 19px; font-weight: 700; color: #fff; }
        .fsm-readout-state { display: inline-flex; align-items: center; gap: 6px; margin-top: 5px; font-size: 12px; font-weight: 800; color: rgba(237,244,251,.9); }
        .fsm-readout-state::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--dot); }

        .fsm-hint { text-align: center; margin: 10px auto 0; color: rgba(237,244,251,.72); font-size: 12px; font-weight: 750; }

        @media (max-width: 900px) {
          .fsm-layout {
            grid-template-columns: 1fr;
            width: 100%;
            margin-left: 0;
          }
          .fsm-side { order: 1; position: static; width: 100%; max-width: 620px; margin: 0 auto; }
          .fsm-outline,
          .fsm-readout { border-radius: 12px; border-left-width: 4px; }
          .fsm-next,
          .fsm-course,
          .fsm-legend { border-left-width: 4px; }
          .fsm-stage { order: 2; max-width: 900px; margin: 0 auto; }
          .fsm-section-rail .fsm-label { font-size: 15px; }
        }
        @media (max-width: 520px) {
          .fsm-inline-units { padding-left: 34px; padding-right: 10px; }
          .fsm-inline-head { display: block; line-height: 1.35; }
          .fsm-inline-head span { display: block; }
          .fsm-inline-head span:last-child { max-width: none; text-align: left; margin-top: 2px; }
          .fsm-inline-unit { grid-template-columns: minmax(0,1fr) auto; gap: 8px; }
          .fsm-inline-reread { grid-column: 1 / -1; justify-self: start; margin-left: 24px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .fsm-twinkle, .fsm-corona, .fsm-ring, .fsm-spikes,
          .fsm-orbit, .fsm-counter, .fsm-moon-orbit { animation: none !important; }
          .fsm-section { transition: none !important; }
        }
`;
