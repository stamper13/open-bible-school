// Page-local CSS for the /intro tour, rendered via a <style> tag the same way
// app/bli and app/credential do it.
//
// The page is a fixed canvas with cards passing over it, so there is very
// little here: the scroll shell, one card, and the scene rail. Type sizes run
// large on purpose — each card holds a single sentence and has the whole
// screen to hold it in.

export const INTRO_PAGE_STYLES = `
        :root {
          /* --navy/--accent/--muted come from app/globals.css. */
          --gold-lit: #f5c842;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        /* One gesture, one scene. Every .scene is exactly one viewport tall,
           but a wheel notch is ~100px, so without snapping it took eight or
           nine of them to cross a slide and the card came to rest wherever the
           last notch happened to land — lit, but sitting off centre.

           mandatory rather than proximity because every scene here is a full
           viewport and none of them overflow, so there is no content that
           snapping could make unreachable. The footer is given its own snap
           point below; without one, mandatory would keep springing back off
           it to the last scene. */
        html {
          scroll-behavior: smooth;
          scroll-snap-type: y mandatory;
        }
        body {
          font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
          color: #fff; background: #0b0f1e; overflow-x: hidden;
        }

        /* The solar system sits behind everything and stays put while the
           cards scroll over it. touch-action lets a vertical swipe scroll the
           page normally while a horizontal drag spins the system. */
        canvas.orrery {
          position: fixed; inset: 0; z-index: 0;
          touch-action: pan-y;
        }

        /* The column of cards. It is transparent to the pointer so the canvas
           underneath still receives hover and drag; only the cards themselves
           take events back. */
        .scroller { position: relative; z-index: 1; pointer-events: none; }

        .scene {
          scroll-snap-align: center;
          min-height: 100svh;
          display: flex;
          align-items: center;
          padding: 96px 0 72px;
        }

        .scene-card {
          position: relative;
          pointer-events: auto;
          width: min(500px, calc(100% - 48px));
          margin-left: max(48px, calc((100vw - 1180px) / 2));
          opacity: 0;
          transform: translateY(26px);
          filter: blur(3px);
          transition: opacity .62s cubic-bezier(.22,.9,.32,1),
                      transform .62s cubic-bezier(.22,.9,.32,1),
                      filter .62s ease;
        }
        .scene-card.on { opacity: 1; transform: translateY(0); filter: blur(0); }

        .scene-kicker {
          display: inline-flex; align-items: center; gap: 8px;
          margin-bottom: 20px; padding: 5px 14px; border-radius: 999px;
          background: rgba(10,163,163,.12); border: 1px solid rgba(10,163,163,.26);
          color: #6fe0e0; font-size: 12px; font-weight: 700;
          letter-spacing: .06em; text-transform: uppercase;
        }
        .scene-kicker::before {
          content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--accent);
        }

        .scene-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(38px, 5.4vw, 64px); font-weight: 600;
          line-height: 1.06; letter-spacing: -.01em;
          text-shadow: 0 4px 34px rgba(0,0,0,.55);
        }

        .scene-label {
          margin-bottom: 16px;
          font-size: 11.5px; font-weight: 800; letter-spacing: .16em;
          text-transform: uppercase; color: var(--gold-lit);
        }

        /* The whole page rests on this one rule: one sentence, set large, with
           a soft plate behind it so it stays readable over a bright planet. */
        .scene-text {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(23px, 2.5vw, 31px);
          font-weight: 500; line-height: 1.42; color: #fff;
          text-wrap: pretty;
          text-shadow: 0 3px 26px rgba(0,0,0,.7), 0 1px 3px rgba(0,0,0,.6);
        }

        /* Reserved for a card that carries a heading as well as copy: there
           the paragraph steps down rather than competing with the title, the
           same relationship .hero-lead has to .hero-heading on /about and
           /bli. That is the cover alone, and the cover has no paragraph — so
           nothing uses this today. It stays because the moment any scene
           pairs a title with a sentence again, this is the rule it needs.
           Every other card is one sentence with the screen to itself, and
           keeps the full-size serif above. */
        .scene-card.is-lead .scene-text {
          font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
          font-size: clamp(16px, 1.35vw, 18.5px);
          font-weight: 450;
          line-height: 1.66;
          color: rgba(255, 255, 255, .82);
          margin-top: 20px;
          text-shadow: 0 2px 18px rgba(0,0,0,.75);
        }

        /* The opening card arrives a line at a time rather than as one block:
           eyebrow, then title, then the paragraph, then the scroll cue. Only
           the title card does this — every other card is a single sentence,
           where a stagger would just feel slow. */
        .scene-card.is-title .scene-kicker,
        .scene-card.is-title .scene-title,
        .scene-card.is-title .scene-text,
        .scene-card.is-title .scene-hint {
          opacity: 0;
          transform: translateY(15px);
          transition: opacity .85s cubic-bezier(.22,.9,.32,1),
                      transform .85s cubic-bezier(.22,.9,.32,1);
        }
        .scene-card.is-title.on .scene-kicker,
        .scene-card.is-title.on .scene-title,
        .scene-card.is-title.on .scene-text,
        .scene-card.is-title.on .scene-hint {
          opacity: 1;
          transform: translateY(0);
        }
        .scene-card.is-title.on .scene-kicker { transition-delay: .18s; }
        .scene-card.is-title.on .scene-title  { transition-delay: .42s; }
        .scene-card.is-title.on .scene-text   { transition-delay: .78s; }
        .scene-card.is-title.on .scene-hint   { transition-delay: 1.2s; }


        .scene-hint {
          position: absolute; top: 100%; left: 0;
          display: flex; align-items: center; gap: 12px; margin-top: 38px;
          font-size: 12.5px; font-weight: 650; color: rgba(255,255,255,.5);
        }
        .scene-hint-mouse {
          position: relative; width: 20px; height: 31px; flex-shrink: 0;
          border: 1.6px solid rgba(255,255,255,.34); border-radius: 11px;
        }
        .scene-hint-mouse i {
          position: absolute; left: 50%; top: 6px; width: 2.4px; height: 6px;
          margin-left: -1.2px; border-radius: 2px; background: rgba(255,255,255,.7);
          animation: hintWheel 1.9s ease-in-out infinite;
        }
        @keyframes hintWheel {
          0%, 100% { transform: translateY(0); opacity: 1; }
          55% { transform: translateY(9px); opacity: .15; }
        }

        .scene-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 34px; }
        .scene-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 27px; border-radius: 999px; text-decoration: none;
          background: rgba(255,255,255,.94); color: var(--navy);
          font-size: 15px; font-weight: 700;
          box-shadow: 0 12px 32px rgba(0,0,0,.4);
          transition: background .15s, transform .13s;
        }
        .scene-btn:hover { background: #fff; transform: translateY(-2px); }
        .scene-btn.ghost {
          background: rgba(255,255,255,.07); color: #fff;
          border: 1px solid rgba(255,255,255,.2); backdrop-filter: blur(8px);
          box-shadow: none;
        }
        .scene-btn.ghost:hover { background: rgba(255,255,255,.14); }
        .scene-mail {
          color: rgba(255,255,255,.58); font-size: 13.5px; font-weight: 650;
          text-decoration: none; border-bottom: 1px solid rgba(255,255,255,.24);
          padding-bottom: 2px;
        }
        .scene-mail:hover { color: #fff; border-color: rgba(255,255,255,.6); }

        /* Scene rail — same idea as the dot rail on /about and /bli, but it
           stays hidden until the reader has actually started scrolling. */
        .orrery-rail {
          position: fixed; right: 24px; top: 50%; transform: translateY(-50%);
          z-index: 30; display: flex; flex-direction: column; gap: 2px;
          opacity: 0; pointer-events: none; transition: opacity .4s ease;
        }
        .orrery-rail.visible { opacity: 1; pointer-events: auto; }

        /* A snap point of its own, so the footer is somewhere the page can
           actually come to rest under mandatory snapping. */
        .oba-site-footer { scroll-snap-align: start; }
        .orrery-dot {
          position: relative; width: 32px; height: 32px; padding: 0; cursor: pointer;
          border: 0; background: transparent;
          transition: background .2s, transform .2s, border-color .2s;
        }
        .orrery-dot::before {
          content: ""; position: absolute; left: 50%; top: 50%;
          width: 8px; height: 8px; border-radius: 50%;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(255,255,255,.34); background: transparent;
          transition: background .2s, transform .2s, border-color .2s;
        }
        .orrery-dot:hover::before { background: rgba(255,255,255,.6); }
        .orrery-dot.on::before { background: var(--gold-lit); border-color: var(--gold-lit); transform: translate(-50%, -50%) scale(1.5); }
        .orrery-dot:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }

        /* The footer scrolls in over the canvas at the very end. */
        .oba-site-footer { position: relative; z-index: 2; }

        @media (max-width: 900px) {
          /* The system rides high and centred on a phone, so the copy drops to
             the lower third rather than sitting on top of it. */
          .scene { align-items: flex-end; padding: 96px 0 88px; }
          .scene-card { width: calc(100% - 40px); margin: 0 20px; }
          .scene-text { font-size: clamp(21px, 5.2vw, 26px); }
          .scene-title { font-size: clamp(34px, 9vw, 46px); }
          .orrery-rail { display: none; }
        }

        /* Cards must never animate content out of reach: with motion reduced
           they simply appear, and the canvas freezes its orbits. */
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .scene-card { transition: opacity .2s linear; transform: none; filter: none; }
          .scene-card.on { transform: none; }
          /* No staggered arrival either — the lines are simply present. */
          .scene-card.is-title .scene-kicker,
          .scene-card.is-title .scene-title,
          .scene-card.is-title .scene-text,
          .scene-card.is-title .scene-hint {
            opacity: 1; transform: none; transition: none; transition-delay: 0s;
          }
          .scene-hint-mouse i { animation: none; }
        }
`;
