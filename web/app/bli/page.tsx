import Link from "next/link";
import { BLI_LEVELS } from "@/lib/bli";

export default function BliMechanicsPage() {
  return (
    <>
      <style>{`
        :root {
          --ink: #0e1116; --muted: #566070; --navy: #1b2442;
          --accent: #0aa3a3; --accent-dim: rgba(10,163,163,.10);
          --accent-line: rgba(10,163,163,.22); --bg: #f6f8fb;
          --card: rgba(255,255,255,.86); --border: rgba(27,36,66,.09);
          --shadow: 0 22px 58px rgba(18,30,54,.13), 0 4px 14px rgba(18,30,54,.06);
          --shadow-sm: 0 6px 20px rgba(18,30,54,.09);
          --beta: #7c3aed; --beta-bg: #f5f3ff; --beta-line: rgba(124,58,237,.18);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; scroll-behavior: smooth; }
        body {
          font-family: "Inter", system-ui, -apple-system, sans-serif;
          color: var(--ink); background-color: var(--bg);
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='820' height='820'%3E%3Cg fill='none'%3E%3Cpath stroke='%231b2442' stroke-opacity='.038' d='M0 20H820M0 40H820M0 60H820M0 80H820M0 100H820M20 0V820M40 0V820M60 0V820M80 0V820M100 0V820'/%3E%3Cpath stroke='%231b2442' stroke-opacity='.07' stroke-width='1.2' d='M0 100H820M0 200H820M0 300H820M100 0V820M200 0V820M300 0V820M400 0V820M500 0V820'/%3E%3C/g%3E%3C/svg%3E"),
            linear-gradient(180deg, #f9fafc 0%, #f0f4fb 100%);
          background-repeat: repeat;
          background-size: 820px 820px, 100% 100%;
          min-height: 100vh;
        }
        .beta-banner {
          background: var(--beta-bg); border-bottom: 1px solid var(--beta-line);
          padding: 9px 32px; display: flex; align-items: center; justify-content: center;
          gap: 10px; font-size: 13px; color: var(--beta); text-align: center;
        }
        .beta-badge {
          font-size: 10px; font-weight: 800; letter-spacing: .08em;
          text-transform: uppercase; background: var(--beta);
          color: #fff; padding: 2px 7px; border-radius: 4px; flex-shrink: 0;
        }
        .nav {
          position: sticky; top: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 32px; background: rgba(249,250,252,.90);
          backdrop-filter: blur(12px); border-bottom: 1px solid var(--border);
        }
        .nav-brand {
          font-family: "Crimson Pro", Georgia, serif;
          font-weight: 600; font-size: 18px;
          color: var(--navy); text-decoration: none; letter-spacing: .01em;
        }
        .nav-links { display: flex; align-items: center; gap: 6px; }
        .nav-link {
          padding: 7px 14px; border-radius: 999px;
          font-size: 13px; font-weight: 500; color: var(--muted);
          text-decoration: none; transition: color .14s, background .14s;
        }
        .nav-link:hover { color: var(--navy); background: rgba(27,36,66,.05); }
        .nav-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 18px; border-radius: 999px;
          font-size: 13px; font-weight: 600;
          background: var(--navy); color: #fff;
          text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 4px 14px rgba(27,36,66,.22);
          transition: background .15s, transform .13s;
        }
        .nav-btn:hover { background: #253566; transform: translateY(-1px); }
        .page { max-width: 780px; margin: 0 auto; padding: 64px 24px 96px; }
        .hero { margin-bottom: 64px; }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          border-radius: 999px; padding: 5px 14px;
          font-size: 12px; font-weight: 700; letter-spacing: .06em;
          text-transform: uppercase; color: #0a6e6e; margin-bottom: 20px;
        }
        .hero-eyebrow::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
        .hero-heading {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: clamp(34px, 5vw, 50px); font-weight: 600; line-height: 1.12;
          color: var(--navy); letter-spacing: .005em; margin-bottom: 20px;
        }
        .hero-heading em { font-style: italic; color: var(--accent); }
        .hero-lead { font-size: 17px; line-height: 1.75; color: var(--muted); max-width: 620px; }
        .section { margin-bottom: 58px; }
        .section-label { font-size: 11px; font-weight: 700; letter-spacing: .10em; text-transform: uppercase; color: var(--accent); margin-bottom: 12px; }
        .section-heading { font-family: "Crimson Pro", Georgia, serif; font-size: 26px; font-weight: 600; line-height: 1.2; color: var(--navy); margin-bottom: 16px; }
        .section-body { font-size: 15.5px; line-height: 1.80; color: #3a4455; }
        .section-body p + p { margin-top: 14px; }
        .section-body strong { color: var(--navy); font-weight: 650; }
        .rule { border: none; border-top: 1px solid var(--border); margin: 56px 0; }
        .mechanic-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px; margin-top: 22px;
        }
        .mechanic-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 12px; padding: 20px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(8px);
        }
        .mechanic-title {
          color: var(--navy); font-size: 13px; font-weight: 760;
          letter-spacing: .06em; text-transform: uppercase; margin-bottom: 9px;
        }
        .mechanic-copy { color: var(--muted); font-size: 14px; line-height: 1.65; }
        .formula-block {
          background: #101827; color: #e5edf7; border-radius: 14px;
          padding: 22px 24px; box-shadow: var(--shadow-sm);
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          font-size: 13px; line-height: 1.75; overflow-x: auto; margin: 22px 0;
        }
        .formula-block strong { color: #8de6e6; font-weight: 700; }
        .note {
          background: var(--card); border: 1px solid var(--border);
          border-left: 3px solid var(--accent);
          border-radius: 12px; padding: 18px 20px;
          font-size: 14px; line-height: 1.70; color: #3a4455;
          box-shadow: var(--shadow-sm);
        }
        .levels {
          display: grid; gap: 8px; margin-top: 20px;
        }
        .level-row {
          display: grid; grid-template-columns: 120px 95px 1fr;
          align-items: center; gap: 12px;
          background: rgba(255,255,255,.72); border: 1px solid var(--border);
          border-radius: 10px; padding: 10px 12px;
        }
        .level-name { font-weight: 700; color: var(--navy); font-size: 14px; }
        .level-range { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
        .level-desc { font-size: 13px; line-height: 1.45; color: var(--muted); }
        .cta-row { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 48px; }
        .btn-primary {
          display: flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 999px;
          background: var(--navy); color: #fff; font-size: 15px; font-weight: 600;
          text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 10px 28px rgba(27,36,66,.24); transition: background .15s, transform .13s;
        }
        .btn-primary:hover { background: #253566; transform: translateY(-2px); }
        .btn-secondary {
          display: flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 999px;
          background: var(--card); color: var(--navy); font-size: 15px; font-weight: 600;
          text-decoration: none; border: 1px solid var(--border); cursor: pointer;
          backdrop-filter: blur(8px); box-shadow: var(--shadow-sm); transition: transform .13s, box-shadow .15s;
        }
        .btn-secondary:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
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

      <div className="beta-banner">
        <span className="beta-badge">Beta</span>
        The scoring model and question bank are being refined as the assessment grows.
      </div>

      <nav className="nav">
        <Link className="nav-brand" href="/">Open Bible Assessment</Link>
        <div className="nav-links">
          <Link className="nav-link" href="/">Dashboard</Link>
          <Link className="nav-link" href="/about">About</Link>
          <Link className="nav-link" href="/credential">For Churches</Link>
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
              Not every question carries the same value. The model gives more weight to material that is more central to the structure and storyline of Scripture, while still sampling enough breadth to expose gaps.
            </p>
          </div>
          <div className="mechanic-grid">
            <div className="mechanic-card">
              <div className="mechanic-title">Book weight</div>
              <p className="mechanic-copy">Some books carry more structural weight because later biblical material depends heavily on them.</p>
            </div>
            <div className="mechanic-card">
              <div className="mechanic-title">Passage importance</div>
              <p className="mechanic-copy">Questions tied to highly significant events and passages count more than lower-level detail.</p>
            </div>
            <div className="mechanic-card">
              <div className="mechanic-title">Difficulty</div>
              <p className="mechanic-copy">Correct answers to harder questions can earn more credit; missed questions can reduce confidence.</p>
            </div>
            <div className="mechanic-card">
              <div className="mechanic-title">Evidence volume</div>
              <p className="mechanic-copy">A small sample can be useful, but repeated answers across sections make the estimate more stable.</p>
            </div>
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
            <div>weight = book_weight * importance_factor</div>
            <br />
            <div><strong>Importance factor</strong></div>
            <div>tier 1 = 1.00</div>
            <div>tier 2 = 0.60</div>
            <div>tier 3+ = 0.35</div>
            <br />
            <div><strong>Guess adjustment</strong></div>
            <div>correct answer = weight * difficulty_reward</div>
            <div>wrong answer = -weight * (1/3)</div>
            <div>&quot;I don&apos;t know&quot; = 0</div>
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
          <div className="levels">
            {BLI_LEVELS.map((level) => (
              <div className="level-row" key={level.name}>
                <div className="level-name">{level.name}</div>
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
