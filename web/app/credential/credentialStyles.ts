// Extracted from app/credential/page.tsx during a file-size cleanup.
// Pure CSS text, rendered via <style> tag(s). No behavior change intended.

export const CREDENTIAL_PAGE_STYLES = `
        :root {
          /* --navy/--accent/--muted now come from app/globals.css */
          --accent-dim: rgba(10,163,163,.10); --accent-line: rgba(10,163,163,.22);
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
           .nav/.nav-brand/.nav-links/.nav-link/.nav-btn now come from
           components/SiteNav.tsx + the .oba-site-nav rules in app/globals.css. */

        .page { position: relative; z-index: 1; max-width: 900px; margin: 0 auto; padding: 56px 24px 96px; }

        .hero { margin-bottom: 52px; max-width: 640px; }
        .hero-heading {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(28px, 4.5vw, 44px); font-weight: 600; line-height: 1.14;
          color: #fff; letter-spacing: .005em; margin-bottom: 18px;
        }
        .hero-lead { font-size: 16px; line-height: 1.75; color: rgba(255,255,255,.62); margin-bottom: 24px; }

        .section-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: .10em;
          text-transform: uppercase; color: rgba(255,255,255,.45); margin-bottom: 16px;
        }

        /* Carousel */
        .carousel {
          position: relative;
          border-radius: 24px;
          outline: none;
        }
        .carousel:focus-visible { outline: 2px solid rgba(255,255,255,.55); outline-offset: 6px; }
        .carousel-viewport {
          overflow: hidden; border-radius: 24px; touch-action: pan-y; cursor: grab;
        }
        .carousel-viewport.is-dragging { cursor: grabbing; }
        .carousel-track {
          display: flex; width: 100%; will-change: transform;
          user-select: none; -webkit-user-select: none;
        }

        .module-card {
          flex: 0 0 100%; position: relative; overflow: hidden;
          min-height: 420px; padding: 36px 30px 32px;
          border-radius: 24px;
          border: 1px solid var(--card-accent-line, rgba(255,255,255,.14));
          background:
            radial-gradient(circle at 12% 8%, var(--card-accent-glow, transparent), transparent 42%),
            linear-gradient(160deg, rgba(255,255,255,.07), rgba(255,255,255,.02));
          backdrop-filter: blur(18px);
          box-shadow: 0 26px 60px rgba(0,0,0,.42), inset 0 0 60px rgba(255,255,255,.02);
          display: flex; flex-direction: column; gap: 18px;
        }
        .module-card::before {
          content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, transparent, var(--card-accent, var(--accent)), transparent);
        }
        .module-number {
          font-family: var(--font-crimson), Georgia, serif; font-size: 13px; font-weight: 600;
          letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.4);
        }
        .status-pill {
          position: relative; z-index: 1;
          display: inline-flex; align-items: center; gap: 7px; width: fit-content;
          padding: 6px 13px; border-radius: 999px; font-size: 11.5px; font-weight: 800;
          letter-spacing: .07em; text-transform: uppercase;
        }
        .status-pill.status-progress {
          background: var(--card-accent-soft); border: 1px solid var(--card-accent-line);
          color: var(--card-accent);
        }
        .status-pill.status-planned {
          background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18);
          color: rgba(255,255,255,.75);
        }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
        .status-pill.status-progress .status-dot { animation: statusPulse 1.8s ease-in-out infinite; }
        @keyframes statusPulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--card-accent-soft); opacity: 1; }
          50% { box-shadow: 0 0 0 5px transparent; opacity: .65; }
        }

        .module-title {
          position: relative; z-index: 1;
          font-family: var(--font-crimson), Georgia, serif; font-weight: 600;
          font-size: clamp(24px, 3.4vw, 32px); line-height: 1.16; color: #fff;
        }
        .module-desc {
          position: relative; z-index: 1;
          font-size: 15px; line-height: 1.75; color: rgba(255,255,255,.68); max-width: 480px;
        }

        /* Decorative motifs */
        .card-motif { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }

        .motif-paper .paper-lines {
          position: absolute; inset: 14% -10% auto 40%; height: 70%;
          background-image: repeating-linear-gradient(to bottom, var(--card-accent-line) 0px, var(--card-accent-line) 1.5px, transparent 1.5px, transparent 25px);
          opacity: .55; transform: rotate(-4deg);
        }
        .paper-check {
          position: absolute; right: 9%; bottom: 10%; width: 120px; height: 120px;
          color: var(--card-accent); opacity: .14; stroke-width: 1.4;
        }

        .motif-glyphs .glyph {
          position: absolute; font-family: var(--font-crimson), Georgia, serif;
          color: var(--card-accent); opacity: .16; font-weight: 600;
          animation: glyphFloat 7s ease-in-out infinite;
        }
        .glyph-0 { top: 8%; right: 12%; font-size: 92px; animation-delay: 0s; }
        .glyph-1 { top: 42%; right: 30%; font-size: 56px; animation-delay: .8s; }
        .glyph-2 { top: 58%; right: 6%; font-size: 68px; animation-delay: 1.6s; }
        .glyph-3 { top: 4%; right: 38%; font-size: 44px; animation-delay: 2.4s; }
        .glyph-4 { top: 74%; right: 42%; font-size: 50px; animation-delay: 3.1s; }
        .glyph-5 { top: 24%; right: 2%; font-size: 40px; animation-delay: 1.1s; }
        @keyframes glyphFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-14px) rotate(3deg); }
        }

        .motif-timeline { display: flex; align-items: center; justify-content: flex-end; padding: 0 8% 0 30%; }
        .timeline-line { position: absolute; right: 8%; top: 50%; width: 60%; height: 1px; background: var(--card-accent-line); }
        .timeline-node {
          position: absolute; top: 50%; display: flex; flex-direction: column; align-items: center; gap: 8px;
          transform: translate(50%, -50%);
        }
        .timeline-node-0 { right: 62%; } .timeline-node-1 { right: 42%; } .timeline-node-2 { right: 22%; } .timeline-node-3 { right: 6%; }
        .timeline-dot {
          width: 11px; height: 11px; border-radius: 50%; background: var(--card-accent);
          box-shadow: 0 0 0 4px var(--card-accent-soft);
          animation: timelineGlow 3.4s ease-in-out infinite;
        }
        .timeline-node-1 .timeline-dot { animation-delay: .5s; }
        .timeline-node-2 .timeline-dot { animation-delay: 1s; }
        .timeline-node-3 .timeline-dot { animation-delay: 1.5s; }
        @keyframes timelineGlow {
          0%, 100% { opacity: .55; } 50% { opacity: 1; }
        }
        .timeline-label {
          font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
          color: rgba(255,255,255,.34); white-space: nowrap;
        }

        .motif-graph { position: absolute; right: -4%; top: -6%; width: 78%; height: 100%; opacity: .8; }
        .graph-line { stroke: var(--card-accent-line); stroke-width: 1; }
        .graph-node circle { fill: var(--card-accent); opacity: .5; animation: nodePulse 3.6s ease-in-out infinite; }
        .graph-node text {
          fill: rgba(255,255,255,.3); font-size: 9px; font-weight: 700;
          letter-spacing: .04em; text-transform: uppercase;
        }
        .graph-node-1 circle, .graph-node-1 { animation-delay: .4s; }
        .graph-node-2 circle { animation-delay: .8s; }
        .graph-node-3 circle { animation-delay: 1.2s; }
        .graph-node-4 circle { animation-delay: 1.6s; }
        @keyframes nodePulse { 0%, 100% { opacity: .35; } 50% { opacity: .85; } }

        /* Controls */
        .carousel-controls {
          display: flex; align-items: center; justify-content: center; gap: 20px;
          margin-top: 26px;
        }
        .carousel-btn {
          display: flex; align-items: center; justify-content: center;
          width: 42px; height: 42px; border-radius: 50%;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16);
          color: #fff; cursor: pointer; transition: background .15s, transform .13s, opacity .15s;
        }
        .carousel-btn svg { width: 18px; height: 18px; }
        .carousel-btn:hover:not(:disabled) { background: rgba(255,255,255,.14); transform: translateY(-1px); }
        .carousel-btn:disabled { opacity: .3; cursor: not-allowed; }
        .carousel-btn:focus-visible { outline: 2px solid rgba(255,255,255,.6); outline-offset: 3px; }

        .carousel-dots { display: flex; align-items: center; gap: 10px; }
        .carousel-dot {
          width: 10px; height: 10px; border-radius: 50%; padding: 0;
          background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.24);
          cursor: pointer; transition: background .15s, transform .15s, width .2s;
        }
        .carousel-dot:hover { background: rgba(255,255,255,.35); }
        .carousel-dot.is-active { background: var(--dot-accent, #fff); width: 26px; border-radius: 999px; border-color: transparent; }
        .carousel-dot:focus-visible { outline: 2px solid rgba(255,255,255,.6); outline-offset: 3px; }

        .sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }

        .contact-strip {
          margin-top: 60px;
          background: linear-gradient(135deg, rgba(27,36,66,.7) 0%, rgba(36,48,96,.7) 100%);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 20px; padding: 36px 40px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 24px; flex-wrap: wrap; backdrop-filter: blur(14px);
        }
        .contact-heading { font-family: var(--font-crimson), Georgia, serif; font-size: 21px; font-weight: 600; color: #fff; margin-bottom: 8px; line-height: 1.2; }
        .contact-desc { font-size: 14px; line-height: 1.65; color: rgba(255,255,255,.6); max-width: 420px; }
        .contact-btn {
          display: flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: 999px;
          background: var(--accent); color: #fff; font-size: 14px; font-weight: 600;
          text-decoration: none; white-space: nowrap; flex-shrink: 0;
          box-shadow: 0 6px 20px rgba(10,163,163,.40); transition: background .15s, transform .13s;
        }
        .contact-btn { border: none; cursor: pointer; font-family: inherit; }
        .contact-btn svg { width: 16px; height: 16px; }
        .contact-btn:hover { background: #089090; transform: translateY(-1px); }
        .contact-btn:focus-visible { outline: 2px solid rgba(255,255,255,.65); outline-offset: 3px; }

        /* Contact modal */
        .modal-backdrop {
          position: fixed; inset: 0; z-index: 60;
          background: rgba(6,9,20,.72); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
          animation: fadeIn .18s ease both;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal {
          position: relative; width: 100%; max-width: 460px;
          max-height: calc(100vh - 40px); overflow-y: auto;
          background: linear-gradient(160deg, rgba(24,32,58,.98), rgba(16,22,42,.98));
          border: 1px solid rgba(255,255,255,.14); border-radius: 20px;
          padding: 30px 28px 26px;
          box-shadow: 0 30px 80px rgba(0,0,0,.6);
          animation: modalIn .24s cubic-bezier(.22,1.2,.4,1) both;
        }
        @keyframes modalIn { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
        .modal-close {
          position: absolute; top: 14px; right: 14px;
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14);
          color: rgba(255,255,255,.7); cursor: pointer; transition: background .15s, color .15s;
        }
        .modal-close svg { width: 15px; height: 15px; }
        .modal-close:hover { background: rgba(255,255,255,.14); color: #fff; }
        .modal-title {
          font-family: var(--font-crimson), Georgia, serif; font-size: 25px;
          font-weight: 600; color: #fff; margin-bottom: 7px; padding-right: 36px;
        }
        .modal-sub { font-size: 13px; line-height: 1.6; color: rgba(255,255,255,.55); margin-bottom: 20px; }
        .modal-form { display: flex; flex-direction: column; gap: 15px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field span {
          font-size: 11px; font-weight: 800; letter-spacing: .09em;
          text-transform: uppercase; color: rgba(255,255,255,.5);
        }
        .field input, .field select, .field textarea {
          width: 100%; padding: 11px 13px; border-radius: 10px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16);
          color: #fff; font-family: inherit; font-size: 14.5px; line-height: 1.5;
          outline: none; transition: border-color .15s, background .15s;
        }
        .field textarea { resize: vertical; min-height: 96px; }
        .field select option { background: #131a30; color: #fff; }
        .field input:focus, .field select:focus, .field textarea:focus {
          border-color: var(--accent); background: rgba(255,255,255,.09);
          box-shadow: 0 0 0 3px rgba(10,163,163,.18);
        }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
        .btn-ghost, .btn-send {
          padding: 11px 20px; border-radius: 999px; font-family: inherit;
          font-size: 14px; font-weight: 650; cursor: pointer; transition: background .15s, transform .13s;
        }
        .btn-ghost {
          background: transparent; border: 1px solid rgba(255,255,255,.18); color: rgba(255,255,255,.7);
        }
        .btn-ghost:hover { background: rgba(255,255,255,.08); color: #fff; }
        .btn-send {
          background: var(--accent); border: none; color: #fff;
          box-shadow: 0 6px 20px rgba(10,163,163,.4);
        }
        .btn-send:hover { background: #089090; transform: translateY(-1px); }
        .modal-close:focus-visible, .btn-ghost:focus-visible, .btn-send:focus-visible {
          outline: 2px solid rgba(255,255,255,.7); outline-offset: 3px;
        }

        @media (max-width: 640px) {
          .page { padding: 36px 16px 72px; }
          .module-card { min-height: 380px; padding: 28px 20px 26px; }
          .module-desc { max-width: 100%; }
          .contact-strip { padding: 26px 22px; flex-direction: column; align-items: flex-start; }
          .motif-glyphs .glyph { opacity: .12; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
`;
