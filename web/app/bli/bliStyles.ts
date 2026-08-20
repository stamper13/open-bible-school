// Extracted from app/bli/page.tsx during a file-size cleanup.
// Pure CSS text, rendered via <style> tag(s). No behavior change intended.

export const BLI_PAGE_STYLES = `
        :root {
          /* --navy/--accent/--muted now come from app/globals.css */
          --accent-dim: rgba(10,163,163,.12);
          --accent-line: rgba(10,163,163,.26);
          --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; scroll-behavior: smooth; }
        body {
          font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
          color: #fff; background: #0b0f1e; min-height: 100vh; overflow-x: hidden;
        }
        canvas.stars { position: fixed; inset: 0; z-index: 0; pointer-events: none; }

        /* .beta-banner/.beta-badge now come from components/BetaBanner.tsx
           + the .oba-beta-banner/.oba-beta-badge rules in app/globals.css.
           .nav/.nav-brand/.nav-links/.nav-link/.nav-btn/.mobile-nav-* now
           come from components/SiteNav.tsx + the .oba-site-nav rules in
           app/globals.css. */

        .page { position: relative; z-index: 1; max-width: 920px; margin: 0 auto; padding: 60px 24px 96px; }
        .hero { margin-bottom: 56px; }
        .hero-heading {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(32px, 5vw, 48px); font-weight: 600; line-height: 1.12;
          color: #fff; margin-bottom: 20px;
        }
        .hero-lead { font-size: 16.5px; line-height: 1.75; color: rgba(255,255,255,.64); max-width: 690px; }

        .section { margin-bottom: 58px; scroll-margin-top: 84px; }
        .rule { border: none; border-top: 1px solid rgba(255,255,255,.09); margin: 56px 0; }

        .flow {
          display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px;
          margin-top: 22px;
        }
        .flow-card {
          position: relative; min-height: 164px; padding: 18px;
          border: 1px solid rgba(255,255,255,.13); border-radius: 14px;
          background:
            radial-gradient(circle at 50% 18%, rgba(79,214,214,.18), transparent 34%),
            rgba(255,255,255,.045);
          overflow: hidden;
        }
        .flow-card::after {
          content: ""; position: absolute; left: 18px; right: 18px; bottom: 17px; height: 3px;
          border-radius: 999px; background: rgba(255,255,255,.10);
        }
        .flow-n {
          display: inline-flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 50%;
          background: rgba(79,214,214,.12); border: 1px solid rgba(79,214,214,.34);
          color: #8af2f2; font-size: 11px; font-weight: 900;
        }
        .flow-title {
          display: block; margin-top: 16px;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 24px; font-weight: 700; color: #fff;
        }
        .flow-copy { display: block; margin-top: 8px; color: rgba(255,255,255,.62); font-size: 13px; line-height: 1.55; }

        .measure-card {
          display: grid; grid-template-columns: minmax(0,1fr);
          max-width: 560px;
          gap: 18px; align-items: stretch; margin-top: 22px;
        }
        .measure-left,
        .confidence-card,
        .route-card {
          border: 1px solid rgba(255,255,255,.13); border-radius: 16px;
          background: rgba(255,255,255,.05);
          box-shadow: 0 22px 54px rgba(0,0,0,.24);
        }
        .measure-left { padding: 22px; }
        .measure-title {
          margin: 0;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 28px; line-height: 1; color: #fff;
        }
        .measure-copy { margin: 12px 0 0; color: rgba(255,255,255,.64); font-size: 14px; line-height: 1.65; }
        .measure-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
        .measure-chip {
          padding: 7px 10px; border-radius: 999px;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.82); font-size: 12px; font-weight: 800;
        }
        .confidence-card { padding: 22px; }
        .confidence-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
        .confidence-title { margin: 0; color: #fff; font-size: 13px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
        .confidence-score { color: #f0c674; font-family: var(--mono); font-size: 12px; font-weight: 800; }
        .confidence-track {
          position: relative; display: grid; grid-template-columns: 15fr 15fr 30fr;
          height: 14px; border-radius: 999px; overflow: hidden;
          background: rgba(255,255,255,.08); margin-bottom: 18px;
        }
        .confidence-seg:nth-child(1) { background: rgba(124,58,237,.55); }
        .confidence-seg:nth-child(2) { background: rgba(10,163,163,.70); }
        .confidence-seg:nth-child(3) { background: rgba(212,160,23,.86); }
        .confidence-marker {
          position: absolute; top: -7px; left: calc((22 / 60) * 100%);
          width: 28px; height: 28px; border-radius: 50%;
          background: #fff; border: 4px solid #0aa3a3;
          box-shadow: 0 6px 20px rgba(0,0,0,.38);
          animation: markerBreathe 3.8s ease-in-out infinite;
        }
        @keyframes markerBreathe {
          0%,100% { transform: translateX(-50%) scale(.94); }
          50% { transform: translateX(-50%) scale(1.08); }
        }
        .confidence-rows { display: grid; gap: 9px; }
        .confidence-row {
          display: grid; grid-template-columns: 108px 88px minmax(0,1fr); gap: 10px; align-items: baseline;
          padding: 10px 0; border-top: 1px solid rgba(255,255,255,.08);
        }
        .confidence-row b { color: #fff; font-size: 13px; }
        .confidence-row i { color: rgba(255,255,255,.48); font-style: normal; font-family: var(--mono); font-size: 11px; }
        .confidence-row span { color: rgba(255,255,255,.58); font-size: 12.5px; line-height: 1.45; }

        .route-card { margin-top: 18px; padding: 20px; overflow: hidden; }
        .route-card-head { display: flex; justify-content: flex-end; margin-bottom: 14px; }
        .route-lane {
          display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 11px;
          position: relative;
        }
        .route-lane::before {
          content: ""; position: absolute; left: 10%; right: 10%; top: 31px; height: 2px;
          background: linear-gradient(90deg, rgba(212,160,23,.2), rgba(79,214,214,.85), rgba(124,58,237,.2));
          z-index: 0;
        }
        .route-step {
          position: relative; z-index: 1; min-height: 132px; padding: 14px;
          border-radius: 12px; background: rgba(8,13,29,.72);
          border: 1px solid rgba(255,255,255,.12);
        }
        .route-dot {
          display: block; width: 28px; height: 28px; border-radius: 50%;
          background: var(--tone); box-shadow: 0 0 22px color-mix(in srgb, var(--tone) 70%, transparent);
          animation: routeGlow 4.4s ease-in-out infinite;
          animation-delay: calc(var(--i) * .55s);
        }
        @keyframes routeGlow {
          0%,100% { transform: scale(.92); filter: brightness(.9); }
          50% { transform: scale(1.12); filter: brightness(1.25); }
        }
        .route-label { display: block; margin-top: 16px; color: rgba(255,255,255,.54); font-size: 10px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
        .route-value { display: block; margin-top: 5px; color: #fff; font-size: 16px; font-weight: 850; line-height: 1.2; }

        details.tech-details {
          border: 1px solid rgba(255,255,255,.13); border-radius: 16px;
          background: rgba(255,255,255,.045); overflow: hidden;
        }
        .tech-summary {
          cursor: pointer; list-style: none; padding: 18px 20px;
          color: #fff; font-size: 14px; font-weight: 900;
        }
        .tech-summary::-webkit-details-marker { display: none; }
        .tech-summary span { color: rgba(255,255,255,.52); font-weight: 650; margin-left: 8px; }
        .tech-details[open] .tech-summary { border-bottom: 1px solid rgba(255,255,255,.10); }
        .tech-inner { padding: 0 20px 20px; }

        .mechanic-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; margin-top: 22px; }
        .mechanic-card {
          text-align: left; cursor: pointer; font-family: inherit; display: block;
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12);
          border-radius: 12px; padding: 18px; color: inherit;
          transition: background .15s, border-color .15s, transform .13s;
        }
        .mechanic-card:hover { background: rgba(255,255,255,.09); transform: translateY(-2px); }
        .mechanic-card[aria-expanded="true"] { border-color: var(--accent-line); background: rgba(10,163,163,.10); }
        .mechanic-card:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
        .mechanic-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .mechanic-title { color: #fff; font-size: 13px; font-weight: 760; letter-spacing: .05em; text-transform: uppercase; }
        .mechanic-var { font-family: var(--mono); font-size: 10.5px; color: #6fe0e0; white-space: nowrap; }
        .mechanic-copy { display: block; color: rgba(255,255,255,.6); font-size: 13.5px; line-height: 1.6; margin-top: 9px; }
        .mechanic-more {
          display: block; margin-top: 11px; padding-top: 11px;
          border-top: 1px solid rgba(255,255,255,.1);
          font-size: 12.5px; line-height: 1.6; color: rgba(255,255,255,.55);
        }

        .formula-block {
          background: rgba(0,0,0,.34); border: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.78); border-radius: 14px;
          padding: 22px 24px; font-family: var(--mono);
          font-size: 12.5px; line-height: 1.85; overflow-x: auto; margin: 22px 0;
        }
        .formula-block strong { color: #6fe0e0; font-weight: 700; }
        .formula-block em { color: #f0c674; font-style: normal; }
        .note {
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12);
          border-left: 3px solid var(--accent); border-radius: 12px; padding: 18px 20px;
          font-size: 14px; line-height: 1.70; color: rgba(255,255,255,.64);
        }
        .note strong { color: #fff; font-weight: 700; }

        .probe {
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12);
          border-radius: 14px; padding: 20px 22px; margin: 22px 0 18px;
        }
        .probe-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .probe-score {
          font-family: var(--font-crimson), Georgia, serif; font-size: 38px; font-weight: 700;
          color: #fff; line-height: 1; font-variant-numeric: tabular-nums;
        }
        .probe-pill {
          display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; border-radius: 999px;
          font-size: 11.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: #fff;
        }
        .probe-track { display: flex; height: 12px; border-radius: 999px; overflow: hidden; }
        .probe-seg { height: 100%; transition: opacity .15s; }
        .probe-input {
          -webkit-appearance: none; appearance: none; width: 100%; height: 26px;
          background: transparent; margin-top: -19px; position: relative; z-index: 2; cursor: pointer; display: block;
        }
        .probe-input::-webkit-slider-thumb {
          -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%;
          background: #fff; border: 3px solid var(--accent); cursor: grab;
          box-shadow: 0 3px 10px rgba(0,0,0,.5);
        }
        .probe-input::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%; background: #fff;
          border: 3px solid var(--accent); cursor: grab; box-shadow: 0 3px 10px rgba(0,0,0,.5);
        }
        .probe-input:focus-visible { outline: 2px solid #fff; outline-offset: 4px; border-radius: 999px; }
        .probe-scale { display: flex; justify-content: space-between; font-family: var(--mono); font-size: 10.5px; color: rgba(255,255,255,.35); margin-top: 4px; }
        .probe-copy { font-size: 13.5px; line-height: 1.65; color: rgba(255,255,255,.62); margin-top: 14px; }

        .levels { display: grid; gap: 8px; margin-top: 20px; }
        .level-row {
          display: grid; grid-template-columns: 140px 100px 1fr; align-items: center; gap: 12px;
          background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
          border-radius: 10px; padding: 11px 13px; transition: background .15s, border-color .15s;
        }
        .level-row.on { background: rgba(10,163,163,.12); border-color: var(--accent-line); }
        .level-name { font-weight: 700; color: #fff; font-size: 14px; display: flex; align-items: center; gap: 8px; }
        .level-swatch { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .level-range { font-family: var(--mono); font-size: 12px; color: rgba(255,255,255,.45); font-variant-numeric: tabular-nums; }
        .level-desc { font-size: 13px; line-height: 1.5; color: rgba(255,255,255,.55); }

        .btn-primary:focus-visible, .btn-secondary:focus-visible { outline: 2px solid rgba(255,255,255,.7); outline-offset: 3px; }

        /* Below the width where the vertical rail has clear margin outside the
           920px content column, it becomes a floating horizontal pill anchored
           to the bottom of the viewport instead of just disappearing — tablet
           widths keep a wayfinding aid, they just don't get the side rail. */
        @media (max-width: 1100px) {
          .rail {
            top: auto; right: auto; left: 50%; bottom: 18px;
            transform: translateX(-50%);
            flex-direction: row; gap: 9px;
            background: rgba(11,15,30,.88); backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,.16); border-radius: 999px;
            padding: 9px 14px; box-shadow: 0 12px 30px rgba(0,0,0,.4);
          }
        }
        @media (max-width: 680px) { .rail { display: none; } }

        .illustrative-tag {
          font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
          color: rgba(255,255,255,.42); background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 4px 10px;
        }

        .mechanic-range-inline {
          display: block; margin-top: 8px; font-family: var(--mono); font-size: 11px; color: #f0c674;
        }

        .lab-jump {
          margin-top: 14px;
        }
        .inline-link-btn {
          background: none; border: none; padding: 0; cursor: pointer; font: inherit;
          color: #6fe0e0; text-decoration: underline; text-underline-offset: 3px;
          text-decoration-color: rgba(111,224,224,.4);
        }
        .inline-link-btn:hover { text-decoration-color: #6fe0e0; }
        .inline-link-btn:focus-visible { outline: 2px solid #fff; outline-offset: 3px; border-radius: 4px; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: .001ms !important; animation-iteration-count: 1 !important;
            transition-duration: .001ms !important;
          }
        }
        @media (max-width: 680px) {
          .page { padding: 40px 16px 72px; }
          .mechanic-grid { grid-template-columns: 1fr; }
          .flow { grid-template-columns: 1fr; }
          .measure-card { grid-template-columns: 1fr; }
          .confidence-row { grid-template-columns: 1fr; gap: 3px; }
          .route-lane { grid-template-columns: 1fr; }
          .route-lane::before { display: none; }
          .level-row { grid-template-columns: 1fr; gap: 4px; }
          .cta-row { flex-direction: column; }
        }
`;
