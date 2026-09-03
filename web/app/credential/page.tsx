"use client";

import SiteFooter from "@/components/SiteFooter";
import BetaBanner from "@/components/BetaBanner";
import SiteNav from "@/components/SiteNav";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { CREDENTIAL_PAGE_STYLES } from "./credentialStyles";

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
      <style>{CREDENTIAL_PAGE_STYLES}</style>

      <canvas ref={canvasRef} className="stars" aria-hidden="true" />

      <BetaBanner label="Ideas">
        Nothing on this page exists yet. These are future goals, not features you can use.
      </BetaBanner>

      <SiteNav
        links={["dashboard", "assess", "knowledge-map", "about", "bli", "reading-log"]}
        cta={{ href: "/assess", label: "Start Assessment" }}
        mobileMenu
        mobileMenuId="credential-mobile-nav"
      />

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
