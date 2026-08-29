export const ASSESS_SCREEN_STYLES = `        /* ============================================================
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
        .testament-card:disabled {
          cursor: default; opacity: .72; background: rgba(255,255,255,.46);
        }
        .testament-card:disabled:hover,
        .testament-card:disabled:focus-visible {
          transform: none; border-color: var(--border);
          background: rgba(255,255,255,.46); box-shadow: none;
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
        .pilot-note {
          padding: 12px 14px; border-radius: 12px;
          background: rgba(212,160,23,.12); border: 1px solid rgba(212,160,23,.26);
          color: #744a08; font-size: 13px; line-height: 1.5; font-weight: 600;
        }
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
`;
