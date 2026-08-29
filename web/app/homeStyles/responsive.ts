export const HOME_RESPONSIVE_STYLES = `        /* ============================================================
           Responsive: narrow-viewport overrides
           ============================================================ */
        @media (max-width: 640px) {
          .score-strip { grid-template-columns: 1fr; }
          .score-block { border-right: none; border-bottom: 1px solid rgba(255,255,255,.12); }
          .conf-block { border-left: none; border-top: 1px solid rgba(255,255,255,.12); align-items: center; text-align: center; }
          .progress-card { padding: 22px 16px 18px; }
          .progress-head { flex-direction: column; gap: 14px; }
          .progress-controls { width: 100%; justify-content: space-between; }
          .progress-chart { min-width: 560px; }
          .progress-detail { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px 12px; }
          .progress-detail-primary { grid-column: 1 / -1; }
          .progress-review-link { grid-column: 1 / -1; }
          .breakdown-head { flex-direction: column; align-items: flex-start; }
          .breakdown-controls { width: 100%; justify-content: flex-start; }
          .breakdown-tabs { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); }
          .breakdown-tab { padding-inline: 8px; }
          .sections-grid,
          .sections-grid.books,
          .sections-grid.domains { grid-template-columns: 1fr; }
          .retest-modal { padding: 24px 22px; }
          .retest-modal-actions { align-items: stretch; flex-direction: column-reverse; }
          .retest-modal-primary,
          .retest-modal-secondary { width: 100%; }
          .save-modal { padding: 24px 22px 20px; }
          .save-modal-title { font-size: 24px; }
          .save-modal-actions { align-items: stretch; flex-direction: column-reverse; }
          .save-modal-primary { justify-content: center; }
          .save-modal-primary,
          .save-modal-secondary { width: 100%; }
          .save-modal-note { text-align: center; }
          .first-assessment-card { grid-template-columns: 1fr; padding: 28px 20px; min-height: auto; }
          .first-assessment-orbit { width: min(100%, 280px); }
          .first-assessment-content h1 { font-size: 36px; }
          .first-assessment-primary,
          .first-assessment-secondary { width: 100%; }
          .first-assessment-choice-panel { grid-template-columns: 1fr; }
          .oba-feature-grid { grid-template-columns: 1fr; gap: 12px; }
          .oba-feature-card { min-height: 0; padding: 18px; }
          .oba-feature-graphic { height: 76px; }
          .knowledge-cone-card { padding: 24px 18px; }
          .knowledge-cone-head { align-items: flex-start; flex-direction: column; }
          .knowledge-cone-score { align-items: flex-start; }
          .knowledge-cone-wrap { min-height: 360px; padding: 18px 8px 58px; }
          .knowledge-cone { height: 320px; transform: rotateX(5deg); }
          .cone-tier { padding: 0 calc(var(--text-inset) + 10px); }
          .cone-tier-name { font-size: 10px; }
          .cone-tier-range { font-size: 10px; }
          .cone-layer-popover { left: 50%; top: calc(var(--popover-y) * 1% + 42px); width: min(340px, 90vw); padding: 15px 17px; transform: translateX(-50%); }
          .cone-layer-popover::before { left: 50%; top: -9px; transform: translateX(-50%) rotate(135deg); }
          .cone-layer-popover strong { font-size: 13px; }
          .cone-layer-popover span { font-size: 13px; line-height: 1.46; }
          @keyframes coneDescriptionIn { from { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(.96); } to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } }
          .cone-marker { right: 50%; transform: translate(50%, -50%); }
          .cone-marker::before { width: 46px; }
          .dashboard-subject-row { margin-top: -8px; }
          /* Now the primary subject control on a phone, so it needs a real
             touch target rather than the 29px the inline trigger rendered. */
          .subject-trigger { min-height: 44px; padding: 8px 16px 8px 13px; font-size: 13.5px; }
          .subject-menu-item { min-height: 44px; }
          .placeholder-dashboard { grid-template-columns: 1fr; padding: 30px 24px; min-height: 360px; }
          .placeholder-orbit { width: min(210px, 70vw); margin: 0 auto; }
          .scope-drawer-backdrop { align-items: flex-end; }
          .scope-drawer {
            width: 100%; height: min(88vh, 760px); border-left: 0;
            border-top: 1px solid rgba(255,255,255,.42);
          }
          .scope-drawer-head { padding: 22px 20px 17px; }
          .scope-drawer-body { padding: 20px 20px 30px; }
          .scope-focused-action { align-items: flex-start; flex-direction: column; }
          /* The nav links exceed a phone's width, so let them wrap onto a
             second row rather than being clipped off the right edge. */
          .nav { padding: 11px 16px; flex-wrap: wrap; gap: 8px; }
          /* The beta tooltip is only visually hidden, so it still occupies
             layout and pushed the document 71px wider than the viewport.
             Anchor it to the nav instead of the badge so it can never
             extend past the right edge. */
          .beta-badge { position: static; }
          .beta-tooltip { left: 12px; right: 12px; width: auto; top: calc(100% + 6px); }
          .nav-right { flex-wrap: wrap; gap: 7px; }
          /* The reduced padding left these at 30px tall. Hold a 32px floor so
             the primary nav controls stay a usable touch target on a phone. */
          .nav-btn {
            padding: 7px 12px; font-size: 12px;
            min-height: 32px;
            display: inline-flex; align-items: center; justify-content: center;
          }
          .bli-tooltip,
          .level-tooltip {
            position: fixed;
            left: 16px;
            right: 16px;
            top: auto;
            bottom: 18px;
            width: auto;
            max-width: none;
            transform: none;
            z-index: 140;
          }
          .bli-tooltip::before,
          .level-tooltip::before {
            display: none;
          }
          /* This used to be pinned with position:fixed and top:86px, a number
             tuned for a single-row nav. The nav now wraps to two rows on a
             phone (142px), so the menu opened 56px *behind* it, and the subject
             switcher — which lives in the page, not the nav — had its menu
             yanked to the top of the viewport, covering its own trigger.
             Staying absolute keeps every menu anchored under whatever opened
             it, at any nav height. */
          .learn-more-menu {
            top: calc(100% + 10px);
            width: min(300px, calc(100vw - 32px));
          }
          .learn-more-menu::before { display: none; }
          .page { padding: 28px 16px 72px; }
        }
        /* ============================================================
           Reduced-motion overrides
           ============================================================ */
        @media (prefers-reduced-motion: reduce) {
          .water-fill, .water-fill::before, .water-fill::after,
          .water-wave, .water-wave::before,
          .progress-point,
          .scope-drawer-backdrop, .scope-drawer,
          .placeholder-orbit, .placeholder-orbit::before, .placeholder-orbit::after {
            animation: none !important;
          }
          /* Catch-all: the page reveal and any future decorative animation
             should be instant rather than a multi-second transition. The
             content must still arrive, so opacity is forced back to full. */
          .page { animation: none !important; opacity: 1 !important; filter: none !important; transform: none !important; }
          *, *::before, *::after {
            animation-duration: .001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .001ms !important;
            scroll-behavior: auto !important;
          }
        }
`;
