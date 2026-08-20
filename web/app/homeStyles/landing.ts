export const HOME_LANDING_STYLES = `        /* ============================================================
           Dashboard subject tabs & loading card
           ============================================================ */
        .dashboard-tabs {
          display: inline-grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px; width: 100%; max-width: 760px;
          padding: 6px; margin: -14px 0 28px;
          border: 1px solid rgba(212,160,23,.28); border-radius: 16px;
          background: rgba(255,255,255,.07); backdrop-filter: blur(14px);
          box-shadow: 0 16px 40px rgba(0,0,0,.22), 0 0 30px rgba(212,160,23,.055), inset 0 0 0 1px rgba(245,200,66,.06);
        }
        .page.is-new-assessment-landing .dashboard-tabs {
          max-width: 820px;
          margin: 0 0 28px;
        }
        .dashboard-tab {
          border: 0; border-radius: 11px; padding: 12px 14px;
          background: transparent; color: rgba(255,255,255,.62);
          display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
          cursor: pointer; font-family: inherit; text-align: left;
          transition: background .16s ease, color .16s ease, transform .14s ease;
        }
        .dashboard-tab strong {
          font-size: 13px; font-weight: 800; letter-spacing: .02em;
        }
        .dashboard-tab span {
          font-size: 11px; font-weight: 650; color: rgba(255,255,255,.38);
        }
        .dashboard-tab:hover { background: rgba(255,255,255,.08); color: #fff; transform: translateY(-1px); }
        .dashboard-tab.is-active {
          background: rgba(255,255,255,.92); color: var(--navy);
          box-shadow: 0 10px 24px rgba(0,0,0,.2);
        }
        .dashboard-tab.is-active span { color: var(--muted); }
        .dashboard-loading-card {
          position: relative;
          min-height: min(460px, 62vh); width: 100%; padding: 32px;
          display: grid; place-items: center;
          color: #fff; text-align: center;
        }
        .dashboard-loading-orbit {
          position: relative; width: 58px; height: 58px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,.18);
          box-shadow: 0 0 28px rgba(10,163,163,.16), inset 0 0 22px rgba(255,255,255,.04);
          animation: dashboardLoadingSpin 2.8s linear infinite;
        }
        .dashboard-loading-orbit::before,
        .dashboard-loading-orbit::after {
          content: ""; position: absolute; border-radius: 999px;
        }
        .dashboard-loading-orbit::before {
          width: 16px; height: 16px; left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle at 35% 30%, #fff6c9, #d4a017 58%, #8c640a);
          box-shadow: 0 0 18px rgba(212,160,23,.48);
        }
        .dashboard-loading-orbit::after {
          width: 10px; height: 10px; right: 2px; top: 24px;
          background: radial-gradient(circle at 35% 30%, #dbfffb, #0aa3a3);
          box-shadow: 0 0 14px rgba(10,163,163,.58);
        }
        .dashboard-loading-sr {
          position: absolute; width: 1px; height: 1px; overflow: hidden;
          clip: rect(0 0 0 0); white-space: nowrap;
        }
        @keyframes dashboardLoadingSpin { to { transform: rotate(1turn); } }
        /* ============================================================
           Save-results card (signed-out snapshot prompt)
           ============================================================ */
        .save-results-card {
          position: relative; overflow: hidden;
          background: rgba(255,255,255,.92);
          border: 1px solid rgba(226,232,240,.92); border-radius: 12px;
          box-shadow: 0 12px 28px rgba(0,0,0,.14);
          backdrop-filter: blur(14px);
          padding: 15px 18px; margin-bottom: 22px;
          display: grid; grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px; align-items: center;
        }
        .save-results-card::before {
          content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
          background: linear-gradient(180deg, #0aa3a3, #d4a017);
          pointer-events: none;
        }
        .save-results-graphic,
        .save-results-content,
        .save-results-actions { position: relative; z-index: 1; }
        .save-results-graphic {
          display: none;
          width: 72px; aspect-ratio: 1; border-radius: 50%;
          border: 1px solid rgba(10,163,163,.22);
          background:
            radial-gradient(circle at 50% 50%, rgba(255,246,201,.92) 0 8px, rgba(212,160,23,.95) 9px 15px, transparent 16px),
            radial-gradient(circle at 74% 28%, rgba(219,255,251,.95) 0 5px, rgba(10,163,163,.90) 6px 10px, transparent 11px),
            radial-gradient(circle at 28% 75%, rgba(255,255,255,.92) 0 4px, rgba(124,58,237,.82) 5px 8px, transparent 9px),
            rgba(255,255,255,.46);
          box-shadow: inset 0 0 30px rgba(10,163,163,.10), 0 14px 30px rgba(27,36,66,.14);
        }
        .save-results-graphic::before,
        .save-results-graphic::after {
          content: ""; position: absolute; border-radius: 50%; pointer-events: none;
        }
        .save-results-graphic::before {
          inset: 13px; border: 1px dashed rgba(10,163,163,.42);
          transform: rotate(-18deg) scaleX(1.18);
        }
        .save-results-graphic::after {
          right: -3px; bottom: 7px; width: 22px; height: 22px;
          background: #fff; border: 1px solid rgba(10,163,163,.22);
          box-shadow: 0 8px 18px rgba(27,36,66,.13);
        }
        .save-results-check {
          position: absolute; right: 3px; bottom: 14px; z-index: 2;
          width: 11px; height: 7px;
          border-left: 2px solid #0a6e6e; border-bottom: 2px solid #0a6e6e;
          transform: rotate(-45deg);
        }
        .save-results-kicker {
          display: inline-flex; align-items: center; gap: 7px;
          color: #0a6e6e; font-size: 10px; font-weight: 900;
          letter-spacing: .11em; text-transform: uppercase;
          margin-bottom: 4px;
        }
        .save-results-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 22px; font-weight: 650; line-height: 1.08;
          color: var(--navy); margin-bottom: 4px;
        }
        .save-results-copy {
          color: var(--muted); font-size: 12.5px; line-height: 1.45;
          max-width: 720px;
        }
        .save-results-actions {
          display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
        }
        .save-results-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          border: none; border-radius: 999px; padding: 10px 16px;
          background: var(--navy);
          color: #fff; font-family: inherit; font-size: 12.5px; font-weight: 850;
          cursor: pointer; box-shadow: 0 10px 22px rgba(27,36,66,.24);
          transition: transform .13s ease, box-shadow .15s ease;
          white-space: nowrap;
        }
        .save-results-btn:hover { transform: translateY(-1px); box-shadow: 0 14px 28px rgba(27,36,66,.30); }
        .save-results-note {
          font-size: 11px; color: rgba(86,96,112,.76); font-weight: 650;
          text-align: right;
        }
        @keyframes saveResultsGlow { to { transform: rotate(1turn); } }
        /* ============================================================
           First-assessment card & feature grid
           ============================================================ */
        .first-assessment-card {
          position: relative; overflow: hidden;
          display: grid; grid-template-columns: minmax(280px, 420px) minmax(0, 1fr);
          gap: 34px; align-items: center;
          min-height: 430px; padding: 38px;
          color: #fff;
          background:
            radial-gradient(circle at 21% 38%, rgba(255,214,92,.36), transparent 36%),
            radial-gradient(circle at 76% 18%, rgba(229,173,35,.28), transparent 34%),
            radial-gradient(circle at 88% 74%, rgba(10,163,163,.16), transparent 35%),
            linear-gradient(145deg, rgba(79,58,17,.74), rgba(37,31,27,.70) 44%, rgba(10,22,38,.78));
          border: 1px solid rgba(245,200,66,.48); border-radius: 22px;
          box-shadow: 0 30px 90px rgba(0,0,0,.28), 0 0 58px rgba(212,160,23,.18), inset 0 0 82px rgba(255,220,126,.10), inset 0 0 0 1px rgba(255,237,171,.12);
          backdrop-filter: blur(18px);
        }
        .first-assessment-card::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background-image:
            radial-gradient(circle, rgba(255,255,255,.78) 0 1px, transparent 1.4px),
            radial-gradient(circle, rgba(255,255,255,.38) 0 1px, transparent 1.5px);
          background-size: 92px 92px, 137px 137px;
          background-position: 10px 18px, 42px 56px;
          opacity: .55;
        }
        .first-assessment-orbit,
        .first-assessment-content { position: relative; z-index: 1; }
        .first-assessment-orbit {
          width: min(100%, 380px); aspect-ratio: 1; border-radius: 999px;
          border: 1px dashed rgba(255,255,255,.24);
          margin: 0 auto;
          background: radial-gradient(circle at 50% 50%, rgba(212,160,23,.10), transparent 38%);
        }
        .first-assessment-orbit::before,
        .first-assessment-orbit::after {
          content: ""; position: absolute; border-radius: 999px; pointer-events: none;
        }
        .first-assessment-orbit::before {
          inset: 56px; border: 1px dashed rgba(10,163,163,.34);
          transform: rotate(-22deg) scaleX(1.18);
        }
        .first-assessment-orbit::after {
          inset: 110px; border: 1px solid rgba(255,255,255,.14);
          transform: rotate(18deg) scaleX(1.42);
        }
        .first-assessment-sun,
        .first-assessment-planet,
        .first-assessment-moon {
          position: absolute; display: block; border-radius: 999px;
          box-shadow: 0 0 34px currentColor;
        }
        .first-assessment-sun {
          width: 102px; height: 102px; left: 50%; top: 50%;
          color: rgba(212,160,23,.72);
          background: radial-gradient(circle at 38% 38%, #fff2b8, #d4a017 45%, #91680e);
          transform: translate(-50%, -50%);
        }
        .first-assessment-planet {
          width: 56px; height: 56px; left: 73%; top: 35%;
          color: rgba(10,163,163,.58);
          background: radial-gradient(circle at 36% 34%, #d6fffa, #0aa3a3 48%, #075e61);
        }
        .first-assessment-moon {
          width: 24px; height: 24px; left: 82%; top: 52%;
          color: rgba(255,255,255,.38);
          background: radial-gradient(circle at 38% 38%, #fff, #cfd6df 55%, #7f8b99);
        }
        .first-assessment-kicker {
          margin-bottom: 11px; color: #5eead4;
          font-size: 12px; font-weight: 900; letter-spacing: .13em; text-transform: uppercase;
        }
        .first-assessment-content h2 {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(36px, 5vw, 58px); line-height: .98; font-weight: 700;
          max-width: 520px; margin-bottom: 16px;
        }
        .first-assessment-content p {
          max-width: 560px; color: rgba(255,255,255,.76);
          font-size: 16px; line-height: 1.65; margin-bottom: 24px;
        }
        .first-assessment-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .first-assessment-primary,
        .first-assessment-secondary {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          min-height: 44px; padding: 12px 18px; border-radius: 999px;
          font-size: 14px; font-weight: 850; text-decoration: none;
          font-family: inherit; cursor: pointer;
        }
        .first-assessment-primary {
          border: 0;
          background: #e6ad12; color: #141827;
          box-shadow: 0 14px 34px rgba(230,173,18,.28);
        }
        .first-assessment-secondary {
          border: 1px solid rgba(255,255,255,.24); color: rgba(255,255,255,.88);
          background: rgba(255,255,255,.06);
        }
        .first-assessment-choice-panel {
          margin-top: 18px; width: min(100%, 540px);
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
          animation: firstAssessmentChoiceIn .2s ease both;
        }
        .first-assessment-choice {
          display: grid; gap: 5px; min-height: 92px;
          padding: 16px; border-radius: 14px;
          text-decoration: none; color: #fff;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.075);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.035);
          transition: transform .14s ease, border-color .14s ease, background .14s ease;
        }
        .first-assessment-choice:hover,
        .first-assessment-choice:focus-visible {
          transform: translateY(-2px);
          border-color: rgba(230,173,18,.48);
          background: rgba(255,255,255,.11);
          outline: none;
        }
        .first-assessment-choice strong {
          font-size: 14px; font-weight: 900;
        }
        .first-assessment-choice span {
          color: rgba(255,255,255,.62);
          font-size: 12px; line-height: 1.35; font-weight: 650;
        }
        @keyframes firstAssessmentChoiceIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .first-assessment-steps {
          display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
          margin-top: 28px; color: rgba(255,255,255,.68);
          font-size: 12px; font-weight: 850; text-transform: uppercase; letter-spacing: .08em;
        }
        .first-assessment-steps span {
          padding: 7px 10px; border-radius: 999px;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.13);
        }
        .oba-feature-grid {
          display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px; margin-top: 34px;
        }
        .oba-feature-card {
          position: relative; overflow: hidden;
          min-height: 238px; padding: 20px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,.16);
          background:
            linear-gradient(145deg, rgba(255,255,255,.94), rgba(240,247,251,.88));
          box-shadow: 0 18px 52px rgba(0,0,0,.22), inset 0 0 34px rgba(255,255,255,.42);
          backdrop-filter: blur(16px);
          color: var(--navy);
        }
        .oba-feature-card::before {
          content: ""; position: absolute; inset: -35% -20% auto auto;
          width: 180px; height: 180px; border-radius: 999px;
          background: color-mix(in srgb, var(--feature-hue) 22%, transparent);
          filter: blur(4px); pointer-events: none;
        }
        .oba-feature-graphic {
          position: relative; height: 88px; margin-bottom: 15px;
          border-radius: 14px;
          background:
            radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--feature-hue) 18%, transparent), transparent 58%),
            rgba(27,36,66,.045);
          border: 1px solid rgba(27,36,66,.08);
        }
        .oba-feature-graphic span {
          position: absolute; display: block;
        }
        .oba-feature-graphic.is-signal .signal-node {
          width: 16px; height: 16px; border-radius: 999px;
          background: var(--feature-hue);
          box-shadow: 0 0 0 7px color-mix(in srgb, var(--feature-hue) 16%, transparent), 0 0 24px color-mix(in srgb, var(--feature-hue) 40%, transparent);
        }
        .oba-feature-graphic.is-signal .signal-node:nth-child(1) { left: 18%; top: 54%; }
        .oba-feature-graphic.is-signal .signal-node:nth-child(2) { left: 46%; top: 26%; }
        .oba-feature-graphic.is-signal .signal-node:nth-child(3) { left: 72%; top: 50%; }
        .oba-feature-graphic.is-signal .signal-line {
          height: 2px; width: 34%; left: 28%; top: 46%;
          background: linear-gradient(90deg, transparent, var(--feature-hue), transparent);
          transform: rotate(-22deg);
        }
        .oba-feature-graphic.is-signal .signal-line:nth-child(5) {
          left: 53%; top: 43%; width: 26%; transform: rotate(18deg);
        }
        .oba-feature-graphic.is-map .map-orbit {
          inset: 16px 31%; border-radius: 999px;
          border: 1.5px dashed color-mix(in srgb, var(--feature-hue) 46%, transparent);
          transform: rotate(-13deg) scaleX(1.55);
        }
        .oba-feature-graphic.is-map .map-star {
          width: 34px; height: 34px; left: 42%; top: 28%;
          border-radius: 999px;
          background: radial-gradient(circle at 35% 30%, #fff7c9, var(--feature-hue) 58%, #8c640a);
          box-shadow: 0 0 24px color-mix(in srgb, var(--feature-hue) 48%, transparent);
        }
        .oba-feature-graphic.is-map .map-planet {
          width: 18px; height: 18px; left: 67%; top: 48%;
          border-radius: 999px; background: #0aa3a3;
          box-shadow: 0 0 16px rgba(10,163,163,.45);
        }
        .oba-feature-graphic.is-path .path-step {
          width: 22px; height: 22px; border-radius: 7px;
          border: 2px solid var(--feature-hue);
          background: color-mix(in srgb, var(--feature-hue) 15%, #ffffff);
        }
        .oba-feature-graphic.is-path .path-step:nth-child(1) { left: 16%; top: 48%; opacity: .58; }
        .oba-feature-graphic.is-path .path-step:nth-child(2) { left: 42%; top: 34%; opacity: .8; }
        .oba-feature-graphic.is-path .path-step:nth-child(3) { left: 68%; top: 22%; background: var(--feature-hue); }
        .oba-feature-graphic.is-path .path-line {
          height: 2px; width: 58%; left: 23%; top: 45%;
          background: linear-gradient(90deg, color-mix(in srgb, var(--feature-hue) 32%, transparent), var(--feature-hue));
          transform: rotate(-15deg);
        }
        .oba-feature-kicker {
          margin: 0 0 7px; color: color-mix(in srgb, var(--feature-hue) 72%, #17213d);
          font-size: 10px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase;
        }
        .oba-feature-title {
          margin: 0; font-family: var(--font-crimson), Georgia, serif;
          font-size: 22px; line-height: 1.05; color: var(--navy);
        }
        .oba-feature-copy {
          margin: 8px 0 0; color: rgba(57,67,87,.78);
          font-size: 13px; line-height: 1.5; font-weight: 650;
        }
`;
