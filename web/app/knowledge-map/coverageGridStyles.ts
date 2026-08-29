// Extracted from app/knowledge-map/CoverageGrid.tsx during a file-size cleanup.
// Pure CSS text, rendered via <style> tag(s). No behavior change intended.

export const COVERAGE_GRID_STYLES_1 = `
        .cov {
          color: #242936;
        }
        .cov-summary {
          display: grid; grid-template-columns: minmax(0,1fr) auto;
          gap: 20px; align-items: start;
          margin-bottom: 14px; padding: 22px 24px;
          border: 1px solid rgba(226,232,240,.95); border-radius: 10px;
          background: rgba(255,255,255,.97);
          box-shadow: 0 18px 42px rgba(0,0,0,.18);
        }
        .cov-kicker {
          margin: 0 0 6px; color: #0a6e6e;
          font-size: 10px; font-weight: 950; letter-spacing: .14em; text-transform: uppercase;
        }
        .cov-title {
          margin: 0; color: #252936;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(28px, 4vw, 40px); line-height: 1;
        }
        .cov-copy {
          max-width: 720px; margin: 9px 0 0;
          color: #4f5d72; font-size: 13px; line-height: 1.55;
        }
        .cov-stats {
          display: grid; grid-template-columns: repeat(4, minmax(68px, 1fr)); gap: 8px;
          min-width: min(420px, 100%);
        }
        .cov-stat {
          min-height: 64px; padding: 10px 12px; border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .cov-stat strong {
          display: block; color: #252936;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 25px; line-height: 1;
        }
        .cov-stat span {
          display: block; margin-top: 6px;
          color: #64748b;
          font-size: 9px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase;
        }
        /* .cov-board renders as part of the caller's own card (currently
           the dashboard's coverage-map-card) rather than carrying its own
           background/border/shadow — see CoverageLegend below, which has
           moved out of this card entirely. */
        .cov-board {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px 20px;
          padding: 18px;
        }
        .cov.is-focused .cov-board {
          grid-template-columns: 1fr;
        }
        .cov-section {
          overflow: hidden;
          border: 0;
          border-radius: 0;
          background: transparent;
        }
        .cov-section-head {
          display: flex; justify-content: space-between; gap: 14px; align-items: end;
          padding: 0 0 10px;
          border-bottom: 1px solid #d7dee8;
          background: transparent;
        }
        .cov-section-name {
          margin: 0; color: #202534;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 23px; line-height: 1;
        }
        .cov-section-meta {
          margin: 5px 0 0; color: #64748b;
          font-size: 11px; font-weight: 800;
        }
        .cov-section-score {
          color: #4b5563; font-size: 12px; font-weight: 850;
          white-space: nowrap;
        }
        .cov-book-row {
          display: grid; grid-template-columns: minmax(118px, 148px) minmax(0,1fr);
          gap: 12px; align-items: center;
          min-height: 42px; padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .cov-book-row:last-child { border-bottom: 0; }
        .cov-book-row.is-up-next {
          margin: 0 -10px; padding-inline: 10px;
          background: #fff;
          border-radius: 8px;
          box-shadow: inset 3px 0 0 #ffcf5c;
        }
        .cov-book-main {
          min-width: 0; display: flex; align-items: flex-start; gap: 8px;
        }
        .cov-book-dot {
          width: 10px; height: 10px; margin-top: 4px; border-radius: 999px;
          background: var(--book-dot); opacity: var(--book-opacity);
          flex: 0 0 auto;
        }
        .cov-book-name {
          margin: 0; color: #202534; font-size: 13px; font-weight: 900; line-height: 1.2;
        }
        .cov-book-meta {
          margin-top: 3px; color: #64748b;
          font-size: 10px; font-weight: 750; line-height: 1.25;
        }
        .cov-boxes {
          display: flex; align-items: center; flex-wrap: wrap;
          gap: 7px 9px;
        }
        .cov-unit-group {
          display: inline-flex; align-items: center; flex-wrap: wrap;
          gap: 5px; padding: 8px; border-radius: 9px;
          border: 1.5px solid color-mix(in srgb, var(--rail) 55%, #64748b);
          background: color-mix(in srgb, var(--fill) 36%, transparent);
        }
        .cov-unit-group.is-single {
          padding: 0; border-color: transparent; background: transparent;
        }
        .cov-unit-group.is-focus {
          border-color: #ffcf5c;
          box-shadow: 0 0 0 2px rgba(255,207,92,.14);
        }
        .cov-box {
          appearance: none; position: relative; flex: 0 0 auto;
          width: 27px; height: 27px; min-height: 0; padding: 0;
          display: grid; place-items: center;
          border-radius: 5px; border: 1.5px solid var(--rail);
          background: var(--fill); color: #17213d;
          cursor: pointer; font: inherit; text-align: center;
          transition: transform .14s ease, border-color .14s ease, background .14s ease, box-shadow .14s ease;
        }
        .cov-box:hover,
        .cov-box:focus-visible {
          transform: translateY(-2px);
          border-color: #fff;
          box-shadow: 0 10px 22px rgba(0,0,0,.28), 0 0 18px color-mix(in srgb, var(--rail) 32%, transparent);
          outline: none;
        }
        .cov-box:disabled {
          cursor: default;
        }
        .cov-box:disabled:hover,
        .cov-box:disabled:focus-visible {
          transform: none;
          border-color: var(--rail);
          box-shadow: none;
        }
        .cov-box.is-insufficient-evidence {
          border-style: solid; border-color: #94a3b8; background: #fff; color: #64748b;
        }
        .cov-box.evidence-none { opacity: .58; }
        .cov-box.evidence-low { opacity: .72; }
        .cov-box.evidence-moderate { opacity: .88; }
        .cov-box.evidence-high { opacity: 1; }
        .cov-box.is-focus::after {
          content: ""; position: absolute; inset: -4px; border-radius: 8px;
          border: 2px solid #ffcf5c; pointer-events: none;
          box-shadow: 0 0 0 2px rgba(255,207,92,.16);
        }
        /* Every chapter in a gold-ringed unit gets that same ::after ring
           (is-focus is set per-unit, not per-chapter) — so within a wide
           unit like Genesis 12-50, nothing marks which chapters the current
           "Recommended reading" card is actually pointing at. A pure
           motion-only cue (no fill) turned out too easy to miss, so this
           now DOES override background/border with a color, but one no
           section owns: orange sits in the one real gap in the section
           palette (gold/green/blue/magenta/teal/indigo/purple/rose — see
           SECTION_HUES in lib/focusPath.ts), so it can't be mistaken for
           any section's own "sufficient" look the way the original gold
           fill could for Torah. The rotating sparkle ring from before sits
           on its own slightly wider orbit (-7px vs is-focus's -4px) so the
           two rings read as concentric halos instead of overlapping. */
        .cov-box.is-focus-chapter {
          background: #fed7aa; border-color: #f97316; color: #7c2d12;
          box-shadow: 0 0 10px 1px rgba(249,115,22,.5);
          z-index: 3;
        }
        .cov-box.is-focus-chapter::before {
          content: ""; position: absolute; inset: -7px; border-radius: 9px;
          padding: 2px; pointer-events: none; z-index: 4;
          background: conic-gradient(from 0deg,
            transparent 0deg, rgba(255,255,255,.95) 10deg, transparent 24deg,
            transparent 96deg, rgba(255,255,255,.95) 106deg, transparent 120deg,
            transparent 192deg, rgba(255,255,255,.95) 202deg, transparent 216deg,
            transparent 288deg, rgba(255,255,255,.95) 298deg, transparent 312deg,
            transparent 360deg);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
                  mask-composite: exclude;
          animation: covFocusChapterSpin 2.4s linear infinite, covFocusChapterTwinkle 1s ease-in-out infinite alternate;
        }
        @keyframes covFocusChapterSpin { to { transform: rotate(360deg); } }
        @keyframes covFocusChapterTwinkle { from { opacity: .5; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .cov-box.is-focus-chapter::before { animation: none; opacity: .85; }
        }
        .cov-box-ref {
          display: block; max-width: 23px; overflow: hidden; text-overflow: ellipsis;
          color: currentColor;
          font-size: 8px; font-weight: 950; line-height: 1;
          white-space: nowrap;
        }
        .cov-box-title {
          position: absolute; width: 1px; height: 1px; overflow: hidden;
          clip: rect(0 0 0 0); white-space: nowrap;
        }
        .cov-box-score {
          position: absolute; width: 1px; height: 1px; overflow: hidden;
          clip: rect(0 0 0 0); white-space: nowrap;
        }
        .cov-empty {
          padding: 28px; text-align: center;
          border: 1px solid #e2e8f0; border-radius: 10px;
          background: rgba(255,255,255,.97); color: #64748b;
        }
        .cov-challenge {
          grid-column: 2;
          min-height: 74px; padding: 14px 16px; border-radius: 8px;
          border: 1px solid #d7dee8;
          background: #fff;
        }
        .cov.is-focused .cov-challenge { display: none; }
        .cov-challenge-title {
          margin: 0 0 5px; color: #202534; font-size: 12px; font-weight: 900; letter-spacing: .02em;
        }
        .cov-challenge-copy { margin: 0; color: #64748b; font-size: 12px; line-height: 1.45; }
        @media (max-width: 900px) {
          .cov-summary { grid-template-columns: 1fr; }
          .cov-stats { min-width: 0; }
          .cov-board { grid-template-columns: 1fr; }
          .cov-book-row { grid-template-columns: minmax(112px, 150px) minmax(0,1fr); }
          .cov-challenge { grid-column: auto; }
        }
        @media (max-width: 560px) {
          .cov-stats { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .cov-section-head { align-items: start; flex-direction: column; }
          .cov-board { padding: 13px; }
          .cov-book-row { grid-template-columns: 1fr; gap: 7px; }
        }
`;

export const COVERAGE_GRID_STYLES_2 = `
        .cov-legend {
          display: flex; flex-direction: column; align-items: flex-start; gap: 10px;
          width: fit-content; max-width: 100%;
        }
        .cov-legend-grid {
          display: grid; grid-template-columns: 74px repeat(var(--legend-section-count, 4), 28px);
          width: fit-content; max-width: 100%;
          gap: 6px 7px; align-items: center;
        }
        .cov-legend-corner { width: 100%; height: 100%; }
        .cov-legend-col-head {
          position: relative;
          display: flex; align-items: center; justify-content: center;
          height: 22px; border-radius: 6px;
          font-size: 11px; font-weight: 900;
          color: var(--hue); background: color-mix(in srgb, var(--hue) 16%, transparent);
          border: 1.5px solid var(--hue);
        }
        .cov-legend-col-head-tip {
          position: absolute; bottom: calc(100% + 9px); left: 50%;
          transform: translate(-50%, 4px);
          padding: 5px 10px; border-radius: 7px; white-space: nowrap;
          background: rgba(14,18,38,.98); border: 1px solid rgba(255,255,255,.16);
          color: #fff; font-size: 11px; font-weight: 750;
          opacity: 0; visibility: hidden; pointer-events: none; z-index: 20;
          transition: opacity .12s ease, transform .12s ease, visibility .12s ease;
        }
        .cov-legend-col-head-tip::after {
          content: ""; position: absolute; top: 100%; left: 50%;
          width: 8px; height: 8px; transform: translate(-50%, -50%) rotate(45deg);
          background: rgba(14,18,38,.98);
          border-right: 1px solid rgba(255,255,255,.16); border-bottom: 1px solid rgba(255,255,255,.16);
        }
        .cov-legend-col-head:hover .cov-legend-col-head-tip,
        .cov-legend-col-head:focus-visible .cov-legend-col-head-tip {
          opacity: 1; visibility: visible; transform: translate(-50%, 0);
        }
        .cov-legend-row-head {
          font-size: 10.5px; font-weight: 800; color: rgba(255,255,255,.68);
          line-height: 1.2;
        }
        .cov-legend-cell { display: flex; justify-content: center; width: 28px; }
        .cov-legend-swatch {
          width: 20px; height: 20px; border-radius: 5px;
          background: var(--fill); border: 2px solid var(--rail);
        }
        .cov-legend-swatch.is-empty { background: var(--fill, #fff); }
        .cov-legend-item {
          display: inline-flex; align-items: center; gap: 8px;
          color: rgba(255,255,255,.74); font-size: 12px; font-weight: 800;
        }
        .cov-legend-item.is-gold { color: #f0c674; }
`;
