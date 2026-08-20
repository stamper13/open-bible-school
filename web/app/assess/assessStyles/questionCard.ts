export const ASSESS_QUESTION_CARD_STYLES = `        /* ============================================================
           Multiple-choice answer buttons
           ============================================================ */
        .choices { display: flex; flex-direction: column; gap: 12px; }
        .choice {
          display: flex; align-items: center; gap: 15px;
          padding: 16px 18px; border-radius: 15px;
          border: 1.5px solid var(--border); background: rgba(255,255,255,.65);
          cursor: pointer; font-size: 15px; color: var(--navy); line-height: 1.45;
          transition: border-color .13s, background .13s, transform .11s;
          text-align: left; width: 100%; font-family: inherit;
        }
        .choice:hover:not(:disabled) {
          border-color: var(--accent-line); background: var(--accent-dim);
          transform: translateX(3px);
        }
        .choice:disabled { cursor: default; }
        .choice.correct { border-color: var(--correct-line); background: var(--correct-bg); }
        .choice.wrong   { border-color: var(--wrong-line);   background: var(--wrong-bg); }
        .choice.skipped { border-color: rgba(86,96,112,.22); background: rgba(27,36,66,.045); }
        .choice.recorded { border-color: var(--accent-line); background: var(--accent-dim); }
        .choice-letter {
          width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700;
          background: rgba(27,36,66,.07); color: var(--muted);
          transition: background .13s, color .13s;
        }
        .choice.correct .choice-letter { background: var(--correct); color: #fff; }
        .choice.wrong   .choice-letter { background: var(--wrong);   color: #fff; }
        .choice.skipped .choice-letter { background: var(--muted); color: #fff; }
        .choice.recorded .choice-letter { background: var(--accent); color: #fff; }
        /* ============================================================
           Sequence-question interaction (drag events into order)
           ============================================================ */
        .sequence-instruction {
          margin: -18px 0 14px; color: var(--muted);
          font-size: 13px; line-height: 1.45;
        }
        .sequence-list { display: flex; flex-direction: column; gap: 9px; }
        .sequence-item {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 32px 38px minmax(0,1fr) auto;
          align-items: center; gap: 10px; min-height: 66px; padding: 10px 12px;
          border: 1.5px solid var(--border); border-radius: 8px;
          background: rgba(255,255,255,.76); color: var(--navy);
          box-shadow: 0 4px 12px rgba(27,36,66,.045);
        }
        .sequence-item.is-dragging {
          z-index: 4; border-color: var(--accent);
          background: #fff; box-shadow: 0 16px 34px rgba(27,36,66,.18);
        }
        .sequence-number {
          width: 30px; height: 30px; border-radius: 50%;
          display: grid; place-items: center;
          background: var(--navy); color: #fff;
          font-size: 12px; font-weight: 800;
        }
        .sequence-handle {
          width: 36px; height: 36px; border-radius: 7px;
          display: grid; place-items: center; border: 1px solid var(--border);
          background: rgba(27,36,66,.045); color: var(--muted);
          font: 800 20px/1 system-ui, sans-serif; cursor: grab;
          touch-action: none;
        }
        .sequence-handle:active { cursor: grabbing; }
        .sequence-handle:disabled { cursor: default; opacity: .5; }
        .sequence-text { font-size: 14.5px; line-height: 1.4; font-weight: 600; }
        .sequence-step-controls { display: inline-flex; gap: 5px; }
        .sequence-step-controls button {
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid var(--border); background: rgba(255,255,255,.78);
          color: var(--navy); font: 800 14px/1 system-ui, sans-serif; cursor: pointer;
        }
        .sequence-step-controls button:hover:not(:disabled) {
          border-color: var(--accent-line); background: var(--accent-dim);
        }
        .sequence-step-controls button:disabled { opacity: .28; cursor: default; }
        .sequence-actions {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-top: 16px;
        }
        .sequence-submit, .sequence-skip {
          min-height: 43px; border-radius: 999px; padding: 0 19px;
          font: 750 13px/1 inherit; cursor: pointer;
        }
        .sequence-submit {
          border: 0; background: var(--navy); color: #fff;
          box-shadow: 0 9px 22px rgba(27,36,66,.22);
        }
        .sequence-submit:hover:not(:disabled) { background: #253566; transform: translateY(-1px); }
        .sequence-skip {
          border: 1px solid var(--border); background: rgba(255,255,255,.64);
          color: var(--muted);
        }
        .sequence-submit:disabled, .sequence-skip:disabled { opacity: .55; cursor: default; }
        /* ============================================================
           Section-sort-question interaction (drag books into their section)
           ============================================================ */
        .section-sort-question { display: flex; flex-direction: column; gap: 16px; }
        .section-sort-bank {
          min-height: 62px; display: flex; align-items: center; flex-wrap: wrap; gap: 9px;
          padding: 12px; border-radius: 8px;
          border: 1.5px dashed rgba(27,36,66,.16);
          background: rgba(27,36,66,.035);
        }
        .section-sort-chip {
          position: relative; z-index: 2;
          min-height: 34px; padding: 0 12px; border-radius: 999px;
          border: 1px solid rgba(27,36,66,.12);
          background: #fff; color: var(--navy);
          font: 760 13px/1 var(--font-inter), system-ui, sans-serif;
          box-shadow: 0 4px 11px rgba(27,36,66,.075);
          cursor: grab; touch-action: none;
        }
        .section-sort-chip:active { cursor: grabbing; }
        .section-sort-chip:disabled { cursor: default; opacity: .68; }
        .section-sort-chip.is-dragging {
          z-index: 8; opacity: .92;
          box-shadow: 0 16px 34px rgba(27,36,66,.18);
        }
        .section-sort-zones {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;
        }
        .section-sort-zone {
          min-height: 154px; padding: 13px; border-radius: 50%;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px;
          border: 1.5px solid rgba(27,36,66,.12);
          background: rgba(255,255,255,.62);
          box-shadow: inset 0 0 0 8px rgba(10,163,163,.035);
          transition: border-color .14s, background .14s, transform .12s;
        }
        .section-sort-zone.is-over {
          border-color: var(--accent);
          background: rgba(10,163,163,.10);
          transform: scale(1.015);
        }
        .section-sort-zone-title {
          max-width: 112px; text-align: center;
          color: var(--navy); font-size: 12px; font-weight: 850; line-height: 1.15;
        }
        .section-sort-zone-labels {
          display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; min-height: 38px;
        }
        .section-sort-zone .section-sort-chip {
          min-height: 30px; padding: 0 10px; font-size: 12px;
        }
        .section-sort-empty {
          color: rgba(86,96,112,.52); font-size: 12px; font-weight: 650;
        }

        /* Feedback */
        /* ============================================================
           Retry notice & post-answer feedback bar
           ============================================================ */
        .retry-notice {
          display: flex; align-items: flex-start; gap: 10px;
          margin-bottom: 16px; padding: 11px 13px; border-radius: 10px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          color: #0a5f5f; font-size: 13px; line-height: 1.5;
        }
        .retry-notice svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }
        .retry-notice span { flex: 1; }
        .retry-notice button {
          flex-shrink: 0; width: 24px; height: 24px; border-radius: 6px;
          border: 0; background: transparent; cursor: pointer;
          color: #0a5f5f; font-size: 17px; line-height: 1; font-family: inherit;
        }
        .retry-notice button:hover { background: rgba(10,163,163,.16); }
        .retry-notice button:focus-visible { outline: 2px solid #0aa3a3; outline-offset: 1px; }
        .feedback-bar {
          margin-top: 20px; padding: 14px 18px; border-radius: 13px;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .feedback-bar.correct { background: var(--correct-bg); border: 1px solid var(--correct-line); }
        .feedback-bar.wrong   { background: var(--wrong-bg);   border: 1px solid var(--wrong-line); }
        .feedback-bar.skipped { background: rgba(27,36,66,.045); border: 1px solid rgba(86,96,112,.18); }
        .feedback-bar.recorded { background: var(--accent-dim); border: 1px solid var(--accent-line); }
        .feedback-text { font-size: 13.5px; font-weight: 600; }
        .feedback-bar.correct .feedback-text { color: var(--correct); }
        .feedback-bar.wrong   .feedback-text { color: var(--wrong); }
        .feedback-bar.skipped .feedback-text { color: var(--muted); }
        .feedback-bar.recorded .feedback-text { color: #0a6969; }
        .canon-note {
          margin-top: 12px; padding: 13px 15px; border-radius: 10px;
          background: rgba(212,160,23,.11); border: 1px solid rgba(212,160,23,.28);
          color: #5f4308; font-size: 13px; line-height: 1.55;
          display: grid; gap: 3px;
        }
        .canon-note strong {
          color: #3b2a05; font-size: 12px; text-transform: uppercase; letter-spacing: .08em;
        }
        .next-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 18px; border-radius: 999px;
          background: var(--navy); color: #fff;
          font-size: 13px; font-weight: 600; border: none; cursor: pointer;
          white-space: nowrap; flex-shrink: 0; font-family: inherit;
          transition: background .13s, transform .11s; text-decoration: none;
        }
        .next-btn:hover { background: #253566; transform: translateY(-1px); }

        /* Score row */
`;
