export const HOME_KNOWLEDGE_CONE_STYLES = `        /* ============================================================
           Knowledge cone panel (water-slosh visual, tier popovers)
           ============================================================ */
        .knowledge-cone-card {
          position: relative; z-index: 1;
          background: rgba(255,255,255,.94); border: 1px solid var(--border);
          border-radius: 20px; box-shadow: var(--shadow);
          backdrop-filter: blur(16px); padding: 28px 32px 30px;
          margin-bottom: 18px; overflow: visible;
        }
        .knowledge-cone-panel {
          margin: -10px 0 30px;
          animation: knowledgeProfileIn .22s cubic-bezier(.22,.72,.18,1) both;
        }
        .knowledge-cone-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 18px; margin-bottom: 22px;
        }
        .knowledge-cone-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 25px; font-weight: 650; color: var(--navy); line-height: 1.1;
        }
        .knowledge-cone-sub { font-size: 13px; color: var(--muted); margin-top: 5px; }
        .knowledge-cone-score {
          display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
          color: var(--navy); font-weight: 700; font-size: 28px;
          font-family: var(--font-crimson), Georgia, serif;
        }
        .knowledge-cone-score span {
          font-family: var(--font-inter), system-ui, sans-serif; font-size: 10px;
          letter-spacing: .10em; text-transform: uppercase; color: var(--muted);
        }
        .knowledge-cone-wrap {
          position: relative; min-height: 440px;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          perspective: 900px;
        }
        .knowledge-cone {
          position: relative; width: min(560px, 100%); height: 378px;
          transform: rotateX(7deg);
          filter: drop-shadow(0 34px 42px rgba(27,36,66,.38)) drop-shadow(0 13px 24px rgba(10,163,163,.22));
        }
        .glass-vessel {
          position: absolute; inset: 0;
          clip-path: polygon(1% 0, 99% 0, 74.5% 100%, 25.5% 100%);
          background:
            linear-gradient(90deg, rgba(255,255,255,.55), rgba(255,255,255,.12) 28%, rgba(255,255,255,.28) 50%, rgba(27,36,66,.10) 100%),
            linear-gradient(180deg, rgba(255,255,255,.20), rgba(10,163,163,.06));
          border: 1px solid rgba(255,255,255,.58);
          box-shadow:
            inset 20px 0 34px rgba(255,255,255,.36),
            inset -22px 0 34px rgba(27,36,66,.28),
            inset 0 -28px 40px rgba(8,74,104,.24),
            inset 0 0 0 1px rgba(27,36,66,.12);
          overflow: hidden; z-index: 1;
        }
        .glass-vessel::before {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 0 16%, rgba(255,255,255,.42) 18%, transparent 25% 100%);
          pointer-events: none;
        }
        .glass-vessel::after {
          content: ""; position: absolute; left: 1%; right: 1%; top: -9px; height: 24px;
          border-radius: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,.70), rgba(255,255,255,.10));
          border: 1px solid rgba(255,255,255,.56);
          box-shadow: 0 10px 22px rgba(27,36,66,.26), inset 0 -3px 10px rgba(27,36,66,.16);
          pointer-events: none;
        }
        .water-fill {
          position: absolute; left: 0; right: 0; bottom: 0;
          height: var(--water-level);
          background:
            linear-gradient(112deg, rgba(255,255,255,.18) 0%, transparent 24% 62%, rgba(255,255,255,.12) 100%),
            linear-gradient(180deg, rgba(189,248,255,.68) 0%, rgba(55,197,213,.72) 50%, rgba(18,123,154,.80) 100%);
          box-shadow:
            inset 18px 0 26px rgba(255,255,255,.22),
            inset -20px 0 34px rgba(8,74,104,.32),
            inset 0 22px 36px rgba(255,255,255,.36),
            inset 0 -30px 42px rgba(8,74,104,.42),
            0 -12px 34px rgba(10,163,163,.30),
            0 0 0 1px rgba(255,255,255,.22);
          animation: waterRise 6.4s cubic-bezier(.18,.76,.12,1) both;
          transform-origin: bottom;
          transform: skewX(calc(var(--slosh-x, 0) * -2.6deg)) translateX(calc(var(--slosh-x, 0) * -1.8%));
          will-change: transform;
          z-index: 3;
        }
        .water-fill::before {
          content: ""; position: absolute; left: -9%; right: -9%; top: -15px; height: 30px;
          border-radius: 46% 54% 50% 50% / 55% 55% 45% 45%;
          background:
            linear-gradient(90deg, rgba(255,255,255,.14), rgba(255,255,255,.74), rgba(255,255,255,.16)),
            radial-gradient(ellipse, rgba(217,251,255,.96), rgba(82,205,224,.68) 56%, rgba(82,205,224,0) 75%);
          filter: blur(.12px);
          transform-origin: 50% 50%;
          translate: calc(var(--slosh-x, 0) * -7%) calc(var(--slosh-x2, 0) * 5px);
          rotate: calc(var(--slosh-x, 0) * -6.5deg + var(--slosh-x2, 0) * -1.6deg);
          scale: calc(1 + var(--slosh-amp, 0) * .09) calc(1 - var(--slosh-amp, 0) * .11);
          will-change: translate, rotate, scale;
          animation: waterSurface 6.4s cubic-bezier(.18,.76,.12,1) both, surfaceMorph 5.2s ease-in-out infinite;
        }
        .water-fill::after {
          content: ""; position: absolute; inset: 0;
          background:
            linear-gradient(112deg, transparent 0 30%, rgba(255,255,255,.22) 41%, transparent 53% 100%),
            radial-gradient(ellipse at 50% 18%, rgba(255,255,255,.16), transparent 50%);
          mix-blend-mode: screen;
          opacity: .42;
          animation: internalSheen 6.2s ease-in-out infinite;
          pointer-events: none;
        }
        .water-wave {
          position: absolute; left: -18%; width: 136%; height: 34px;
          top: -17px; overflow: hidden; border-radius: 999px;
          pointer-events: none; mix-blend-mode: screen; opacity: .55;
          transform-origin: 50% 50%;
        }
        .water-wave::before {
          content: ""; position: absolute; left: 50%; top: var(--wave-top, -92px);
          width: var(--wave-size, 220px); height: var(--wave-size, 220px);
          border-radius: 43% 57% 46% 54% / 56% 44% 56% 44%;
          background:
            radial-gradient(circle at 35% 32%, rgba(255,255,255,.72), transparent 0 9%, rgba(255,255,255,0) 17%),
            radial-gradient(circle at 62% 66%, rgba(255,255,255,.30), transparent 0 12%, rgba(255,255,255,0) 22%),
            linear-gradient(135deg, rgba(217,251,255,.70), rgba(82,205,224,.28) 52%, rgba(18,123,154,.16));
          transform: translateX(-50%) rotate(0deg);
          animation: liquidRoll var(--wave-speed, 8s) linear infinite, liquidBob 5.4s ease-in-out infinite;
          filter: blur(.08px);
        }
        .water-wave-a { --wave-size: 245px; --wave-top: -105px; --wave-speed: 8.8s; opacity: calc(.62 + var(--slosh-amp, 0) * .22); translate: calc(var(--slosh-x, 0) * 3.6%) calc(var(--slosh-x2, 0) * -3px); }
        .water-wave-b { --wave-size: 205px; --wave-top: -82px; --wave-speed: 7.1s; top: -11px; opacity: calc(.42 + var(--slosh-amp, 0) * .22); transform: scaleX(1.06); translate: calc(var(--slosh-x, 0) * -2.4% + var(--slosh-x2, 0) * 2.8%) calc(var(--slosh-x2, 0) * 3px); }
        .water-wave-b::before { animation-direction: reverse, normal; background: linear-gradient(135deg, rgba(189,248,255,.54), rgba(10,163,163,.26) 55%, rgba(18,123,154,.14)); }
        .water-wave-c { --wave-size: 270px; --wave-top: -128px; --wave-speed: 11s; top: -23px; opacity: calc(.25 + var(--slosh-amp, 0) * .18); transform: scaleX(.96); translate: calc(var(--slosh-x2, 0) * -3.2%) 0; }
        .water-wave-c::before { background: linear-gradient(135deg, rgba(255,255,255,.44), rgba(189,248,255,.16) 58%, transparent); }
        @keyframes waterRise { from { height: 0; } to { height: var(--water-level); } }
        @keyframes waterSurface { 0% { opacity: .10; transform: scaleX(.48); } 22% { opacity: .92; transform: scaleX(.76); } 100% { opacity: 1; transform: scaleX(1); } }
        @keyframes surfaceMorph {
          0%, 100% { border-radius: 42% 58% 52% 48% / 53% 60% 40% 47%; }
          50% { border-radius: 60% 40% 47% 53% / 60% 52% 48% 40%; }
        }
        @keyframes liquidRoll {
          to { transform: translateX(-50%) rotate(1turn); }
        }
        @keyframes liquidBob {
          0%, 100% { top: var(--wave-top); border-radius: 43% 57% 46% 54% / 56% 44% 56% 44%; }
          50% { top: calc(var(--wave-top) + 7px); border-radius: 55% 45% 58% 42% / 44% 57% 43% 56%; }
        }
        @keyframes internalSheen { 0%, 100% { transform: translateX(-16%) skewX(-7deg); opacity: .30; } 48% { transform: translateX(16%) skewX(-7deg); opacity: .64; } }
        .cone-tier {
          position: relative; width: 100%; height: calc(100% / 7);
          display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px;
          padding: 0 calc(var(--text-inset) + 18px); color: var(--navy);
          background: transparent;
          border: 0; border-bottom: 1px solid rgba(27,36,66,.18);
          clip-path: polygon(var(--top-left) 0, var(--top-right) 0, var(--bottom-right) 100%, var(--bottom-left) 100%);
          transition: background .18s, box-shadow .18s, color .18s, transform .18s;
          transform-origin: center;
          z-index: 8;
          cursor: pointer; font-family: inherit; text-align: left;
        }
        .cone-tier:hover, .cone-tier:focus-visible {
          background: rgba(255,255,255,.24); outline: none;
          box-shadow: inset 0 0 0 2px rgba(255,255,255,.30);
        }
        .cone-tier:last-child { border-bottom: 0; }
        .cone-tier.is-active {
          background: rgba(255,255,255,.20);
          box-shadow: inset 0 0 0 2px rgba(27,36,66,.16);
        }
        .cone-tier.is-expanded {
          background: linear-gradient(90deg, rgba(13,21,48,.86), rgba(27,36,66,.74));
          box-shadow: inset 0 0 0 2px rgba(255,255,255,.24), 0 14px 30px rgba(8,13,30,.34);
          color: #fff;
          transform: scale(1.035, 1.22);
          z-index: 18;
        }
        .cone-tier.is-expanded .cone-tier-name,
        .cone-tier.is-expanded .cone-tier-range { transform: translateY(-8px); text-shadow: 0 1px 12px rgba(0,0,0,.35); }
        .cone-tier-name { position: relative; z-index: 1; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; text-shadow: 0 1px 0 rgba(255,255,255,.50); transition: transform .18s, text-shadow .18s; }
        .cone-tier-range { position: relative; z-index: 1; font-size: 12px; font-weight: 800; opacity: .76; white-space: nowrap; text-shadow: 0 1px 0 rgba(255,255,255,.50); transition: transform .18s, text-shadow .18s; }
        .cone-layer-popover {
          position: absolute; left: calc(100% + 20px); top: calc(var(--popover-y) * 1%); width: min(340px, 46vw);
          padding: 17px 19px; border-radius: 10px; z-index: 30;
          background: rgba(255,255,255,.94); border: 1px solid rgba(27,36,66,.10);
          box-shadow: 0 20px 42px rgba(27,36,66,.34), 0 0 0 1px rgba(255,255,255,.56) inset;
          color: rgba(27,36,66,.88); transform: translateY(-50%);
          backdrop-filter: blur(14px); animation: coneDescriptionIn .18s ease-out both;
          pointer-events: none;
        }
        .cone-layer-popover::before {
          content: ""; position: absolute; left: -10px; top: 50%; width: 18px; height: 18px;
          background: rgba(255,255,255,.94); border-left: 1px solid rgba(27,36,66,.10); border-bottom: 1px solid rgba(27,36,66,.10);
          transform: translateY(-50%) rotate(45deg);
        }
        .cone-layer-popover strong { display: block; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 7px; color: var(--navy); }
        .cone-layer-popover span { display: block; font-size: 14px; line-height: 1.48; font-weight: 650; }
        @keyframes coneDescriptionIn { from { opacity: 0; transform: translateY(-50%) translateX(-8px) scale(.96); } to { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); } }
        .knowledge-cone-panel .cone-layer-popover {
          left: 50%; top: calc(var(--popover-y) * 1% + 42px); width: min(340px, calc(100% - 28px));
          padding: 15px 17px; transform: translateX(-50%);
          animation: coneDescriptionInDrawer .18s ease-out both;
        }
        .knowledge-cone-panel .cone-layer-popover::before {
          left: 50%; top: -9px; transform: translateX(-50%) rotate(135deg);
        }
        @keyframes coneDescriptionInDrawer { from { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(.96); } to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } }
        .cone-marker {
          position: absolute; right: -96px;
          top: calc(var(--marker-y) * 1%);
          transform: translateY(-50%);
          display: flex; align-items: center; gap: 10px;
          color: var(--navy); font-size: 12px; font-weight: 800;
          z-index: 20;
        }
        .cone-marker::before {
          content: ""; width: 74px; height: 2px;
          background: linear-gradient(90deg, rgba(27,36,66,.10), var(--navy));
        }
        .cone-marker-dot {
          width: 18px; height: 18px; border-radius: 50%;
          background: #fff; border: 4px solid var(--navy);
          box-shadow: 0 7px 18px rgba(0,0,0,.30);
        }
        .cone-empty-note {
          text-align: center; color: var(--muted); font-size: 14px; line-height: 1.6;
          max-width: 460px; margin: 0 auto;
        }
        /* ============================================================
           Score strip: score-evidence column
           ============================================================ */
        .conf-block {
          display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
          padding: 30px 32px; gap: 9px;
          border-left: 1px solid rgba(255,255,255,.12); min-width: 210px; position: relative;
        }
        .conf-empty-label {
          display: inline-flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
          font-size: 13px; font-weight: 850; letter-spacing: .075em;
          text-transform: uppercase; color: rgba(255,255,255,.55); text-align: left;
        }
        .conf-percent {
          font-family: var(--font-crimson), Georgia, serif; font-size: 27px; line-height: 1;
          font-weight: 750; color: #fff; letter-spacing: 0; text-transform: none;
        }
        .conf-note { display: flex; align-items: center; gap: 9px; font-size: 13px; color: rgba(255,255,255,.55); text-align: left; line-height: 1.35; }
        .conf-level {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 5px 10px; border-radius: 999px;
          background: color-mix(in srgb, var(--score-accent, var(--accent)) 16%, transparent);
          border: 1px solid color-mix(in srgb, var(--score-accent, var(--accent)) 45%, transparent);
          color: var(--score-accent, var(--accent)); font-size: 12px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase;
        }
        .evidence-info-btn {
          width: 21px; height: 21px; display: inline-flex; align-items: center; justify-content: center;
          border-radius: 50%; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.6); font: 800 11px var(--font-inter), sans-serif; cursor: pointer;
        }
        .evidence-tooltip {
          position: absolute; right: 22px; top: calc(100% - 10px); z-index: 80;
          width: min(300px, calc(100vw - 42px)); padding: 13px 15px; border-radius: 8px;
          background: rgba(14,18,38,.98); border: 1px solid rgba(255,255,255,.14); box-shadow: 0 12px 34px rgba(0,0,0,.5);
          color: rgba(255,255,255,.86); font-size: 12px; font-weight: 600; line-height: 1.5;
          opacity: 0; visibility: hidden; transform: translateY(-5px);
          transition: opacity .14s, transform .14s, visibility .14s; pointer-events: none;
        }
        .evidence-tooltip.is-open { opacity: 1; visibility: visible; transform: translateY(0); pointer-events: auto; }
        /* Standard-assessment controls — used to live in their own card;
           now they're just the page header's primary action (see
           .header-assess below), so these are themed for sitting directly
           on the dark starfield instead of on a light card. */
        /* ============================================================
           Dashboard header: OT/NT testament toggle
           ============================================================ */
        .header-assess {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          animation: stdAssessIn .4s ease both;
        }
        @keyframes stdAssessIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
        .std-assess-toggle {
          position: relative; display: inline-flex; padding: 4px; border-radius: 999px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16);
        }
        .std-assess-toggle-thumb {
          position: absolute; top: 4px; left: 4px;
          width: calc(50% - 4px); height: calc(100% - 8px); border-radius: 999px;
          background: var(--suite-hue); box-shadow: 0 4px 12px rgba(0,0,0,.3);
          transition: transform .32s cubic-bezier(.34,1.56,.64,1), background .3s ease;
        }
        .std-assess-toggle-btn {
          position: relative; z-index: 1; border: 0; background: transparent;
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 15px; border-radius: 999px; cursor: pointer;
          font: inherit; font-size: 12.5px; font-weight: 800; color: rgba(255,255,255,.55);
          transition: color .2s ease; white-space: nowrap;
        }
        .std-assess-toggle-btn svg { opacity: .6; transition: opacity .2s ease; }
        .std-assess-toggle-btn.is-active { color: #fff; }
        .std-assess-toggle-btn.is-active svg { opacity: .95; }
        .std-assess-actions { display: flex; align-items: center; gap: 12px; }
        .std-assess-cta {
          position: relative; overflow: hidden;
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 18px; border-radius: 999px;
          background: var(--suite-hue); color: #fff; text-decoration: none;
          font-size: 13.5px; font-weight: 800; white-space: nowrap;
          transition: filter .15s ease, transform .15s ease, background .3s ease;
        }
        .std-assess-cta:hover { filter: brightness(1.08); transform: translateY(-1px); }
        /* A slow, occasional sheen sweep — reads as "this is the thing to
           click" without being an constant distraction. */
        .std-assess-cta::after {
          content: ""; position: absolute; top: 0; left: -60%;
          width: 40%; height: 100%;
          background: linear-gradient(115deg, transparent, rgba(255,255,255,.6), transparent);
          transform: skewX(-20deg);
          animation: ctaSheen 3.6s ease-in-out infinite;
        }
        @keyframes ctaSheen {
          0% { left: -60%; }
          35%, 100% { left: 130%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .std-assess-cta::after { animation: none; opacity: 0; }
        }
        .scope-text-btn {
          border: 0; padding: 5px 0; background: transparent; color: rgba(255,255,255,.5);
          font: inherit; font-size: 11.5px; font-weight: 750; cursor: pointer; white-space: nowrap;
        }
        .scope-text-btn:hover, .scope-text-btn:focus-visible { color: #fff; outline: none; }
        @media (max-width: 640px) {
          .header-assess { width: 100%; }
          .std-assess-toggle { flex: 1; }
          .std-assess-toggle-btn { flex: 1; }
          .std-assess-actions { width: 100%; justify-content: space-between; }
        }
`;
