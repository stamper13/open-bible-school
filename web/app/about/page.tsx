"use client";

import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import SiteFooter from "@/components/SiteFooter";
import { BLI_LEVELS, levelForScore } from "@/lib/bli";

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
      <style>{`
        :root {
          --muted: #566070; --navy: #1b2442;
          --accent: #0aa3a3; --accent-dim: rgba(10,163,163,.12);
          --accent-line: rgba(10,163,163,.26);
          --beta: #a78bfa;
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
          font-size: 10px; font-weight: 800; letter-spacing: .08em;
          text-transform: uppercase; background: #7c3aed;
          color: #fff; padding: 2px 7px; border-radius: 4px; flex-shrink: 0;
        }
        .nav {
          position: sticky; top: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 32px; background: rgba(11,15,30,.85);
          backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .nav-brand {
          font-family: var(--font-crimson), Georgia, serif;
          font-weight: 600; font-size: 18px;
          color: #fff; text-decoration: none; letter-spacing: .01em;
        }
        .nav-links { display: flex; align-items: center; gap: 6px; }
        .nav-link {
          padding: 7px 14px; border-radius: 999px;
          font-size: 13px; font-weight: 500; color: rgba(255,255,255,.6);
          text-decoration: none; transition: color .14s, background .14s;
        }
        .nav-link:hover { color: #fff; background: rgba(255,255,255,.08); }
        .nav-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 18px; border-radius: 999px;
          font-size: 13px; font-weight: 600;
          background: rgba(255,255,255,.92); color: var(--navy);
          text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 4px 14px rgba(0,0,0,.3);
          transition: background .15s, transform .13s;
        }
        .nav-btn:hover { background: #fff; transform: translateY(-1px); }
        .nav-link:focus-visible, .nav-btn:focus-visible, .nav-brand:focus-visible {
          outline: 2px solid rgba(255,255,255,.65); outline-offset: 3px; border-radius: 6px;
        }

        .page { position: relative; z-index: 1; max-width: 760px; margin: 0 auto; padding: 64px 24px 96px; }
        .hero { padding-top: 56px; margin-bottom: 16px; }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          border-radius: 999px; padding: 5px 14px;
          font-size: 12px; font-weight: 700; letter-spacing: .06em;
          text-transform: uppercase; color: #6fe0e0; margin-bottom: 20px;
        }
        .hero-eyebrow::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
        .hero-heading {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(32px, 5vw, 50px); font-weight: 600; line-height: 1.12;
          color: #fff; letter-spacing: .005em; margin-bottom: 20px;
        }
        .hero-heading em { font-style: italic; color: #4fd6d6; }
        .hero-lead { font-size: 17px; line-height: 1.75; color: rgba(255,255,255,.64); max-width: 580px; }

        .pull-quote { border-left: 3px solid var(--accent); margin: 28px 0 0; padding: 4px 0 4px 24px; }
        .pull-quote p {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 21px; font-style: italic; line-height: 1.55; color: rgba(255,255,255,.88); font-weight: 500;
        }
        .section { margin-bottom: 60px; }
        .section-label { font-size: 11px; font-weight: 700; letter-spacing: .10em; text-transform: uppercase; color: #4fd6d6; margin-bottom: 12px; }
        .section-heading { font-family: var(--font-crimson), Georgia, serif; font-size: 26px; font-weight: 600; line-height: 1.2; color: #fff; margin-bottom: 16px; }
        .section-body { font-size: 15.5px; line-height: 1.80; color: rgba(255,255,255,.66); }
        .section-body p + p { margin-top: 14px; }
        .section-body strong { color: #fff; font-weight: 650; }
        .inline-link { color: #4fd6d6; font-weight: 650; text-decoration: none; border-bottom: 1px solid rgba(10,163,163,.45); }
        .inline-link:hover { color: #7fe9e9; border-bottom-color: #7fe9e9; }
        .rule { border: none; border-top: 1px solid rgba(255,255,255,.09); margin: 60px 0; }

        .glass {
          background: linear-gradient(155deg, rgba(255,255,255,.07), rgba(255,255,255,.02));
          border: 1px solid rgba(255,255,255,.13);
          border-radius: 18px; backdrop-filter: blur(16px);
          box-shadow: 0 20px 50px rgba(0,0,0,.34);
        }

        /* Interactive cycle */
        .cycle { margin: 30px 0 8px; padding: 26px; display: grid; grid-template-columns: minmax(304px, 320px) minmax(0,1fr); gap: 24px; align-items: center; }
        .cycle-dial { position: relative; width: 250px; height: 250px; justify-self: center; }
        .cycle-ring { position: absolute; inset: 0; }
        .cycle-ring circle { fill: none; stroke: rgba(255,255,255,.12); stroke-width: 1; }
        .cycle-ring .cycle-arc {
          fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round;
          stroke-dasharray: 40 640; opacity: .85;
          animation: cycleOrbit 9s linear infinite;
        }
        @keyframes cycleOrbit { to { stroke-dashoffset: -680; } }
        .cycle-node {
          position: absolute; width: 74px; height: 74px; margin: -37px 0 0 -37px;
          border-radius: 50%; cursor: pointer; font-family: inherit;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
          background: rgba(16,22,42,.9); border: 1px solid rgba(255,255,255,.16);
          color: rgba(255,255,255,.6); transition: transform .18s, border-color .18s, color .18s, box-shadow .18s;
        }
        .cycle-node b { font-size: 12.5px; font-weight: 800; letter-spacing: .03em; }
        .cycle-node i { font-style: normal; font-size: 10px; font-weight: 700; opacity: .55; }
        .cycle-node:hover { transform: scale(1.06); color: #fff; border-color: rgba(255,255,255,.3); }
        .cycle-node.is-active {
          color: #fff; border-color: var(--accent); transform: scale(1.1);
          box-shadow: 0 0 0 5px rgba(10,163,163,.14), 0 10px 26px rgba(0,0,0,.4);
          background: linear-gradient(150deg, rgba(10,163,163,.30), rgba(16,22,42,.92));
        }
        .cycle-node:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
        .cycle-node-0 { left: 50%; top: 0; }
        .cycle-node-1 { left: 100%; top: 50%; }
        .cycle-node-2 { left: 50%; top: 100%; }
        .cycle-node-3 { left: 0; top: 50%; }
        .cycle-center {
          position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
          width: 108px; text-align: center; pointer-events: none;
          font-size: 10.5px; font-weight: 800; letter-spacing: .12em;
          text-transform: uppercase; color: rgba(255,255,255,.3); line-height: 1.5;
        }
        .cycle-panel { position: relative; z-index: 1; min-height: 150px; }
        .cycle-panel-step { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #4fd6d6; margin-bottom: 8px; }
        .cycle-panel-title { font-family: var(--font-crimson), Georgia, serif; font-size: 27px; font-weight: 600; color: #fff; margin-bottom: 10px; }
        .cycle-panel-copy { font-size: 15px; line-height: 1.72; color: rgba(255,255,255,.68); margin-bottom: 12px; }
        .cycle-panel-detail { font-size: 13.5px; line-height: 1.68; color: rgba(255,255,255,.46); border-left: 2px solid var(--accent-line); padding-left: 14px; }

        /* Scope toggle */
        .scope { margin: 26px 0 8px; padding: 8px; }
        .scope-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 4px; }
        .scope-tab {
          border: 0; border-radius: 12px; padding: 12px 14px; cursor: pointer;
          background: transparent; color: rgba(255,255,255,.55);
          font-family: inherit; font-size: 13.5px; font-weight: 750;
          transition: background .16s, color .16s;
        }
        .scope-tab:hover { background: rgba(255,255,255,.07); color: #fff; }
        .scope-tab.is-active { background: rgba(255,255,255,.93); color: var(--navy); box-shadow: 0 8px 22px rgba(0,0,0,.25); }
        .scope-tab:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
        .scope-panel { padding: 18px 16px 16px; }
        .scope-lead { font-size: 14.5px; line-height: 1.7; color: rgba(255,255,255,.66); margin-bottom: 16px; }
        .scope-items { display: flex; flex-wrap: wrap; gap: 8px; }
        .scope-chip {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 13px; border-radius: 999px; font-size: 13px; font-weight: 600;
          animation: chipIn .3s ease both;
        }
        @keyframes chipIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .scope-chip.yes { background: var(--accent-dim); border: 1px solid var(--accent-line); color: #7fe9e9; }
        .scope-chip.no { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.14); color: rgba(255,255,255,.55); }
        .scope-chip svg { width: 13px; height: 13px; flex-shrink: 0; }

        /* Knowledge map */
        .map-block { margin: 28px 0 8px; padding: 24px 26px; }
        .map-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
        .map-title { font-family: var(--font-crimson), Georgia, serif; font-size: 19px; font-weight: 600; color: #fff; }
        .map-tag {
          font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
          color: rgba(255,255,255,.42); background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 4px 10px;
        }
        .map-rows { display: flex; flex-direction: column; gap: 14px; }
        .map-row {
          width: 100%; text-align: left; background: transparent; border: 0; padding: 6px 8px;
          border-radius: 10px; cursor: pointer; font-family: inherit;
          transition: background .16s;
        }
        .map-row:hover { background: rgba(255,255,255,.05); }
        .map-row:focus-visible { outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px; }
        .map-row-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 7px; }
        .map-name { font-size: 13.5px; font-weight: 750; color: rgba(255,255,255,.85); display: flex; align-items: center; gap: 8px; }
        .map-swatch { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .map-books { font-size: 11.5px; font-weight: 600; color: rgba(255,255,255,.38); }
        .map-bar { height: 9px; border-radius: 999px; background: rgba(255,255,255,.07); overflow: hidden; }
        .map-fill {
          height: 100%; border-radius: 999px; width: 0;
          transition: width 1.15s cubic-bezier(.22,.9,.3,1);
        }
        .map-note { margin-top: 18px; font-size: 13px; line-height: 1.65; color: rgba(255,255,255,.5); min-height: 42px; }

        /* Objection disclosure */
        .objection { margin: 28px 0 0; padding: 0; overflow: hidden; }
        .objection-btn {
          width: 100%; display: flex; align-items: flex-start; gap: 12px;
          padding: 22px 26px; background: transparent; border: 0; cursor: pointer;
          font-family: inherit; text-align: left; color: #fff;
        }
        .objection-btn:hover { background: rgba(255,255,255,.04); }
        .objection-btn:focus-visible { outline: 2px solid rgba(255,255,255,.6); outline-offset: -2px; }
        .objection-q {
          flex: 1; font-family: var(--font-crimson), Georgia, serif;
          font-size: 18px; font-style: italic; font-weight: 600; color: #fff; line-height: 1.4;
        }
        .objection-mark { font-size: 12px; font-weight: 800; letter-spacing: .06em; color: #4fd6d6; padding-top: 5px; flex-shrink: 0; }
        .objection-chev { width: 18px; height: 18px; flex-shrink: 0; margin-top: 4px; color: rgba(255,255,255,.5); transition: transform .22s; }
        .objection-btn[aria-expanded="true"] .objection-chev { transform: rotate(180deg); }
        .objection-a {
          font-size: 15px; line-height: 1.78; color: rgba(255,255,255,.66);
          padding: 0 26px 24px 60px; animation: chipIn .26s ease both;
        }
        .objection-a p + p { margin-top: 12px; }

        .future-note {
          display: flex; align-items: flex-start; gap: 12px;
          background: rgba(124,58,237,.12); border: 1px solid rgba(124,58,237,.28);
          border-radius: 12px; padding: 16px 20px;
          font-size: 13.5px; line-height: 1.65; color: #d8c7fb; margin-top: 20px;
        }

        /* Resource constellation */
        .constellation { margin: 26px 0 8px; padding: 8px; }
        .constel-panel { padding: 10px 6px 14px; }
        .constel-wrap { overflow-x: auto; }
        .constel-svg { display: block; width: 100%; min-width: 640px; height: auto; }
        .constel-links { opacity: 0; transition: opacity .55s ease .12s; }
        .constel-svg.is-revealed .constel-links { opacity: 1; }
        .constel-link {
          stroke: rgba(255,255,255,.17); stroke-width: 1;
          transition: stroke .45s ease, stroke-width .45s ease, opacity .45s ease;
        }
        .constel-link.is-off { opacity: .15; }
        .constel-link.is-on {
          stroke: var(--hl); stroke-width: 1.9;
          stroke-dasharray: 5 7; animation: constelFlow 1.1s linear infinite;
        }
        @keyframes constelFlow { to { stroke-dashoffset: -24; } }

        /* Each node pops in once, around its own centre; the inner group owns on/off state
           so the pop animation's fill-mode never fights the highlight opacity. */
        .constel-pop { opacity: 0; }
        .constel-svg.is-revealed .constel-pop {
          animation: constelPop .5s cubic-bezier(.2,1.25,.4,1) both;
        }
        @keyframes constelPop {
          from { opacity: 0; transform: scale(.35); }
          to { opacity: 1; transform: scale(1); }
        }

        .constel-node { transition: opacity .45s ease; }
        .constel-node circle {
          fill: rgba(16,22,42,.95); stroke: rgba(255,255,255,.32); stroke-width: 1.2;
          transition: fill .45s ease, stroke .45s ease, stroke-width .45s ease;
        }
        .constel-node text {
          fill: rgba(255,255,255,.62); font-size: 11.5px; font-weight: 600;
          transition: fill .45s ease;
        }
        .constel-node.is-off { opacity: .3; }
        .constel-node.is-on circle { fill: var(--hl); stroke: var(--hl-bright); stroke-width: 2.2; }
        .constel-node.is-on text { fill: var(--hl-bright); font-weight: 750; }
        .constel-hub-core { fill: url(#constelHub); stroke: var(--accent); stroke-width: 1.5; }
        .constel-pulse {
          fill: none; stroke: var(--accent);
          transform-box: fill-box; transform-origin: center;
          animation: constelPulse 3.2s ease-out infinite;
        }
        @keyframes constelPulse {
          0% { transform: scale(1); opacity: .45; }
          100% { transform: scale(2.15); opacity: 0; }
        }
        .constel-hub-label {
          fill: #fff; font-family: var(--font-crimson), Georgia, serif;
          font-size: 22px; font-weight: 600; text-anchor: middle;
        }
        .constel-hub-sub {
          fill: rgba(255,255,255,.48); font-size: 9px; font-weight: 700;
          letter-spacing: .11em; text-transform: uppercase; text-anchor: middle;
        }
        .constel-caption {
          margin-top: 8px; padding: 0 10px; font-size: 13.5px; line-height: 1.65;
          color: rgba(255,255,255,.55); min-height: 62px;
        }
        .constel-caption b {
          font-weight: 750; color: var(--hl-bright);
          transition: color .45s ease;
        }
        .constel-hint {
          display: block; margin-top: 7px; font-size: 12.5px;
          color: rgba(255,255,255,.38);
        }

        /* Retention chart */
        .decay { margin: 28px 0 8px; padding: 22px 24px; }
        .decay-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .decay-title { font-family: var(--font-crimson), Georgia, serif; font-size: 19px; font-weight: 600; color: #fff; }
        .decay-wrap { overflow-x: auto; }
        .decay-svg { display: block; width: 100%; min-width: 580px; height: auto; }
        .decay-grid { stroke: rgba(255,255,255,.08); stroke-width: 1; }
        .decay-tick { fill: rgba(255,255,255,.34); font-size: 10.5px; font-weight: 600; }
        .decay-cred { fill: none; stroke: #f0c674; stroke-width: 1.7; stroke-dasharray: 7 5; }
        .decay-curve { fill: none; stroke-width: 2.6; stroke-linecap: round; }
        .decay-curve.up { stroke: #17a673; }
        .decay-curve.down { stroke: #e0873a; }
        .decay-scrub { stroke: rgba(255,255,255,.42); stroke-width: 1; stroke-dasharray: 3 4; }
        .decay-dot { stroke: #0b0f1e; stroke-width: 2.5; transition: cx .12s linear, cy .12s linear; }
        .decay-key { font-size: 10.5px; font-weight: 700; }
        .decay-slider {
          -webkit-appearance: none; appearance: none; width: 100%; height: 26px;
          background: transparent; cursor: pointer; display: block; margin-top: 10px;
        }
        .decay-slider::-webkit-slider-runnable-track {
          height: 5px; border-radius: 999px; background: rgba(255,255,255,.12);
        }
        .decay-slider::-moz-range-track { height: 5px; border-radius: 999px; background: rgba(255,255,255,.12); }
        .decay-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; margin-top: -7.5px;
          background: #fff; border: 3px solid var(--accent); box-shadow: 0 3px 10px rgba(0,0,0,.5);
        }
        .decay-slider::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%; background: #fff;
          border: 3px solid var(--accent); box-shadow: 0 3px 10px rgba(0,0,0,.5);
        }
        .decay-slider:focus-visible { outline: 2px solid #fff; outline-offset: 4px; border-radius: 999px; }
        .decay-slider-label {
          display: flex; justify-content: space-between; font-size: 11px;
          color: rgba(255,255,255,.4); font-weight: 600;
        }
        .decay-readout { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
        .decay-cell {
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.11);
          border-radius: 12px; padding: 13px 14px;
        }
        .decay-cell.cred { border-color: rgba(240,198,116,.3); }
        .decay-cell.up { border-color: rgba(23,166,115,.32); }
        .decay-cell.down { border-color: rgba(224,135,58,.32); }
        .decay-cell-k {
          display: block; font-size: 10px; font-weight: 800; letter-spacing: .09em;
          text-transform: uppercase; color: rgba(255,255,255,.42); margin-bottom: 7px;
        }
        .decay-cell-v { display: block; font-size: 19px; font-weight: 750; color: #fff; font-variant-numeric: tabular-nums; }
        .decay-cell-sub { display: block; font-size: 11.5px; font-weight: 700; margin-top: 3px; }
        .decay-note { margin-top: 15px; font-size: 13.5px; line-height: 1.68; color: rgba(255,255,255,.58); }

        /* Use cases */
        .usecase-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 26px 0 8px; }
        .usecase-card { padding: 20px 18px 18px; }
        .usecase-n {
          display: block; font-family: var(--font-crimson), Georgia, serif;
          font-size: 13px; font-weight: 700; letter-spacing: .1em; color: #4fd6d6; margin-bottom: 10px;
        }
        .usecase-title { display: block; font-size: 14.5px; font-weight: 750; color: #fff; line-height: 1.35; margin-bottom: 9px; }
        .usecase-copy { display: block; font-size: 13px; line-height: 1.65; color: rgba(255,255,255,.6); }

        /* Contribution cards */
        .contrib-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 26px 0 8px; }
        .contrib-card { padding: 22px 22px 20px; }
        .contrib-icon {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 10px; margin-bottom: 14px;
          background: var(--accent-dim); border: 1px solid var(--accent-line); color: #6fe0e0;
        }
        .contrib-icon svg { width: 18px; height: 18px; }
        .contrib-title { display: block; font-size: 15px; font-weight: 750; color: #fff; margin-bottom: 4px; }
        .contrib-sub { display: block; font-size: 12.5px; color: rgba(255,255,255,.45); margin-bottom: 14px; }
        .contrib-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .contrib-list li {
          display: flex; align-items: center; gap: 9px;
          font-size: 13.5px; color: rgba(255,255,255,.66);
        }
        .contrib-list li::before {
          content: ""; width: 5px; height: 5px; border-radius: 50%;
          background: var(--accent); flex-shrink: 0;
        }

        /* Data disclosure */
        .datacard { margin: 26px 0 8px; padding: 8px; }
        .data-panel { padding: 18px 16px 16px; }
        .data-rows { display: flex; flex-direction: column; gap: 11px; }
        .data-row { display: flex; align-items: flex-start; gap: 11px; font-size: 14px; line-height: 1.6; animation: chipIn .3s ease both; }
        .data-icon { width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
        .data-icon svg { width: 100%; height: 100%; }
        .data-row.yes { color: rgba(255,255,255,.78); }
        .data-row.yes .data-icon { color: #4fd6d6; }
        .data-row.no { color: rgba(255,255,255,.5); }
        .data-row.no .data-icon { color: rgba(255,255,255,.35); }
        .data-stored {
          margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.1);
          font-size: 13.5px; line-height: 1.65; color: rgba(255,255,255,.55);
        }

        .donate-block {
          border-radius: 20px; padding: 36px 40px; margin: 60px 0;
          position: relative; overflow: hidden;
          background:
            radial-gradient(circle at 12% 16%, rgba(10,163,163,.20), transparent 44%),
            linear-gradient(135deg, rgba(27,36,66,.82) 0%, rgba(36,48,96,.82) 100%);
          border: 1px solid rgba(255,255,255,.13); backdrop-filter: blur(14px);
        }
        .donate-heading { font-family: var(--font-crimson), Georgia, serif; font-size: 24px; font-weight: 600; color: #fff; margin-bottom: 12px; }
        .donate-body { font-size: 15px; line-height: 1.72; color: rgba(255,255,255,.7); margin-bottom: 24px; max-width: 480px; }
        .donate-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 24px; border-radius: 999px;
          background: var(--accent); color: #fff;
          font-size: 14px; font-weight: 600; text-decoration: none;
          box-shadow: 0 6px 20px rgba(10,163,163,.40);
          transition: background .15s, transform .13s;
        }
        .donate-btn:hover { background: #089090; transform: translateY(-1px); }

        .cta-row { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 48px; }
        .btn-primary, .btn-secondary {
          display: flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 999px;
          font-size: 15px; font-weight: 600; text-decoration: none; cursor: pointer;
          transition: transform .13s, background .15s, box-shadow .15s;
        }
        .btn-primary { background: rgba(255,255,255,.93); color: var(--navy); border: none; box-shadow: 0 10px 28px rgba(0,0,0,.3); }
        .btn-primary:hover { background: #fff; transform: translateY(-2px); }
        .btn-secondary { background: rgba(255,255,255,.06); color: #fff; border: 1px solid rgba(255,255,255,.16); backdrop-filter: blur(8px); }
        .btn-secondary:hover { background: rgba(255,255,255,.12); transform: translateY(-2px); }
        .donate-btn:focus-visible, .btn-primary:focus-visible, .btn-secondary:focus-visible, .inline-link:focus-visible {
          outline: 2px solid rgba(255,255,255,.7); outline-offset: 3px;
        }

        /* One panel at a time. Panels are min-height rather than fixed height so
           tall sections can exceed the viewport instead of clipping, while
           scroll snapping gives the about page its slide-replacement feel. */
        html { scroll-snap-type: y mandatory; }
        .page { max-width: 760px; margin: 0 auto; padding: 0 24px; }
        .panel {
          min-height: 100svh;
          display: flex; flex-direction: column; justify-content: center;
          scroll-snap-align: center;
          scroll-snap-stop: always;
          padding: 58px 0; margin-bottom: 0;
        }
        .is-enhanced .panel { transition: opacity .35s ease, transform .35s ease; }
        .is-enhanced .panel:not(.is-active) {
          opacity: .78; transform: translateY(10px) scale(.992);
        }
        .is-enhanced .panel.is-active { opacity: 1; transform: none; }
        .panel > .rule { display: none; }

        .rail {
          position: fixed; right: 22px; top: 50%; transform: translateY(-50%);
          z-index: 30; display: flex; flex-direction: column; gap: 11px;
        }
        .rail-dot {
          width: 9px; height: 9px; border-radius: 50%; padding: 0; cursor: pointer;
          border: 1px solid rgba(255,255,255,.35); background: transparent;
          transition: background .2s, transform .2s, border-color .2s;
        }
        .rail-dot:hover { background: rgba(255,255,255,.55); }
        .rail-dot.on { background: var(--accent); border-color: var(--accent); transform: scale(1.4); }
        .rail-dot:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }

        @media (max-width: 900px) { .rail { display: none; } }

        /* Panel emphasis is motion. Under reduced motion, show everything. */
        @media (prefers-reduced-motion: reduce) {
          .is-enhanced .panel:not(.is-active) { opacity: 1; transform: none; }
          html { scroll-snap-type: none; }
        }

        @media (max-width: 700px) {
          .cycle { grid-template-columns: 1fr; justify-items: center; padding: 22px 18px; gap: 88px; }
          .cycle-panel { min-height: 0; }
          .panel { padding: 52px 0; }
        }
        @media (max-width: 600px) {
          .nav { padding: 13px 16px; }
          .nav-links .nav-link { display: none; }
          .page { padding: 0 16px; }
          .hero { padding-top: 40px; }
          .donate-block { padding: 28px 22px; }
          .cta-row { flex-direction: column; }
          .beta-banner { padding: 9px 16px; font-size: 12px; }
          .map-block { padding: 20px 16px; }
          .objection-btn { padding: 20px 18px; }
          .objection-a { padding: 0 18px 20px 18px; }
          .cycle-dial { width: 220px; height: 220px; }
          .cycle-node { width: 66px; height: 66px; margin: -33px 0 0 -33px; }
          .contrib-grid { grid-template-columns: 1fr; }
          .usecase-grid { grid-template-columns: 1fr; }
          .decay { padding: 20px 16px; }
          .decay-readout { grid-template-columns: 1fr; }
          .constel-caption { min-height: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>

      <canvas ref={canvasRef} className="stars" aria-hidden="true" />

      <div className="beta-banner">
        <span className="beta-badge">Beta</span>
        Open Bible Assessment is in active development. Questions and resources are being refined — feedback on accuracy and wording is welcome.
      </div>

      <nav className="nav">
        <BrandLogo className="nav-brand" />
        <div className="nav-links">
          <Link className="nav-link" href="/">Dashboard</Link>
          <Link className="nav-link" href="/assess">Assess</Link>
          <Link className="nav-link" href="/knowledge-map">Knowledge Map</Link>
          <Link className="nav-link" href="/bli">How BLI Works</Link>
          <Link className="nav-link" href="/credential">Future Ideas</Link>
        </div>
        <Link className="nav-btn" href="/assess">Start Assessment</Link>
      </nav>

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
