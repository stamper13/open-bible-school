export const ASSESS_OVERLAY_STYLES = `        /* ============================================================
           Google sign-in & magic-link sign-in
           ============================================================ */
        .google-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; padding: 12px 20px; border-radius: 12px;
          background: #fff; color: #1f2937; font-size: 14px; font-weight: 600;
          border: 1.5px solid rgba(27,36,66,.12); cursor: pointer; font-family: inherit;
          box-shadow: 0 2px 8px rgba(0,0,0,.08); transition: box-shadow .14s, transform .12s;
          margin-bottom: 12px;
        }
        .google-btn:hover { box-shadow: 0 4px 16px rgba(0,0,0,.12); transform: translateY(-1px); }
        .google-btn svg { width: 18px; height: 18px; flex-shrink: 0; }
        .divider-or { display: flex; align-items: center; gap: 10px; margin: 12px 0; }
        .divider-or::before, .divider-or::after { content: ""; flex: 1; height: 1px; background: var(--border); }
        .divider-or span { font-size: 12px; color: var(--muted); }
        .magic-row { display: flex; gap: 8px; }
        .magic-input {
          flex: 1; padding: 11px 14px; border-radius: 10px;
          border: 1.5px solid var(--border); font-size: 14px; font-family: inherit;
          outline: none; transition: border-color .13s;
        }
        .magic-input:focus { border-color: var(--accent-line); }
        .magic-btn {
          padding: 11px 18px; border-radius: 10px;
          background: var(--navy); color: #fff; font-size: 13.5px; font-weight: 600;
          border: none; cursor: pointer; font-family: inherit; white-space: nowrap;
          transition: background .13s;
        }
        .magic-btn:hover { background: #253566; }
        .save-success { font-size: 13.5px; color: var(--correct); font-weight: 600; text-align: center; padding: 12px; }
        .skip-link { display: block; text-align: center; margin-top: 12px; font-size: 13px; color: var(--muted); cursor: pointer; }
        .skip-link:hover { color: var(--navy); }

        /* Center card (loading/error/complete) */
        /* ============================================================
           Generic center-card / button / spinner primitives
           ============================================================ */
        .center-card { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; }
        .big-num { font-family: var(--font-crimson), Georgia, serif; font-size: 72px; font-weight: 700; color: var(--navy); line-height: 1; }
        .card-heading { margin: 0; font-family: var(--font-crimson), Georgia, serif; font-size: 26px; font-weight: 600; color: var(--navy); }
        .card-sub { font-size: 15px; color: var(--muted); line-height: 1.6; max-width: 400px; }
        .btn-primary {
          display: flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 999px;
          background: var(--navy); color: #fff; font-size: 15px; font-weight: 600;
          text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 10px 28px rgba(27,36,66,.35); transition: background .15s, transform .13s;
        }
        .btn-primary:hover { background: #253566; transform: translateY(-2px); }
        .btn-secondary {
          font-size: 14px; color: var(--muted); text-decoration: none;
          padding: 10px 20px; border-radius: 999px;
          border: 1px solid var(--border); background: rgba(255,255,255,.5);
          transition: color .14s, background .14s;
        }
        .btn-secondary:hover { color: var(--navy); background: rgba(255,255,255,.8); }
        .spinner {
          width: 40px; height: 40px; border-radius: 50%;
          border: 3px solid rgba(27,36,66,.1); border-top-color: var(--accent);
          animation: spin .8s linear infinite; margin: 0 auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        /* ============================================================
           Between-question loader (orbit spinner)
           ============================================================ */
        .between-question-loader {
          align-items: center; text-align: center;
          background: none;
          border-color: transparent;
          backdrop-filter: none;
          box-shadow: none;
          padding: 0;
          width: auto;
          max-width: none;
          animation: none;
        }
        .between-question-loader .startup-status,
        .between-question-loader .pilot-badge,
        .between-question-loader .card-heading,
        .between-question-loader .pilot-note,
        .between-question-loader .startup-actions {
          display: none;
        }

        /* Reuses the dashboard-loading orbit motif inside the assessment.
           Between questions, the card chrome is removed and only this orbit
           remains against the starfield. */
        .orbit-loader {
          position: relative;
          width: 58px; height: 58px; margin: 0 auto;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.18);
          box-shadow: 0 0 28px rgba(10,163,163,.16), inset 0 0 22px rgba(255,255,255,.04);
          animation: obsOrbitShellSpin 2.8s linear infinite;
        }
        .orbit-loader-ring {
          position: absolute; inset: 9px;
          border: 1px dashed rgba(10,163,163,.34);
          border-radius: 999px;
          transform: rotate(-22deg) scaleX(1.18);
        }
        .orbit-loader-star {
          position: absolute; left: 50%; top: 50%;
          width: 16px; height: 16px; margin: -8px 0 0 -8px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #fff6c9, #d4a017 58%, #8c640a);
          box-shadow: 0 0 18px rgba(212,160,23,.48), 0 0 30px rgba(212,160,23,.16);
        }
        .orbit-loader-path {
          position: absolute; inset: 0;
        }
        .orbit-loader-path i {
          position: absolute; right: 2px; top: 24px;
          width: 10px; height: 10px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #dbfffb, #0aa3a3);
          box-shadow: 0 0 14px rgba(10,163,163,.58);
        }
        .startup-card:not(.between-question-loader) .orbit-loader {
          border-color: rgba(27,36,66,.12);
          box-shadow: 0 0 24px rgba(10,163,163,.12), inset 0 0 20px rgba(27,36,66,.035);
        }
        .startup-card:not(.between-question-loader) .orbit-loader-ring {
          border-color: rgba(10,163,163,.28);
        }
        @keyframes obsOrbitShellSpin { to { transform: rotate(1turn); } }
        @media (prefers-reduced-motion: reduce) {
          .orbit-loader { animation: none; }
        }
        .startup-status {
          display: grid; gap: 7px; max-width: 440px;
        }
        .startup-title {
          font-size: 15px; font-weight: 750; color: var(--navy);
        }
        .startup-note {
          font-size: 13px; line-height: 1.55; color: var(--muted);
        }
        .startup-actions {
          display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin-top: 4px;
        }
`;
