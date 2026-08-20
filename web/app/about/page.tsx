"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import SiteFooter from "@/components/SiteFooter";
import BetaBanner from "@/components/BetaBanner";
import SiteNav from "@/components/SiteNav";
import { BLI_LEVELS, levelForScore } from "@/lib/bli";
import { ABOUT_PAGE_STYLES } from "./aboutStyles";

const CYCLE_STEPS = [
  {
    key: "assess",
    title: "Assess",
    copy: "Answer questions that sample real familiarity with the biblical text.",
    detail: "The goal is to measure what someone currently knows, not what a transcript, reading plan, or self-report implies.",
  },
  {
    key: "map",
    title: "Map",
    copy: "See strengths and gaps by section, book, and chapter range.",
    detail: "Once there is enough evidence, the result becomes a profile rather than just a single score.",
  },
  {
    key: "route",
    title: "Route",
    copy: "Use the map to choose the next passage or skill to review.",
    detail: "The recommendation engine is meant to make study more targeted than a generic reading plan.",
  },
  {
    key: "repeat",
    title: "Repeat",
    copy: "Come back after study and let the profile become more accurate.",
    detail: "Repeated assessment makes growth, retention, and fading easier to see over time.",
  },
];

const SCOPE_TABS = [
  {
    key: "tests",
    label: "What it tests",
    lead: "The factual content of Scripture: events, people, sequence, locations, and textual detail. For example, what happens in Genesis 15, what Leviticus 16 describes, or what 2 Kings says about the northern kingdom.",
    items: [
      "The events",
      "The people",
      "The sequence",
      "Textual detail",
    ],
  },
  {
    key: "doesnt",
    label: "What it doesn't",
    lead: "It does not score faithfulness, wisdom, pastoral calling, interpretations specific to a particular denomination, or theological arguments that depend on synthesizing many passages.",
    items: [
      "Wisdom",
      "Interpretive skill",
      "Theological depth",
      "Godly character",
    ],
  },
];

// The means by which people actually gain biblical knowledge, orbiting the BLI hub.
// These mirror the means listed in the opening paragraph of the section below.
// Coordinates are hand-placed rather than generated so labels never collide;
// `pos` decides which side of its node a label sits on.
const HUB = { x: 380, y: 219, r: 46 };

const MEANS = [
  { key: "reading", label: "Bible reading", x: 185, y: 95, pos: "left" },
  { key: "commentaries", label: "Commentaries", x: 150, y: 219, pos: "left" },
  { key: "memorization", label: "Memorization", x: 185, y: 343, pos: "left" },
  { key: "sermons", label: "Sermons", x: 300, y: 48, pos: "top" },
  { key: "training", label: "Formal training", x: 462, y: 48, pos: "top" },
  { key: "studies", label: "Bible studies", x: 575, y: 95, pos: "right" },
  { key: "discipleship", label: "Discipleship", x: 610, y: 219, pos: "right" },
  { key: "conversation", label: "Conversation", x: 575, y: 343, pos: "right" },
];

// Two routes that overlap on three means and differ on two — same destination.
const READERS = [
  {
    key: "a",
    label: "Reader A",
    color: "#e0873a",
    bright: "#f6b06a",
    items: ["reading", "sermons", "studies", "commentaries", "discipleship"],
    note: "No formal training. Years of steady reading, weekly preaching, a small group, commentaries close at hand, and someone older walking alongside.",
  },
  {
    key: "b",
    label: "Reader B",
    color: "#17a673",
    bright: "#58d6a8",
    items: ["reading", "sermons", "studies", "training", "memorization"],
    note: "Seminary trained. The same reading, preaching, and group study, plus formal coursework and years spent memorizing passages.",
  },
];

function labelPos(node: { x: number; y: number; pos: string }) {
  if (node.pos === "left") return { tx: node.x - 13, ty: node.y + 4, anchor: "end" as const };
  if (node.pos === "right") return { tx: node.x + 13, ty: node.y + 4, anchor: "start" as const };
  if (node.pos === "top") return { tx: node.x, ty: node.y - 16, anchor: "middle" as const };
  return { tx: node.x, ty: node.y + 22, anchor: "middle" as const };
}

// Illustrative decay/retention model. Both curves start at the same graduation score,
// so the divergence after year 0 is the whole point: identical transcript, different
// knowledge. Shapes are exponential toward an asymptote — not fitted to real data.
const GRAD_SCORE = 640;
const DECAY_YEARS = 12;
const SCORE_MIN = 300;
const SCORE_MAX = 800;

const PLOT = { left: 92, right: 706, top: 42, bottom: 258 };

const retained = (year: number) => 760 - 120 * Math.exp(-0.18 * year);
const faded = (year: number) => 380 + 260 * Math.exp(-0.22 * year);

const xForYear = (year: number) =>
  PLOT.left + (year / DECAY_YEARS) * (PLOT.right - PLOT.left);
const yForScore = (score: number) =>
  PLOT.bottom - ((score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * (PLOT.bottom - PLOT.top);

function curvePath(fn: (year: number) => number) {
  const steps: string[] = [];
  for (let y = 0; y <= DECAY_YEARS + 0.001; y += 0.25) {
    steps.push(`${steps.length ? "L" : "M"}${xForYear(y).toFixed(1)},${yForScore(fn(y)).toFixed(1)}`);
  }
  return steps.join(" ");
}

const RETAINED_PATH = curvePath(retained);
const FADED_PATH = curvePath(faded);

const USE_CASES = [
  {
    key: "untrained",
    n: "01",
    title: "Candidates the paperwork cannot vouch for",
    copy: "Someone without a conventional transcript may still know Scripture well. A direct measure gives an examining body one more concrete point of evidence.",
  },
  {
    key: "programs",
    n: "02",
    title: "Programs checking their own efficacy",
    copy: "A program could use repeated measurement to see whether graduates retain the biblical content their training was meant to strengthen.",
  },
  {
    key: "pastors",
    n: "03",
    title: "Pastors finding their blind spots",
    copy: "A private map by section can show where knowledge has quietly thinned and where review would help most.",
  },
];

const CONTRIBUTIONS = [
  {
    key: "biblical",
    title: "Biblical review",
    sub: "From people who know Scripture",
    items: ["Question wording", "Textual accuracy", "Passage selection", "Book coverage"],
  },
  {
    key: "technical",
    title: "Technical review",
    sub: "From people who build software",
    items: ["Scoring model", "Data modeling", "Accessibility", "Security", "Reliability"],
  },
];

export default function AboutPage() {
  const [cycleStep, setCycleStep] = useState(0);
  const [scopeTab, setScopeTab] = useState(0);
  const [objectionOpen, setObjectionOpen] = useState(false);
  const [reader, setReader] = useState(0);
  const [readerBlank, setReaderBlank] = useState(false);
  const [readerPinned, setReaderPinned] = useState(false);
  const [constelRevealed, setConstelRevealed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [gradYear, setGradYear] = useState(6);
  const [panelCount, setPanelCount] = useState(0);
  const [activePanel, setActivePanel] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const constelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const panelsRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const skipAnimation = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let frame = 0;

    const stars = Array.from({ length: 240 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: (0.5 + Math.random() * 1.5) * DPR,
      opacity: 0.35 + Math.random() * 0.55,
      twinkleSpeed: 0.002 + Math.random() * 0.004,
      twinkleOffset: Math.random() * Math.PI * 2,
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
      const w = canvas.width;
      const h = canvas.height;

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#0b0f1e");
      grad.addColorStop(0.5, "#111827");
      grad.addColorStop(1, "#0d1530");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const nebula = ctx.createRadialGradient(w * 0.74, h * 0.26, 0, w * 0.74, h * 0.26, w * 0.45);
      nebula.addColorStop(0, "rgba(10,163,163,0.07)");
      nebula.addColorStop(1, "transparent");
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, w, h);

      for (const star of stars) {
        const twinkle = skipAnimation ? 1 : 0.6 + 0.4 * Math.sin(frame * star.twinkleSpeed + star.twinkleOffset);
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${star.opacity * twinkle})`;
        ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      frame++;
      if (!skipAnimation) raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Only the panel crossing the middle band of the viewport counts as active, which
  // keeps exactly one section lit. The enhancement is added from JS so that without
  // it every panel stays fully visible rather than stuck at 12% opacity.
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const panels = Array.from(root.querySelectorAll<HTMLElement>(".panel"));
    if (!panels.length) return;

    panelsRef.current = panels;
    setPanelCount(panels.length);
    root.classList.add("is-enhanced");
    panels[0].classList.add("is-active");

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        el.classList.toggle("is-active", entry.isIntersecting);
        if (entry.isIntersecting) {
          const index = panels.indexOf(el);
          if (index >= 0) setActivePanel(index);
        }
      }
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });

    panels.forEach(panel => observer.observe(panel));
    return () => observer.disconnect();
  }, []);

  // Nodes pop in only once the diagram is actually on screen.
  useEffect(() => {
    const node = constelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setConstelRevealed(true);
    }, { threshold: 0.3 });
    observer.observe(node);
    const fallback = window.setTimeout(() => setConstelRevealed(true), 1500);
    return () => { observer.disconnect(); window.clearTimeout(fallback); };
  }, []);

  // Cycle between the two readers: clear the highlights, pause, then light the next set.
  // Stops for good once someone picks a reader themselves, and never runs under reduced motion.
  useEffect(() => {
    if (!constelRevealed || readerPinned || reducedMotion) return;
    let gap: number | undefined;
    const id = window.setInterval(() => {
      setReaderBlank(true);
      gap = window.setTimeout(() => {
        setReader(r => (r + 1) % READERS.length);
        setReaderBlank(false);
      }, 520);
    }, 4200);
    return () => { window.clearInterval(id); window.clearTimeout(gap); };
  }, [constelRevealed, readerPinned, reducedMotion]);

  const pickReader = useCallback((i: number) => {
    setReaderPinned(true);
    setReaderBlank(false);
    setReader(i);
  }, []);

  const onCycleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setCycleStep(i => (i + 1) % CYCLE_STEPS.length);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setCycleStep(i => (i - 1 + CYCLE_STEPS.length) % CYCLE_STEPS.length);
    }
  }, []);

  const active = CYCLE_STEPS[cycleStep];
  const scope = SCOPE_TABS[scopeTab];
  const activeReader = READERS[reader];
  const litMeans = readerBlank ? new Set<string>() : new Set(activeReader.items);
  const constelLabel = `The means feeding one BLI profile. ${activeReader.label} arrived by: ${
    activeReader.items.map(k => MEANS.find(m => m.key === k)?.label).join(", ")
  }.`;
  const retainedScore = Math.round(retained(gradYear));
  const fadedScore = Math.round(faded(gradYear));
  const bandFor = (score: number) =>
    BLI_LEVELS.find(b => b.name === levelForScore(score)) ?? BLI_LEVELS[0];

  return (
    <>
      <style>{ABOUT_PAGE_STYLES}</style>

      <canvas ref={canvasRef} className="stars" aria-hidden="true" />

      <BetaBanner>
        Open Bible Assessment is in active development. Questions and resources are being refined — feedback on accuracy and wording is welcome.
      </BetaBanner>

      <SiteNav
        links={["dashboard", "assess", "knowledge-map", "bli", "credential", "reading-log"]}
        cta={{ href: "/assess", label: "Start Assessment" }}
      />

      <main className="page" ref={pageRef}>
        <header className="hero">
          <div className="hero-eyebrow">About Open Bible Assessment</div>
          <h1 className="hero-heading">Measuring Bible<br/><em>content knowledge</em></h1>
          <p className="hero-lead">
            Open Bible Assessment is a beta tool for measuring Scripture content knowledge, mapping strengths and gaps,
            and pointing learners toward what to study next.
          </p>
        </header>

        <section className="section panel">
          <p className="section-label">The basic idea</p>
          <h2 className="section-heading">Assess, map, route, repeat</h2>
          <div className="section-body">
            <p>
              Open Bible Assessment is built around a simple cycle: <strong>assess, map, route, repeat</strong>. It asks
              questions, builds a profile of strengths and gaps, then recommends a next place to focus.
            </p>
            <p>
              There are already many great resources out there that provide content to better understand the Word of
              God; they answer the &ldquo;what&rdquo; to study. The goal here, instead, is to answer the
              &ldquo;where&rdquo; &mdash; pointing you to the specific places in Scripture you don&rsquo;t yet
              understand well.
            </p>
          </div>

          <div className="cycle glass">
            <div
              className="cycle-dial"
              role="tablist"
              aria-label="The assess, map, route, repeat cycle"
              onKeyDown={onCycleKeyDown}
            >
              <svg className="cycle-ring" viewBox="0 0 250 250" aria-hidden="true">
                <circle cx="125" cy="125" r="108" />
                <circle className="cycle-arc" cx="125" cy="125" r="108" />
              </svg>
              <span className="cycle-center">Assess · Map<br/>Route · Repeat</span>
              {CYCLE_STEPS.map((step, i) => (
                <button
                  key={step.key}
                  type="button"
                  role="tab"
                  id={`cycle-tab-${step.key}`}
                  aria-selected={i === cycleStep}
                  aria-controls="cycle-panel"
                  tabIndex={i === cycleStep ? 0 : -1}
                  className={`cycle-node cycle-node-${i}${i === cycleStep ? " is-active" : ""}`}
                  onClick={() => setCycleStep(i)}
                >
                  <i>{i + 1}</i>
                  <b>{step.title}</b>
                </button>
              ))}
            </div>
            <div
              className="cycle-panel"
              role="tabpanel"
              id="cycle-panel"
              aria-labelledby={`cycle-tab-${active.key}`}
            >
              <p className="cycle-panel-step">Step {cycleStep + 1} of {CYCLE_STEPS.length}</p>
              <h3 className="cycle-panel-title">{active.title}</h3>
              <p className="cycle-panel-copy">{active.copy}</p>
              <p className="cycle-panel-detail">{active.detail}</p>
            </div>
          </div>
        </section>

        <section className="section panel">
          <p className="section-label">What it measures</p>
          <h2 className="section-heading">What the BLI does and does not test</h2>

          <div className="scope glass">
            <div className="scope-tabs" role="tablist" aria-label="What the BLI does and does not test">
              {SCOPE_TABS.map((tab, i) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  id={`scope-tab-${tab.key}`}
                  aria-selected={i === scopeTab}
                  aria-controls="scope-panel"
                  className={`scope-tab${i === scopeTab ? " is-active" : ""}`}
                  onClick={() => setScopeTab(i)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="scope-panel" role="tabpanel" id="scope-panel" aria-labelledby={`scope-tab-${scope.key}`}>
              <p className="scope-lead">{scope.lead}</p>
              <div className="scope-items">
                {scope.items.map(item => (
                  <span key={item} className={`scope-chip ${scopeTab === 0 ? "yes" : "no"}`}>
                    {scopeTab === 0 ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    )}
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="section-body" style={{ marginTop: 26 }}>
            <p>
              The Bible Literacy Index (BLI) measures <strong>Scripture content knowledge</strong>: events, people,
              sequence, places, and textual detail. Those are questions about what is in the text, which makes them
              more testable than interpretations specific to a particular denomination.
            </p>
            <p>
              It cannot measure wisdom, godly character, pastoral calling, or theological depth. A high score means a
              person knows the content of Scripture well. That matters, but it is one part of a larger picture.
            </p>
          </div>

          <div className="objection glass">
            <button
              type="button"
              className="objection-btn"
              aria-expanded={objectionOpen}
              aria-controls="objection-answer"
              onClick={() => setObjectionOpen(o => !o)}
            >
              <span className="objection-mark">Q.</span>
              <span className="objection-q">Can you really quantify Bible knowledge?</span>
              <svg className="objection-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {objectionOpen && (
              <div className="objection-a" id="objection-answer">
                <p>Not fully, and that is not the claim. Seminaries run Bible content exams, and ordination boards often test Scripture knowledge before licensing ministers. Both are asking whether a person has read the text and retained it.</p>
                <p>The BLI works in that limited sense. It cannot capture wisdom, interpretation, or spiritual formation. It can estimate whether someone knows the events, people, and passages of Scripture, and it should be read only within that scope.</p>
              </div>
            )}
          </div>
        </section>

        <section className="section panel">
          <p className="section-label">Beta project</p>
          <h2 className="section-heading">An early version, still being refined</h2>
          <div className="section-body">
            <p>
              Open Bible Assessment is in beta. The aim is a useful diagnostic tool for Bible content knowledge, not a
              formally validated testing instrument. The current BLI is provisional: good enough to map likely gaps
              and guide study, but still in need of more question review, user data, and statistical validation.
            </p>
            <p>
              Feedback is part of the work, especially on biblical accuracy, question wording, accessibility, and reliability.
            </p>
          </div>

          <div className="contrib-grid">
            {CONTRIBUTIONS.map(group => (
              <div className="contrib-card glass" key={group.key}>
                <span className="contrib-icon" aria-hidden="true">
                  {group.key === "biblical" ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                    </svg>
                  )}
                </span>
                <span className="contrib-title">{group.title}</span>
                <span className="contrib-sub">{group.sub}</span>
                <ul className="contrib-list">
                  {group.items.map(item => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="section panel">
          <p className="section-label">How it works</p>
          <h2 className="section-heading">How the assessment adapts</h2>
          <div className="section-body">
            <p>
              The assessment weights questions toward significant events and passages, then concentrates on the areas
              where it has the least confidence. The more questions you answer, the more useful the profile becomes.
            </p>
            <p>
              Your BLI score is an estimate. Early on it rests on a small sample; with more answers, it becomes a
              clearer picture of where you stand. The dashboard breaks the Old Testament into Torah, Former Prophets,
              Latter Prophets, and Writings so you can see where knowledge is strong and where it thins out.
            </p>
          </div>

          <div className="section-body" style={{ marginTop: 22 }}>
            <p>
              For readers who want the technical details, including how weighting and the display scale work, see <Link className="inline-link" href="/bli">How the Bible Literacy Index Works</Link>.
            </p>
          </div>

          <blockquote className="pull-quote">
            <p>The score, the map, and the recommendations are only worth anything if they send you back to Scripture with a clearer sense of where to go.</p>
          </blockquote>
        </section>

        <section className="section panel">
          <p className="section-label">Where this fits</p>
          <h2 className="section-heading">A map, not another library</h2>
          <div className="section-body">
            <p>
              People grow in biblical knowledge through reading Scripture, hearing sermons, studying with others,
              using commentaries, taking courses, memorizing passages, and talking with pastors and teachers. The point
              of OBA is that you don&apos;t have to keep relearning what you already know, no matter where you learned it.
            </p>
          </div>

          <div
            className="constellation glass"
            ref={constelRef}
            style={{ ["--hl" as string]: activeReader.color, ["--hl-bright" as string]: activeReader.bright } as CSSProperties}
          >
            <div className="scope-tabs" role="tablist" aria-label="Example readers">
              {READERS.map((r, i) => (
                <button
                  key={r.key}
                  type="button"
                  role="tab"
                  id={`constel-tab-${r.key}`}
                  aria-selected={i === reader}
                  aria-controls="constel-panel"
                  className={`scope-tab${i === reader ? " is-active" : ""}`}
                  onClick={() => pickReader(i)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="constel-panel" role="tabpanel" id="constel-panel" aria-labelledby={`constel-tab-${activeReader.key}`}>
              <div className="constel-wrap">
                <svg
                  className={`constel-svg${constelRevealed ? " is-revealed" : ""}`}
                  viewBox="0 0 760 440"
                  role="img"
                  aria-label={constelLabel}
                >
                  <defs>
                    <radialGradient id="constelHub" cx="34%" cy="28%">
                      <stop offset="0%" stopColor="rgba(10,163,163,.55)" />
                      <stop offset="100%" stopColor="rgba(16,22,42,.98)" />
                    </radialGradient>
                  </defs>

                  <g className="constel-links">
                    {MEANS.map(node => (
                      <line
                        key={`link-${node.key}`}
                        x1={HUB.x} y1={HUB.y} x2={node.x} y2={node.y}
                        className={`constel-link ${litMeans.has(node.key) ? "is-on" : "is-off"}`}
                      />
                    ))}
                  </g>

                  <circle className="constel-pulse" cx={HUB.x} cy={HUB.y} r={HUB.r} />
                  <circle className="constel-hub-core" cx={HUB.x} cy={HUB.y} r={HUB.r} />
                  <text className="constel-hub-label" x={HUB.x} y={HUB.y + 1}>BLI</text>
                  <text className="constel-hub-sub" x={HUB.x} y={HUB.y + 20}>one profile</text>

                  {MEANS.map((node, i) => {
                    const t = labelPos(node);
                    const lit = litMeans.has(node.key);
                    return (
                      <g
                        key={`node-${node.key}`}
                        className="constel-pop"
                        style={{ transformOrigin: `${node.x}px ${node.y}px`, animationDelay: `${i * 70}ms` }}
                      >
                        <g className={`constel-node ${lit ? "is-on" : "is-off"}`}>
                          <circle cx={node.x} cy={node.y} r={lit ? 7 : 5.5} />
                          <text x={t.tx} y={t.ty} textAnchor={t.anchor}>{node.label}</text>
                        </g>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <p className="constel-caption" role="status" aria-live="polite">
                <b>{activeReader.label}</b> — {activeReader.note}
                {!readerPinned && <span className="constel-hint">Cycling between two readers. Pick one to hold it.</span>}
              </p>
            </div>
          </div>

          <div className="section-body" style={{ marginTop: 22 }}>
            <p>
              Two people can reach the same place by different routes. The assessment does not care which route you took,
              only where it left you. The aim is a competency map: a way to see what you know, what is missing, and what
              to study next.
            </p>
          </div>
        </section>

        <section className="section panel">
          <p className="section-label">Formal training</p>
          <h2 className="section-heading">Where OBA can help someone with a formal Bible degree</h2>
          <div className="section-body">
            <p>
              A degree records work completed at a point in time. It matters, but it does not keep measuring what
              someone knows years later. Knowledge can deepen, stay fresh, or fade. A repeated measure gives a different
              kind of information: not where someone studied, but what they currently retain.
            </p>
          </div>

          <div className="decay glass">
            <div className="decay-head">
              <span className="decay-title">The years after graduation</span>
              <span className="map-tag">Illustrative — not fitted to real data</span>
            </div>

            <div className="decay-wrap">
              <svg className="decay-svg" viewBox="0 0 760 300" role="img" aria-label={`Two graduates of the same program, ${gradYear} years on: with ongoing study the measured BLI is ${retainedScore}, without maintenance it is ${fadedScore}. The credential is identical in both cases.`}>
                {[800, 675, 550, 425, 300].map(score => (
                  <g key={score}>
                    <line className="decay-grid" x1={PLOT.left} y1={yForScore(score)} x2={PLOT.right} y2={yForScore(score)} />
                    <text className="decay-tick" x={PLOT.left - 10} y={yForScore(score) + 3.5} textAnchor="end">{score}</text>
                  </g>
                ))}
                {[0, 3, 6, 9, 12].map(year => (
                  <text key={year} className="decay-tick" x={xForYear(year)} y={PLOT.bottom + 20} textAnchor="middle">
                    {year === 0 ? "grad" : `+${year}y`}
                  </text>
                ))}

                <path className="decay-cred" d={`M${xForYear(0)},${yForScore(GRAD_SCORE)} L${xForYear(DECAY_YEARS)},${yForScore(GRAD_SCORE)}`} />
                <path className="decay-curve up" d={RETAINED_PATH} />
                <path className="decay-curve down" d={FADED_PATH} />

                <line className="decay-scrub" x1={xForYear(gradYear)} y1={PLOT.top - 6} x2={xForYear(gradYear)} y2={PLOT.bottom} />
                <circle className="decay-dot" cx={xForYear(gradYear)} cy={yForScore(retained(gradYear))} r={6} fill="#17a673" />
                <circle className="decay-dot" cx={xForYear(gradYear)} cy={yForScore(faded(gradYear))} r={6} fill="#e0873a" />
                <circle cx={xForYear(0)} cy={yForScore(GRAD_SCORE)} r={5} fill="#f0c674" stroke="#0b0f1e" strokeWidth={2} />

                <text className="decay-key" x={PLOT.right} y={yForScore(GRAD_SCORE) - 10} textAnchor="end" fill="#f0c674">
                  what the transcript still implies
                </text>
                <text className="decay-key" x={PLOT.right} y={yForScore(retained(DECAY_YEARS)) - 12} textAnchor="end" fill="#17a673">
                  kept up
                </text>
                <text className="decay-key" x={PLOT.right} y={yForScore(faded(DECAY_YEARS)) + 20} textAnchor="end" fill="#e0873a">
                  left to fade
                </text>
              </svg>
            </div>

            <input
              className="decay-slider"
              type="range" min={0} max={DECAY_YEARS} step={1}
              value={gradYear}
              onChange={e => setGradYear(Number(e.target.value))}
              aria-label="Years since graduation"
              aria-valuetext={`${gradYear} years after graduation`}
            />
            <div className="decay-slider-label" aria-hidden="true">
              <span>Graduation</span><span>{DECAY_YEARS} years on</span>
            </div>

            <div className="decay-readout">
              <div className="decay-cell cred">
                <span className="decay-cell-k">On paper</span>
                <span className="decay-cell-v">MDiv</span>
                <span className="decay-cell-sub" style={{ color: "#f0c674" }}>unchanged since year 0</span>
              </div>
              <div className="decay-cell up">
                <span className="decay-cell-k">Kept up</span>
                <span className="decay-cell-v">{retainedScore}</span>
                <span className="decay-cell-sub" style={{ color: bandFor(retainedScore).color }}>{bandFor(retainedScore).name}</span>
              </div>
              <div className="decay-cell down">
                <span className="decay-cell-k">Left to fade</span>
                <span className="decay-cell-v">{fadedScore}</span>
                <span className="decay-cell-sub" style={{ color: bandFor(fadedScore).color }}>{bandFor(fadedScore).name}</span>
              </div>
            </div>

            <p className="decay-note" role="status" aria-live="polite">
              {gradYear === 0
                ? "At graduation the transcript and the knowledge agree. This is the only moment they are guaranteed to."
                : `Two graduates of the same program, ${gradYear} year${gradYear === 1 ? "" : "s"} on. Their transcripts are identical and always will be. Their measured knowledge is ${retainedScore - fadedScore} points apart, and nothing on paper distinguishes them.`}
            </p>
          </div>

        </section>

        <section className="section panel">
          <p className="section-label">The second gap</p>
          <h2 className="section-heading">When study gets detached from the whole Bible</h2>
          <div className="section-body">
            <p>
              Formal coursework is one example, but the same drift can happen with podcasts, books, lectures, and other
              Christian study resources. Many resources are valuable because they go deep, but deep can also become
              narrow: a person can spend a long time inside one debate, theme, author, or tradition while losing track
              of the broad shape of Scripture.
            </p>
            <p>
              That is not an argument against seminary, podcasts, theology books, or church-history resources. It is an
              argument that resources and measurement answer different questions. Resources teach; a repeatable
              measurement helps show what has actually remained across the whole biblical field and where review would
              reconnect the parts.
            </p>
          </div>
        </section>

        <section className="section panel">
          <p className="section-label">What it would be for</p>
          <h2 className="section-heading">Three things a direct measure makes possible</h2>

          <div className="usecase-grid">
            {USE_CASES.map(useCase => (
              <div className="usecase-card glass" key={useCase.key}>
                <span className="usecase-n">{useCase.n}</span>
                <span className="usecase-title">{useCase.title}</span>
                <span className="usecase-copy">{useCase.copy}</span>
              </div>
            ))}
          </div>

          <div className="future-note">
            <span>Verified assessment for church credentialing is a future idea, not a current feature. For now, the priority is improving the beta question bank and the reliability of the map.</span>
          </div>

          <div className="section-body" style={{ marginTop: 22 }}>
            <p>
              Corrections and criticism are welcome on biblical accuracy, question wording, accessibility, and engineering. The same address reaches the project for{" "}
              <a className="inline-link" href="mailto:adstamper35@gmail.com?subject=Open%20Bible%20Assessment%20feedback">
                feedback
              </a>.
            </p>
          </div>
        </section>

        <div className="panel">
        <div className="donate-block">
          <h2 className="donate-heading">Free to use</h2>
          <p className="donate-body">
            There is no subscription, no premium tier, and no advertising, and that is not going to change.
          </p>
        </div>

        <div className="cta-row">
          <Link className="btn-primary" href="/assess">Start the assessment</Link>
          <Link className="btn-secondary" href="/bli">How BLI works</Link>
          <Link className="btn-secondary" href="/credential">Future ideas</Link>
        </div>
        </div>
      </main>

      {panelCount > 1 && (
        <nav className="rail" aria-label="Jump to section">
          {Array.from({ length: panelCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              className={`rail-dot${i === activePanel ? " on" : ""}`}
              aria-label={`Go to section ${i + 1} of ${panelCount}`}
              aria-current={i === activePanel}
              onClick={() => panelsRef.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" })}
            />
          ))}
        </nav>
      )}
      <SiteFooter />
    </>
  );
}
