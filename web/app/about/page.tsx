"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

const CYCLE_STEPS = [
  {
    key: "assess",
    title: "Assess",
    copy: "Measure real content familiarity instead of assuming knowledge from credentials or completed material.",
    detail: "It assesses underlying competency directly rather than relying on proxies like credentials, course completion, reading plans, or self-confidence.",
  },
  {
    key: "map",
    title: "Map",
    copy: "Show the shape of your knowledge by section, book, and eventually other domains.",
    detail: "Once there is evidence, it maps where your knowledge is strong and where it is thin — not as a single number, but as a shape.",
  },
  {
    key: "route",
    title: "Route",
    copy: "Point you toward the passages and resources that match your actual gaps.",
    detail: "From the map, it can route you toward the passages and resources most relevant to your actual gaps rather than a generic reading plan.",
  },
  {
    key: "repeat",
    title: "Repeat",
    copy: "Return after study and let the map become more accurate as evidence accumulates.",
    detail: "Over time, repeated assessment gives a clearer picture of growth, and the map becomes more accurate as evidence accumulates.",
  },
];

const SCOPE_TABS = [
  {
    key: "tests",
    label: "What it tests",
    lead: "The grammar of biblical knowledge — the foundational content that underlies all serious engagement with Scripture.",
    items: [
      "The events",
      "The people",
      "The sequence",
      "Textual detail",
      "What happened in Genesis 15",
      "What the two goats in Leviticus 16 represent",
      "What 2 Kings says about the northern kingdom, and why",
    ],
  },
  {
    key: "doesnt",
    label: "What it doesn't",
    lead: "Positions that require drawing multiple passages together into a theological argument fall entirely outside its scope.",
    items: [
      "Wisdom",
      "Interpretive skill",
      "Theological depth",
      "How Scripture has shaped a life",
      "Infant vs. believer's baptism",
      "Denominational position",
    ],
  },
];

const MAP_SECTIONS = [
  { name: "Torah", books: "Genesis – Deuteronomy", color: "#d4a017", value: 78 },
  { name: "Former Prophets", books: "Joshua – Kings", color: "#0e8c6a", value: 54 },
  { name: "Latter Prophets", books: "Isaiah – Malachi", color: "#2563c4", value: 31 },
  { name: "Writings", books: "Psalms, Proverbs, Job…", color: "#7c3aed", value: 42 },
];

export default function AboutPage() {
  const [cycleStep, setCycleStep] = useState(0);
  const [scopeTab, setScopeTab] = useState(0);
  const [objectionOpen, setObjectionOpen] = useState(false);
  const [mapActive, setMapActive] = useState<number | null>(null);
  const [mapRevealed, setMapRevealed] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

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
    const node = mapRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setMapRevealed(true);
    }, { threshold: 0.35 });
    observer.observe(node);
    // The bars must never be left empty if the observer never reports.
    const fallback = window.setTimeout(() => setMapRevealed(true), 1500);
    return () => { observer.disconnect(); window.clearTimeout(fallback); };
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
        .hero { margin-bottom: 64px; }
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

        .pull-quote { border-left: 3px solid var(--accent); margin: 48px 0; padding: 4px 0 4px 24px; }
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
        .cycle { margin: 30px 0 8px; padding: 26px; display: grid; grid-template-columns: 250px minmax(0,1fr); gap: 28px; align-items: center; }
        .cycle-dial { position: relative; width: 250px; height: 250px; }
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
        .cycle-panel { min-height: 150px; }
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
        .objection { margin: 48px 0; padding: 0; overflow: hidden; }
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

        @media (max-width: 700px) {
          .cycle { grid-template-columns: 1fr; justify-items: center; padding: 22px 18px; gap: 30px; }
          .cycle-panel { min-height: 0; }
        }
        @media (max-width: 600px) {
          .nav { padding: 13px 16px; }
          .nav-links .nav-link { display: none; }
          .page { padding: 40px 16px 72px; }
          .donate-block { padding: 28px 22px; }
          .cta-row { flex-direction: column; }
          .beta-banner { padding: 9px 16px; font-size: 12px; }
          .map-block { padding: 20px 16px; }
          .objection-btn { padding: 20px 18px; }
          .objection-a { padding: 0 18px 20px 18px; }
          .cycle-dial { width: 220px; height: 220px; }
          .cycle-node { width: 66px; height: 66px; margin: -33px 0 0 -33px; }
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
        <Link className="nav-brand" href="/">Open Bible Assessment</Link>
        <div className="nav-links">
          <Link className="nav-link" href="/">Dashboard</Link>
          <Link className="nav-link" href="/bli">How BLI Works</Link>
          <Link className="nav-link" href="/credential">Future Ideas</Link>
        </div>
        <Link className="nav-btn" href="/">Start Assessment</Link>
      </nav>

      <main className="page">
        <header className="hero">
          <div className="hero-eyebrow">About Open Bible Assessment</div>
          <h1 className="hero-heading">The grammar of<br/><em>biblical knowledge</em></h1>
          <p className="hero-lead">
            Open Bible Assessment is a free, adaptive tool that helps you find out what you actually know about the Bible, where your gaps are, and what to study next. It is not a spiritual barometer. It measures one thing: familiarity with the content of Scripture.
          </p>
        </header>

        <section className="section">
          <p className="section-label">The basic idea</p>
          <h2 className="section-heading">Assess, map, route, repeat</h2>
          <div className="section-body">
            <p>
              Open Bible Assessment is built around a simple cycle: <strong>assess, map, route, repeat</strong>. First, it assesses underlying competency directly rather than relying on proxies like credentials, course completion, reading plans, or self-confidence. Then it maps where your knowledge is strong and where it is thin. From there, it can route you toward the passages and resources most relevant to your actual gaps. Over time, repeated assessment gives a clearer picture of growth.
            </p>
            <p>
              This is different from many approaches to Bible training. The problem is not a lack of resources. There are more books, sermons, courses, podcasts, study guides, and curricula than any one person could ever use. The harder question is knowing what you actually need next.
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

        <section className="section">
          <p className="section-label">What it measures</p>
          <h2 className="section-heading">Content knowledge, nothing more</h2>

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
              The Bible Literacy Index (BLI) measures the <strong>grammar of biblical knowledge</strong> — the foundational content that underlies all serious engagement with Scripture: the events, the people, the sequence, the textual detail. What happened in Genesis 15. What the two goats in Leviticus 16 represent. What 2 Kings says about the northern kingdom and why. These are mostly questions of textual content rather than denominational position. They can be tested. They can be measured.
            </p>
            <p>
              In some cases a question may presume a particular reading of a text — that is unavoidable at this level of detail. What the BLI does not test are positions that require drawing multiple passages together into a theological argument: whether infant baptism or believer&apos;s baptism is correct, for instance, is a question that falls entirely outside its scope.
            </p>
            <p>
              What the BLI cannot measure — and does not attempt to — is wisdom, interpretive skill, theological depth, or how the Bible has shaped a person&apos;s life. Strong Scripture content knowledge is something a Presbyterian, a Baptist, an Anglican, and a Pentecostal can all demonstrate — or lack. The tool belongs to no denomination and tilts toward no tradition in what it tests.
            </p>
            <p>
              A high BLI score does not make someone a better Christian, a more faithful elder, or a wiser pastor. It means they know the content of Scripture well. That knowledge matters — it undergirds everything else. But it is the floor, not the ceiling.
            </p>
          </div>
        </section>

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
              <p>Not fully — and we&apos;re not trying to. But testing it is not a new idea. Seminaries run Bible content exams. Ordination boards test Scripture knowledge before licensing ministers. What they&apos;re all doing is the same thing: assessing something real — whether a person has engaged with and retained the content of Scripture.</p>
              <p>The BLI works on the same principle. It won&apos;t capture wisdom, interpretive skill, or spiritual formation. But it can tell whether someone knows the events, people, and passages of the Old Testament. Think of the score as a proxy — useful and honest within its scope, not a final verdict on anything.</p>
            </div>
          )}
        </div>

        <section className="section">
          <p className="section-label">How it works</p>
          <h2 className="section-heading">Adaptive, continuous, honest</h2>
          <div className="section-body">
            <p>
              The assessment adapts to you. It weights questions toward the most significant events and passages in Scripture, then focuses on areas where it is most uncertain about your knowledge. The more questions you answer, the more precise your profile becomes. There is no finished state — you can always go deeper.
            </p>
            <p>
              Your BLI score is a snapshot, not a verdict. Early in the process it reflects a small sample; over time it becomes a genuinely informative picture of where you stand. The dashboard shows you not just an overall score but a breakdown by section — Torah, Former Prophets, Latter Prophets — so you can see exactly where your knowledge is strong and where it thins out.
            </p>
          </div>

          <div className="map-block glass" ref={mapRef}>
            <div className="map-head">
              <span className="map-title">A breakdown by section</span>
              <span className="map-tag">Illustrative — not your data</span>
            </div>
            <div className="map-rows">
              {MAP_SECTIONS.map((section, i) => (
                <button
                  key={section.name}
                  type="button"
                  className="map-row"
                  aria-pressed={mapActive === i}
                  onClick={() => setMapActive(mapActive === i ? null : i)}
                >
                  <span className="map-row-top">
                    <span className="map-name">
                      <span className="map-swatch" style={{ background: section.color }} />
                      {section.name}
                    </span>
                    <span className="map-books">{section.books}</span>
                  </span>
                  <span className="map-bar">
                    <span
                      className="map-fill"
                      style={{
                        width: mapRevealed ? `${section.value}%` : 0,
                        background: `linear-gradient(90deg, ${section.color}, ${section.color}bb)`,
                        transitionDelay: `${i * 130}ms`,
                        opacity: mapActive === null || mapActive === i ? 1 : 0.35,
                      } as CSSProperties}
                    />
                  </span>
                </button>
              ))}
            </div>
            <p className="map-note">
              {mapActive === null
                ? "Each bar is one section of the Old Testament. A profile like this one says: the Torah is solid, the Latter Prophets are thin — so that is where study would pay off most."
                : `${MAP_SECTIONS[mapActive].name} (${MAP_SECTIONS[mapActive].books}). In this illustration the profile shows ${MAP_SECTIONS[mapActive].value}% — ${MAP_SECTIONS[mapActive].value >= 60 ? "a relatively strong area" : "an area where study would pay off"}.`}
            </p>
          </div>

          <div className="section-body" style={{ marginTop: 22 }}>
            <p>
              For readers who want the technical details, including how weighting and the display scale work, see <Link className="inline-link" href="/bli">How the Bible Literacy Index Works</Link>.
            </p>
          </div>
        </section>

        <hr className="rule" />

        <blockquote className="pull-quote">
          <p>&ldquo;The destination is the real goal. The score, the map, and the recommendations are only useful if they send you back to Scripture with a clearer sense of where to go.&rdquo;</p>
        </blockquote>

        <section className="section">
          <p className="section-label">The destination</p>
          <h2 className="section-heading">Resources are means, not the goal</h2>
          <div className="section-body">
            <p>
              People grow in biblical knowledge through many faithful means: reading Scripture, hearing sermons, studying commentaries, taking courses, talking with pastors and teachers, memorizing passages, and discussing the Bible with other Christians. Open Bible Assessment does not replace any of those. It helps you use them more tactically.
            </p>
            <p>
              The point is not to collect resources, complete courses, or accumulate credentials as though those automatically equal biblical competence. Those things can be valuable. But they are means. The goal is to know Scripture better.
            </p>
            <p>
              Open Bible Assessment is not trying to solve biblical literacy by becoming one more content library in an already crowded world. It is trying to become a competency map: a way to see what is actually there, what is missing, and what would be most fruitful to pursue next.
            </p>
          </div>
        </section>

        <hr className="rule" />

        <section className="section">
          <p className="section-label">For churches</p>
          <h2 className="section-heading">An objective baseline for biblical literacy</h2>
          <div className="section-body">
            <p>
              Seminary grades and an MDiv in hand are imperfect proxies for biblical knowledge. That is not a criticism of seminary education — it is an observation about what credentials measure and what they do not. Course grades reflect performance in academic contexts. They do not reliably tell a session whether a candidate has read and absorbed the Old Testament. And the converse is equally true: some of the most biblically knowledgeable people have no formal training at all. The credential and the knowledge are not the same thing.
            </p>
            <p>
              Open Bible Assessment is working toward something that does not yet exist: an independent, objective measure of Scripture content knowledge — available to any candidate regardless of how or where they were trained, and interpretable by any session without specialized knowledge of seminary curricula or grading standards.
            </p>
            <p>
              This is the core advantage of direct competency assessment: it bypasses proxies and looks at the underlying thing itself. Credentials, courses, and libraries all have a place. But the question beneath them is simpler and more demanding: what does this person actually know?
            </p>
          </div>
          <div className="future-note">
            <span>The verified assessment feature for church credentialing is a planned feature, not yet available. The question bank is currently in beta and being refined through community feedback. If you are a church leader or session clerk interested in using Open Bible Assessment when it is ready, you are welcome to get in touch.</span>
          </div>
        </section>

        <section className="section">
          <p className="section-label">Curated resources</p>
          <h2 className="section-heading">Where to go from here</h2>
          <div className="section-body">
            <p>
              The dashboard identifies your gaps and links to curated resources for each area.
            </p>
          </div>
        </section>

        <section className="section">
          <p className="section-label">Beta project</p>
          <h2 className="section-heading">A proof of concept being refined in public</h2>
          <div className="section-body">
            <p>
              Open Bible Assessment is currently a beta project. The goal is to build a useful diagnostic tool for Bible content knowledge, not to pretend that the present score is already a fully validated psychometric instrument. The BLI is provisional: useful for mapping gaps and guiding study, but still in need of more question review, more user data, and more statistical validation.
            </p>
            <p>
              That means feedback is part of the work. Biblical insight matters: question wording, textual accuracy, passage selection, book coverage, and theological neutrality all need careful review. Technical insight matters too: scoring, data modeling, accessibility, security, analytics, and frontend/backend reliability all affect whether this can become genuinely useful.
            </p>
            <p>
              If the idea has potential, it will need more than one person. The hope is to make the early version good enough to test honestly, learn from real use, and invite help from people who care about Scripture, education, statistics, and software.
            </p>
          </div>
        </section>

        <section className="section">
          <p className="section-label">Your data</p>
          <h2 className="section-heading">What is stored, and what is not</h2>
          <div className="section-body">
            <p>
              A score is an estimate, and an early one is a rough estimate. The BLI is calculated from
              the questions you have answered, so it becomes more reliable as more responses accumulate.
              A handful of answers indicates very little; a few dozen across different sections indicates
              considerably more. It is a measure of Scripture content knowledge — not an accredited
              credential, and not a judgement of your faith or understanding.
            </p>
            <p>
              You can assess without an account. If you do, progress is held in your browser only and is
              <strong> temporary</strong> — clearing your browser data, or switching device or browser,
              loses it. Signing in preserves your progress and lets it carry across devices, and the
              anonymous work you have already done transfers to your account when you sign in.
            </p>
            <p>
              For a signed-in account the stored data is your email address, your assessment attempts,
              the answers you gave, and the scores derived from them. There is no advertising and your
              responses are not sold or shared. To request a copy of your data or have your account and
              its assessment history deleted, email{" "}
              <a className="inline-link" href="mailto:adstamper35@gmail.com?subject=Open%20Bible%20Assessment%20data%20request">
                adstamper35@gmail.com
              </a>.
            </p>
            <p>
              Corrections and criticism are genuinely wanted — on biblical accuracy and question wording
              as much as on engineering. The same address reaches the project for{" "}
              <a className="inline-link" href="mailto:adstamper35@gmail.com?subject=Open%20Bible%20Assessment%20feedback">
                feedback
              </a>.
            </p>
          </div>
        </section>

        <div className="donate-block">
          <h2 className="donate-heading">Free, and staying that way</h2>
          <p className="donate-body">
            Open Bible Assessment is not a product. There is no subscription, no premium tier, no advertising. The tool is free to use and will remain so. If you find it useful and want to support the ongoing work, you can make a donation. If not, use it anyway.
          </p>
          <a className="donate-btn" href="/donate">Support the work</a>
        </div>

        <div className="cta-row">
          <Link className="btn-primary" href="/">Start the assessment</Link>
          <Link className="btn-secondary" href="/bli">How BLI works</Link>
          <Link className="btn-secondary" href="/credential">Future ideas</Link>
        </div>
      </main>
    </>
  );
}
