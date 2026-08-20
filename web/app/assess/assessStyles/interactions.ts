export const ASSESS_INTERACTION_STYLES = `        /* ============================================================
           NT running-score row
           ============================================================ */
        .score-row {
          display: flex; gap: 20px; margin-top: 20px; padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        .score-item { font-size: 12.5px; color: var(--muted); }
        .score-item strong { color: var(--navy); font-size: 15px; display: block; }

        /* Milestone banner — this fires once, at the moment a full baseline
           or targeted test actually finishes, so it earns a bit more
           presence than the routine teal UI around it: gold marks
           achievement elsewhere in the app (first-assessment-card, Torah
           bar), so this borrows that language instead of the standard
           interactive teal. */
        /* ============================================================
           OT milestone banner (baseline/retest complete)
           ============================================================ */
        .milestone-banner {
          position: relative; overflow: hidden;
          margin-top: 16px; padding: 16px 18px; border-radius: 14px;
          background:
            linear-gradient(135deg, rgba(245,200,66,.20), rgba(212,160,23,.07)),
            rgba(255,255,255,.7);
          border: 1px solid rgba(212,160,23,.38);
          box-shadow: 0 10px 28px rgba(212,160,23,.12);
          font-size: 13px; color: #4a3a08; font-weight: 500;
          display: flex; align-items: center; gap: 14px;
          animation: milestoneIn .5s cubic-bezier(.22,.72,.18,1) both;
        }
        @keyframes milestoneIn {
          from { opacity: 0; transform: translateY(6px) scale(.98); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .milestone-banner { animation: none; }
        }
        .milestone-icon {
          flex-shrink: 0; width: 34px; height: 34px; border-radius: 999px;
          display: grid; place-items: center;
          background: radial-gradient(circle at 34% 30%, #fff4bd, #e6ad12 60%, #91680e);
          box-shadow: 0 0 0 4px rgba(230,173,18,.14), 0 4px 14px rgba(212,160,23,.35);
        }
        .milestone-icon svg { width: 17px; height: 17px; color: #4a3208; }
        .milestone-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; line-height: 1.45; }
        .milestone-kicker {
          font-size: 10.5px; font-weight: 850; letter-spacing: .09em; text-transform: uppercase;
          color: #8a6208;
        }
        .milestone-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .milestone-results, .milestone-dashboard {
          min-height: 36px; display: inline-flex; align-items: center; justify-content: center;
          border-radius: 999px; padding: 0 14px; font: 750 12px var(--font-inter), sans-serif;
          text-decoration: none; cursor: pointer; white-space: nowrap;
        }
        .milestone-results {
          color: #241a02; background: linear-gradient(135deg, #f5c842, #d4a017);
          border: 1px solid rgba(212,160,23,.5);
          box-shadow: 0 8px 20px rgba(212,160,23,.32);
        }
        .milestone-dashboard { color: #4a3a08; background: rgba(255,255,255,.65); border: 1px solid rgba(212,160,23,.28); }

        /* ============================================================
           Correct-answer celebration burst (fireworks)
           ============================================================ */
        .cosmic-burst {
          position: fixed; inset: 0; z-index: 12; pointer-events: none; overflow: hidden;
          mix-blend-mode: screen;
        }
        .firework {
          --spark-length: 34px;
          --delay: 0s;
          position: absolute; width: 112px; height: 96px;
          left: 10vw; top: 24vh;
          color: rgba(173,232,255,1);
          opacity: 0;
          animation: fireworkPop 1.75s ease-out var(--delay) both;
        }
        .firework::before {
          content: ""; position: absolute; left: 50%; top: 50%;
          width: 8px; height: 8px; border-radius: 999px;
          background: currentColor;
          box-shadow: 0 0 18px currentColor, 0 0 36px rgba(255,255,255,.32);
          transform: translate(-50%, -50%);
          animation: fireworkCore 1.75s ease-out var(--delay) both;
        }
        .spark {
          position: absolute; left: 50%; top: 50%;
          width: var(--spark-length); height: 3px; border-radius: 999px;
          background: linear-gradient(90deg, rgba(255,255,255,.95), currentColor 55%, transparent);
          filter: drop-shadow(0 0 7px currentColor);
          transform-origin: 0 50%;
          opacity: 0;
          animation: fireworkSpark 1.75s ease-out var(--delay) both;
        }
        .spark-a { --x: -7px;  --y: -8px;  --r: -125deg; }
        .spark-b { --x: -3px;  --y: -10px; --r: -98deg; }
        .spark-c { --x: 4px;   --y: -8px;  --r: -62deg; }
        .spark-d { --x: 8px;   --y: -2px;  --r: -28deg; }
        .spark-e { --x: 4px;   --y: 7px;   --r: 32deg; opacity: .72; }
        .spark-f { --x: -8px;  --y: 6px;   --r: 148deg; opacity: .72; }
        .firework-one { left: 8vw; top: 25vh; color: rgba(173,232,255,1); --delay: 0s; }
        .firework-two { left: 13vw; top: 18vh; color: rgba(212,160,23,.98); --delay: .16s; transform: scale(.9); }
        .firework-three { left: 17vw; top: 28vh; color: rgba(10,163,163,.98); --delay: .32s; transform: scale(.82); }
        @keyframes fireworkPop {
          0% { opacity: 0; }
          12% { opacity: 1; }
          72% { opacity: .88; }
          100% { opacity: 0; }
        }
        @keyframes fireworkCore {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(.25); }
          16% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(.55); }
        }
        @keyframes fireworkSpark {
          0% { opacity: 0; width: 8px; transform: translate(var(--x), var(--y)) rotate(var(--r)) scaleX(.2); }
          18% { opacity: 1; width: var(--spark-length); }
          100% { opacity: 0; width: calc(var(--spark-length) * 1.12); transform: translate(calc(var(--x) * 3.2), calc(var(--y) * 3.2)) rotate(var(--r)) scaleX(1); }
        }
        /* Results overlay */
        /* ============================================================
           Report-a-problem & OT results overlay modals
           ============================================================ */
        .overlay-backdrop {
          position: fixed; inset: 0; z-index: 40;
          background: rgba(0,0,0,.6); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 24px;
        }
        .overlay-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 24px; padding: 36px 40px;
          box-shadow: var(--shadow); width: 100%; max-width: 480px;
          position: relative; animation: cardIn .25s ease;
        }
        .overlay-close {
          position: absolute; top: 16px; right: 16px;
          width: 32px; height: 32px; border-radius: 999px;
          background: rgba(27,36,66,.07); border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--muted); transition: background .13s;
        }
        .overlay-close:hover { background: rgba(27,36,66,.12); }
        .report-card { max-width: 520px; }
        .report-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 24px; font-weight: 650; color: var(--navy); margin-bottom: 8px;
        }
        .report-desc { font-size: 13.5px; color: var(--muted); line-height: 1.55; margin-bottom: 16px; }
        .report-question {
          padding: 12px 14px; border-radius: 12px;
          background: rgba(27,36,66,.045); border: 1px solid rgba(27,36,66,.08);
          color: var(--navy); font-size: 13.5px; line-height: 1.45; margin-bottom: 16px;
        }
        .report-options {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px; margin-bottom: 14px;
        }
        .report-option {
          border: 1.5px solid var(--border); background: rgba(255,255,255,.72);
          color: var(--navy); border-radius: 12px; padding: 11px 12px;
          font-size: 13.5px; font-weight: 700; cursor: pointer; font-family: inherit;
          transition: border-color .13s, background .13s, color .13s;
        }
        .report-option.is-active {
          background: var(--accent-dim); border-color: var(--accent-line); color: #0a5a5a;
        }
        .report-textarea {
          width: 100%; min-height: 108px; resize: vertical;
          border: 1.5px solid var(--border); border-radius: 12px;
          padding: 12px 14px; font-size: 14px; line-height: 1.5;
          font-family: inherit; color: var(--navy); outline: none;
          background: rgba(255,255,255,.74);
        }
        .report-textarea:focus { border-color: var(--accent-line); background: #fff; }
        .report-error { color: var(--wrong); font-size: 12.5px; font-weight: 650; margin-top: 10px; }
        .report-actions {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 10px; margin-top: 16px;
        }
        .report-submit {
          border: none; border-radius: 999px; background: var(--navy); color: #fff;
          padding: 10px 18px; font-size: 13.5px; font-weight: 750;
          cursor: pointer; font-family: inherit;
        }
        .report-submit:disabled { opacity: .62; cursor: default; }
        .report-cancel {
          border: 1px solid var(--border); border-radius: 999px;
          background: rgba(255,255,255,.58); color: var(--muted);
          padding: 9px 16px; font-size: 13px; font-weight: 650;
          cursor: pointer; font-family: inherit;
        }
        .report-sent {
          padding: 22px 6px 4px; text-align: center;
          color: var(--correct); font-size: 15px; font-weight: 750;
        }
        .overlay-score {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 64px; font-weight: 700; color: var(--navy);
          line-height: 1; text-align: center; margin-bottom: 4px;
        }
        .overlay-label { text-align: center; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 20px; }
        .overlay-stats { display: flex; justify-content: center; gap: 28px; margin-bottom: 24px; }
        .overlay-stat { text-align: center; }
        .overlay-stat strong { display: block; font-size: 20px; font-weight: 700; color: var(--navy); font-family: var(--font-crimson), Georgia, serif; }
        .overlay-stat span { font-size: 12px; color: var(--muted); }
        .overlay-divider { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
        .overlay-heading { font-family: var(--font-crimson), Georgia, serif; font-size: 18px; font-weight: 600; color: var(--navy); margin-bottom: 12px; }
        .overlay-desc { font-size: 13.5px; color: var(--muted); line-height: 1.65; margin-bottom: 16px; }
`;
