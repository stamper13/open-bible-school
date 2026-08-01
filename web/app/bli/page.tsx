"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BLI_LEVELS, levelForScore } from "@/lib/bli";
import ScoringLab from "./ScoringLab";

const MECHANICS = [
  {
    title: "Book weight",
    copy: "Some books carry more structural weight because later biblical material depends heavily on them.",
    variable: "book_weight",
    range: "0.70 – 1.00",
    note: "Genesis and Exodus sit near the top because the rest of the canon keeps referring back to them.",
  },
  {
    title: "Passage importance",
    copy: "Questions tied to highly significant events and passages count more than lower-level detail.",
    variable: "importance_factor",
    range: "1.00 / 0.60 / 0.35",
    note: "Tier 1 material is the storyline itself. Tier 3 is supporting detail — real, but not load-bearing.",
  },
  {
    title: "Difficulty",
    copy: "Correct answers to harder questions can earn more credit; missed questions can reduce confidence.",
    variable: "difficulty_reward",
    range: "1.00 – 1.50",
    note: "Getting a hard question right is stronger evidence than getting an easy one right.",
  },
  {
    title: "Evidence volume",
    copy: "A small sample can be useful, but repeated answers across sections make the estimate more stable.",
    variable: "n_responses",
    range: "unbounded",
    note: "Volume does not raise the score on its own. It narrows the uncertainty around it.",
  },
];

export default function BliMechanicsPage() {
  const [probe, setProbe] = useState(560);
  const [openMechanic, setOpenMechanic] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const skip = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let frame = 0;

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random(), y: Math.random(),
      r: (0.5 + Math.random() * 1.4) * DPR,
      opacity: 0.3 + Math.random() * 0.5,
      speed: 0.002 + Math.random() * 0.004,
      offset: Math.random() * Math.PI * 2,
    }));

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth * DPR;
      canvas.height = window.innerHeight * DPR;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width, h = canvas.height;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#0b0f1e"); g.addColorStop(0.5, "#111827"); g.addColorStop(1, "#0d1530");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const neb = ctx.createRadialGradient(w * 0.2, h * 0.25, 0, w * 0.2, h * 0.25, w * 0.42);
      neb.addColorStop(0, "rgba(10,163,163,0.07)"); neb.addColorStop(1, "transparent");
      ctx.fillStyle = neb; ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        const tw = skip ? 1 : 0.6 + 0.4 * Math.sin(frame * s.speed + s.offset);
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${s.opacity * tw})`;
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      frame++;
      if (!skip) raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const probeBand = BLI_LEVELS.find(b => b.name === levelForScore(probe)) ?? BLI_LEVELS[0];

  return (
    <>
      <style>{`
        :root {
          --muted: #566070; --navy: #1b2442;
          --accent: #0aa3a3; --accent-dim: rgba(10,163,163,.12);
          --accent-line: rgba(10,163,163,.26);
          --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; scroll-behavior: smooth; }
        body {
          font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
          color: #fff; background: #0b0f1e; min-height: 100vh; overflow-x: hidden;
        }
        canvas.stars { position: fixed; inset: 0; z-index: 0; pointer-events: none; }

        .beta-banner {
          position: relative; z-index: 1;
          background: rgba(124,58,237,.12); border-bottom: 1px solid rgba(124,58,237,.28);
          padding: 9px 32px; display: flex; align-items: center; justify-content: center;
          gap: 10px; font-size: 13px; color: #d8c7fb; text-align: center;
        }
        .beta-badge {
          font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
          background: #7c3aed; color: #fff; padding: 2px 7px; border-radius: 4px; flex-shrink: 0;
        }
        .nav {
          position: sticky; top: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 32px; background: rgba(11,15,30,.85);
          backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .nav-brand {
          font-family: var(--font-crimson), Georgia, serif; font-weight: 600; font-size: 18px;
          color: #fff; text-decoration: none; letter-spacing: .01em;
        }
        .nav-links { display: flex; align-items: center; gap: 6px; }
        .nav-link {
          padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 500;
          color: rgba(255,255,255,.6); text-decoration: none; transition: color .14s, background .14s;
        }
        .nav-link:hover { color: #fff; background: rgba(255,255,255,.08); }
        .nav-btn {
          display: flex; align-items: center; gap: 7px; padding: 8px 18px; border-radius: 999px;
          font-size: 13px; font-weight: 600; background: rgba(255,255,255,.92); color: var(--navy);
          text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 4px 14px rgba(0,0,0,.3); transition: background .15s, transform .13s;
        }
        .nav-btn:hover { background: #fff; transform: translateY(-1px); }
        .nav-link:focus-visible, .nav-btn:focus-visible, .nav-brand:focus-visible {
          outline: 2px solid rgba(255,255,255,.65); outline-offset: 3px; border-radius: 6px;
        }

        .page { position: relative; z-index: 1; max-width: 780px; margin: 0 auto; padding: 60px 24px 96px; }
        .hero { margin-bottom: 56px; }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          border-radius: 999px; padding: 5px 14px; font-size: 12px; font-weight: 700;
          letter-spacing: .06em; text-transform: uppercase; color: #6fe0e0; margin-bottom: 20px;
        }
        .hero-eyebrow::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
        .hero-heading {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(32px, 5vw, 48px); font-weight: 600; line-height: 1.12;
          color: #fff; margin-bottom: 20px;
        }
        .hero-heading em { font-style: italic; color: #4fd6d6; }
        .hero-lead { font-size: 16.5px; line-height: 1.75; color: rgba(255,255,255,.64); max-width: 640px; }

        .section { margin-bottom: 58px; }
        .section-label { font-size: 11px; font-weight: 700; letter-spacing: .10em; text-transform: uppercase; color: #4fd6d6; margin-bottom: 12px; }
        .section-heading { font-family: var(--font-crimson), Georgia, serif; font-size: 26px; font-weight: 600; line-height: 1.2; color: #fff; margin-bottom: 16px; }
        .section-body { font-size: 15.5px; line-height: 1.80; color: rgba(255,255,255,.66); }
        .section-body p + p { margin-top: 14px; }
        .section-body strong { color: #fff; font-weight: 650; }
        .rule { border: none; border-top: 1px solid rgba(255,255,255,.09); margin: 56px 0; }

        .mechanic-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; margin-top: 22px; }
        .mechanic-card {
          text-align: left; cursor: pointer; font-family: inherit; display: block;
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12);
          border-radius: 12px; padding: 18px; color: inherit;
          transition: background .15s, border-color .15s, transform .13s;
        }
        .mechanic-card:hover { background: rgba(255,255,255,.09); transform: translateY(-2px); }
        .mechanic-card[aria-expanded="true"] { border-color: var(--accent-line); background: rgba(10,163,163,.10); }
        .mechanic-card:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
        .mechanic-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .mechanic-title { color: #fff; font-size: 13px; font-weight: 760; letter-spacing: .05em; text-transform: uppercase; }
        .mechanic-var { font-family: var(--mono); font-size: 10.5px; color: #6fe0e0; white-space: nowrap; }
        .mechanic-copy { display: block; color: rgba(255,255,255,.6); font-size: 13.5px; line-height: 1.6; margin-top: 9px; }
        .mechanic-more {
          display: block; margin-top: 11px; padding-top: 11px;
          border-top: 1px solid rgba(255,255,255,.1);
          font-size: 12.5px; line-height: 1.6; color: rgba(255,255,255,.55);
        }
        .mechanic-range { font-family: var(--mono); font-size: 11px; color: #f0c674; display: block; margin-bottom: 5px; }

        .formula-block {
          background: rgba(0,0,0,.34); border: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.78); border-radius: 14px;
          padding: 22px 24px; font-family: var(--mono);
          font-size: 12.5px; line-height: 1.85; overflow-x: auto; margin: 22px 0;
        }
        .formula-block strong { color: #6fe0e0; font-weight: 700; }
        .formula-block em { color: #f0c674; font-style: normal; }
        .note {
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12);
          border-left: 3px solid var(--accent); border-radius: 12px; padding: 18px 20px;
          font-size: 14px; line-height: 1.70; color: rgba(255,255,255,.64);
        }
        .note strong { color: #fff; font-weight: 700; }

        .probe {
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12);
          border-radius: 14px; padding: 20px 22px; margin: 22px 0 18px;
        }
        .probe-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .probe-score {
          font-family: var(--font-crimson), Georgia, serif; font-size: 38px; font-weight: 700;
          color: #fff; line-height: 1; font-variant-numeric: tabular-nums;
        }
        .probe-pill {
          display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; border-radius: 999px;
          font-size: 11.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: #fff;
        }
        .probe-track { display: flex; height: 12px; border-radius: 999px; overflow: hidden; }
        .probe-seg { height: 100%; transition: opacity .15s; }
        .probe-input {
          -webkit-appearance: none; appearance: none; width: 100%; height: 26px;
          background: transparent; margin-top: -19px; position: relative; z-index: 2; cursor: pointer; display: block;
        }
        .probe-input::-webkit-slider-thumb {
          -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%;
          background: #fff; border: 3px solid var(--accent); cursor: grab;
          box-shadow: 0 3px 10px rgba(0,0,0,.5);
        }
        .probe-input::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%; background: #fff;
          border: 3px solid var(--accent); cursor: grab; box-shadow: 0 3px 10px rgba(0,0,0,.5);
        }
        .probe-input:focus-visible { outline: 2px solid #fff; outline-offset: 4px; border-radius: 999px; }
        .probe-scale { display: flex; justify-content: space-between; font-family: var(--mono); font-size: 10.5px; color: rgba(255,255,255,.35); margin-top: 4px; }
        .probe-copy { font-size: 13.5px; line-height: 1.65; color: rgba(255,255,255,.62); margin-top: 14px; }

        .levels { display: grid; gap: 8px; margin-top: 20px; }
        .level-row {
          display: grid; grid-template-columns: 140px 100px 1fr; align-items: center; gap: 12px;
          background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
          border-radius: 10px; padding: 11px 13px; transition: background .15s, border-color .15s;
        }
        .level-row.on { background: rgba(10,163,163,.12); border-color: var(--accent-line); }
        .level-name { font-weight: 700; color: #fff; font-size: 14px; display: flex; align-items: center; gap: 8px; }
        .level-swatch { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .level-range { font-family: var(--mono); font-size: 12px; color: rgba(255,255,255,.45); font-variant-numeric: tabular-nums; }
        .level-desc { font-size: 13px; line-height: 1.5; color: rgba(255,255,255,.55); }

        .cta-row { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 48px; }
        .btn-primary, .btn-secondary {
          display: flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 999px;
          font-size: 15px; font-weight: 600; text-decoration: none; cursor: pointer;
          transition: transform .13s, background .15s;
        }
        .btn-primary { background: rgba(255,255,255,.93); color: var(--navy); border: none; box-shadow: 0 10px 28px rgba(0,0,0,.3); }
        .btn-primary:hover { background: #fff; transform: translateY(-2px); }
        .btn-secondary { background: rgba(255,255,255,.06); color: #fff; border: 1px solid rgba(255,255,255,.16); }
        .btn-secondary:hover { background: rgba(255,255,255,.12); transform: translateY(-2px); }
        .btn-primary:focus-visible, .btn-secondary:focus-visible { outline: 2px solid rgba(255,255,255,.7); outline-offset: 3px; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: .001ms !important; animation-iteration-count: 1 !important;
            transition-duration: .001ms !important;
          }
        }
        @media (max-width: 680px) {
          .nav { padding: 13px 16px; }
          .nav-links .nav-link { display: none; }
          .page { padding: 40px 16px 72px; }
          .beta-banner { padding: 9px 16px; font-size: 12px; }
          .mechanic-grid { grid-template-columns: 1fr; }
          .level-row { grid-template-columns: 1fr; gap: 4px; }
          .cta-row { flex-direction: column; }
        }
      `}</style>

      <canvas ref={canvasRef} className="stars" aria-hidden="true" />

      <div className="beta-banner">
        <span className="beta-badge">Beta</span>
        The scoring model and question bank are being refined as the assessment grows.
      </div>

      <nav className="nav">
        <Link className="nav-brand" href="/">Open Bible Assessment</Link>
        <div className="nav-links">
          <Link className="nav-link" href="/">Dashboard</Link>
          <Link className="nav-link" href="/about">About</Link>
          <Link className="nav-link" href="/credential">Future Ideas</Link>
        </div>
        <Link className="nav-btn" href="/">Start Assessment</Link>
      </nav>

      <main className="page">
        <header className="hero">
          <div className="hero-eyebrow">Bible Literacy Index</div>
          <h1 className="hero-heading">How the <em>BLI</em> works</h1>
          <p className="hero-lead">
            The Bible Literacy Index is an adaptive estimate of Scripture content familiarity. It is built from repeated answers across weighted biblical material, then shown on a 0–800 scale. Your score maps to one of seven named levels — Unfamiliar, Acquainted, Familiar, Literate, Studied, Learned, or Scholar — so progress is easy to read over time.
          </p>
        </header>

        <section className="section">
          <p className="section-label">Run it yourself</p>
          <h2 className="section-heading">The model, executing</h2>
          <div className="section-body" style={{ marginBottom: 22 }}>
            <p>
              Below is the scoring model running over a twelve-question sample. Choose how the candidate answers, then run or step through it — the arithmetic is exactly the formula documented further down this page.
            </p>
          </div>

          <ScoringLab />

          <p className="note" style={{ marginTop: 20 }}>
            Try <strong>Guessing every time</strong>: the score lands near zero rather than 25%, because the −1/3 penalty on a wrong answer cancels a one-in-four hit rate. Then try <strong>&ldquo;I don&rsquo;t know&rdquo;</strong> — the model records no evidence at all rather than a bad score. That difference is the whole point of the guessing correction.
          </p>
        </section>

        <hr className="rule" />

        <section className="section">
          <p className="section-label">Short version</p>
          <h2 className="section-heading">A score is evidence, not a verdict</h2>
          <div className="section-body">
            <p>
              The BLI does not try to read the heart, measure wisdom, or prove pastoral readiness. It estimates how well someone knows the content of Scripture: people, events, sequence, major passages, textual details, and the relationships between them.
            </p>
            <p>
              Early scores are provisional because they rest on fewer answers. As more evidence accumulates, the profile becomes more useful. The aim is not to produce a permanent label, but to make learning more honest and better directed.
            </p>
          </div>
        </section>

        <section className="section">
          <p className="section-label">Inputs</p>
          <h2 className="section-heading">What affects the score</h2>
          <div className="section-body">
            <p>
              Not every question carries the same value. The model gives more weight to material that is more central to the structure and storyline of Scripture, while still sampling enough breadth to expose gaps. Select any input to see the variable it maps to.
            </p>
          </div>
          <div className="mechanic-grid">
            {MECHANICS.map((m, i) => (
              <button
                key={m.title}
                type="button"
                className="mechanic-card"
                aria-expanded={openMechanic === i}
                onClick={() => setOpenMechanic(openMechanic === i ? null : i)}
              >
                <span className="mechanic-top">
                  <span className="mechanic-title">{m.title}</span>
                  <span className="mechanic-var">{m.variable}</span>
                </span>
                <span className="mechanic-copy">{m.copy}</span>
                {openMechanic === i && (
                  <span className="mechanic-more">
                    <span className="mechanic-range">{m.variable} = {m.range}</span>
                    {m.note}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        <hr className="rule" />

        <section className="section">
          <p className="section-label">Adaptive logic</p>
          <h2 className="section-heading">Why the assessment changes as you answer</h2>
          <div className="section-body">
            <p>
              A fixed quiz mostly tells you how you did on that quiz. An adaptive assessment tries to learn where the uncertainty is. If the system has little evidence in a section, or if your answers suggest a possible gap, it can route future questions toward that area.
            </p>
            <p>
              This is why the dashboard matters as much as the single number. The BLI gives a top-level estimate, but the map shows where that estimate is coming from: Torah, Former Prophets, Latter Prophets, Writings, books, and eventually other learning domains.
            </p>
          </div>
        </section>

        <section className="section">
          <p className="section-label">Technical details</p>
          <h2 className="section-heading">The current scoring model</h2>
          <div className="section-body">
            <p>
              The current database model produces a raw score from 0–100, then converts it to the displayed 0–800 scale by multiplying by 8. The model will continue to be refined as the question bank improves, but the present version follows this broad structure.
            </p>
          </div>

          <div className="formula-block">
            <div><strong>Question weight</strong></div>
            <div>weight = <em>book_weight</em> * <em>importance_factor</em></div>
            <br />
            <div><strong>Importance factor</strong></div>
            <div>tier 1 = <em>1.00</em></div>
            <div>tier 2 = <em>0.60</em></div>
            <div>tier 3+ = <em>0.35</em></div>
            <br />
            <div><strong>Guess adjustment</strong></div>
            <div>correct answer = weight * <em>difficulty_reward</em></div>
            <div>wrong answer = -weight * <em>(1/3)</em></div>
            <div>&quot;I don&apos;t know&quot; = <em>0</em></div>
            <br />
            <div><strong>Raw score</strong></div>
            <div>raw BLI = clamp(0, 100, weighted_earned / weighted_possible * 100)</div>
            <br />
            <div><strong>Displayed score</strong></div>
            <div>display BLI = clamp(0, 800, raw BLI * 8)</div>
          </div>

          <p className="note">
            The negative value for wrong answers is a guessing correction. In a four-choice multiple-choice question, random guessing would be right about one time in four. The model therefore treats confident wrong answers differently from choosing &quot;I don&apos;t know.&quot;
          </p>
        </section>

        <section className="section">
          <p className="section-label">Score bands</p>
          <h2 className="section-heading">How to read the 0–800 scale</h2>
          <div className="section-body">
            <p>Drag the marker to see where any score lands.</p>
          </div>

          <div className="probe">
            <div className="probe-head">
              <span className="probe-score">{probe}</span>
              <span
                className="probe-pill"
                style={{ background: `${probeBand.color}30`, border: `1px solid ${probeBand.color}90` }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: probeBand.color }} />
                {probeBand.name}
              </span>
            </div>
            <div className="probe-track" aria-hidden="true">
              {BLI_LEVELS.map(b => (
                <span
                  key={b.name}
                  className="probe-seg"
                  style={{
                    width: `${((b.max - b.min + 1) / 800) * 100}%`,
                    background: b.color,
                    opacity: b.name === probeBand.name ? 1 : 0.3,
                  }}
                />
              ))}
            </div>
            <input
              className="probe-input"
              type="range" min={0} max={800} step={1}
              value={probe}
              onChange={e => setProbe(Number(e.target.value))}
              aria-label="Sample BLI score"
              aria-valuetext={`${probe}, ${probeBand.name}`}
            />
            <div className="probe-scale" aria-hidden="true"><span>0</span><span>400</span><span>800</span></div>
            <p className="probe-copy" role="status" aria-live="polite">{probeBand.description}</p>
          </div>

          <div className="levels">
            {BLI_LEVELS.map((level) => (
              <div className={`level-row${level.name === probeBand.name ? " on" : ""}`} key={level.name}>
                <div className="level-name">
                  <span className="level-swatch" style={{ background: level.color }} />
                  {level.name}
                </div>
                <div className="level-range">{level.min}–{level.max}</div>
                <div className="level-desc">{level.description}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <p className="section-label">Limits</p>
          <h2 className="section-heading">What the BLI does not claim</h2>
          <div className="section-body">
            <p>
              The score is not a measure of holiness, love for God, preaching ability, doctrinal maturity, wisdom, or pastoral qualification. It is a content-knowledge index.
            </p>
            <p>
              That limitation is part of the design. A narrow measurement can be useful precisely because it does not pretend to be everything. The destination is still the real goal: deeper, truer, more fruitful engagement with Scripture. That is the scope — narrow, honest, and useful within it.
            </p>
          </div>
        </section>

        <div className="cta-row">
          <Link className="btn-primary" href="/">Start the assessment</Link>
          <Link className="btn-secondary" href="/about">Read the philosophy</Link>
        </div>
      </main>
    </>
  );
}
