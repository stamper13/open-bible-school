"use client";

import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/lib/supabase/client";
import { BLI_LEVELS, levelForScore } from "@/lib/bli";
import ScoringLab from "./ScoringLab";

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  // Mobile menu: Escape closes it, and it never survives a viewport resize
  // past the breakpoint where the inline nav-links reappear.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 680) setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileNavOpen]);

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
        .nav-right { display: flex; align-items: center; gap: 10px; }
        .mobile-nav-toggle {
          display: none; flex-direction: column; justify-content: center; gap: 4px;
          width: 34px; height: 34px; padding: 0; border-radius: 8px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); cursor: pointer;
        }
        .mobile-nav-toggle-bar { width: 16px; height: 2px; margin: 0 auto; background: #fff; border-radius: 2px; }
        .mobile-nav-toggle:focus-visible { outline: 2px solid rgba(255,255,255,.65); outline-offset: 2px; }
        .mobile-nav-panel {
          position: sticky; top: 60px; z-index: 19;
          display: flex; flex-direction: column;
          background: rgba(11,15,30,.97); backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,.08);
          padding: 6px 16px 14px;
        }
        .mobile-nav-link {
          padding: 12px 6px; font-size: 14px; font-weight: 600; color: rgba(255,255,255,.82);
          text-decoration: none; border-top: 1px solid rgba(255,255,255,.06);
        }
        .mobile-nav-link:first-child { border-top: none; }
        .mobile-nav-link:hover, .mobile-nav-link:focus-visible { color: #fff; }
        .mobile-nav-cta {
          margin-top: 6px; margin-bottom: 4px; padding: 12px 14px; border-radius: 12px;
          background: rgba(255,255,255,.94); color: var(--navy); font-weight: 700; text-align: center;
        }
        .mobile-nav-cta:hover, .mobile-nav-cta:focus-visible { color: var(--navy); background: #fff; }

        .page { position: relative; z-index: 1; max-width: 920px; margin: 0 auto; padding: 60px 24px 96px; }
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
        .hero-lead { font-size: 16.5px; line-height: 1.75; color: rgba(255,255,255,.64); max-width: 690px; }

        .section { margin-bottom: 58px; scroll-margin-top: 84px; }
        .section-label { font-size: 11px; font-weight: 700; letter-spacing: .10em; text-transform: uppercase; color: #4fd6d6; margin-bottom: 12px; }
        .section-heading { font-family: var(--font-crimson), Georgia, serif; font-size: 26px; font-weight: 600; line-height: 1.2; color: #fff; margin-bottom: 16px; }
        .section-body { font-size: 15.5px; line-height: 1.80; color: rgba(255,255,255,.66); }
        .section-body p + p { margin-top: 14px; }
        .section-body strong { color: #fff; font-weight: 650; }
        .rule { border: none; border-top: 1px solid rgba(255,255,255,.09); margin: 56px 0; }

        .flow {
          display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px;
          margin-top: 22px;
        }
        .flow-card {
          position: relative; min-height: 164px; padding: 18px;
          border: 1px solid rgba(255,255,255,.13); border-radius: 14px;
          background:
            radial-gradient(circle at 50% 18%, rgba(79,214,214,.18), transparent 34%),
            rgba(255,255,255,.045);
          overflow: hidden;
        }
        .flow-card::after {
          content: ""; position: absolute; left: 18px; right: 18px; bottom: 17px; height: 3px;
          border-radius: 999px; background: rgba(255,255,255,.10);
        }
        .flow-n {
          display: inline-flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 50%;
          background: rgba(79,214,214,.12); border: 1px solid rgba(79,214,214,.34);
          color: #8af2f2; font-size: 11px; font-weight: 900;
        }
        .flow-title {
          display: block; margin-top: 16px;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 24px; font-weight: 700; color: #fff;
        }
        .flow-copy { display: block; margin-top: 8px; color: rgba(255,255,255,.62); font-size: 13px; line-height: 1.55; }

        .measure-card {
          display: grid; grid-template-columns: minmax(0,1fr);
          max-width: 560px;
          gap: 18px; align-items: stretch; margin-top: 22px;
        }
        .measure-left,
        .confidence-card,
        .route-card {
          border: 1px solid rgba(255,255,255,.13); border-radius: 16px;
          background: rgba(255,255,255,.05);
          box-shadow: 0 22px 54px rgba(0,0,0,.24);
        }
        .measure-left { padding: 22px; }
        .measure-title {
          margin: 0;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 28px; line-height: 1; color: #fff;
        }
        .measure-copy { margin: 12px 0 0; color: rgba(255,255,255,.64); font-size: 14px; line-height: 1.65; }
        .measure-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
        .measure-chip {
          padding: 7px 10px; border-radius: 999px;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.82); font-size: 12px; font-weight: 800;
        }
        .confidence-card { padding: 22px; }
        .confidence-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
        .confidence-title { margin: 0; color: #fff; font-size: 13px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
        .confidence-score { color: #f0c674; font-family: var(--mono); font-size: 12px; font-weight: 800; }
        .confidence-track {
          position: relative; display: grid; grid-template-columns: 15fr 15fr 30fr;
          height: 14px; border-radius: 999px; overflow: hidden;
          background: rgba(255,255,255,.08); margin-bottom: 18px;
        }
        .confidence-seg:nth-child(1) { background: rgba(124,58,237,.55); }
        .confidence-seg:nth-child(2) { background: rgba(10,163,163,.70); }
        .confidence-seg:nth-child(3) { background: rgba(212,160,23,.86); }
        .confidence-marker {
          position: absolute; top: -7px; left: calc((22 / 60) * 100%);
          width: 28px; height: 28px; border-radius: 50%;
          background: #fff; border: 4px solid #0aa3a3;
          box-shadow: 0 6px 20px rgba(0,0,0,.38);
          animation: markerBreathe 3.8s ease-in-out infinite;
        }
        @keyframes markerBreathe {
          0%,100% { transform: translateX(-50%) scale(.94); }
          50% { transform: translateX(-50%) scale(1.08); }
        }
        .confidence-rows { display: grid; gap: 9px; }
        .confidence-row {
          display: grid; grid-template-columns: 108px 88px minmax(0,1fr); gap: 10px; align-items: baseline;
          padding: 10px 0; border-top: 1px solid rgba(255,255,255,.08);
        }
        .confidence-row b { color: #fff; font-size: 13px; }
        .confidence-row i { color: rgba(255,255,255,.48); font-style: normal; font-family: var(--mono); font-size: 11px; }
        .confidence-row span { color: rgba(255,255,255,.58); font-size: 12.5px; line-height: 1.45; }

        .route-card { margin-top: 18px; padding: 20px; overflow: hidden; }
        .route-card-head { display: flex; justify-content: flex-end; margin-bottom: 14px; }
        .route-lane {
          display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 11px;
          position: relative;
        }
        .route-lane::before {
          content: ""; position: absolute; left: 10%; right: 10%; top: 31px; height: 2px;
          background: linear-gradient(90deg, rgba(212,160,23,.2), rgba(79,214,214,.85), rgba(124,58,237,.2));
          z-index: 0;
        }
        .route-step {
          position: relative; z-index: 1; min-height: 132px; padding: 14px;
          border-radius: 12px; background: rgba(8,13,29,.72);
          border: 1px solid rgba(255,255,255,.12);
        }
        .route-dot {
          display: block; width: 28px; height: 28px; border-radius: 50%;
          background: var(--tone); box-shadow: 0 0 22px color-mix(in srgb, var(--tone) 70%, transparent);
          animation: routeGlow 4.4s ease-in-out infinite;
          animation-delay: calc(var(--i) * .55s);
        }
        @keyframes routeGlow {
          0%,100% { transform: scale(.92); filter: brightness(.9); }
          50% { transform: scale(1.12); filter: brightness(1.25); }
        }
        .route-label { display: block; margin-top: 16px; color: rgba(255,255,255,.54); font-size: 10px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
        .route-value { display: block; margin-top: 5px; color: #fff; font-size: 16px; font-weight: 850; line-height: 1.2; }

        details.tech-details {
          border: 1px solid rgba(255,255,255,.13); border-radius: 16px;
          background: rgba(255,255,255,.045); overflow: hidden;
        }
        .tech-summary {
          cursor: pointer; list-style: none; padding: 18px 20px;
          color: #fff; font-size: 14px; font-weight: 900;
        }
        .tech-summary::-webkit-details-marker { display: none; }
        .tech-summary span { color: rgba(255,255,255,.52); font-weight: 650; margin-left: 8px; }
        .tech-details[open] .tech-summary { border-bottom: 1px solid rgba(255,255,255,.10); }
        .tech-inner { padding: 0 20px 20px; }

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
        /* Below the width where the vertical rail has clear margin outside the
           920px content column, it becomes a floating horizontal pill anchored
           to the bottom of the viewport instead of just disappearing — tablet
           widths keep a wayfinding aid, they just don't get the side rail. */
        @media (max-width: 1100px) {
          .rail {
            top: auto; right: auto; left: 50%; bottom: 18px;
            transform: translateX(-50%);
            flex-direction: row; gap: 9px;
            background: rgba(11,15,30,.88); backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,.16); border-radius: 999px;
            padding: 9px 14px; box-shadow: 0 12px 30px rgba(0,0,0,.4);
          }
        }
        @media (max-width: 680px) { .rail { display: none; } }

        .illustrative-tag {
          font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
          color: rgba(255,255,255,.42); background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 4px 10px;
        }

        .mechanic-range-inline {
          display: block; margin-top: 8px; font-family: var(--mono); font-size: 11px; color: #f0c674;
        }

        .lab-jump {
          margin-top: 14px;
        }
        .inline-link-btn {
          background: none; border: none; padding: 0; cursor: pointer; font: inherit;
          color: #6fe0e0; text-decoration: underline; text-underline-offset: 3px;
          text-decoration-color: rgba(111,224,224,.4);
        }
        .inline-link-btn:hover { text-decoration-color: #6fe0e0; }
        .inline-link-btn:focus-visible { outline: 2px solid #fff; outline-offset: 3px; border-radius: 4px; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: .001ms !important; animation-iteration-count: 1 !important;
            transition-duration: .001ms !important;
          }
        }
        @media (max-width: 680px) {
          .nav { padding: 13px 16px; }
          .nav-links .nav-link { display: none; }
          /* The header CTA moves into the mobile menu itself at this width —
             logo + hamburger only, so the wordmark never has to fight a
             second pill for space. */
          .nav-right .nav-btn { display: none; }
          .mobile-nav-toggle { display: flex; }
          .page { padding: 40px 16px 72px; }
          .beta-banner { padding: 9px 16px; font-size: 12px; }
          .mechanic-grid { grid-template-columns: 1fr; }
          .flow { grid-template-columns: 1fr; }
          .measure-card { grid-template-columns: 1fr; }
          .confidence-row { grid-template-columns: 1fr; gap: 3px; }
          .route-lane { grid-template-columns: 1fr; }
          .route-lane::before { display: none; }
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
        <BrandLogo className="nav-brand" />
        <div className="nav-links">
          <Link className="nav-link" href="/">Dashboard</Link>
          <Link className="nav-link" href="/assess">Assess</Link>
          <Link className="nav-link" href="/knowledge-map">Knowledge Map</Link>
          <Link className="nav-link" href="/about">About</Link>
          <Link className="nav-link" href="/credential">Future Ideas</Link>
        </div>
        <div className="nav-right">
          <Link className="nav-btn" href="/assess">Start Assessment</Link>
          <button
            type="button"
            className="mobile-nav-toggle"
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
            aria-controls="bli-mobile-nav"
            onClick={() => setMobileNavOpen(open => !open)}
          >
            <span className="mobile-nav-toggle-bar" />
            <span className="mobile-nav-toggle-bar" />
            <span className="mobile-nav-toggle-bar" />
          </button>
        </div>
      </nav>

      {mobileNavOpen && (
        <div className="mobile-nav-panel" id="bli-mobile-nav" role="menu" aria-label="Site">
          <Link className="mobile-nav-link mobile-nav-cta" role="menuitem" href="/assess" onClick={() => setMobileNavOpen(false)}>Start Assessment</Link>
          <Link className="mobile-nav-link" role="menuitem" href="/" onClick={() => setMobileNavOpen(false)}>Dashboard</Link>
          <Link className="mobile-nav-link" role="menuitem" href="/assess" onClick={() => setMobileNavOpen(false)}>Assess</Link>
          <Link className="mobile-nav-link" role="menuitem" href="/knowledge-map" onClick={() => setMobileNavOpen(false)}>Knowledge Map</Link>
          <Link className="mobile-nav-link" role="menuitem" href="/about" onClick={() => setMobileNavOpen(false)}>About</Link>
          <Link className="mobile-nav-link" role="menuitem" href="/credential" onClick={() => setMobileNavOpen(false)}>Future Ideas</Link>
        </div>
      )}

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
