export const ASSESS_RESPONSIVE_STYLES = `        /* ============================================================
           Responsive: narrow-viewport overrides
           ============================================================ */
        @media (max-width: 640px) {
          .card { padding: 30px 22px; max-width: 100%; }
          .nav { display: flex; justify-content: space-between; padding: 12px 16px; }
          .card-prompt { font-size: 20px; }
          .question-head { align-items: flex-start; }
          .report-options { grid-template-columns: 1fr; }
          /* width:100% made nav-center demand the full nav width alongside its
             flex siblings, pushing the progress row past the right edge.
             Let it share the row instead. */
          .nav-center { width: auto; flex: 1 1 auto; min-width: 0; }
          .nav-subphase { display: none; }
          /* The wordmark alone claimed 270px of a 358px nav, squeezing the
             progress row out past the right edge. Keep the emblem, drop the
             text, and trim the row's fixed minimums so it has room to sit. */
          .brand-wrap { min-width: 0; flex: 0 0 auto; }
          .oba-brand-logo-text { display: none; }
          .nav-count, .nav-count-right { min-width: 26px; }
          .nav-progress-row { gap: 8px; }
          .progress-bar-track { width: 96px; }
          /* Exit is the escape hatch mid-assessment and sat at 29px tall.
             It has to be comfortably tappable. */
          .nav-exit { min-height: 44px; padding: 6px 14px; font-size: 13.5px; }
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
