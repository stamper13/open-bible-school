export const ASSESS_RESPONSIVE_STYLES = `        /* ============================================================
           Responsive: narrow-viewport overrides
           ============================================================ */
        @media (max-width: 640px) {
          .card { padding: 30px 22px; max-width: 100%; }
          .nav { display: flex; justify-content: space-between; padding: 12px 16px; }
          .card-prompt { font-size: 20px; }
          .question-head { align-items: flex-start; }
          .report-options { grid-template-columns: 1fr; }
          .nav-center { min-width: 0; }
          .nav-subphase { display: none; }
          .progress-bar-track { width: 112px; }
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
