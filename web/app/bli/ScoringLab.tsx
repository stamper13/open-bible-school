"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BLI_LEVELS, levelForScore } from "@/lib/bli";

/**
 * An executable walkthrough of the scoring model documented on this page.
 *
 * The arithmetic here mirrors the documented formula exactly:
 *   weight   = book_weight * importance_factor
 *   correct  = +weight * difficulty_reward
 *   wrong    = -weight * (1/3)
 *   "I don't know" contributes nothing and is excluded from the denominator,
 *   matching the scoring filter in the live app.
 *
 * The question list is a fixed sample, not a real assessment.
 */

type Strategy = "studied" | "guessing" | "idk";
type Outcome = "correct" | "wrong" | "idk";

const TIER_FACTOR: Record<number, number> = { 1: 1.0, 2: 0.6, 3: 0.35 };

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

/** Fixed outcomes per strategy so a run is reproducible rather than flickering. */
const OUTCOMES: Record<Strategy, Outcome[]> = {
  studied: ["correct","correct","correct","wrong","correct","correct","wrong","correct","correct","correct","correct","correct"],
  // Three of twelve right is roughly what blind guessing yields on 4 choices.
  guessing: ["wrong","correct","wrong","wrong","wrong","correct","wrong","wrong","correct","wrong","wrong","wrong"],
  idk: Array(12).fill("idk") as Outcome[],
};

const STRATEGIES: { key: Strategy; label: string; blurb: string }[] = [
  { key: "studied",  label: "Knows the material", blurb: "Answers confidently and is usually right." },
  { key: "guessing", label: "Guessing every time", blurb: "Picks at random from four choices." },
  { key: "idk",      label: "Answers “I don’t know”", blurb: "Declines rather than guessing." },
];

type Totals = { earned: number; possible: number; raw: number | null; display: number | null };

function totalsAt(strategy: Strategy, steps: number, reward: number): Totals {
  let earned = 0;
  let possible = 0;
  for (let i = 0; i < steps; i++) {
    const q = SAMPLE[i];
    const outcome = OUTCOMES[strategy][i];
    const weight = q.bookWeight * TIER_FACTOR[q.tier];
    if (outcome === "idk") continue; // excluded from evidence entirely
    possible += weight;
    earned += outcome === "correct" ? weight * reward : -weight * (1 / 3);
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
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!running || step >= SAMPLE.length) return;
    const id = window.setTimeout(() => {
      const next = step + 1;
      setStep(next);
      if (next >= SAMPLE.length) setRunning(false);
    }, reduced ? 120 : 620);
    return () => window.clearTimeout(id);
  }, [reduced, running, step]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [step]);

  const reset = useCallback(() => { setRunning(false); setStep(0); }, []);
  const pickStrategy = useCallback((key: Strategy) => { setStrategy(key); setStep(0); setRunning(false); }, []);

  const totals = totalsAt(strategy, step, reward);
  const done = step >= SAMPLE.length;
  const band = totals.display === null ? null : BLI_LEVELS.find(b => b.name === levelForScore(totals.display!)) ?? null;

  return (
    <div className="lab">
      <style>{`
        .lab {
          --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
          border: 1px solid rgba(255,255,255,.14); border-radius: 16px; overflow: hidden;
          background: linear-gradient(160deg, rgba(13,19,38,.96), rgba(9,13,28,.98));
          box-shadow: 0 24px 60px rgba(0,0,0,.42);
        }
        .lab-chrome {
          display: flex; align-items: center; gap: 8px; padding: 10px 14px;
          background: rgba(255,255,255,.04); border-bottom: 1px solid rgba(255,255,255,.1);
        }
        .lab-dot { width: 10px; height: 10px; border-radius: 50%; }
        .lab-file {
          margin-left: 8px; font-family: var(--mono); font-size: 11.5px;
          color: rgba(255,255,255,.42); letter-spacing: .02em;
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
        .lab-strat:focus-visible, .lab-btn:focus-visible, .lab-range:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
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
        .lab-reward { display: flex; align-items: center; gap: 9px; margin-left: auto; font-family: var(--mono); font-size: 11.5px; color: rgba(255,255,255,.5); }
        .lab-range { width: 110px; accent-color: #0aa3a3; }
        .lab-log {
          font-family: var(--mono); font-size: 12px; line-height: 1.75;
          padding: 14px; height: 260px; overflow-y: auto;
          background: rgba(0,0,0,.28); color: rgba(255,255,255,.72);
          scrollbar-width: thin;
        }
        .lab-line { white-space: pre-wrap; word-break: break-word; animation: labIn .2s ease both; }
        @keyframes labIn { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: none; } }
        .c-key { color: #6fe0e0; }
        .c-num { color: #f0c674; }
        .c-ok { color: #4ade80; }
        .c-bad { color: #f87171; }
        .c-dim { color: rgba(255,255,255,.34); }
        .c-idk { color: #a78bfa; }
        .lab-cursor {
          display: inline-block; width: 7px; height: 14px; vertical-align: -2px;
          background: #6fe0e0; animation: labBlink 1.05s steps(2) infinite;
        }
        @keyframes labBlink { 0%,50% { opacity: 1; } 50.01%,100% { opacity: 0; } }
        .lab-out {
          display: grid; grid-template-columns: repeat(4, minmax(0,1fr));
          border-top: 1px solid rgba(255,255,255,.1);
        }
        .lab-cell { padding: 13px 14px; border-right: 1px solid rgba(255,255,255,.07); }
        .lab-cell:last-child { border-right: 0; }
        .lab-cell i {
          display: block; font-style: normal; font-family: var(--mono);
          font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: rgba(255,255,255,.36);
        }
        .lab-cell b {
          display: block; margin-top: 4px; font-size: 21px; font-weight: 750;
          font-family: var(--font-crimson), Georgia, serif; color: #fff;
        }
        .lab-band { padding: 12px 14px; border-top: 1px solid rgba(255,255,255,.1); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .lab-band-pill {
          display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; border-radius: 999px;
          font-size: 11.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase;
        }
        .lab-band-copy { font-size: 12.5px; color: rgba(255,255,255,.55); line-height: 1.55; flex: 1 1 240px; }
        @media (prefers-reduced-motion: reduce) {
          .lab-line, .lab-cursor { animation: none !important; }
        }
        @media (max-width: 620px) {
          .lab-out { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .lab-cell:nth-child(2) { border-right: 0; }
          .lab-reward { margin-left: 0; }
        }
      `}</style>

      <div className="lab-chrome" aria-hidden="true">
        <span className="lab-dot" style={{ background: "#f87171" }} />
        <span className="lab-dot" style={{ background: "#f0c674" }} />
        <span className="lab-dot" style={{ background: "#4ade80" }} />
        <span className="lab-file">compute_bli.sql — sample run</span>
        <span className="lab-tag">Illustrative</span>
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
        <label className="lab-reward">
          difficulty_reward = <span className="c-num">{reward.toFixed(2)}</span>
          <input
            className="lab-range" type="range" min={1} max={1.5} step={0.05}
            value={reward} onChange={e => setReward(Number(e.target.value))}
            aria-label="Difficulty reward multiplier"
          />
        </label>
      </div>

      <div className="lab-log" ref={logRef} role="log" aria-live="polite" aria-label="Scoring trace">
        <div className="lab-line c-dim">$ compute_bli --sample --strategy={strategy}</div>
        {SAMPLE.slice(0, step).map((q, i) => {
          const outcome = OUTCOMES[strategy][i];
          const factor = TIER_FACTOR[q.tier];
          const weight = q.bookWeight * factor;
          const delta = outcome === "idk" ? 0 : outcome === "correct" ? weight * reward : -weight * (1 / 3);
          return (
            <div className="lab-line" key={q.ref}>
              <span className="c-dim">[{String(i + 1).padStart(2, "0")}]</span>{" "}
              <span className="c-key">eval</span> {q.ref}{" "}
              <span className="c-dim">tier=</span><span className="c-num">{q.tier}</span>{" "}
              <span className="c-dim">w=</span><span className="c-num">{q.bookWeight.toFixed(2)}</span>
              <span className="c-dim">×</span><span className="c-num">{factor.toFixed(2)}</span>
              <span className="c-dim">=</span><span className="c-num">{weight.toFixed(3)}</span>{" "}
              {outcome === "correct" && <span className="c-ok">CORRECT +{delta.toFixed(3)}</span>}
              {outcome === "wrong" && <span className="c-bad">WRONG {delta.toFixed(3)}</span>}
              {outcome === "idk" && <span className="c-idk">IDK — excluded from evidence</span>}
            </div>
          );
        })}
        {step > 0 && (
          <div className="lab-line c-dim">
            {"  "}Σ earned=<span className="c-num">{totals.earned.toFixed(3)}</span>{"  "}
            possible=<span className="c-num">{totals.possible.toFixed(3)}</span>{"  "}
            raw=<span className="c-num">{totals.raw === null ? "null" : totals.raw.toFixed(1)}</span>{"  "}
            display=<span className="c-num">{totals.display === null ? "null" : totals.display}</span>
          </div>
        )}
        {done && strategy === "guessing" && (
          <div className="lab-line c-bad">{"// "}guessing nets ~0: the −1/3 penalty cancels a 1-in-4 hit rate.</div>
        )}
        {done && strategy === "idk" && (
          <div className="lab-line c-idk">{"// "}no evidence recorded — the model reports nothing rather than zero.</div>
        )}
        {!done && <span className="lab-cursor" aria-hidden="true" />}
      </div>

      <div className="lab-out">
        <div className="lab-cell"><i>weighted_earned</i><b>{totals.earned.toFixed(2)}</b></div>
        <div className="lab-cell"><i>weighted_possible</i><b>{totals.possible.toFixed(2)}</b></div>
        <div className="lab-cell"><i>raw BLI (0–100)</i><b>{totals.raw === null ? "—" : totals.raw.toFixed(1)}</b></div>
        <div className="lab-cell"><i>display (0–800)</i><b>{totals.display === null ? "—" : totals.display}</b></div>
      </div>

      <div className="lab-band">
        {band ? (
          <>
            <span className="lab-band-pill" style={{ background: `${band.color}26`, border: `1px solid ${band.color}80`, color: "#fff" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: band.color }} />
              {band.name}
            </span>
            <span className="lab-band-copy">{band.description}</span>
          </>
        ) : (
          <span className="lab-band-copy">
            {step === 0 ? "Press Run to execute the model over a twelve-question sample." : "No scoring evidence yet — every answer so far was “I don’t know”."}
          </span>
        )}
      </div>
    </div>
  );
}
