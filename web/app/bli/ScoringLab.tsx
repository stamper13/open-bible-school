"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BLI_LEVELS, levelForScore } from "@/lib/bli";

/**
 * An executable walkthrough of the scoring model documented on this page.
 *
 * The arithmetic here mirrors the documented formula exactly:
 *   weight   = book_weight * importance_factor
 *   correct  = +weight * difficulty_reward
 *   wrong    = -weight * (1/3)
 *   "I don't know" contributes 0 earned points while the question still counts
 *   in weighted_possible, matching the live backend.
 *
 * difficulty_reward itself is normally derived per-question from its
 * calibrated difficulty — clamp(0.70, 1.25, 1.0 + 0.20 * item_difficulty) on
 * the live backend — not chosen by hand. The slider below lets you set it
 * directly instead, so you can explore the same 0.70–1.25 range a real
 * question could actually land in, including the fact that an easy correct
 * answer is worth *less* than full weight, not more.
 *
 * This walkthrough is deliberately plain-language: it shows which question
 * mattered more (a bar, not a variable name) and what happened to it (an
 * icon and a word), not the raw weight * reward arithmetic. Anyone who wants
 * the exact numbers has the formula one section down, in Technical details.
 *
 * The question list is a fixed sample, not a real assessment.
 */

type Strategy = "studied" | "guessing" | "idk" | "custom";
type ScriptedStrategy = "studied" | "guessing" | "idk";
type Outcome = "correct" | "wrong" | "idk";

const TIER_FACTOR: Record<number, number> = { 1: 1.0, 2: 0.6, 3: 0.35 };
const TIER_LABEL: Record<number, string> = { 1: "Core", 2: "Supporting", 3: "Detail" };

type Sample = { ref: string; book: string; tier: 1 | 2 | 3; bookWeight: number };

const SAMPLE: Sample[] = [
  { ref: "Genesis 15",    book: "GEN", tier: 1, bookWeight: 1.0 },
  { ref: "Exodus 20",     book: "EXO", tier: 1, bookWeight: 1.0 },
  { ref: "Leviticus 16",  book: "LEV", tier: 2, bookWeight: 0.85 },
  { ref: "Numbers 13",    book: "NUM", tier: 3, bookWeight: 0.75 },
  { ref: "Deuteronomy 6", book: "DEU", tier: 1, bookWeight: 0.95 },
  { ref: "Joshua 6",      book: "JOS", tier: 2, bookWeight: 0.8 },
  { ref: "Judges 7",      book: "JDG", tier: 3, bookWeight: 0.7 },
  { ref: "1 Samuel 17",   book: "1SA", tier: 1, bookWeight: 0.9 },
  { ref: "2 Samuel 7",    book: "2SA", tier: 1, bookWeight: 0.9 },
  { ref: "1 Kings 18",    book: "1KI", tier: 2, bookWeight: 0.85 },
  { ref: "2 Kings 17",    book: "2KI", tier: 2, bookWeight: 0.85 },
  { ref: "Isaiah 53",     book: "ISA", tier: 1, bookWeight: 0.95 },
];

const MAX_WEIGHT = Math.max(...SAMPLE.map(q => q.bookWeight * TIER_FACTOR[q.tier]));

/** Fixed outcomes per scripted strategy so a run is reproducible rather than flickering. */
const OUTCOMES: Record<ScriptedStrategy, Outcome[]> = {
  studied: ["correct","correct","correct","wrong","correct","correct","wrong","correct","correct","correct","correct","correct"],
  // Three of twelve right is roughly what blind guessing yields on 4 choices.
  guessing: ["wrong","correct","wrong","wrong","wrong","correct","wrong","wrong","correct","wrong","wrong","wrong"],
  idk: Array(12).fill("idk") as Outcome[],
};

const CUSTOM_CYCLE: Outcome[] = ["idk", "correct", "wrong"];

const STRATEGIES: { key: Strategy; label: string; blurb: string }[] = [
  { key: "studied",  label: "Knows the material", blurb: "Answers confidently and is usually right." },
  { key: "guessing", label: "Guessing every time", blurb: "Picks at random from four choices." },
  { key: "idk",      label: "Answers “I don’t know”", blurb: "Declines rather than guessing." },
  { key: "custom",   label: "Choose your own", blurb: "Click each question below to set its result yourself." },
];

const OUTCOME_META: Record<Outcome, { label: string; icon: string; className: string }> = {
  correct: { label: "Correct", icon: "✓", className: "ok" },
  wrong:   { label: "Wrong",   icon: "✕", className: "bad" },
  idk:     { label: "Skipped", icon: "–", className: "idk" },
};

type Totals = { earned: number; possible: number; raw: number | null; display: number | null };

function totalsFor(outcomes: Outcome[], steps: number, reward: number): Totals {
  let earned = 0;
  let possible = 0;
  for (let i = 0; i < steps; i++) {
    const q = SAMPLE[i];
    const outcome = outcomes[i];
    const weight = q.bookWeight * TIER_FACTOR[q.tier];
    possible += weight;
    earned += outcome === "correct" ? weight * reward : outcome === "wrong" ? -weight * (1 / 3) : 0;
  }
  if (possible <= 0) return { earned, possible, raw: null, display: null };
  const raw = Math.max(0, Math.min(100, (earned / possible) * 100));
  return { earned, possible, raw, display: Math.max(0, Math.min(800, Math.round(raw * 8))) };
}

export default function ScoringLab() {
  const [strategy, setStrategy] = useState<Strategy>("studied");
  const [reward, setReward] = useState(1.0);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [customOutcomes, setCustomOutcomes] = useState<Outcome[]>(
    () => Array(SAMPLE.length).fill("idk") as Outcome[],
  );

  const isCustom = strategy === "custom";
  const activeOutcomes = isCustom ? customOutcomes : OUTCOMES[strategy];
  // Custom mode has no scripted playback: every question is visible and
  // editable immediately, so "step" always covers the full sample.
  const effectiveStep = isCustom ? SAMPLE.length : step;
  const done = isCustom ? true : step >= SAMPLE.length;
  const customAnswered = useMemo(
    () => customOutcomes.filter(o => o !== "idk").length,
    [customOutcomes],
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (isCustom || !running || step >= SAMPLE.length) return;
    const id = window.setTimeout(() => {
      const next = step + 1;
      setStep(next);
      if (next >= SAMPLE.length) setRunning(false);
    }, reduced ? 120 : 620);
    return () => window.clearTimeout(id);
  }, [isCustom, reduced, running, step]);

  const reset = useCallback(() => {
    if (isCustom) {
      setCustomOutcomes(Array(SAMPLE.length).fill("idk") as Outcome[]);
      return;
    }
    setRunning(false);
    setStep(0);
  }, [isCustom]);

  const pickStrategy = useCallback((key: Strategy) => {
    setStrategy(key);
    setRunning(false);
    setStep(key === "custom" ? SAMPLE.length : 0);
  }, []);

  const cycleOutcome = useCallback((index: number) => {
    setCustomOutcomes(prev => {
      const next = [...prev];
      const at = CUSTOM_CYCLE.indexOf(next[index]);
      next[index] = CUSTOM_CYCLE[(at + 1) % CUSTOM_CYCLE.length];
      return next;
    });
  }, []);

  const totals = totalsFor(activeOutcomes, effectiveStep, reward);
  const band = totals.display === null ? null : BLI_LEVELS.find(b => b.name === levelForScore(totals.display!)) ?? null;
  const rewardNote = reward >= 1.06 ? "extra credit" : reward <= 0.94 ? "reduced credit" : null;

  return (
    <div className="lab">
      <style>{`
        .lab {
          border: 1px solid rgba(255,255,255,.14); border-radius: 16px; overflow: hidden;
          background: linear-gradient(160deg, rgba(13,19,38,.96), rgba(9,13,28,.98));
          box-shadow: 0 24px 60px rgba(0,0,0,.42);
        }
        .lab-header {
          display: flex; align-items: center; gap: 10px; padding: 14px 16px;
          background: rgba(255,255,255,.04); border-bottom: 1px solid rgba(255,255,255,.1);
        }
        .lab-eyebrow {
          font-size: 12.5px; font-weight: 750; color: rgba(255,255,255,.75);
        }
        .lab-tag {
          margin-left: auto; font-size: 9.5px; font-weight: 800; letter-spacing: .1em;
          text-transform: uppercase; color: rgba(255,255,255,.4);
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14);
          border-radius: 999px; padding: 3px 9px;
        }
        .lab-controls {
          display: flex; flex-wrap: wrap; gap: 8px; padding: 14px;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .lab-strat {
          flex: 1 1 150px; text-align: left; cursor: pointer; font-family: inherit;
          padding: 10px 12px; border-radius: 10px;
          background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.62); transition: background .15s, border-color .15s, color .15s;
        }
        .lab-strat b { display: block; font-size: 12.5px; font-weight: 750; }
        .lab-strat span { display: block; font-size: 11px; margin-top: 2px; opacity: .7; }
        .lab-strat:hover { background: rgba(255,255,255,.08); color: #fff; }
        .lab-strat.on { border-color: #0aa3a3; background: rgba(10,163,163,.14); color: #fff; }
        .lab-strat:focus-visible, .lab-btn:focus-visible, .lab-range:focus-visible, .lab-row-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
        .lab-run { display: flex; align-items: center; gap: 10px; padding: 12px 14px; flex-wrap: wrap; border-bottom: 1px solid rgba(255,255,255,.08); }
        .lab-btn {
          display: inline-flex; align-items: center; gap: 7px; cursor: pointer; font-family: inherit;
          padding: 8px 15px; border-radius: 999px; font-size: 12.5px; font-weight: 700;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16); color: #fff;
          transition: background .15s;
        }
        .lab-btn:hover:not(:disabled) { background: rgba(255,255,255,.15); }
        .lab-btn:disabled { opacity: .35; cursor: not-allowed; }
        .lab-btn.primary { background: #0aa3a3; border-color: transparent; }
        .lab-btn.primary:hover:not(:disabled) { background: #089090; }
        .lab-btn svg { width: 13px; height: 13px; }
        .lab-hint { font-size: 12.5px; color: rgba(255,255,255,.55); line-height: 1.5; }
        .lab-reward { display: flex; align-items: center; gap: 9px; margin-left: auto; font-size: 12px; color: rgba(255,255,255,.55); }
        .lab-reward b { color: #fff; font-weight: 750; }
        .lab-range { width: 110px; accent-color: #0aa3a3; }
        .lab-rows {
          padding: 12px; display: flex; flex-direction: column; gap: 7px;
          min-height: 120px;
        }
        .lab-row {
          display: flex; align-items: center; gap: 12px; padding: 9px 12px;
          border-radius: 10px; border: 1px solid rgba(255,255,255,.09);
          background: rgba(255,255,255,.025);
          animation: rowIn .22s ease both;
        }
        .lab-row.ok   { border-color: rgba(74,222,128,.32); background: rgba(74,222,128,.07); }
        .lab-row.bad  { border-color: rgba(248,113,113,.32); background: rgba(248,113,113,.07); }
        .lab-row.idk  { border-color: rgba(167,139,250,.28); background: rgba(167,139,250,.06); }
        @keyframes rowIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
        .lab-row-icon {
          flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
          display: grid; place-items: center; font-size: 13px; font-weight: 800;
        }
        .lab-row.ok .lab-row-icon  { background: rgba(74,222,128,.18); color: #4ade80; }
        .lab-row.bad .lab-row-icon { background: rgba(248,113,113,.18); color: #f87171; }
        .lab-row.idk .lab-row-icon { background: rgba(167,139,250,.18); color: #a78bfa; }
        .lab-row-ref { flex: 1 1 auto; min-width: 0; }
        .lab-row-ref b {
          display: block; font-size: 13.5px; font-weight: 700; color: #fff;
          font-family: var(--font-crimson), Georgia, serif;
        }
        .lab-row-bar {
          margin-top: 5px; height: 4px; width: 100%; max-width: 160px; border-radius: 999px;
          background: rgba(255,255,255,.1); overflow: hidden;
        }
        .lab-row-bar i { display: block; height: 100%; background: rgba(255,255,255,.4); border-radius: 999px; }
        .lab-row.ok .lab-row-bar i  { background: #4ade80; }
        .lab-row.bad .lab-row-bar i { background: #f87171; }
        .lab-row.idk .lab-row-bar i { background: #a78bfa; }
        .lab-row-tier {
          flex-shrink: 0; font-size: 10px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase;
          color: rgba(255,255,255,.4);
        }
        .lab-row-outcome {
          flex-shrink: 0; display: flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 750;
        }
        .lab-row.ok .lab-row-outcome  { color: #4ade80; }
        .lab-row.bad .lab-row-outcome { color: #f87171; }
        .lab-row.idk .lab-row-outcome { color: #a78bfa; }
        .lab-row-bonus {
          font-size: 9.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;
          color: rgba(255,255,255,.4); border: 1px solid rgba(255,255,255,.16); border-radius: 999px;
          padding: 1px 6px;
        }
        .lab-row-btn {
          width: 100%; text-align: left; cursor: pointer; font: inherit; color: inherit;
          background: transparent; border: none; padding: 0; display: contents;
        }
        .lab-row-cycle { flex-shrink: 0; font-size: 10.5px; color: rgba(255,255,255,.32); }
        .lab-row.idk .lab-row-btn:hover ~ *, .lab-row:has(.lab-row-btn):hover { background: rgba(255,255,255,.05); }
        .lab-empty {
          display: grid; place-items: center; min-height: 100px; padding: 20px;
          color: rgba(255,255,255,.4); font-size: 12.5px; text-align: center;
        }
        .lab-waiting {
          display: flex; align-items: center; gap: 8px; padding: 6px 12px;
          color: rgba(255,255,255,.32); font-size: 11.5px;
        }
        .lab-waiting-dot {
          width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.4);
          animation: pulse 1.1s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100% { opacity: .25; } 50% { opacity: .9; } }
        .lab-score {
          display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
          padding: 16px; border-top: 1px solid rgba(255,255,255,.1);
          background: rgba(255,255,255,.02);
        }
        .lab-score-num {
          flex-shrink: 0; text-align: center; min-width: 92px;
        }
        .lab-score-num b {
          display: block; font-size: 32px; line-height: 1; font-weight: 750;
          font-family: var(--font-crimson), Georgia, serif; color: #fff;
        }
        .lab-score-num span {
          display: block; margin-top: 3px; font-size: 10px; font-weight: 800;
          letter-spacing: .07em; text-transform: uppercase; color: rgba(255,255,255,.4);
        }
        .lab-score-detail { flex: 1 1 220px; min-width: 0; }
        .lab-band-pill {
          display: inline-flex; align-items: center; gap: 7px; padding: 4px 11px; border-radius: 999px;
          font-size: 11.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase;
          margin-bottom: 5px;
        }
        .lab-score-copy { font-size: 12.5px; color: rgba(255,255,255,.55); line-height: 1.55; }
        .lab-note {
          margin: 0; padding: 10px 16px 16px; font-size: 12.5px; line-height: 1.55; color: rgba(255,255,255,.55);
        }
        @media (prefers-reduced-motion: reduce) {
          .lab-row, .lab-waiting-dot { animation: none !important; }
        }
        @media (max-width: 620px) {
          .lab-reward { margin-left: 0; }
          .lab-row-bar { max-width: 90px; }
        }
      `}</style>

      <div className="lab-header">
        <span className="lab-eyebrow">Sample run</span>
        <span className="lab-tag">Illustrative — 12 questions</span>
      </div>

      <div className="lab-controls" role="group" aria-label="Choose how the sample candidate answers">
        {STRATEGIES.map(s => (
          <button
            key={s.key}
            type="button"
            className={`lab-strat${strategy === s.key ? " on" : ""}`}
            aria-pressed={strategy === s.key}
            onClick={() => pickStrategy(s.key)}
          >
            <b>{s.label}</b>
            <span>{s.blurb}</span>
          </button>
        ))}
      </div>

      <div className="lab-run">
        {isCustom ? (
          <>
            <span className="lab-hint">
              {customAnswered === 0
                ? "Every question below starts as “I don’t know.” Click one to mark it correct or wrong."
                : `${customAnswered} of ${SAMPLE.length} questions set. Click any question to change it.`}
            </span>
            <button type="button" className="lab-btn" onClick={reset} disabled={customAnswered === 0}>
              Reset to skipped
            </button>
          </>
        ) : (
          <>
            <button type="button" className="lab-btn primary" onClick={() => (done ? (setStep(0), setRunning(true)) : setRunning(r => !r))}>
              {running ? (
                <><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>Pause</>
              ) : (
                <><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>{done ? "Run again" : step > 0 ? "Resume" : "Run"}</>
              )}
            </button>
            <button type="button" className="lab-btn" onClick={() => { setRunning(false); setStep(s => Math.min(SAMPLE.length, s + 1)); }} disabled={done}>
              Step
            </button>
            <button type="button" className="lab-btn" onClick={reset} disabled={step === 0}>Reset</button>
          </>
        )}
        <label className="lab-reward">
          Credit for a hard question: <b>×{reward.toFixed(2)}</b>
          <input
            className="lab-range" type="range" min={0.7} max={1.25} step={0.05}
            value={reward} onChange={e => setReward(Number(e.target.value))}
            aria-label="Extra credit for a harder question"
          />
        </label>
      </div>

      <div className="lab-rows" role="list" aria-label="Sample questions and results">
        {effectiveStep === 0 && (
          <div className="lab-empty">Press Run to work through the sample, one question at a time.</div>
        )}
        {SAMPLE.slice(0, effectiveStep).map((q, i) => {
          const outcome = activeOutcomes[i];
          const meta = OUTCOME_META[outcome];
          const weight = q.bookWeight * TIER_FACTOR[q.tier];
          const barPct = Math.max(6, Math.round((weight / MAX_WEIGHT) * 100));
          const row = (
            <>
              <span className="lab-row-icon" aria-hidden="true">{meta.icon}</span>
              <span className="lab-row-ref">
                <b>{q.ref}</b>
                <span className="lab-row-bar" aria-hidden="true"><i style={{ width: `${barPct}%` }} /></span>
              </span>
              <span className="lab-row-tier">{TIER_LABEL[q.tier]}</span>
              <span className="lab-row-outcome">
                {meta.label}
                {outcome === "correct" && rewardNote && <span className="lab-row-bonus">{rewardNote}</span>}
              </span>
              {isCustom && <span className="lab-row-cycle" aria-hidden="true">click to change ↻</span>}
            </>
          );
          if (isCustom) {
            return (
              <div className={`lab-row ${meta.className}`} key={q.ref} role="listitem">
                <button
                  type="button"
                  className="lab-row-btn"
                  onClick={() => cycleOutcome(i)}
                  aria-label={`${q.ref}, ${TIER_LABEL[q.tier]} importance, currently ${outcome === "idk" ? "skipped" : meta.label.toLowerCase()}. Click to cycle to the next result.`}
                >
                  {row}
                </button>
              </div>
            );
          }
          return (
            <div className={`lab-row ${meta.className}`} key={q.ref} role="listitem">
              {row}
            </div>
          );
        })}
        {!isCustom && !done && effectiveStep > 0 && (
          <div className="lab-waiting"><span className="lab-waiting-dot" aria-hidden="true" />Next question…</div>
        )}
      </div>

      <div className="lab-score">
        <div className="lab-score-num">
          <b>{totals.display ?? "—"}</b>
          <span>of 800</span>
        </div>
        <div className="lab-score-detail">
          {band ? (
            <>
              <span className="lab-band-pill" style={{ background: `${band.color}26`, border: `1px solid ${band.color}80`, color: "#fff" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: band.color }} />
                {band.name}
              </span>
              <p className="lab-score-copy">{band.description}</p>
            </>
          ) : (
            <p className="lab-score-copy">
              {effectiveStep === 0
                ? "The score builds up as each question is answered — some questions move it more than others."
                : "Every answer so far is cautious: nothing earned yet, nothing lost either."}
            </p>
          )}
        </div>
      </div>

      {done && strategy === "guessing" && (
        <p className="lab-note">
          Guessing lands near zero, not the ~25% you&rsquo;d expect from four-choice odds: a wrong
          answer costs a third of what a correct one earns, and that penalty erases most of a random hit rate.
        </p>
      )}
      {done && strategy === "idk" && (
        <p className="lab-note">
          &ldquo;I don&rsquo;t know&rdquo; holds the score at zero rather than pulling it down — it
          records honest uncertainty instead of guessing, with no credit and no penalty.
        </p>
      )}
    </div>
  );
}
