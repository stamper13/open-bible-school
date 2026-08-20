"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import SiteFooter from "@/components/SiteFooter";
import BetaBanner from "@/components/BetaBanner";
import SiteNav from "@/components/SiteNav";
import { supabase } from "@/lib/supabase/client";
import { BLI_LEVELS, levelForScore } from "@/lib/bli";
import ScoringLab from "./ScoringLab";
import { BLI_PAGE_STYLES } from "./bliStyles";

const MECHANICS = [
  {
    title: "Book weight",
    copy: "Some books carry more structural weight because later biblical material depends heavily on them.",
    variable: "book_weight",
    range: "0.52 – 1.00",
    note: "Genesis and Exodus sit near the top because the rest of the canon keeps referring back to them.",
  },
  {
    title: "Passage importance",
    copy: "Questions tied to highly significant events and passages count more than lower-level detail.",
    variable: "importance_factor",
    range: "1.00 / 0.60 / 0.35",
    note: "Tier 1 material is the main storyline. Tier 3 is supporting detail — accurate, but less central.",
  },
  {
    title: "Difficulty",
    copy: "Correct answers earn more credit on a harder question and less on an easier one — a wrong answer costs the same regardless.",
    variable: "difficulty_reward",
    range: "0.70 – 1.25",
    note: "Getting a hard question right is stronger evidence than getting an easy one right, so it's worth more; an easy correct answer is worth less than full credit.",
  },
  {
    title: "Evidence volume",
    copy: "A small sample can be useful, but repeated answers across sections make the estimate more stable.",
    variable: "n_responses",
    range: "unbounded",
    note: "Volume does not raise the score on its own. It narrows the uncertainty around it.",
  },
];

const FLOW_STEPS = [
  {
    n: "01",
    title: "Answer",
    copy: "Questions sample people, events, sequence, places, and textual detail.",
  },
  {
    n: "02",
    title: "Weigh",
    copy: "Central passages and harder items carry more evidence.",
  },
  {
    n: "03",
    title: "Map",
    copy: "Answers become a profile by testament, section, book, and learning unit.",
  },
  {
    n: "04",
    title: "Route",
    copy: "The dashboard chooses the next focused place to review.",
  },
];

const CONFIDENCE_STEPS = [
  { label: "Provisional", range: "0-14 answers", copy: "Ask for more evidence before trusting the weakness." },
  { label: "Developing", range: "15-29 answers", copy: "The section can be interpreted, but still needs more signal." },
  { label: "Established", range: "30+ answers", copy: "Enough section evidence to treat the label as stable." },
];

// Matches the order of the top-level `.section` blocks in the page body,
// used for the right-edge jump nav's dot labels.
const RAIL_LABELS = [
  "The loop",
  "Confidence",
  "Recommendation logic",
  "Inputs",
  "Score bands",
  "Run it yourself",
  "Technical details",
];

const ROUTE_STEPS = [
  { label: "Earliest foundation gap", value: "Genesis 12-50", tone: "#d4a017" },
  { label: "Supported weak skill", value: "Geography", tone: "#0aa3a3" },
  { label: "Next action", value: "Reread, then retest", tone: "#7c3aed" },
];

export default function BliMechanicsPage() {
  const [probe, setProbe] = useState(560);
  const [openMechanic, setOpenMechanic] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [panelCount, setPanelCount] = useState(0);
  const [activePanel, setActivePanel] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const panelsRef = useRef<HTMLElement[]>([]);
  const techDetailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session?.user?.email));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user?.email));
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Right-edge jump nav. Tracks whichever top-level section currently
  // crosses the middle of the viewport so exactly one dot stays lit.
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const panels = Array.from(root.querySelectorAll<HTMLElement>(":scope > .section"));
    if (!panels.length) return;
    panelsRef.current = panels;
    setPanelCount(panels.length);

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const index = panels.indexOf(entry.target as HTMLElement);
        if (index >= 0) setActivePanel(index);
      }
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });

    panels.forEach(panel => observer.observe(panel));
    return () => observer.disconnect();
  }, []);

  // Deep links (the dashboard's level-badge "Learn more") land on a URL
  // hash. A same-route Next.js navigation doesn't reliably keep the
  // fragment scrolled into view here — the router's own scroll handling
  // and this page's heavy layout (star canvas, web font swap) can shift
  // things right after the initial jump — so re-assert the scroll position
  // for a few frames after mount until it holds.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    let raf = 0;
    // Generous window: in dev, Turbopack's first compile of a freshly
    // edited route can take a couple of seconds, and the router's own
    // post-navigation scroll handling lands after that — later than a
    // short correction loop would wait around for.
    const deadline = Date.now() + 3000;
    const tryScroll = () => {
      const el = document.getElementById(hash);
      if (el && Math.abs(el.getBoundingClientRect().top) > 4) {
        el.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
      }
      if (Date.now() < deadline) raf = requestAnimationFrame(tryScroll);
    };
    raf = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(raf);
  }, []);

  const jumpToFormula = useCallback(() => {
    setFormulaOpen(true);
    requestAnimationFrame(() => {
      techDetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

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
      <style>{BLI_PAGE_STYLES}</style>

      <canvas ref={canvasRef} className="stars" aria-hidden="true" />

      <BetaBanner>
        The scoring model and question bank are being refined as the assessment grows.
      </BetaBanner>

      <SiteNav
        links={["dashboard", "assess", "knowledge-map", "about", "credential", "reading-log"]}
        cta={{ href: "/assess", label: "Start Assessment" }}
        mobileMenu
        mobileMenuId="bli-mobile-nav"
      />

      <main className="page" ref={pageRef}>
        <header className="hero">
          <div className="hero-eyebrow">Bible Literacy Index</div>
          <h1 className="hero-heading">How the <em>BLI</em> works</h1>
          <p className="hero-lead">
            OBA turns assessment answers into a Bible Literacy Index, a confidence-aware knowledge map, and a next
            place to review.
          </p>
        </header>

        <section className="section">
          <p className="section-label">The loop</p>
          <h2 className="section-heading">From answers to a next step</h2>
          <div className="flow" aria-label="OBA scoring and recommendation flow">
            {FLOW_STEPS.map((step, index) => (
              <div className="flow-card" key={step.title} style={{ "--i": index } as CSSProperties}>
                <span className="flow-n">{step.n}</span>
                <span className="flow-title">{step.title}</span>
                <span className="flow-copy">{step.copy}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <p className="section-label">Confidence</p>
          <h2 className="section-heading">How confident the score is</h2>
          <div className="section-body" style={{ marginBottom: 4 }}>
            <p>
              Answers accumulate into evidence by section. More answers in a section mean a more stable read on it —
              this is what separates an early, provisional label from one you can actually rely on.
            </p>
          </div>
          <div className="measure-card">
            <div className="confidence-card">
              <div className="confidence-head">
                <h3 className="confidence-title">Section evidence</h3>
                <span className="illustrative-tag">Illustrative — 22 example answers</span>
              </div>
              <div className="confidence-track" aria-hidden="true">
                <span className="confidence-seg" />
                <span className="confidence-seg" />
                <span className="confidence-seg" />
                <span className="confidence-marker" />
              </div>
              <div className="confidence-rows">
                {CONFIDENCE_STEPS.map((step) => (
                  <div className="confidence-row" key={step.label}>
                    <b>{step.label}</b>
                    <i>{step.range}</i>
                    <span>{step.copy}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <p className="section-label">Recommendation logic</p>
          <h2 className="section-heading">The router looks for the next useful gap</h2>
          <div className="route-card" aria-label="Example recommendation route">
            <div className="route-card-head">
              <span className="illustrative-tag">Illustrative — not your data</span>
            </div>
            <div className="route-lane">
              {ROUTE_STEPS.map((step, index) => (
                <div className="route-step" key={step.label}>
                  <span className="route-dot" style={{ "--tone": step.tone, "--i": index } as CSSProperties} />
                  <span className="route-label">{step.label}</span>
                  <span className="route-value">{step.value}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="note" style={{ marginTop: 16 }}>
            The backend first protects under-tested sections, then works through the earliest foundation gaps, book
            dependencies, and supported weak skills inside the selected learning unit.
          </p>
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
                <span className="mechanic-range-inline">{m.variable} = {m.range}</span>
                <span className="mechanic-copy">{m.copy}</span>
                {openMechanic === i && (
                  <span className="mechanic-more">{m.note}</span>
                )}
              </button>
            ))}
          </div>
        </section>

        <hr className="rule" />

        <section className="section" id="score-bands">
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
          <p className="section-label">Run it yourself</p>
          <h2 className="section-heading">The scoring model, step by step</h2>
          <div className="section-body" style={{ marginBottom: 22 }}>
            <p>
              Below is the scoring model running over a twelve-question sample. Choose how the candidate answers, or
              set each question yourself, then run or step through it. The exact formula behind the arithmetic is
              printed in Technical details, right after this.
            </p>
          </div>

          <ScoringLab />

          <p className="note" style={{ marginTop: 20 }}>
            Try <strong>Guessing every time</strong>: the score lands near zero rather than 25%, because the -1/3
            penalty on a wrong answer cancels a one-in-four hit rate. Then try <strong>&ldquo;I don&rsquo;t know&rdquo;</strong>,
            which records caution: no credit, no guessing penalty.
          </p>

          <p className="lab-jump">
            <button type="button" className="inline-link-btn" onClick={jumpToFormula}>
              See the exact formula behind these numbers ↓
            </button>
          </p>
        </section>

        <section className="section">
          <p className="section-label">Technical details</p>
          <h2 className="section-heading">The current scoring model</h2>
          <details
            className="tech-details"
            ref={techDetailsRef}
            open={formulaOpen}
            onToggle={(event) => setFormulaOpen(event.currentTarget.open)}
          >
            <summary className="tech-summary">
              Show the formula <span>for review and debugging</span>
            </summary>
            <div className="tech-inner">
              <div className="formula-block">
                <div><strong>Question weight</strong></div>
                <div>weight = <em>book_weight</em> * <em>importance_factor</em></div>
                <br />
                <div><strong>Importance factor</strong></div>
                <div>tier 1 = <em>1.00</em></div>
                <div>tier 2 = <em>0.60</em></div>
                <div>tier 3+ = <em>0.35</em></div>
                <br />
                <div><strong>Difficulty reward</strong></div>
                <div>difficulty_reward = clamp(0.70, 1.25, 1.0 + 0.20 * <em>item_difficulty</em>)</div>
                <div>correct answer = weight * <em>difficulty_reward</em></div>
                <br />
                <div><strong>Guess adjustment</strong></div>
                <div>wrong answer = -weight * <em>(1/3)</em></div>
                <div>&quot;I don&apos;t know&quot; = <em>0 earned</em></div>
                <br />
                <div><strong>Raw score</strong></div>
                <div>raw BLI = clamp(0, 100, weighted_earned / weighted_possible * 100)</div>
                <br />
                <div><strong>Displayed score</strong></div>
                <div>display BLI = clamp(0, 800, raw BLI * 8)</div>
              </div>
              <p className="note">
                <em>item_difficulty</em> comes from each question&rsquo;s calibrated difficulty (harder items push the
                reward toward 1.25, easier items pull it toward 0.70), so a correct answer on an easy question is
                worth less than full weight, not more. The negative value for wrong answers is a guessing correction:
                in a four-choice multiple-choice question, random guessing would be right about one time in four.
              </p>
            </div>
          </details>
        </section>

        <div className="cta-row">
          <Link className="btn-primary" href={signedIn ? "/" : "/assess"}>
            {signedIn ? "See your BLI profile" : "Start the assessment"}
          </Link>
          <Link className="btn-secondary" href={signedIn ? "/knowledge-map" : "/about"}>
            {signedIn ? "Explore the knowledge map" : "About the project"}
          </Link>
        </div>
      </main>

      {panelCount > 1 && (
        <nav className="rail" aria-label="Jump to section">
          {Array.from({ length: panelCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              className={`rail-dot${i === activePanel ? " on" : ""}`}
              aria-label={`Jump to ${RAIL_LABELS[i] ?? `section ${i + 1}`}`}
              aria-current={i === activePanel}
              onClick={() => panelsRef.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" })}
            />
          ))}
        </nav>
      )}

      <SiteFooter />
    </>
  );
}
