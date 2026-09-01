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
        .between-question-loader .startup-status { display: none; }

        /* Orbit loader: one tilted ellipse, one sun, one planet.
           The old one stacked a gradient disc, a dashed ring, a travelling
           dot, a star and three sparks into 96px, which read as clutter.

           Everything is tilted with rotation alone and never scaled. The first
           attempt squashed a circle on Y to fake the ellipse, but that squash
           also flattened the planet, and un-squashing it failed once the arm
           rotated — the axis being corrected had turned with it, so the planet
           smeared into a streak. Here the ring is simply a wide, short box
           with a 50% radius, and the planet rides an elliptical motion path.
           Rotation preserves circles, so the planet stays round all the way
           round. */
        .orbit-loader {
          position: relative; width: 54px; height: 54px; margin: 0 auto;
        }
        .orbit-loader-ring {
          position: absolute; left: 0; top: 16px;
          width: 54px; height: 22px;
          border: 1.5px solid rgba(255, 255, 255, .18);
          border-radius: 50%;
          transform: rotate(-18deg);
        }
        .orbit-loader-star {
          position: absolute; left: 50%; top: 50%;
          width: 15px; height: 15px; margin: -7.5px 0 0 -7.5px;
          border-radius: 50%;
          background: radial-gradient(circle at 36% 32%, #fff7e0 0 3px, #f2c64f 4px 6px, #c1890f 100%);
          box-shadow: 0 0 13px rgba(242, 198, 79, .5), 0 0 26px rgba(242, 198, 79, .18);
        }
        .orbit-loader-path {
          position: absolute; inset: 0;
          transform: rotate(-18deg);
        }
        .orbit-loader-path i {
          /* left/top pinned to the origin: offset-path translates from the
             element's static position, so without these the orbit is shifted
             by wherever the dot would otherwise have sat and the planet
             circles outside its own ring. */
          position: absolute; left: 0; top: 0;
          width: 9px; height: 9px;
          border-radius: 50%;
          background: radial-gradient(circle at 34% 30%, #ddfbfa, #2fb8b8 72%);
          box-shadow: 0 0 9px rgba(47, 184, 184, .65);
          offset-path: path("M 1,27 a 26,11 0 1,0 52,0 a 26,11 0 1,0 -52,0");
          offset-rotate: 0deg;
          animation: obsOrbitTravel 1.7s linear infinite;
        }
        @keyframes obsOrbitTravel { to { offset-distance: 100%; } }
        @media (prefers-reduced-motion: reduce) {
          .orbit-loader-path i { animation: none; offset-distance: 22%; }
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
