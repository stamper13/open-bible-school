export const ASSESS_RESPONSIVE_STYLES = `        /* ============================================================
           Responsive: narrow-viewport overrides
           ============================================================ */
        @media (max-width: 640px) {
          .card { padding: 30px 22px; max-width: 100%; }
          .card-prompt { font-size: 20px; }
          .question-head { align-items: flex-start; }
          .report-options { grid-template-columns: 1fr; }
          /* Brand, readout, and up to three action pills cannot share one
             375px row: the pills alone claim 210px, which starved nav-center
             down to 3px and let its centered children spill over the brand on
             the left and under the buttons on the right. Give the readout its
             own row underneath instead. */
          .nav {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            grid-template-areas: "brand actions" "center center";
            align-items: center;
            row-gap: 7px; column-gap: 10px;
            padding: 10px 16px;
          }
          .brand-wrap { grid-area: brand; min-width: 0; justify-self: start; }
          .nav > .nav-actions { grid-area: actions; justify-self: end; }
          /* On its own row the readout fits phase label and progress side by
             side, so the stacked nav stays about as short as the broken one. */
          .nav-center {
            grid-area: center;
            flex-direction: row; justify-content: center;
            width: 100%; min-width: 0; gap: 10px;
          }
          .nav-phase {
            min-width: 0; flex: 0 1 auto;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .nav-subphase { display: none; }
          /* The wordmark alone claimed 270px of a 358px nav. Keep the emblem
             and drop the text so the action pills keep their tap targets. */
          .oba-brand-logo-text { display: none; }
          .nav-count, .nav-count-right { min-width: 26px; }
          .nav-progress-row { flex: 1 1 auto; min-width: 0; gap: 8px; }
          .progress-bar-track { flex: 1 1 auto; width: auto; min-width: 56px; }
          /* Exit is the escape hatch mid-assessment and sat at 29px tall.
             It has to be comfortably tappable. */
          .nav-exit {
            min-height: 44px; padding: 6px 14px; font-size: 13.5px;
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
`;
