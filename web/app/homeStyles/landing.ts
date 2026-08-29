export const HOME_LANDING_STYLES = `        /* ============================================================
           Dashboard subject tabs & loading card
           ============================================================ */
        /* One dashboard subject control, shared with the header's switcher
           (see SubjectSwitcher in homeDashboard/nav.tsx). This replaces the old
           three-tile .dashboard-tabs grid, which stacked into three full-width
           boxes on a phone and pushed the real content below the fold. */
        .dashboard-subject-row {
          display: flex; align-items: center;
          margin: -14px 0 28px;
        }
        .page.is-new-assessment-landing .dashboard-subject-row {
          margin: 0 0 24px;
        }
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
        @keyframes saveResultsGlow { to { transform: rotate(1turn); } }
        /* ============================================================
           Save-results popup (the first ask, before the card above)
           ============================================================ */
        .save-modal-backdrop {
          position: fixed; inset: 0; z-index: 90;
          background: rgba(7,12,28,.66); backdrop-filter: blur(8px);
          display: grid; place-items: center; padding: 24px;
          animation: saveModalBackdropIn .18s ease-out both;
        }
        /* A cream card on a dark-space dashboard read as a browser alert
           dropped onto the page. The dialog now uses the same surface, gold
           CTA and type as the dashboard behind it, and carries a title, one
           line and two buttons instead of a kicker, a paragraph and a
           two-sentence footnote. */
        .save-modal {
          width: min(100%, 420px); border-radius: 20px;
          background: rgba(13,18,36,.97);
          border: 1px solid rgba(255,255,255,.14);
          box-shadow: 0 30px 80px rgba(0,0,0,.55);
          backdrop-filter: blur(14px);
          padding: 26px 28px 24px;
          position: relative; overflow: hidden;
          animation: saveModalIn .2s ease-out both;
        }
        .save-modal::before {
          content: ""; position: absolute; inset: 0 0 auto 0; height: 3px;
          background: linear-gradient(90deg, #0aa3a3, #e6ad12);
          pointer-events: none;
        }
        .save-modal-close {
          position: absolute; top: 13px; right: 13px;
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,.16);
          background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.6); cursor: pointer;
          transition: color .13s ease, border-color .13s ease, background .13s ease;
        }
        .save-modal-close:hover, .save-modal-close:focus-visible {
          color: #fff; border-color: rgba(255,255,255,.38);
          background: rgba(255,255,255,.12); outline: none;
        }
        .save-modal-badge {
          display: inline-flex; align-items: center; justify-content: center;
          width: 38px; height: 38px; border-radius: 50%; margin-bottom: 15px;
          background: rgba(10,163,163,.16);
          border: 1px solid rgba(10,163,163,.42);
          color: #6fe0e0;
        }
        .save-modal-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 26px; line-height: 1.12; font-weight: 650;
          color: #fff; margin-bottom: 8px; padding-right: 26px;
        }
        .save-modal-copy {
          color: rgba(255,255,255,.68); font-size: 14.5px; line-height: 1.55;
          margin-bottom: 22px;
        }
        .save-modal-actions {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 10px; flex-wrap: wrap;
        }
        .save-modal-primary,
        .save-modal-secondary {
          border-radius: 999px; padding: 12px 20px; min-height: 44px;
          font-family: inherit; font-size: 13.5px; font-weight: 800;
          cursor: pointer;
        }
        .save-modal-primary {
          display: inline-flex; align-items: center; gap: 9px;
          border: none; color: #141827; background: #e6ad12;
          box-shadow: 0 12px 28px rgba(230,173,18,.26);
          transition: transform .13s ease, box-shadow .15s ease, background .13s ease;
        }
        .save-modal-primary:hover {
          background: #f2ba22; transform: translateY(-1px);
          box-shadow: 0 16px 32px rgba(230,173,18,.3);
        }
        .save-modal-secondary {
          border: 1px solid rgba(255,255,255,.2); color: rgba(255,255,255,.8);
          background: rgba(255,255,255,.05);
          transition: background .13s ease, color .13s ease;
        }
        .save-modal-secondary:hover { background: rgba(255,255,255,.11); color: #fff; }
        .save-modal-primary:focus-visible,
        .save-modal-secondary:focus-visible {
          outline: 2px solid rgba(255,255,255,.7); outline-offset: 3px;
        }
        @keyframes saveModalBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes saveModalIn {
          from { opacity: 0; transform: translateY(10px) scale(.985); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .save-modal-backdrop, .save-modal { animation: none; }
        }
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
        .first-assessment-content h1 {
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
        .first-assessment-primary.is-disabled,
        .first-assessment-primary:disabled,
        .first-assessment-choice.is-disabled {
          cursor: default; opacity: .62; text-decoration: none; transform: none;
        }
        .first-assessment-choice.is-disabled:hover,
        .first-assessment-choice.is-disabled:focus-visible {
          transform: none; border-color: rgba(255,255,255,.18);
          background: rgba(255,255,255,.075);
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
