export const ASSESS_RESPONSIVE_STYLES = `        /* ============================================================
           Responsive: narrow-viewport overrides
           ============================================================ */
        @media (max-width: 640px) {
          /* The question screen is a full-screen view, not a document, so on a
             phone it is pinned to the viewport and never scrolls as a page.

             body carries min-height:100vh, which is a floor and not a cap, so
             a long prompt grew the body past the viewport and handed the scene
             extra room — which defeated every constraint below it. Capping the
             height here is what forces the shrinking down into the prompt,
             the one element that can absorb it. svh rather than vh so mobile
             browser chrome is accounted for. */
          /* Not while the milestone banner is up. On the last question the
             card grows by the "Baseline complete / See results" banner, and
             with the page pinned and overflow hidden anything past the
             viewport became unreachable — the See results link was cut off
             and could not be tapped. Unpinning for that one state lets the
             page scroll again exactly when it needs to. */
          body:has(.card:not(.center-card)):not(:has(.milestone-banner)) {
            height: 100svh;
            max-height: 100svh;
            overflow-y: hidden;
          }
          /* stretch, so the card can fill the scene and hold the answers in
             one place from question to question. */
          /* stretch, so the card fills the scene and holds the answers in
             one place from question to question.

             min-height:0 is the load-bearing part. The scene is a flex:1 item,
             and a flex item defaults to min-height:auto, so a long prompt made
             the scene grow past the viewport and took the page with it. Zero
             lets it hold its share and pushes the shrinking down into the
             prompt, where it belongs. */
          /* iOS only.
             Safari's bottom toolbar still covered the last answer even with
             svh, and -webkit-fill-available is the height Safari actually
             measures the visible area with. Declared unscoped, though, it also
             won in Chrome for Android, where it resolves to the taller layout
             viewport — the card then centred in a box bigger than the screen
             and the whole thing sat low, with the spare room piled above it.
             -webkit-touch-callout is the usual stand-in for "this is iOS", so
             the override lands there and Android keeps svh. */
          @supports (-webkit-touch-callout: none) {
            body:has(.card:not(.center-card)):not(:has(.milestone-banner)) {
              height: -webkit-fill-available;
              max-height: -webkit-fill-available;
            }
          }

          /* Nothing fills the scene. The card wraps its content and sits at
             the top, so the sky shows below it instead of being covered by a
             tall slab of white. */
          /* Centred, so the sky shows above and below and the card grows
             evenly in both directions as a question gets longer.

             This is a deliberate trade. Bottom-anchoring held the answers
             perfectly still but pushed the card against the bottom edge with
             all the spare room stacked above it, which looked lopsided on a
             tall phone. Centred, the spare room is split, and the answers move
             by half the card's growth rather than not at all — still less than
             half what they moved before any of this. */
          .scene {
            align-items: center;
            min-height: 0;
            /* The extra top padding is the head's room. Capping the card's
               height could not provide it: the card is centred, so a cap
               leaves half the space above and half below, and the head needs
               all of it above. Padding takes it off the top before centring
               happens, so the card can never rise into the nav. */
            /* 52 top, not 60. The top padding reserves room for the section
               pills and flag, which sit above the card and are visually part
               of it — so what should look centred is the head-and-card group,
               not the card alone. The head block measures 41px, so 52 keeps
               11px of slack above it while bringing the group's top and bottom
               sky to within a pixel of each other on a large phone. */
            padding: 52px 12px max(26px, env(safe-area-inset-bottom));
          }
          /* The card becomes a column that cannot outgrow the scene, so the
             page itself never scrolls. Only the prompt is allowed to flex:
             the head and the answers keep their natural size, which is what
             stops the tap targets moving between questions. */
          .card {
            border-radius: 18px;
            padding: 18px 14px 16px;
            max-width: 100%;
          }
          .card:not(.center-card) {
            display: flex;
            flex-direction: column;
            position: relative;
            max-height: 100%;
            /* visible, not hidden: the head is positioned above the card and
               hidden would clip it away. Note the clipped element still
               reports a normal bounding rect, so this looks like a layout bug
               until you actually look at the pixels. Nothing else needs the
               clip — the prompt shrinks and scrolls before anything can spill,
               which is what min-height:0 below buys. */
            overflow: visible;
            /* No explicit height. An explicit one would override the
               scene's align-items:stretch, and a percentage does not resolve
               reliably against a height the scene itself gets from flex.
               Stretch fills the scene without depending on that. */
            min-height: 0;
          }
          .question-head { flex: none; }
          /* The answers are what yield when a long question meets long
             options: they scroll within the card, and only in that case. The
             question stays readable, which matters more. */
          .choices {
            flex: 0 1 auto;
            min-height: 0;
            overflow-y: auto;
            overscroll-behavior: contain;
          }
          /* .choices is itself a flex column, so squeezing it shrank each
             button below its own text and the options overlapped one another.
             The buttons keep their natural height and the container scrolls. */
          .choices > .choice { flex: none; }
          /* Lifted out of the card onto the sky above it. Taken out of flow,
             so the card gets the whole row back and the empty sky does some
             work. Absolute rather than a markup change, so desktop is
             untouched and the JSX stays one shape for both. */
          .question-head {
            position: absolute;
            bottom: calc(100% + 11px);
            left: 2px;
            right: 2px;
            align-items: center;
            gap: 10px;
            margin-bottom: 0;
          }
          /* The flag was a white disc for a white card; on the sky it needs to
             be the other way round. */
          .report-trigger {
            background: rgba(255, 255, 255, .10);
            border-color: rgba(255, 255, 255, .22);
            color: rgba(255, 255, 255, .78);
          }
          .location-bar { gap: 6px; }
          .loc-pill {
            padding: 3px 8px;
            font-size: 10px;
            letter-spacing: .03em;
          }
          .report-trigger {
            width: 31px;
            height: 31px;
          }
          /* Previously capped at min(26svh, 190px), which gave a long prompt
             its own scrollbar *and* pushed the card past the viewport, so a
             phone ended up with two nested scroll surfaces. Now it takes
             whatever the answers leave over and only scrolls as a last
             resort.

             min-height reserves roughly three lines whatever the question is,
             so a short prompt and a long one put the answer buttons in nearly
             the same place. Questions vary in length; the tap targets should
             not. 17px rather than 19px buys about 35px on the longest
             prompts, which is usually the difference between scrolling and
             not. */
          .card-prompt {
            /* A fixed band rather than "whatever is left over".
"Whatever is left" made the card as tall as the screen, which both
               buried the starfield and left a short question floating above a
               large empty gap. Fixed at about four lines: the answers still
               land in exactly the same place every question, the gap under a
               short prompt is small, and only genuinely long questions scroll
               within the band. */
            /* Sizes to the question, with a ceiling. Past about six lines it
               scrolls within the band rather than pushing the answers off the
               top of the screen. */
            flex: 0 1 auto;
            /* A floor, not zero. min-height:0 let the prompt shrink away to
               nothing when the answers were tall, which hid the question
               outright — far worse than any amount of scrolling. Three lines
               are always kept; past that the answers give way instead. */
            min-height: 4.4em;
            max-height: 10em;
            margin-bottom: 14px;
            padding-right: 2px;
            display: flex;
            flex-direction: column;
            /* Top-aligned, not centred: the reserved band is a fixed size, so
               centring made a short question float in the middle of it with
               dead space above and below. Aligned to the top, the first line
               of every question begins at the same place whatever its
               length. */
            justify-content: flex-start;
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
            font-size: 17px;
            line-height: 1.36;
          }
          .choices { gap: 8px; }
          .choice {
            align-items: flex-start;
            gap: 11px;
            min-height: 46px;
            padding: 11px 12px;
            border-radius: 11px;
            font-size: 14px;
            line-height: 1.35;
          }
          .choice-letter {
            width: 26px;
            height: 26px;
            border-radius: 7px;
            margin-top: 1px;
          }
          .report-options { grid-template-columns: 1fr; }
          /* One row: emblem, progress, pills.
             The readout used to need a second row, because the phase label
             ("Initial Assessment") alone claimed 163px and the pills were
             pinned at 76px each. Dropping the label and letting the pills size
             to their text buys back enough width for all three to share a
             line, which takes the bar from 87px to about 64px and gives the
             flag below it room to breathe. */
          .nav {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            grid-template-areas: "brand center actions";
            align-items: center;
            column-gap: 10px;
            padding: 10px 14px;
          }
          .brand-wrap { grid-area: brand; min-width: 0; justify-self: start; }
          .nav > .nav-actions {
            grid-area: actions; justify-self: end;
            display: grid; grid-auto-flow: column; grid-auto-columns: auto;
            align-items: center; gap: 6px;
            /* No nudge any more: on a single row the pills centre naturally
               against the emblem. */
          }
          /* On its own row the readout fits phase label and progress side by
             side, so the stacked nav stays about as short as the broken one. */
          .nav-center {
            grid-area: center;
            flex-direction: row; justify-content: center;
            width: 100%; min-width: 0; gap: 8px;
            /* Clip rather than spill. On a 320px screen showing three pills
               there is not enough room for the readout, and left visible it
               overflowed its own box and ran underneath the buttons — the
               exact failure the old two-row layout was built to avoid. */
            overflow: hidden;
          }
          /* The wordmark alone claimed 270px of a 358px nav. Keep the emblem
             and drop the text so the action pills keep their tap targets. */
          .oba-brand-logo-text { display: none; }
          /* The ring itself is defined in chrome.ts and applies everywhere;
             phones just get a slightly smaller one. */
          .nav-progress-row { width: 34px; height: 34px; }
          .nav-progress-row::before {
            -webkit-mask: radial-gradient(circle, transparent 11.5px, #000 12px);
                    mask: radial-gradient(circle, transparent 11.5px, #000 12px);
          }
          .nav-count { font-size: 11.5px; }
          /* Exit is the escape hatch mid-assessment and sat at 29px tall.
             It has to be comfortably tappable. */
          .nav-exit {
            width: auto; min-height: 44px; padding: 0 11px; font-size: 13px;
            white-space: nowrap;
          }
          /* Three full-width pills need 275px of a 343px row, leaving nothing
             for the brand. Trimming this one label to "Review" brings the row
             back to 210px so all three keep their 44px tap targets. */
          .nav-exit-tail { display: none; }
          .pilot-badge { font-size: 11.5px; }
          .nav-phase { font-size: 12.5px; }
          /* The beta tooltip is only visually hidden, so it still occupies
             layout and pushed the document 108px wider than the viewport.
             Anchor it to the nav instead of the badge so it can never extend
             past the right edge. Mirrors the same override in homeStyles. */
          .beta-badge { position: static; }
          .beta-tooltip { left: 12px; right: 12px; width: auto; top: calc(100% + 6px); }
          .overlay-card { padding: 28px 24px; }
          /* The evidence readout had no phone sizing at all, so it rendered at
             desktop scale and landed on top of the question card — white text
             over a white card, sitting on the last answer.
             Two fixes: smaller, and behind. z-index 0 puts it under .scene, so
             where it meets the card the card wins and it is simply not seen;
             it shows only in the open sky beneath. That way it never needs to
             be positioned around a card whose height changes per question. */
          .confidence-nebula-label {
            right: auto; left: 50%; bottom: 3px;
            transform: translateX(-50%);
            z-index: 0;
            /* One line, not three. Stacked, it was tall enough that the card
               sliced it in half and left a stray "7 responses" under the
               edge, which looks like a bug rather than a decision. On one
               line it fits the gap under the card whole, or is hidden
               entirely behind it. */
            flex-direction: row; align-items: baseline; gap: 5px;
            opacity: .8;
          }
          .confidence-nebula-label span { font-size: 8.5px; letter-spacing: .13em; }
          .confidence-nebula-label strong { max-width: 52vw; font-size: 11px; font-weight: 750; }
          .confidence-nebula-label small { display: none; }
          /* The startup and between-question loaders hold a spinner and two
             short lines, but inherited .card's full width and ran the whole
             351px across the phone. Sized to their content instead, so they
             read as a small notice on the starfield rather than a slab.
             Scoped to .startup-card so the error and completion screens, which
             carry buttons and need the width, are untouched. */
          .card.startup-card {
            width: auto;
            max-width: min(290px, calc(100% - 28px));
            margin: 0 auto;
            padding: 18px 18px 16px;
          }
          .startup-card .startup-status { gap: 5px; }
          .startup-card .startup-title { font-size: 14px; }
          .startup-card .startup-note { font-size: 12.5px; line-height: 1.5; }
          .overlay-score { font-size: 52px; }
          .selection-grid { grid-template-columns: 1fr; }
          .milestone-banner { align-items: stretch; flex-direction: column; }
          .milestone-actions { display: grid; grid-template-columns: 1fr 1fr; }
          .sequence-item { grid-template-columns: 30px 34px minmax(0,1fr); padding: 9px; gap: 8px; }
          .sequence-step-controls { grid-column: 2 / -1; justify-content: flex-end; }
          .sequence-actions { align-items: stretch; flex-direction: column-reverse; }
          .sequence-submit, .sequence-skip { width: 100%; }
          .section-sort-zones { grid-template-columns: 1fr; }
          .section-sort-zone { min-height: 132px; border-radius: 8px; }
          .section-sort-zone-title { max-width: none; }
        }

        @media (max-width: 380px) {
          .nav { column-gap: 8px; padding-left: 12px; padding-right: 12px; }
          /* auto, not a fixed 68px: on the single-row bar the pills have to
             give the readout room. Three of them at a fixed width left the
             count clipped to "0 2" on a 320px screen. */
          .nav > .nav-actions { grid-auto-columns: auto; gap: 5px; }
          .nav-exit { padding: 0 8px; font-size: 12.5px; }
          .beta-badge { display: none; }
        }
`;
