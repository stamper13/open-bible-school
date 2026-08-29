export const HOME_RECOMMENDATION_STYLES = `        /* ============================================================
           Skill recommendation callout helpers
           ============================================================ */
        .recommended-guidance {
          margin-top: 14px; padding: 13px 14px;
          border-radius: 12px; border: 1px solid rgba(10,163,163,.16);
          background: rgba(10,163,163,.055); max-width: 660px;
        }
        .recommended-guidance-title {
          margin-bottom: 8px; color: #0a6e6e;
          font-size: 11px; font-weight: 850; letter-spacing: .10em; text-transform: uppercase;
        }
        .recommended-guidance-list {
          display: grid; gap: 6px; margin: 0; padding: 0; list-style: none;
        }
        .recommended-guidance-list li {
          position: relative; padding-left: 16px;
          color: rgba(27,36,66,.82); font-size: 12.5px; line-height: 1.45; font-weight: 650;
        }
        .recommended-guidance-list li::before {
          content: ""; position: absolute; left: 0; top: .62em;
          width: 6px; height: 6px; border-radius: 50%; background: #0aa3a3;
        }
        .recommended-resources {
          display: flex; flex-wrap: wrap; gap: 8px; margin-top: 11px;
        }
        .recommended-resource {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 10px; border-radius: 999px;
          color: #0a6e6e; background: rgba(255,255,255,.68);
          border: 1px solid rgba(10,163,163,.18);
          font-size: 12px; font-weight: 800; text-decoration: none;
        }
        .recommended-resource:hover, .recommended-resource:focus-visible {
          color: var(--navy); border-color: rgba(10,163,163,.34); outline: none;
        }
        .recommended-review {
          display: inline-flex; align-items: center; gap: 7px;
          color: #0a6e6e; font-size: 12px; font-weight: 800; text-decoration: none;
        }
        .recommended-review:hover, .recommended-review:focus-visible {
          color: var(--navy); outline: none; text-decoration: underline;
          text-underline-offset: 3px;
        }
        /* ============================================================
           Retest confirmation modal
           ============================================================ */
        .retest-modal-backdrop {
          position: fixed; inset: 0; z-index: 90;
          background: rgba(7,12,28,.66); backdrop-filter: blur(8px);
          display: grid; place-items: center; padding: 24px;
        }
        .retest-modal {
          width: min(100%, 480px); border-radius: 20px;
          background: rgba(255,255,255,.96); border: 1px solid var(--border);
          box-shadow: var(--shadow); padding: 28px 30px;
          position: relative; overflow: hidden;
        }
        .retest-modal::before {
          content: ""; position: absolute; inset: 0 auto 0 0; width: 5px;
          background: linear-gradient(180deg, var(--accent), #d4a017);
        }
        .retest-modal-kicker {
          color: #0a6e6e; font-size: 11px; font-weight: 850;
          letter-spacing: .11em; text-transform: uppercase; margin-bottom: 10px;
        }
        .retest-modal-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 28px; line-height: 1.08; font-weight: 650;
          color: var(--navy); margin-bottom: 10px;
        }
        .retest-modal-copy {
          color: var(--muted); font-size: 14px; line-height: 1.6;
          margin-bottom: 18px;
        }
        .retest-modal-actions {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 10px; flex-wrap: wrap;
        }
        .retest-modal-primary,
        .retest-modal-secondary {
          border-radius: 999px; padding: 11px 18px;
          font-family: inherit; font-size: 13.5px; font-weight: 800;
          cursor: pointer;
        }
        .retest-modal-primary {
          border: none; color: #fff; background: var(--navy);
          box-shadow: 0 10px 24px rgba(27,36,66,.28);
        }
        .retest-modal-secondary {
          border: 1px solid var(--border); color: var(--muted);
          background: rgba(255,255,255,.70);
        }
        /* ============================================================
           Coverage map section (mode switcher, focus/recommended card, grid wrapper)
           ============================================================ */
        .section-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: .10em;
          text-transform: uppercase; color: rgba(255,255,255,.45);
          margin-bottom: 14px; margin-top: 32px;
        }
        .breakdown-head {
          display: flex; justify-content: space-between; align-items: center;
          gap: 14px; margin-top: 32px; margin-bottom: 14px;
        }
        .breakdown-head .section-eyebrow { margin: 0; }
        .coverage-map-section { margin-top: 32px; position: relative; }
        .coverage-map-head {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 14px; margin-bottom: 14px;
        }
        .coverage-map-section .section-eyebrow { margin-bottom: 6px; }
        .coverage-map-title {
          margin: 0; color: #fff;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(22px, 3vw, 30px); line-height: 1;
        }
        .coverage-map-copy {
          margin: 8px 0 0; max-width: 620px;
          color: rgba(255,255,255,.66); font-size: 12.5px; line-height: 1.45;
        }
        .coverage-mode-controls {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px; border-radius: 999px;
          background: rgba(255,255,255,.08); border: 1px solid rgba(212,160,23,.42);
        }
        .coverage-mode-btn {
          min-height: 34px; border: 0; border-radius: 999px; padding: 7px 11px;
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          background: transparent; color: rgba(255,255,255,.64);
          font: inherit; font-size: 11.5px; font-weight: 850; cursor: pointer;
          transition: background .15s ease, color .15s ease, box-shadow .15s ease;
        }
        .coverage-mode-btn svg {
          width: 15px; height: 15px; fill: none; stroke: currentColor;
          stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
        }
        .coverage-mode-btn:hover,
        .coverage-mode-btn:focus-visible {
          color: #fff; background: rgba(255,255,255,.10); outline: none;
        }
        .coverage-mode-btn.is-active {
          background: rgba(255,255,255,.95); color: var(--navy);
          box-shadow: 0 8px 20px rgba(0,0,0,.18);
        }
        .coverage-mode-btn:disabled {
          opacity: .42; cursor: not-allowed;
        }
        .coverage-map-link {
          display: inline-flex; align-items: center; gap: 7px;
          width: 34px; height: 34px; justify-content: center;
          padding: 0; border-radius: 999px; white-space: nowrap;
          background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18);
          color: rgba(255,255,255,.85); text-decoration: none;
          font-size: 12px; font-weight: 800;
          transition: background .15s ease, border-color .15s ease;
        }
        .coverage-map-link:hover { background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.30); }
        /* A tiny star-and-orbiting-planet in place of a generic map glyph —
           the same slow-drift orbit motif as the brand mark and the
           Learn More menu (see learnMoreOrbitSpin above), just built from
           plain rotating elements rather than SVG so it stays cheap and
           avoids SVG transform-origin quirks. Always drifting quietly;
           speeds up on hover as the one bit of direct feedback that this
           icon leads to the knowledge map. */
        .cml-icon { position: relative; width: 20px; height: 20px; flex: 0 0 auto; }
        .cml-star {
          position: absolute; top: 50%; left: 50%; width: 5px; height: 5px;
          margin: -2.5px 0 0 -2.5px; border-radius: 50%;
          background: #f0c674; box-shadow: 0 0 6px rgba(240,198,116,.85);
          animation: cmlTwinkle 2.6s ease-in-out infinite;
        }
        .cml-orbit {
          position: absolute; inset: 0;
          border: 1px dashed rgba(255,255,255,.32); border-radius: 50%;
          animation: cmlSpin 7s linear infinite;
        }
        .cml-planet {
          position: absolute; top: -1.5px; left: 50%; width: 4px; height: 4px;
          margin-left: -2px; border-radius: 50%;
          background: #7de5e5; box-shadow: 0 0 5px rgba(125,229,229,.85);
        }
        @keyframes cmlSpin { to { transform: rotate(360deg); } }
        @keyframes cmlTwinkle {
          0%, 100% { opacity: .68; transform: scale(.82); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        .coverage-map-link:hover .cml-orbit { animation-duration: 1.3s; }
        .coverage-map-link:hover .cml-star { animation-duration: .9s; }
        @media (prefers-reduced-motion: reduce) {
          .cml-orbit, .cml-star { animation: none; }
        }
        /* One continuous card for the recommendation callout and the
           chapter board — previously separate boxes. They're divided by a
           fine gold line (.coverage-focus-card's border-bottom) instead of
           each carrying its own background/border/shadow. The legend lives
           outside this card entirely — see .coverage-legend-rail below. */
        .coverage-map-card {
          border-radius: 10px; border: 1px solid rgba(226,232,240,.95);
          background: rgba(255,255,255,.97);
          box-shadow: 0 20px 48px rgba(0,0,0,.20);
          overflow: hidden;
        }
        /* The legend has no box of its own — it sits directly on the dark
           starfield backdrop. On wide viewports it breaks out of the .page
           column entirely, floating in the left margin beside the card
           (position: relative on .coverage-map-section is what makes
           right: 100% land at that column's left edge) — there's room there
           for the section-by-completion-level matrix. Below this width
           there's no margin to float a ~220px panel into, so it drops back
           into normal flow above the card instead. */
        .coverage-legend-rail {
          margin-bottom: 14px;
        }
        .coverage-map-section.is-recommended .coverage-legend-rail {
          display: flex; justify-content: flex-end;
        }
        @media (min-width: 1680px) {
          .coverage-legend-rail {
            position: absolute; top: 58px; right: 100%;
            width: 224px; margin: 0 28px 0 0;
          }
        }
        .coverage-focus-card {
          position: relative;
          display: grid; grid-template-columns: minmax(0,1fr) minmax(190px, auto);
          gap: 18px; align-items: center;
          padding: 20px 22px;
          color: var(--navy);
          border-bottom: 1px solid rgba(212,160,23,.4);
        }
        .coverage-focus-card.is-skill {
          align-items: start;
          background:
            linear-gradient(135deg, rgba(255,255,255,.98), rgba(255,248,225,.96) 58%, rgba(236,253,245,.92));
        }
        .coverage-focus-card.is-skill::before {
          content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
          background: linear-gradient(180deg, #d4a017, #0aa3a3);
        }
        .coverage-diagnostic-head {
          display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
          margin-bottom: 6px;
        }
        .coverage-focus-eyebrow {
          margin: 0 0 5px; color: #0a6e6e;
          font-size: 10.5px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase;
        }
        .coverage-focus-card.is-skill .coverage-focus-eyebrow {
          margin: 0; color: #8a5d00;
        }
        .coverage-focus-title {
          margin: 0; color: var(--navy);
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 24px; font-weight: 650; line-height: 1.08;
        }
        /* The dimension name (e.g. "Law") doubling as the title, when
           there's a dimension gap to click into. Underline only shows on
           hover/focus so it doesn't look like a broken link at rest. */
        .coverage-focus-title-link {
          appearance: none; border: 0; padding: 0; margin: 0; background: transparent;
          font: inherit; color: inherit; cursor: pointer; text-align: left;
          text-decoration-line: underline; text-decoration-color: transparent; text-underline-offset: 4px;
          transition: text-decoration-color .15s ease, color .15s ease;
        }
        .coverage-focus-title-link:hover, .coverage-focus-title-link:focus-visible {
          text-decoration-color: currentColor; color: #0a6e6e; outline: none;
        }
        .coverage-focus-meta {
          margin: 5px 0 0; color: var(--muted);
          font-size: 12.5px; font-weight: 700; line-height: 1.4;
        }
        .coverage-focus-copy {
          margin: 10px 0 0; color: #435168;
          font-size: 13px; line-height: 1.52; max-width: 760px;
        }
        .coverage-focus-actions {
          display: flex; flex-direction: column; align-items: flex-end; gap: 9px;
        }
        .coverage-focus-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          border: 0; border-radius: 8px; padding: 10px 14px;
          background: var(--navy); color: #fff; text-decoration: none;
          font-size: 12.5px; font-weight: 850; white-space: nowrap;
          box-shadow: 0 10px 22px rgba(27,36,66,.22);
        }
        .coverage-focus-primary svg { width: 14px; height: 14px; }
        .coverage-focus-priority {
          margin: 0; color: var(--muted);
          font-size: 12px; line-height: 1.45; text-align: right; max-width: 260px;
        }
        .coverage-focus-card.is-skill .recommended-guidance {
          margin-top: 14px; padding: 13px 14px;
          border-radius: 10px; border: 1px solid rgba(212,160,23,.20);
          background: rgba(255,255,255,.64);
        }
        .coverage-focus-card.is-skill .scope-text-btn {
          background: rgba(255,255,255,.68);
        }
        .coverage-map-empty {
          min-height: 132px; padding: 24px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; gap: 6px;
          border: 1px solid var(--border); border-radius: 10px;
          background: rgba(255,255,255,.97); color: var(--muted);
        }
        .coverage-map-empty strong {
          color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 20px; font-weight: 650;
        }
        .coverage-map-empty span { max-width: 480px; font-size: 12px; line-height: 1.5; }
        @media (max-width: 560px) {
          .coverage-map-head { flex-direction: column; align-items: start; }
          .coverage-mode-controls { width: 100%; overflow-x: auto; border-radius: 12px; }
          .coverage-mode-btn { flex: 1 0 auto; }
          .coverage-focus-card { grid-template-columns: 1fr; padding: 18px; }
          .coverage-focus-actions { align-items: flex-start; }
          .coverage-focus-priority { text-align: left; max-width: none; }
          .coverage-focus-primary { white-space: normal; }
        }
        .breakdown-controls {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 10px; flex-wrap: wrap;
        }
        .breakdown-tabs {
          display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px;
          background: rgba(255,255,255,.88); border: 1px solid var(--border);
          box-shadow: var(--shadow-sm); backdrop-filter: blur(14px);
        }
        .breakdown-tab {
          border: none; border-radius: 999px; padding: 7px 12px;
          background: transparent; color: var(--muted);
          font: inherit; font-size: 12px; font-weight: 800; cursor: pointer;
        }
        .breakdown-tab:hover, .breakdown-tab:focus-visible {
          color: var(--navy); outline: none;
        }
        .breakdown-tab.is-active { background: var(--navy); color: #fff; }
        .breakdown-note {
          margin: -4px 0 14px; color: rgba(255,255,255,.68);
          font-size: 12.5px; line-height: 1.45;
        }
        .sections-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .sections-grid.books { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .sections-grid.domains { grid-template-columns: repeat(3, minmax(0, 1fr)); }
`;
