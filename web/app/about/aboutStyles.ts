// Extracted from app/about/page.tsx during a file-size cleanup.
// Pure CSS text, rendered via <style> tag(s). No behavior change intended.

export const ABOUT_PAGE_STYLES = `
        :root {
          /* --navy/--accent/--muted now come from app/globals.css */
          --accent-dim: rgba(10,163,163,.12);
          --accent-line: rgba(10,163,163,.26);
          --beta: #a78bfa;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; scroll-behavior: smooth; }
        body {
          font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
          color: #fff; background: #0b0f1e; min-height: 100vh; overflow-x: hidden;
        }
        canvas.stars { position: fixed; inset: 0; z-index: 0; pointer-events: none; }

        /* .beta-banner/.beta-badge now come from components/BetaBanner.tsx
           + the .oba-beta-banner/.oba-beta-badge rules in app/globals.css */
        .nav {
          position: sticky; top: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 32px; background: rgba(11,15,30,.85);
          backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .nav-brand {
          font-family: var(--font-crimson), Georgia, serif;
          font-weight: 600; font-size: 18px;
          color: #fff; text-decoration: none; letter-spacing: .01em;
        }
        .nav-links { display: flex; align-items: center; gap: 6px; }
        .nav-link {
          padding: 7px 14px; border-radius: 999px;
          font-size: 13px; font-weight: 500; color: rgba(255,255,255,.6);
          text-decoration: none; transition: color .14s, background .14s;
        }
        .nav-link:hover { color: #fff; background: rgba(255,255,255,.08); }
        .nav-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 18px; border-radius: 999px;
          font-size: 13px; font-weight: 600;
          background: rgba(255,255,255,.92); color: var(--navy);
          text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 4px 14px rgba(0,0,0,.3);
          transition: background .15s, transform .13s;
        }
        .nav-btn:hover { background: #fff; transform: translateY(-1px); }
        .nav-link:focus-visible, .nav-btn:focus-visible, .nav-brand:focus-visible {
          outline: 2px solid rgba(255,255,255,.65); outline-offset: 3px; border-radius: 6px;
        }

        .page { position: relative; z-index: 1; max-width: 760px; margin: 0 auto; padding: 64px 24px 96px; }
        .hero { padding-top: 56px; margin-bottom: 16px; }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          border-radius: 999px; padding: 5px 14px;
          font-size: 12px; font-weight: 700; letter-spacing: .06em;
          text-transform: uppercase; color: #6fe0e0; margin-bottom: 20px;
        }
        .hero-eyebrow::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
        .hero-heading {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(32px, 5vw, 50px); font-weight: 600; line-height: 1.12;
          color: #fff; letter-spacing: .005em; margin-bottom: 20px;
        }
        .hero-heading em { font-style: italic; color: #4fd6d6; }
        .hero-lead { font-size: 17px; line-height: 1.75; color: rgba(255,255,255,.64); max-width: 580px; }

        .pull-quote { border-left: 3px solid var(--accent); margin: 28px 0 0; padding: 4px 0 4px 24px; }
        .pull-quote p {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 21px; font-style: italic; line-height: 1.55; color: rgba(255,255,255,.88); font-weight: 500;
        }
        .section { margin-bottom: 60px; }
        .section-label { font-size: 11px; font-weight: 700; letter-spacing: .10em; text-transform: uppercase; color: #4fd6d6; margin-bottom: 12px; }
        .section-heading { font-family: var(--font-crimson), Georgia, serif; font-size: 26px; font-weight: 600; line-height: 1.2; color: #fff; margin-bottom: 16px; }
        .section-body { font-size: 15.5px; line-height: 1.80; color: rgba(255,255,255,.66); }
        .section-body p + p { margin-top: 14px; }
        .section-body strong { color: #fff; font-weight: 650; }
        .inline-link { color: #4fd6d6; font-weight: 650; text-decoration: none; border-bottom: 1px solid rgba(10,163,163,.45); }
        .inline-link:hover { color: #7fe9e9; border-bottom-color: #7fe9e9; }
        .rule { border: none; border-top: 1px solid rgba(255,255,255,.09); margin: 60px 0; }

        .glass {
          background: linear-gradient(155deg, rgba(255,255,255,.07), rgba(255,255,255,.02));
          border: 1px solid rgba(255,255,255,.13);
          border-radius: 18px; backdrop-filter: blur(16px);
          box-shadow: 0 20px 50px rgba(0,0,0,.34);
        }

        /* Interactive cycle */
        .cycle { margin: 30px 0 8px; padding: 26px; display: grid; grid-template-columns: minmax(304px, 320px) minmax(0,1fr); gap: 24px; align-items: center; }
        .cycle-dial { position: relative; width: 250px; height: 250px; justify-self: center; }
        .cycle-ring { position: absolute; inset: 0; }
        .cycle-ring circle { fill: none; stroke: rgba(255,255,255,.12); stroke-width: 1; }
        .cycle-ring .cycle-arc {
          fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round;
          stroke-dasharray: 40 640; opacity: .85;
          animation: cycleOrbit 9s linear infinite;
        }
        @keyframes cycleOrbit { to { stroke-dashoffset: -680; } }
        .cycle-node {
          position: absolute; width: 74px; height: 74px; margin: -37px 0 0 -37px;
          border-radius: 50%; cursor: pointer; font-family: inherit;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
          background: rgba(16,22,42,.9); border: 1px solid rgba(255,255,255,.16);
          color: rgba(255,255,255,.6); transition: transform .18s, border-color .18s, color .18s, box-shadow .18s;
        }
        .cycle-node b { font-size: 12.5px; font-weight: 800; letter-spacing: .03em; }
        .cycle-node i { font-style: normal; font-size: 10px; font-weight: 700; opacity: .55; }
        .cycle-node:hover { transform: scale(1.06); color: #fff; border-color: rgba(255,255,255,.3); }
        .cycle-node.is-active {
          color: #fff; border-color: var(--accent); transform: scale(1.1);
          box-shadow: 0 0 0 5px rgba(10,163,163,.14), 0 10px 26px rgba(0,0,0,.4);
          background: linear-gradient(150deg, rgba(10,163,163,.30), rgba(16,22,42,.92));
        }
        .cycle-node:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
        .cycle-node-0 { left: 50%; top: 0; }
        .cycle-node-1 { left: 100%; top: 50%; }
        .cycle-node-2 { left: 50%; top: 100%; }
        .cycle-node-3 { left: 0; top: 50%; }
        .cycle-center {
          position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
          width: 108px; text-align: center; pointer-events: none;
          font-size: 10.5px; font-weight: 800; letter-spacing: .12em;
          text-transform: uppercase; color: rgba(255,255,255,.3); line-height: 1.5;
        }
        .cycle-panel { position: relative; z-index: 1; min-height: 150px; }
        .cycle-panel-step { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #4fd6d6; margin-bottom: 8px; }
        .cycle-panel-title { font-family: var(--font-crimson), Georgia, serif; font-size: 27px; font-weight: 600; color: #fff; margin-bottom: 10px; }
        .cycle-panel-copy { font-size: 15px; line-height: 1.72; color: rgba(255,255,255,.68); margin-bottom: 12px; }
        .cycle-panel-detail { font-size: 13.5px; line-height: 1.68; color: rgba(255,255,255,.46); border-left: 2px solid var(--accent-line); padding-left: 14px; }

        /* Scope toggle */
        .scope { margin: 26px 0 8px; padding: 8px; }
        .scope-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 4px; }
        .scope-tab {
          border: 0; border-radius: 12px; padding: 12px 14px; cursor: pointer;
          background: transparent; color: rgba(255,255,255,.55);
          font-family: inherit; font-size: 13.5px; font-weight: 750;
          transition: background .16s, color .16s;
        }
        .scope-tab:hover { background: rgba(255,255,255,.07); color: #fff; }
        .scope-tab.is-active { background: rgba(255,255,255,.93); color: var(--navy); box-shadow: 0 8px 22px rgba(0,0,0,.25); }
        .scope-tab:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
        .scope-panel { padding: 18px 16px 16px; }
        .scope-lead { font-size: 14.5px; line-height: 1.7; color: rgba(255,255,255,.66); margin-bottom: 16px; }
        .scope-items { display: flex; flex-wrap: wrap; gap: 8px; }
        .scope-chip {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 13px; border-radius: 999px; font-size: 13px; font-weight: 600;
          animation: chipIn .3s ease both;
        }
        @keyframes chipIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .scope-chip.yes { background: var(--accent-dim); border: 1px solid var(--accent-line); color: #7fe9e9; }
        .scope-chip.no { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.14); color: rgba(255,255,255,.55); }
        .scope-chip svg { width: 13px; height: 13px; flex-shrink: 0; }

        /* Knowledge map */
        .map-block { margin: 28px 0 8px; padding: 24px 26px; }
        .map-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
        .map-title { font-family: var(--font-crimson), Georgia, serif; font-size: 19px; font-weight: 600; color: #fff; }
        .map-tag {
          font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
          color: rgba(255,255,255,.42); background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 4px 10px;
        }
        .map-rows { display: flex; flex-direction: column; gap: 14px; }
        .map-row {
          width: 100%; text-align: left; background: transparent; border: 0; padding: 6px 8px;
          border-radius: 10px; cursor: pointer; font-family: inherit;
          transition: background .16s;
        }
        .map-row:hover { background: rgba(255,255,255,.05); }
        .map-row:focus-visible { outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px; }
        .map-row-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 7px; }
        .map-name { font-size: 13.5px; font-weight: 750; color: rgba(255,255,255,.85); display: flex; align-items: center; gap: 8px; }
        .map-swatch { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .map-books { font-size: 11.5px; font-weight: 600; color: rgba(255,255,255,.38); }
        .map-bar { height: 9px; border-radius: 999px; background: rgba(255,255,255,.07); overflow: hidden; }
        .map-fill {
          height: 100%; border-radius: 999px; width: 0;
          transition: width 1.15s cubic-bezier(.22,.9,.3,1);
        }
        .map-note { margin-top: 18px; font-size: 13px; line-height: 1.65; color: rgba(255,255,255,.5); min-height: 42px; }

        /* Objection disclosure */
        .objection { margin: 28px 0 0; padding: 0; overflow: hidden; }
        .objection-btn {
          width: 100%; display: flex; align-items: flex-start; gap: 12px;
          padding: 22px 26px; background: transparent; border: 0; cursor: pointer;
          font-family: inherit; text-align: left; color: #fff;
        }
        .objection-btn:hover { background: rgba(255,255,255,.04); }
        .objection-btn:focus-visible { outline: 2px solid rgba(255,255,255,.6); outline-offset: -2px; }
        .objection-q {
          flex: 1; font-family: var(--font-crimson), Georgia, serif;
          font-size: 18px; font-style: italic; font-weight: 600; color: #fff; line-height: 1.4;
        }
        .objection-mark { font-size: 12px; font-weight: 800; letter-spacing: .06em; color: #4fd6d6; padding-top: 5px; flex-shrink: 0; }
        .objection-chev { width: 18px; height: 18px; flex-shrink: 0; margin-top: 4px; color: rgba(255,255,255,.5); transition: transform .22s; }
        .objection-btn[aria-expanded="true"] .objection-chev { transform: rotate(180deg); }
        .objection-a {
          font-size: 15px; line-height: 1.78; color: rgba(255,255,255,.66);
          padding: 0 26px 24px 60px; animation: chipIn .26s ease both;
        }
        .objection-a p + p { margin-top: 12px; }

        .future-note {
          display: flex; align-items: flex-start; gap: 12px;
          background: rgba(124,58,237,.12); border: 1px solid rgba(124,58,237,.28);
          border-radius: 12px; padding: 16px 20px;
          font-size: 13.5px; line-height: 1.65; color: #d8c7fb; margin-top: 20px;
        }

        /* Resource constellation */
        .constellation { margin: 26px 0 8px; padding: 8px; }
        .constel-panel { padding: 10px 6px 14px; }
        .constel-wrap { overflow-x: auto; }
        .constel-svg { display: block; width: 100%; min-width: 640px; height: auto; }
        .constel-links { opacity: 0; transition: opacity .55s ease .12s; }
        .constel-svg.is-revealed .constel-links { opacity: 1; }
        .constel-link {
          stroke: rgba(255,255,255,.17); stroke-width: 1;
          transition: stroke .45s ease, stroke-width .45s ease, opacity .45s ease;
        }
        .constel-link.is-off { opacity: .15; }
        .constel-link.is-on {
          stroke: var(--hl); stroke-width: 1.9;
          stroke-dasharray: 5 7; animation: constelFlow 1.1s linear infinite;
        }
        @keyframes constelFlow { to { stroke-dashoffset: -24; } }

        /* Each node pops in once, around its own centre; the inner group owns on/off state
           so the pop animation's fill-mode never fights the highlight opacity. */
        .constel-pop { opacity: 0; }
        .constel-svg.is-revealed .constel-pop {
          animation: constelPop .5s cubic-bezier(.2,1.25,.4,1) both;
        }
        @keyframes constelPop {
          from { opacity: 0; transform: scale(.35); }
          to { opacity: 1; transform: scale(1); }
        }

        .constel-node { transition: opacity .45s ease; }
        .constel-node circle {
          fill: rgba(16,22,42,.95); stroke: rgba(255,255,255,.32); stroke-width: 1.2;
          transition: fill .45s ease, stroke .45s ease, stroke-width .45s ease;
        }
        .constel-node text {
          fill: rgba(255,255,255,.62); font-size: 11.5px; font-weight: 600;
          transition: fill .45s ease;
        }
        .constel-node.is-off { opacity: .3; }
        .constel-node.is-on circle { fill: var(--hl); stroke: var(--hl-bright); stroke-width: 2.2; }
        .constel-node.is-on text { fill: var(--hl-bright); font-weight: 750; }
        .constel-hub-core { fill: url(#constelHub); stroke: var(--accent); stroke-width: 1.5; }
        .constel-pulse {
          fill: none; stroke: var(--accent);
          transform-box: fill-box; transform-origin: center;
          animation: constelPulse 3.2s ease-out infinite;
        }
        @keyframes constelPulse {
          0% { transform: scale(1); opacity: .45; }
          100% { transform: scale(2.15); opacity: 0; }
        }
        .constel-hub-label {
          fill: #fff; font-family: var(--font-crimson), Georgia, serif;
          font-size: 22px; font-weight: 600; text-anchor: middle;
        }
        .constel-hub-sub {
          fill: rgba(255,255,255,.48); font-size: 9px; font-weight: 700;
          letter-spacing: .11em; text-transform: uppercase; text-anchor: middle;
        }
        .constel-caption {
          margin-top: 8px; padding: 0 10px; font-size: 13.5px; line-height: 1.65;
          color: rgba(255,255,255,.55); min-height: 62px;
        }
        .constel-caption b {
          font-weight: 750; color: var(--hl-bright);
          transition: color .45s ease;
        }
        .constel-hint {
          display: block; margin-top: 7px; font-size: 12.5px;
          color: rgba(255,255,255,.38);
        }

        /* Retention chart */
        .decay { margin: 28px 0 8px; padding: 22px 24px; }
        .decay-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .decay-title { font-family: var(--font-crimson), Georgia, serif; font-size: 19px; font-weight: 600; color: #fff; }
        .decay-wrap { overflow-x: auto; }
        .decay-svg { display: block; width: 100%; min-width: 580px; height: auto; }
        .decay-grid { stroke: rgba(255,255,255,.08); stroke-width: 1; }
        .decay-tick { fill: rgba(255,255,255,.34); font-size: 10.5px; font-weight: 600; }
        .decay-cred { fill: none; stroke: #f0c674; stroke-width: 1.7; stroke-dasharray: 7 5; }
        .decay-curve { fill: none; stroke-width: 2.6; stroke-linecap: round; }
        .decay-curve.up { stroke: #17a673; }
        .decay-curve.down { stroke: #e0873a; }
        .decay-scrub { stroke: rgba(255,255,255,.42); stroke-width: 1; stroke-dasharray: 3 4; }
        .decay-dot { stroke: #0b0f1e; stroke-width: 2.5; transition: cx .12s linear, cy .12s linear; }
        .decay-key { font-size: 10.5px; font-weight: 700; }
        .decay-slider {
          -webkit-appearance: none; appearance: none; width: 100%; height: 26px;
          background: transparent; cursor: pointer; display: block; margin-top: 10px;
        }
        .decay-slider::-webkit-slider-runnable-track {
          height: 5px; border-radius: 999px; background: rgba(255,255,255,.12);
        }
        .decay-slider::-moz-range-track { height: 5px; border-radius: 999px; background: rgba(255,255,255,.12); }
        .decay-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; margin-top: -7.5px;
          background: #fff; border: 3px solid var(--accent); box-shadow: 0 3px 10px rgba(0,0,0,.5);
        }
        .decay-slider::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%; background: #fff;
          border: 3px solid var(--accent); box-shadow: 0 3px 10px rgba(0,0,0,.5);
        }
        .decay-slider:focus-visible { outline: 2px solid #fff; outline-offset: 4px; border-radius: 999px; }
        .decay-slider-label {
          display: flex; justify-content: space-between; font-size: 11px;
          color: rgba(255,255,255,.4); font-weight: 600;
        }
        .decay-readout { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
        .decay-cell {
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.11);
          border-radius: 12px; padding: 13px 14px;
        }
        .decay-cell.cred { border-color: rgba(240,198,116,.3); }
        .decay-cell.up { border-color: rgba(23,166,115,.32); }
        .decay-cell.down { border-color: rgba(224,135,58,.32); }
        .decay-cell-k {
          display: block; font-size: 10px; font-weight: 800; letter-spacing: .09em;
          text-transform: uppercase; color: rgba(255,255,255,.42); margin-bottom: 7px;
        }
        .decay-cell-v { display: block; font-size: 19px; font-weight: 750; color: #fff; font-variant-numeric: tabular-nums; }
        .decay-cell-sub { display: block; font-size: 11.5px; font-weight: 700; margin-top: 3px; }
        .decay-note { margin-top: 15px; font-size: 13.5px; line-height: 1.68; color: rgba(255,255,255,.58); }

        /* Use cases */
        .usecase-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 26px 0 8px; }
        .usecase-card { padding: 20px 18px 18px; }
        .usecase-n {
          display: block; font-family: var(--font-crimson), Georgia, serif;
          font-size: 13px; font-weight: 700; letter-spacing: .1em; color: #4fd6d6; margin-bottom: 10px;
        }
        .usecase-title { display: block; font-size: 14.5px; font-weight: 750; color: #fff; line-height: 1.35; margin-bottom: 9px; }
        .usecase-copy { display: block; font-size: 13px; line-height: 1.65; color: rgba(255,255,255,.6); }

        /* Contribution cards */
        .contrib-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 26px 0 8px; }
        .contrib-card { padding: 22px 22px 20px; }
        .contrib-icon {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 10px; margin-bottom: 14px;
          background: var(--accent-dim); border: 1px solid var(--accent-line); color: #6fe0e0;
        }
        .contrib-icon svg { width: 18px; height: 18px; }
        .contrib-title { display: block; font-size: 15px; font-weight: 750; color: #fff; margin-bottom: 4px; }
        .contrib-sub { display: block; font-size: 12.5px; color: rgba(255,255,255,.45); margin-bottom: 14px; }
        .contrib-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .contrib-list li {
          display: flex; align-items: center; gap: 9px;
          font-size: 13.5px; color: rgba(255,255,255,.66);
        }
        .contrib-list li::before {
          content: ""; width: 5px; height: 5px; border-radius: 50%;
          background: var(--accent); flex-shrink: 0;
        }

        /* Data disclosure */
        .datacard { margin: 26px 0 8px; padding: 8px; }
        .data-panel { padding: 18px 16px 16px; }
        .data-rows { display: flex; flex-direction: column; gap: 11px; }
        .data-row { display: flex; align-items: flex-start; gap: 11px; font-size: 14px; line-height: 1.6; animation: chipIn .3s ease both; }
        .data-icon { width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
        .data-icon svg { width: 100%; height: 100%; }
        .data-row.yes { color: rgba(255,255,255,.78); }
        .data-row.yes .data-icon { color: #4fd6d6; }
        .data-row.no { color: rgba(255,255,255,.5); }
        .data-row.no .data-icon { color: rgba(255,255,255,.35); }
        .data-stored {
          margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.1);
          font-size: 13.5px; line-height: 1.65; color: rgba(255,255,255,.55);
        }

        .donate-block {
          border-radius: 20px; padding: 36px 40px; margin: 60px 0;
          position: relative; overflow: hidden;
          background:
            radial-gradient(circle at 12% 16%, rgba(10,163,163,.20), transparent 44%),
            linear-gradient(135deg, rgba(27,36,66,.82) 0%, rgba(36,48,96,.82) 100%);
          border: 1px solid rgba(255,255,255,.13); backdrop-filter: blur(14px);
        }
        .donate-heading { font-family: var(--font-crimson), Georgia, serif; font-size: 24px; font-weight: 600; color: #fff; margin-bottom: 12px; }
        .donate-body { font-size: 15px; line-height: 1.72; color: rgba(255,255,255,.7); margin-bottom: 24px; max-width: 480px; }
        .donate-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 24px; border-radius: 999px;
          background: var(--accent); color: #fff;
          font-size: 14px; font-weight: 600; text-decoration: none;
          box-shadow: 0 6px 20px rgba(10,163,163,.40);
          transition: background .15s, transform .13s;
        }
        .donate-btn:hover { background: #089090; transform: translateY(-1px); }

        .cta-row { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 48px; }
        .btn-primary, .btn-secondary {
          display: flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 999px;
          font-size: 15px; font-weight: 600; text-decoration: none; cursor: pointer;
          transition: transform .13s, background .15s, box-shadow .15s;
        }
        .btn-primary { background: rgba(255,255,255,.93); color: var(--navy); border: none; box-shadow: 0 10px 28px rgba(0,0,0,.3); }
        .btn-primary:hover { background: #fff; transform: translateY(-2px); }
        .btn-secondary { background: rgba(255,255,255,.06); color: #fff; border: 1px solid rgba(255,255,255,.16); backdrop-filter: blur(8px); }
        .btn-secondary:hover { background: rgba(255,255,255,.12); transform: translateY(-2px); }
        .donate-btn:focus-visible, .btn-primary:focus-visible, .btn-secondary:focus-visible, .inline-link:focus-visible {
          outline: 2px solid rgba(255,255,255,.7); outline-offset: 3px;
        }

        /* One panel at a time. Panels are min-height rather than fixed height so
           tall sections can exceed the viewport instead of clipping, while
           scroll snapping gives the about page its slide-replacement feel. */
        html { scroll-snap-type: y mandatory; }
        .page { max-width: 760px; margin: 0 auto; padding: 0 24px; }
        .panel {
          min-height: 100svh;
          display: flex; flex-direction: column; justify-content: center;
          scroll-snap-align: center;
          scroll-snap-stop: always;
          padding: 58px 0; margin-bottom: 0;
        }
        .is-enhanced .panel { transition: opacity .35s ease, transform .35s ease; }
        .is-enhanced .panel:not(.is-active) {
          opacity: .78; transform: translateY(10px) scale(.992);
        }
        .is-enhanced .panel.is-active { opacity: 1; transform: none; }
        .panel > .rule { display: none; }

        .rail {
          position: fixed; right: 22px; top: 50%; transform: translateY(-50%);
          z-index: 30; display: flex; flex-direction: column; gap: 11px;
        }
        .rail-dot {
          width: 9px; height: 9px; border-radius: 50%; padding: 0; cursor: pointer;
          border: 1px solid rgba(255,255,255,.35); background: transparent;
          transition: background .2s, transform .2s, border-color .2s;
        }
        .rail-dot:hover { background: rgba(255,255,255,.55); }
        .rail-dot.on { background: var(--accent); border-color: var(--accent); transform: scale(1.4); }
        .rail-dot:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }

        @media (max-width: 900px) { .rail { display: none; } }

        /* Panel emphasis is motion. Under reduced motion, show everything. */
        @media (prefers-reduced-motion: reduce) {
          .is-enhanced .panel:not(.is-active) { opacity: 1; transform: none; }
          html { scroll-snap-type: none; }
        }

        @media (max-width: 700px) {
          .cycle { grid-template-columns: 1fr; justify-items: center; padding: 22px 18px; gap: 88px; }
          .cycle-panel { min-height: 0; }
          .panel { padding: 52px 0; }
        }
        @media (max-width: 600px) {
          .nav { padding: 13px 16px; }
          .nav-links .nav-link { display: none; }
          .page { padding: 0 16px; }
          .hero { padding-top: 40px; }
          .donate-block { padding: 28px 22px; }
          .cta-row { flex-direction: column; }
          .map-block { padding: 20px 16px; }
          .objection-btn { padding: 20px 18px; }
          .objection-a { padding: 0 18px 20px 18px; }
          .cycle-dial { width: 220px; height: 220px; }
          .cycle-node { width: 66px; height: 66px; margin: -33px 0 0 -33px; }
          .contrib-grid { grid-template-columns: 1fr; }
          .usecase-grid { grid-template-columns: 1fr; }
          .decay { padding: 20px 16px; }
          .decay-readout { grid-template-columns: 1fr; }
          .constel-caption { min-height: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
`;
