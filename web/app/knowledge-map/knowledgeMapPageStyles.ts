// Extracted from app/knowledge-map/page.tsx during a file-size cleanup.
// Pure CSS text, rendered via <style> tag(s). No behavior change intended.

export const KNOWLEDGE_MAP_PAGE_STYLES = `
        :root {
          /* --navy/--accent/--muted now come from app/globals.css */
          --line: rgba(209,224,235,.30);
        }
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        html { background: #060a14; }
        body {
          margin: 0; min-height: 100vh; color: #edf4fb;
          font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
          /* A base fill that always paints plus fixed nebulae for depth; the
             base scrolls with the document so there is never a bare gap behind
             the fixed star canvas. */
          background:
            linear-gradient(180deg,#070b16 0%,#0a1122 50%,#060a16 100%) no-repeat,
            #060a14;
        }
        body::before {
          content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none;
          background:
            radial-gradient(ellipse at 22% 8%, rgba(36,80,120,.32), transparent 55%),
            radial-gradient(ellipse at 84% 30%, rgba(88,52,150,.26), transparent 52%),
            radial-gradient(ellipse at 60% 98%, rgba(10,90,90,.24), transparent 56%);
        }
        button, a { font: inherit; }
        /* animated starfield sits behind everything; content is lifted above it */
        .km-starfield { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
        .page { position: relative; z-index: 1; }
        .focus-transition { position: fixed; inset: 0; z-index: 15; pointer-events: none; }
        /* .nav/.nav-brand/.nav-links/.nav-link now come from
           components/SiteNav.tsx + the .oba-site-nav--block rules in
           app/globals.css. */
        .page { width: min(1560px, calc(100% - 48px)); margin: 0 auto; padding: 26px 0 70px; }
        .page-head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 20px; flex-wrap: wrap; margin-bottom: 20px;
        }
        .eyebrow {
          margin: 0; color: #7de5e5;
          font-size: 11px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase;
        }
        .title {
          margin: 0; color: #fff;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(32px,4vw,48px); line-height: 1;
        }
        .subtitle {
          max-width: 720px; margin: 10px 0 0;
          color: rgba(237,244,251,.68); font-size: 14px; line-height: 1.55;
        }
        .summary {
          display: grid; grid-template-columns: repeat(3,minmax(92px,1fr));
          gap: 8px; min-width: 330px;
        }
        .summary-item {
          min-height: 66px; padding: 11px 13px;
          border: 1px solid rgba(255,255,255,.12); border-radius: 6px;
          background: rgba(255,255,255,.055);
        }
        .summary-value {
          display: block; color: #fff;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 21px; font-weight: 750; line-height: 1.1;
        }
        .summary-label {
          display: block; margin-top: 6px;
          color: rgba(237,244,251,.56); font-size: 9px;
          font-weight: 850; letter-spacing: .08em; text-transform: uppercase;
        }
        .next-band {
          position: relative; display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          gap: 24px; align-items: center;
          margin-bottom: 26px; padding: 20px 22px 20px 27px;
          border: 1px solid rgba(114,231,255,.34); border-radius: 8px;
          background: linear-gradient(105deg,rgba(10,163,163,.17),rgba(255,255,255,.06) 56%,rgba(212,160,23,.09));
          box-shadow: 0 18px 42px rgba(0,0,0,.24); overflow: hidden;
        }
        .next-band::before {
          content: ""; position: absolute; inset: 0 auto 0 0; width: 5px;
          background: linear-gradient(180deg,#72e7ff,#d4a017);
        }
        .next-kicker {
          margin: 0 0 5px; color: #8debf5;
          font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase;
        }
        .next-title { margin: 0; color: #fff; font-family: var(--font-crimson),Georgia,serif; font-size: 26px; line-height: 1.05; }
        .next-ref { margin: 6px 0 0; color: #f0c674; font-size: 12px; font-weight: 800; letter-spacing: .03em; }
        .next-copy { max-width: 720px; margin: 7px 0 0; color: rgba(237,244,251,.70); font-size: 13px; line-height: 1.5; }
        .next-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; justify-content: flex-end; }
        .btn-primary, .btn-secondary {
          display: inline-flex; min-height: 40px; align-items: center; justify-content: center;
          gap: 7px; padding: 9px 14px; border-radius: 6px;
          font-size: 12px; font-weight: 850; text-decoration: none; cursor: pointer;
        }
        .btn-primary { border: 1px solid #cff9ff; background: #b9f3ff; color: #07111d; }
        .btn-secondary { border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.07); color: #fff; }
        button.btn-secondary { appearance: none; }
        .map-head { margin-bottom: 16px; }
        .map-title { margin: 0; color: #fff; font-family: var(--font-crimson),Georgia,serif; font-size: 24px; line-height: 1; }
        .map-copy { max-width: 720px; margin: 7px 0 0; color: rgba(237,244,251,.6); font-size: 12.5px; line-height: 1.5; }
        .km-view-bar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .km-view-toggle {
          position: relative; display: inline-grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          padding: 4px; border-radius: 999px;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14);
        }
        .km-view-thumb {
          display: none;
        }
        .km-view-btn {
          position: relative; z-index: 1; border: 0; background: transparent !important;
          min-width: 96px; padding: 8px 13px; border-radius: 999px; cursor: pointer;
          font: inherit; font-size: 12.5px; font-weight: 800; color: rgba(255,255,255,.62);
          transition: color .2s ease, box-shadow .2s ease;
        }
        .km-view-btn:not(.is-active) {
          background: transparent !important;
          box-shadow: none !important;
        }
        .km-view-btn.is-active,
        .km-view-btn[aria-selected="true"] {
          color: #fff !important; background: #0aa3a3 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,.3);
        }
        .km-testament-toggle {
          display: inline-flex; align-items: center; gap: 5px; padding: 4px;
          border-radius: 999px; background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.13);
        }
        .km-testament-pill,
        .km-testament-btn {
          min-width: 42px; border: 0; border-radius: 999px; padding: 8px 13px;
          font: inherit; font-size: 12.5px; font-weight: 850;
        }
        .km-testament-pill { display: inline-flex; justify-content: center; color: #06111f; background: #d6b857; }
        .km-testament-btn {
          cursor: pointer; color: rgba(255,255,255,.68); background: transparent;
        }
        .km-testament-btn:hover,
        .km-testament-btn:focus-visible { color: #fff; background: rgba(255,255,255,.09); }
        .km-coming-soon {
          margin: 0; padding: 7px 10px; border-radius: 999px;
          border: 1px solid rgba(255,207,92,.34);
          background: rgba(255,207,92,.10); color: #ffe08a;
          font-size: 12px; font-weight: 850; letter-spacing: .02em;
        }
        .km-motion-btn {
          display: inline-flex; align-items: center; gap: 8px;
          min-height: 36px; padding: 8px 13px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,.16);
          background: rgba(255,255,255,.075); color: rgba(255,255,255,.84);
          cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 850;
        }
        .km-motion-btn:hover,
        .km-motion-btn:focus-visible {
          color: #fff; background: rgba(255,255,255,.13); outline: none;
        }
        .km-motion-btn.is-paused {
          color: #06111f; background: #d6b857; border-color: rgba(255,223,128,.78);
        }
        .km-motion-btn.is-active {
          color: #06111f; background: #b9f3ff; border-color: rgba(207,249,255,.86);
        }
        .km-motion-icon {
          width: 15px; height: 15px; flex: 0 0 auto;
        }
        .km-view-copy { margin: 0; font-size: 12.5px; color: rgba(237,244,251,.56); max-width: 480px; }
        @media (max-width: 640px) {
          .km-view-bar { flex-direction: column; align-items: flex-start; gap: 8px; }
        }
        .loading, .error, .empty {
          display: grid; place-items: center; gap: 14px; min-height: 260px;
          padding: 24px; text-align: center;
          border: 1px solid rgba(255,255,255,.13); border-radius: 8px;
          color: rgba(237,244,251,.70); background: rgba(4,8,20,.44);
        }
        .state-line { margin: 0; max-width: 470px; line-height: 1.6; }
        .retry-btn {
          min-height: 44px; padding: 11px 22px; border-radius: 999px; cursor: pointer;
          font: 650 13.5px var(--font-inter), system-ui, sans-serif;
          color: #fff; background: rgba(255,255,255,.09); border: 1px solid rgba(255,255,255,.22);
          transition: background .15s;
        }
        .retry-btn:hover { background: rgba(255,255,255,.16); }
        .retry-btn:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
        @media (max-width: 760px) {
          .page { width: min(100% - 22px,620px); padding-top: 24px; }
          .page-head { grid-template-columns: 1fr; align-items: start; margin-bottom: 18px; }
          .summary { width: 100%; min-width: 0; }
          .next-band { grid-template-columns: 1fr; padding: 19px 18px 19px 23px; }
          .next-actions { justify-content: flex-start; }
        }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          *, *::before, *::after { transition: none !important; }
        }
`;
