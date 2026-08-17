"use client";

import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import SiteFooter from "@/components/SiteFooter";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

type AccentKey = "teal" | "gold" | "blue" | "purple";
type ModuleStatus = "In development" | "Planned";

type RoadmapModule = {
  id: string;
  title: string;
  status: ModuleStatus;
  accent: AccentKey;
  description: string;
  motif: AccentKey;
};

const ACCENTS: Record<AccentKey, { main: string; soft: string; line: string; glow: string }> = {
  teal: { main: "#0aa3a3", soft: "rgba(10,163,163,.16)", line: "rgba(10,163,163,.34)", glow: "rgba(10,163,163,.22)" },
  gold: { main: "#d4a017", soft: "rgba(212,160,23,.16)", line: "rgba(212,160,23,.34)", glow: "rgba(212,160,23,.20)" },
  blue: { main: "#2563c4", soft: "rgba(37,99,196,.16)", line: "rgba(37,99,196,.34)", glow: "rgba(37,99,196,.22)" },
  purple: { main: "#7c3aed", soft: "rgba(124,58,237,.16)", line: "rgba(124,58,237,.34)", glow: "rgba(124,58,237,.22)" },
};

const MODULES: RoadmapModule[] = [
  {
    id: "printable-assessments",
    title: "Printable verification assessments",
    status: "In development",
    accent: "teal",
    motif: "teal",
    description: "Generate a paper assessment matched to an individual's current level, administer it under supervision, and use the result to verify an online BLI or confirm specific strengths and gaps. It is the offline counterpart to the online assessment.",
  },
  {
    id: "biblical-languages",
    title: "Biblical languages",
    status: "Planned",
    accent: "gold",
    motif: "gold",
    description: "Hebrew and Greek as a parallel literacy track: alphabet, core vocabulary, morphology, and progressive reading fluency, scored on its own index.",
  },
  {
    id: "church-history",
    title: "Church history",
    status: "Planned",
    accent: "blue",
    motif: "blue",
    description: "From the apostolic era to the present: councils, creeds, movements, and the figures behind them, assessed with the same denominationally neutral approach.",
  },
  {
    id: "systematic-theology",
    title: "Systematic theology",
    status: "Planned",
    accent: "purple",
    motif: "purple",
    description: "Doctrine organized by topic rather than by book, mapping how biblical material coheres into structured theological categories.",
  },
];

const TIMELINE_ERAS = ["Apostolic", "Councils", "Reformation", "Present"];
const GLYPHS = ["א", "Ω", "ש", "β", "ל", "λ"];
const THEOLOGY_NODES = [
  { label: "God", x: 150, y: 34 },
  { label: "Man", x: 254, y: 92 },
  { label: "Sin", x: 226, y: 186 },
  { label: "Salvation", x: 74, y: 186 },
  { label: "Church", x: 46, y: 92 },
];

function accentVars(key: AccentKey): CSSProperties {
  const a = ACCENTS[key];
  return {
    ["--card-accent" as string]: a.main,
    ["--card-accent-soft" as string]: a.soft,
    ["--card-accent-line" as string]: a.line,
    ["--card-accent-glow" as string]: a.glow,
  } as CSSProperties;
}

function CardMotif({ kind }: { kind: AccentKey }) {
  if (kind === "teal") {
    return (
      <div className="card-motif motif-paper" aria-hidden="true">
        <div className="paper-lines" />
        <svg className="paper-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  if (kind === "gold") {
    return (
      <div className="card-motif motif-glyphs" aria-hidden="true">
        {GLYPHS.map((g, i) => (
          <span key={i} className={`glyph glyph-${i}`}>{g}</span>
        ))}
      </div>
    );
  }
  if (kind === "blue") {
    return (
      <div className="card-motif motif-timeline" aria-hidden="true">
        <div className="timeline-line" />
        {TIMELINE_ERAS.map((era, i) => (
          <div key={era} className={`timeline-node timeline-node-${i}`}>
            <span className="timeline-dot" />
            <span className="timeline-label">{era}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <svg className="card-motif motif-graph" viewBox="0 0 300 220" aria-hidden="true">
      {THEOLOGY_NODES.map((node, i) => {
        const next = THEOLOGY_NODES[(i + 1) % THEOLOGY_NODES.length];
        return <line key={`l-${i}`} x1={node.x} y1={node.y} x2={next.x} y2={next.y} className="graph-line" />;
      })}
      {THEOLOGY_NODES.map((node, i) => (
        <g key={node.label} className={`graph-node graph-node-${i}`}>
          <circle cx={node.x} cy={node.y} r="5" />
          <text x={node.x} y={node.y - 12} textAnchor="middle">{node.label}</text>
        </g>
      ))}
    </svg>
  );
}

export default function CredentialPage() {
  const total = MODULES.length;
  const [index, setIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dragStartXRef = useRef(0);
  const dragStartIndexRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
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

      const nebulaA = ctx.createRadialGradient(w * 0.78, h * 0.22, 0, w * 0.78, h * 0.22, w * 0.45);
      nebulaA.addColorStop(0, "rgba(10,163,163,0.07)");
      nebulaA.addColorStop(1, "transparent");
      ctx.fillStyle = nebulaA;
      ctx.fillRect(0, 0, w, h);

      const nebulaB = ctx.createRadialGradient(w * 0.18, h * 0.8, 0, w * 0.18, h * 0.8, w * 0.4);
      nebulaB.addColorStop(0, "rgba(124,58,237,0.05)");
      nebulaB.addColorStop(1, "transparent");
      ctx.fillStyle = nebulaB;
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

  const goTo = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min(total - 1, next)));
  }, [total]);
  const goPrev = useCallback(() => setIndex(i => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIndex(i => Math.min(total - 1, i + 1)), [total]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
  }, [goNext, goPrev]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    draggingRef.current = true;
    dragOffsetRef.current = 0;
    dragStartXRef.current = e.clientX;
    dragStartIndexRef.current = index;
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsDragging(true);
  }, [index]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || pointerIdRef.current !== e.pointerId) return;
    const delta = e.clientX - dragStartXRef.current;
    const atStart = dragStartIndexRef.current === 0 && delta > 0;
    const atEnd = dragStartIndexRef.current === total - 1 && delta < 0;
    const offset = atStart || atEnd ? delta * 0.35 : delta;
    dragOffsetRef.current = offset;
    setDragOffset(offset);
  }, [total]);

  const finishDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const width = viewportRef.current?.offsetWidth ?? window.innerWidth;
    const threshold = Math.max(40, width * 0.15);
    const offset = dragOffsetRef.current;
    if (offset <= -threshold) goTo(dragStartIndexRef.current + 1);
    else if (offset >= threshold) goTo(dragStartIndexRef.current - 1);
    dragOffsetRef.current = 0;
    pointerIdRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, [goTo]);

  useEffect(() => {
    if (!contactOpen) return;
    firstFieldRef.current?.focus();
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setContactOpen(false); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [contactOpen]);

  const submitContact = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const reason = String(data.get("reason") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
    const subject = `Open Bible Assessment — ${reason}`;
    const body = `${message}\n\n— ${name}`;
    window.location.href = `mailto:adstamper35@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setContactOpen(false);
  }, []);

  const trackStyle: CSSProperties = useMemo(() => ({
    transform: `translate3d(calc(-${index * 100}% + ${dragOffset}px), 0, 0)`,
    transition: isDragging || reducedMotion ? "none" : "transform 560ms cubic-bezier(0.34, 1.42, 0.64, 1)",
  }), [dragOffset, index, isDragging, reducedMotion]);

  const activeModule = MODULES[index];

  return (
    <>
      <style>{`
        :root {
          --navy: #1b2442; --accent: #0aa3a3; --muted: #566070;
          --accent-dim: rgba(10,163,163,.10); --accent-line: rgba(10,163,163,.22);
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

        .page { position: relative; z-index: 1; max-width: 900px; margin: 0 auto; padding: 56px 24px 96px; }

        .hero { margin-bottom: 52px; max-width: 640px; }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          border-radius: 999px; padding: 5px 14px; font-size: 12px; font-weight: 700;
          letter-spacing: .06em; text-transform: uppercase; color: #6fe0e0; margin-bottom: 20px;
        }
        .hero-eyebrow::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
        .hero-heading {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(28px, 4.5vw, 44px); font-weight: 600; line-height: 1.14;
          color: #fff; letter-spacing: .005em; margin-bottom: 18px;
        }
        .hero-lead { font-size: 16px; line-height: 1.75; color: rgba(255,255,255,.62); margin-bottom: 24px; }

        .section-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: .10em;
          text-transform: uppercase; color: rgba(255,255,255,.45); margin-bottom: 16px;
        }

        /* Carousel */
        .carousel {
          position: relative;
          border-radius: 24px;
          outline: none;
        }
        .carousel:focus-visible { outline: 2px solid rgba(255,255,255,.55); outline-offset: 6px; }
        .carousel-viewport {
          overflow: hidden; border-radius: 24px; touch-action: pan-y; cursor: grab;
        }
        .carousel-viewport.is-dragging { cursor: grabbing; }
        .carousel-track {
          display: flex; width: 100%; will-change: transform;
          user-select: none; -webkit-user-select: none;
        }

        .module-card {
          flex: 0 0 100%; position: relative; overflow: hidden;
          min-height: 420px; padding: 36px 30px 32px;
          border-radius: 24px;
          border: 1px solid var(--card-accent-line, rgba(255,255,255,.14));
          background:
            radial-gradient(circle at 12% 8%, var(--card-accent-glow, transparent), transparent 42%),
            linear-gradient(160deg, rgba(255,255,255,.07), rgba(255,255,255,.02));
          backdrop-filter: blur(18px);
          box-shadow: 0 26px 60px rgba(0,0,0,.42), inset 0 0 60px rgba(255,255,255,.02);
          display: flex; flex-direction: column; gap: 18px;
        }
        .module-card::before {
          content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, transparent, var(--card-accent, var(--accent)), transparent);
        }
        .module-number {
          font-family: var(--font-crimson), Georgia, serif; font-size: 13px; font-weight: 600;
          letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.4);
        }
        .status-pill {
          position: relative; z-index: 1;
          display: inline-flex; align-items: center; gap: 7px; width: fit-content;
          padding: 6px 13px; border-radius: 999px; font-size: 11.5px; font-weight: 800;
          letter-spacing: .07em; text-transform: uppercase;
        }
        .status-pill.status-progress {
          background: var(--card-accent-soft); border: 1px solid var(--card-accent-line);
          color: var(--card-accent);
        }
        .status-pill.status-planned {
          background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18);
          color: rgba(255,255,255,.75);
        }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
        .status-pill.status-progress .status-dot { animation: statusPulse 1.8s ease-in-out infinite; }
        @keyframes statusPulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--card-accent-soft); opacity: 1; }
          50% { box-shadow: 0 0 0 5px transparent; opacity: .65; }
        }

        .module-title {
          position: relative; z-index: 1;
          font-family: var(--font-crimson), Georgia, serif; font-weight: 600;
          font-size: clamp(24px, 3.4vw, 32px); line-height: 1.16; color: #fff;
        }
        .module-desc {
          position: relative; z-index: 1;
          font-size: 15px; line-height: 1.75; color: rgba(255,255,255,.68); max-width: 480px;
        }

        /* Decorative motifs */
        .card-motif { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }

        .motif-paper .paper-lines {
          position: absolute; inset: 14% -10% auto 40%; height: 70%;
          background-image: repeating-linear-gradient(to bottom, var(--card-accent-line) 0px, var(--card-accent-line) 1.5px, transparent 1.5px, transparent 25px);
          opacity: .55; transform: rotate(-4deg);
        }
        .paper-check {
          position: absolute; right: 9%; bottom: 10%; width: 120px; height: 120px;
          color: var(--card-accent); opacity: .14; stroke-width: 1.4;
        }

        .motif-glyphs .glyph {
          position: absolute; font-family: var(--font-crimson), Georgia, serif;
          color: var(--card-accent); opacity: .16; font-weight: 600;
          animation: glyphFloat 7s ease-in-out infinite;
        }
        .glyph-0 { top: 8%; right: 12%; font-size: 92px; animation-delay: 0s; }
        .glyph-1 { top: 42%; right: 30%; font-size: 56px; animation-delay: .8s; }
        .glyph-2 { top: 58%; right: 6%; font-size: 68px; animation-delay: 1.6s; }
        .glyph-3 { top: 4%; right: 38%; font-size: 44px; animation-delay: 2.4s; }
        .glyph-4 { top: 74%; right: 42%; font-size: 50px; animation-delay: 3.1s; }
        .glyph-5 { top: 24%; right: 2%; font-size: 40px; animation-delay: 1.1s; }
        @keyframes glyphFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-14px) rotate(3deg); }
        }

        .motif-timeline { display: flex; align-items: center; justify-content: flex-end; padding: 0 8% 0 30%; }
        .timeline-line { position: absolute; right: 8%; top: 50%; width: 60%; height: 1px; background: var(--card-accent-line); }
        .timeline-node {
          position: absolute; top: 50%; display: flex; flex-direction: column; align-items: center; gap: 8px;
          transform: translate(50%, -50%);
        }
        .timeline-node-0 { right: 62%; } .timeline-node-1 { right: 42%; } .timeline-node-2 { right: 22%; } .timeline-node-3 { right: 6%; }
        .timeline-dot {
          width: 11px; height: 11px; border-radius: 50%; background: var(--card-accent);
          box-shadow: 0 0 0 4px var(--card-accent-soft);
          animation: timelineGlow 3.4s ease-in-out infinite;
        }
        .timeline-node-1 .timeline-dot { animation-delay: .5s; }
        .timeline-node-2 .timeline-dot { animation-delay: 1s; }
        .timeline-node-3 .timeline-dot { animation-delay: 1.5s; }
        @keyframes timelineGlow {
          0%, 100% { opacity: .55; } 50% { opacity: 1; }
        }
        .timeline-label {
          font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
          color: rgba(255,255,255,.34); white-space: nowrap;
        }

        .motif-graph { position: absolute; right: -4%; top: -6%; width: 78%; height: 100%; opacity: .8; }
        .graph-line { stroke: var(--card-accent-line); stroke-width: 1; }
        .graph-node circle { fill: var(--card-accent); opacity: .5; animation: nodePulse 3.6s ease-in-out infinite; }
        .graph-node text {
          fill: rgba(255,255,255,.3); font-size: 9px; font-weight: 700;
          letter-spacing: .04em; text-transform: uppercase;
        }
        .graph-node-1 circle, .graph-node-1 { animation-delay: .4s; }
        .graph-node-2 circle { animation-delay: .8s; }
        .graph-node-3 circle { animation-delay: 1.2s; }
        .graph-node-4 circle { animation-delay: 1.6s; }
        @keyframes nodePulse { 0%, 100% { opacity: .35; } 50% { opacity: .85; } }

        /* Controls */
        .carousel-controls {
          display: flex; align-items: center; justify-content: center; gap: 20px;
          margin-top: 26px;
        }
        .carousel-btn {
          display: flex; align-items: center; justify-content: center;
          width: 42px; height: 42px; border-radius: 50%;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16);
          color: #fff; cursor: pointer; transition: background .15s, transform .13s, opacity .15s;
        }
        .carousel-btn svg { width: 18px; height: 18px; }
        .carousel-btn:hover:not(:disabled) { background: rgba(255,255,255,.14); transform: translateY(-1px); }
        .carousel-btn:disabled { opacity: .3; cursor: not-allowed; }
        .carousel-btn:focus-visible { outline: 2px solid rgba(255,255,255,.6); outline-offset: 3px; }

        .carousel-dots { display: flex; align-items: center; gap: 10px; }
        .carousel-dot {
          width: 10px; height: 10px; border-radius: 50%; padding: 0;
          background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.24);
          cursor: pointer; transition: background .15s, transform .15s, width .2s;
        }
        .carousel-dot:hover { background: rgba(255,255,255,.35); }
        .carousel-dot.is-active { background: var(--dot-accent, #fff); width: 26px; border-radius: 999px; border-color: transparent; }
        .carousel-dot:focus-visible { outline: 2px solid rgba(255,255,255,.6); outline-offset: 3px; }

        .sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }

        .contact-strip {
          margin-top: 60px;
          background: linear-gradient(135deg, rgba(27,36,66,.7) 0%, rgba(36,48,96,.7) 100%);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 20px; padding: 36px 40px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 24px; flex-wrap: wrap; backdrop-filter: blur(14px);
        }
        .contact-heading { font-family: var(--font-crimson), Georgia, serif; font-size: 21px; font-weight: 600; color: #fff; margin-bottom: 8px; line-height: 1.2; }
        .contact-desc { font-size: 14px; line-height: 1.65; color: rgba(255,255,255,.6); max-width: 420px; }
        .contact-btn {
          display: flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: 999px;
          background: var(--accent); color: #fff; font-size: 14px; font-weight: 600;
          text-decoration: none; white-space: nowrap; flex-shrink: 0;
          box-shadow: 0 6px 20px rgba(10,163,163,.40); transition: background .15s, transform .13s;
        }
        .contact-btn { border: none; cursor: pointer; font-family: inherit; }
        .contact-btn svg { width: 16px; height: 16px; }
        .contact-btn:hover { background: #089090; transform: translateY(-1px); }
        .contact-btn:focus-visible { outline: 2px solid rgba(255,255,255,.65); outline-offset: 3px; }

        /* Contact modal */
        .modal-backdrop {
          position: fixed; inset: 0; z-index: 60;
          background: rgba(6,9,20,.72); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
          animation: fadeIn .18s ease both;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal {
          position: relative; width: 100%; max-width: 460px;
          max-height: calc(100vh - 40px); overflow-y: auto;
          background: linear-gradient(160deg, rgba(24,32,58,.98), rgba(16,22,42,.98));
          border: 1px solid rgba(255,255,255,.14); border-radius: 20px;
          padding: 30px 28px 26px;
          box-shadow: 0 30px 80px rgba(0,0,0,.6);
          animation: modalIn .24s cubic-bezier(.22,1.2,.4,1) both;
        }
        @keyframes modalIn { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
        .modal-close {
          position: absolute; top: 14px; right: 14px;
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14);
          color: rgba(255,255,255,.7); cursor: pointer; transition: background .15s, color .15s;
        }
        .modal-close svg { width: 15px; height: 15px; }
        .modal-close:hover { background: rgba(255,255,255,.14); color: #fff; }
        .modal-title {
          font-family: var(--font-crimson), Georgia, serif; font-size: 25px;
          font-weight: 600; color: #fff; margin-bottom: 7px; padding-right: 36px;
        }
        .modal-sub { font-size: 13px; line-height: 1.6; color: rgba(255,255,255,.55); margin-bottom: 20px; }
        .modal-form { display: flex; flex-direction: column; gap: 15px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field span {
          font-size: 11px; font-weight: 800; letter-spacing: .09em;
          text-transform: uppercase; color: rgba(255,255,255,.5);
        }
        .field input, .field select, .field textarea {
          width: 100%; padding: 11px 13px; border-radius: 10px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16);
          color: #fff; font-family: inherit; font-size: 14.5px; line-height: 1.5;
          outline: none; transition: border-color .15s, background .15s;
        }
        .field textarea { resize: vertical; min-height: 96px; }
        .field select option { background: #131a30; color: #fff; }
        .field input:focus, .field select:focus, .field textarea:focus {
          border-color: var(--accent); background: rgba(255,255,255,.09);
          box-shadow: 0 0 0 3px rgba(10,163,163,.18);
        }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
        .btn-ghost, .btn-send {
          padding: 11px 20px; border-radius: 999px; font-family: inherit;
          font-size: 14px; font-weight: 650; cursor: pointer; transition: background .15s, transform .13s;
        }
        .btn-ghost {
          background: transparent; border: 1px solid rgba(255,255,255,.18); color: rgba(255,255,255,.7);
        }
        .btn-ghost:hover { background: rgba(255,255,255,.08); color: #fff; }
        .btn-send {
          background: var(--accent); border: none; color: #fff;
          box-shadow: 0 6px 20px rgba(10,163,163,.4);
        }
        .btn-send:hover { background: #089090; transform: translateY(-1px); }
        .modal-close:focus-visible, .btn-ghost:focus-visible, .btn-send:focus-visible {
          outline: 2px solid rgba(255,255,255,.7); outline-offset: 3px;
        }

        @media (max-width: 640px) {
          .nav { padding: 13px 16px; }
          .nav-links .nav-link { display: none; }
          .page { padding: 36px 16px 72px; }
          .beta-banner { padding: 9px 16px; font-size: 12px; }
          .module-card { min-height: 380px; padding: 28px 20px 26px; }
          .module-desc { max-width: 100%; }
          .contact-strip { padding: 26px 22px; flex-direction: column; align-items: flex-start; }
          .motif-glyphs .glyph { opacity: .12; }
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
        <span className="beta-badge">Ideas</span>
        Nothing on this page exists yet. These are future goals, not features you can use.
      </div>

      <nav className="nav">
        <BrandLogo className="nav-brand" />
        <div className="nav-links">
          <Link className="nav-link" href="/">Dashboard</Link>
          <Link className="nav-link" href="/assess">Assess</Link>
          <Link className="nav-link" href="/knowledge-map">Knowledge Map</Link>
          <Link className="nav-link" href="/about">About</Link>
          <Link className="nav-link" href="/bli">How BLI Works</Link>
        </div>
        <Link className="nav-btn" href="/assess">Start Assessment</Link>
      </nav>

      <main className="page">
        <header className="hero">
          <div className="hero-eyebrow">Future ideas</div>
          <h1 className="hero-heading">Future Ideas</h1>
          <p className="hero-lead" style={{ marginBottom: 14 }}>
            Open Bible Assessment has just launched a beta system that evaluates Old and New Testament content
            knowledge. The question bank and the scoring behind it are still being developed, and the current priority
            is making them more reliable rather than adding anything new.
          </p>
          <p className="hero-lead">
            The four modules below are ideas for what could follow.
          </p>
        </header>

        <p className="section-eyebrow">Ideas — {index + 1} of {total}</p>

        <div
          className="carousel"
          role="region"
          aria-roledescription="carousel"
          aria-label="Planned modules roadmap"
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          <div
            className={`carousel-viewport${isDragging ? " is-dragging" : ""}`}
            ref={viewportRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onPointerLeave={(e) => { if (isDragging && pointerIdRef.current === e.pointerId) finishDrag(); }}
          >
            <div className="carousel-track" style={trackStyle}>
              {MODULES.map((mod, i) => (
                <div
                  key={mod.id}
                  className="module-card"
                  style={accentVars(mod.accent)}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`Module ${i + 1} of ${total}: ${mod.title}`}
                  aria-hidden={i !== index}
                >
                  <CardMotif kind={mod.motif} />
                  <span className="module-number">Module {i + 1} of {total}</span>
                  <span className={`status-pill ${mod.status === "In development" ? "status-progress" : "status-planned"}`}>
                    <span className="status-dot" />
                    {mod.status}
                  </span>
                  <h2 className="module-title">{mod.title}</h2>
                  <p className="module-desc">{mod.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="carousel-controls">
            <button type="button" className="carousel-btn" onClick={goPrev} disabled={index === 0} aria-label="Previous module">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div className="carousel-dots" role="tablist" aria-label="Choose a module">
              {MODULES.map((mod, i) => (
                <button
                  key={mod.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Go to module ${i + 1}: ${mod.title}`}
                  className={`carousel-dot${i === index ? " is-active" : ""}`}
                  style={{ ["--dot-accent" as string]: ACCENTS[mod.accent].main } as CSSProperties}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
            <button type="button" className="carousel-btn" onClick={goNext} disabled={index === total - 1} aria-label="Next module">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <p className="sr-only" role="status" aria-live="polite">
            Module {index + 1} of {total}: {activeModule.title}, {activeModule.status}.
          </p>
        </div>

        <div className="contact-strip">
          <div>
            <h2 className="contact-heading">Feedback and help wanted</h2>
            <p className="contact-desc">
              If you have feedback on the website, or want to volunteer, get in touch.
            </p>
          </div>
          <button type="button" className="contact-btn" onClick={() => setContactOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Feedback or volunteer
          </button>
        </div>
      </main>
      <SiteFooter />

      {contactOpen && (
        <div className="modal-backdrop" onClick={() => setContactOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-title"
            onClick={e => e.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={() => setContactOpen(false)} aria-label="Close contact form">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <h2 className="modal-title" id="contact-title">Get in touch</h2>
            <p className="modal-sub">
              This opens your email app with the message ready to send. Nothing is stored on this site.
            </p>
            <form className="modal-form" onSubmit={submitContact}>
              <label className="field">
                <span>Your name</span>
                <input ref={firstFieldRef} name="name" type="text" autoComplete="name" required />
              </label>
              <label className="field">
                <span>Reason</span>
                <select name="reason" defaultValue="Feedback">
                  <option>Feedback</option>
                  <option>I&apos;d like to volunteer</option>
                  <option>Question</option>
                  <option>Something else</option>
                </select>
              </label>
              <label className="field">
                <span>Message</span>
                <textarea name="message" rows={5} required />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setContactOpen(false)}>Cancel</button>
                <button type="submit" className="btn-send">Open in email app</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
