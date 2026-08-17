"use client";

import { type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  STATE_LABELS,
  chapterRangeLabel,
  compactReference,
  passageReference,
  readableUnitLabel,
  rereadHref,
  sectionHue,
  starTone,
  type FocusPath,
} from "@/lib/focusPath";

/**
 * A mini solar system that lives on the dashboard showing the current focus:
 *   • section star at centre
 *   • book planet orbiting
 *   • chapter-section moon orbiting the book
 *
 * Clicking it opens the full Knowledge Map page. This card is intentionally
 * only a vivid preview: enough context to make the current frontier feel
 * tangible, without turning the dashboard into a second map surface.
 */

// ── mini-map SVG constants ───────────────────────────────────────────────────
const VW = 420;
const VH = 280;
const CX = 166;
const CY = 130;
const STAR_R = 30;
const BOOK_ORBIT = 82;
const BPX = CX + BOOK_ORBIT;
const BPY = CY;
const BOOK_R = 16;
const MOON_ORBIT = 30;
const MOON_ANGLE = (-108 * Math.PI) / 180;
const MPX = BPX + MOON_ORBIT * Math.cos(MOON_ANGLE);
const MPY = BPY + MOON_ORBIT * Math.sin(MOON_ANGLE);
const MOON_R = 9;

/** Deterministic PRNG so the decorative dust is stable between renders. */
function seeded(seed: number) {
  let v = seed >>> 0;
  return () => {
    v = (v * 1664525 + 1013904223) >>> 0;
    return v / 4294967296;
  };
}
const DUST = (() => {
  const rand = seeded(20260809);
  return Array.from({ length: 34 }, () => ({
    x: rand() * VW,
    y: rand() * VH,
    r: 0.5 + rand() * 1.3,
    o: 0.15 + rand() * 0.45,
    delay: rand() * 5,
    dur: 2.6 + rand() * 3.4,
  }));
})();

function hex2rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
function withAlpha(hex: string, a: number) {
  const [r, g, b] = hex2rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export default function DashboardMiniMap({
  path,
}: {
  path: FocusPath;
  userId: string | null;
}) {
  const router = useRouter();

  const leaf = path.focusLeaf;
  const book = path.focusBook;
  const section = path.focusSection;

  if (!leaf || !book || !section) return null;

  const hue = sectionHue(section);
  const sectionTone = starTone(section.state, hue);
  const bookTone = starTone(book.state, hue);
  const moonTone = starTone(leaf.state, hue);
  const chapterLabel = chapterRangeLabel(leaf.start_ch, leaf.end_ch);
  const leafTitle = readableUnitLabel(leaf.label);

  function openMap() { router.push("/knowledge-map"); }

  return (
    <>
      <style>{`
        .dmm-card {
          display: grid; grid-template-columns: minmax(0,1.2fr) minmax(0,1fr);
          gap: 0; border-radius: 18px; overflow: hidden; margin-bottom: 28px;
          cursor: pointer; position: relative; isolation: isolate;
          background:
            radial-gradient(circle at 18% 18%, rgba(255,255,255,.10), transparent 18%),
            radial-gradient(ellipse at 36% 42%, var(--dmm-glow), rgba(6,10,22,.18) 66%, rgba(6,10,22,.44) 100%);
          border: 1px solid var(--dmm-border);
          box-shadow: 0 0 32px var(--dmm-shadow), 0 8px 22px rgba(0,0,0,0.32);
          backdrop-filter: blur(3px);
          outline: none;
          transition: box-shadow .25s ease, border-color .25s ease, transform .25s ease;
        }
        .dmm-card::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(115deg, transparent 0 45%, rgba(255,255,255,.08) 52%, transparent 62%);
          opacity: .55; transform: translateX(-28%);
          transition: transform .35s ease, opacity .35s ease;
        }
        .dmm-card:hover, .dmm-card:focus-visible {
          border-color: var(--dmm-border-hover);
          box-shadow: 0 0 48px var(--dmm-shadow-hover), 0 10px 28px rgba(0,0,0,0.38);
          transform: translateY(-2px);
        }
        .dmm-card:hover::before, .dmm-card:focus-visible::before { opacity: .9; transform: translateX(18%); }
        .dmm-card:focus-visible { outline: 2px solid rgba(255,255,255,.55); outline-offset: 3px; }
        .dmm-viz { position: relative; }
        .dmm-hint {
          position: absolute; bottom: 12px; left: 0; right: 0; text-align: center;
          font-size: 10px; font-weight: 800; letter-spacing: .10em; text-transform: uppercase;
          color: rgba(255,255,255,.36); pointer-events: none;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          transition: color .2s ease;
        }
        .dmm-card:hover .dmm-hint, .dmm-card:focus-visible .dmm-hint { color: rgba(255,255,255,.62); }
        .dmm-hint svg { width: 11px; height: 11px; transition: transform .2s ease; }
        .dmm-card:hover .dmm-hint svg, .dmm-card:focus-visible .dmm-hint svg { transform: translateX(2px); }
        .dmm-dust { animation: dmmDust ease-in-out infinite alternate; }
        @keyframes dmmDust { from { opacity: .1; } to { opacity: .8; } }
        @keyframes dmmSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes dmmBreathe { 0%,100% { opacity:.75; transform:scale(.94); } 50% { opacity:1; transform:scale(1.08); } }
        /* transform-based, not filter:brightness() — filter animations on
           many simultaneous bodies force a repaint per frame instead of a
           cheap compositor-only pass, which can show up as intermittent
           color flicker/"glitching" under load (see FocusStarMap.tsx). */
        @keyframes dmmTwinkle { 0%,100% { transform: scale(.96); } 50% { transform: scale(1.06); } }
        .dmm-orbit { animation: dmmSpin 22s linear infinite; }
        .dmm-counter { animation: dmmSpin 22s linear infinite reverse; }
        .dmm-moon-orbit { animation: dmmSpin 9s linear infinite; }
        .dmm-moon-counter { animation: dmmSpin 9s linear infinite reverse; }
        .dmm-corona-anim { animation: dmmBreathe 5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .dmm-twinkle { animation: dmmTwinkle 3.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .dmm-txt {
          paint-order: stroke fill; stroke: rgba(0,0,12,0.92); stroke-width: 3.5px; stroke-linejoin: round;
          dominant-baseline: middle; font-family: var(--font-inter), system-ui, sans-serif; pointer-events: none;
        }
        .dmm-panel { position: relative; z-index: 1; padding: 22px 24px 22px 20px; display: flex; flex-direction: column; justify-content: center; border-left: 1px solid var(--dmm-border-soft); }
        .dmm-eyebrow { margin: 0 0 3px; font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: var(--dmm-hue); }
        .dmm-subhead { margin: 0 0 9px; font-size: 11px; font-weight: 650; color: rgba(255,255,255,.58); max-width: 320px; line-height: 1.4; }
        .dmm-title { margin: 0; font-family: var(--font-crimson), Georgia, serif; font-size: 22px; font-weight: 650; color: #fff; line-height: 1.15; }
        .dmm-ref { margin: 5px 0 0; font-size: 12px; font-weight: 700; color: rgba(255,255,255,.52); }
        .dmm-state {
          display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; padding: 4px 10px 4px 8px;
          border-radius: 999px; font-size: 10.5px; font-weight: 800; width: fit-content;
          background: var(--dmm-state-bg); border: 1px solid var(--dmm-state-border); color: rgba(255,255,255,.85);
        }
        .dmm-state-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dmm-hue); box-shadow: 0 0 6px 1px var(--dmm-glow-strong); }
        .dmm-actions { display: flex; flex-direction: column; gap: 9px; margin-top: 16px; }
        .dmm-reread {
          display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px; border-radius: 8px;
          background: var(--dmm-hue); color: #fff; text-decoration: none; font-size: 12px; font-weight: 800; width: fit-content;
          transition: filter .15s ease;
        }
        .dmm-reread:hover { filter: brightness(1.12); }
        .dmm-explore {
          display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px; border-radius: 8px; cursor: pointer;
          background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18);
          color: rgba(255,255,255,.85); font-size: 12px; font-weight: 800; width: fit-content;
          transition: background .15s ease, border-color .15s ease;
        }
        .dmm-explore:hover { background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.30); }

        @media (prefers-reduced-motion: reduce) {
          .dmm-dust, .dmm-orbit, .dmm-counter, .dmm-moon-orbit, .dmm-moon-counter,
          .dmm-corona-anim, .dmm-twinkle { animation: none !important; }
          .dmm-card, .dmm-card::before, .dmm-hint, .dmm-hint svg { transition: none !important; }
        }
      `}</style>

      {/* ── Mini card ── */}
      <section
        role="button"
        tabIndex={0}
        aria-label={`Explore your knowledge map — currently focused on ${leafTitle}`}
        className="dmm-card"
        onClick={openMap}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMap(); } }}
        style={{
          "--dmm-hue": hue,
          "--dmm-glow": withAlpha(hue, 0.18),
          "--dmm-glow-strong": withAlpha(hue, 0.7),
          "--dmm-border": "rgba(212,160,23,.48)",
          "--dmm-border-hover": "rgba(212,160,23,.72)",
          "--dmm-border-soft": withAlpha(hue, 0.20),
          "--dmm-shadow": withAlpha(hue, 0.12),
          "--dmm-shadow-hover": withAlpha(hue, 0.22),
          "--dmm-state-bg": withAlpha(hue, 0.14),
          "--dmm-state-border": withAlpha(hue, 0.35),
        } as CSSProperties}
      >
        {/* Left: animated mini star-map */}
        <div className="dmm-viz">
          <svg viewBox={`0 0 ${VW} ${VH}`} style={{ display: "block", width: "100%", height: "auto" }} aria-hidden="true">
            <defs>
              <radialGradient id="dm-hot">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.92" />
                <stop offset="60%" stopColor="#fff" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="dm-corona" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
                <stop offset="18%" stopColor="currentColor" stopOpacity="0.6" />
                <stop offset="55%" stopColor="currentColor" stopOpacity="0.14" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="dm-sphere" cx="34%" cy="30%" r="74%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.50" />
                <stop offset="38%" stopColor="#fff" stopOpacity="0" />
                <stop offset="100%" stopColor="#040509" stopOpacity="0.44" />
              </radialGradient>
              <filter id="dm-glow" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* decorative dust for atmosphere, matching the full map's field */}
            <g aria-hidden="true">
              {DUST.map((s, i) => (
                <circle
                  key={i} className="dmm-dust" cx={s.x} cy={s.y} r={s.r} fill="#dbe7ff"
                  style={{ opacity: s.o, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` } as CSSProperties}
                />
              ))}
            </g>

            {/* Orbit rings */}
            <circle cx={CX} cy={CY} r={BOOK_ORBIT} fill="none" stroke={withAlpha(hue, 0.26)} strokeWidth={1.15} strokeDasharray="4 7" />
            <circle cx={BPX} cy={BPY} r={MOON_ORBIT} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={1} strokeDasharray="3 5" />

            {/* ── Section star ── */}
            <g style={{ color: sectionTone.color } as CSSProperties}>
              <circle className="dmm-corona-anim" cx={CX} cy={CY} r={STAR_R * 2.6} fill="url(#dm-corona)" opacity={sectionTone.glow * 0.70} />
            </g>
            <circle className="dmm-twinkle" cx={CX} cy={CY} r={STAR_R} fill={sectionTone.color} opacity={sectionTone.core} />
            <circle cx={CX} cy={CY} r={STAR_R} fill="none" stroke={sectionTone.color} strokeWidth={1.3} opacity={sectionTone.core * 0.85} filter="url(#dm-glow)" />
            <circle cx={CX} cy={CY} r={STAR_R * 0.52} fill="url(#dm-hot)" opacity={sectionTone.core * 0.80} />

            {/* ── Book planet, making a full orbit around the section star. ── */}
            <g className="dmm-orbit" style={{ transformBox: "view-box", transformOrigin: `${CX}px ${CY}px` } as CSSProperties}>
              <g className="dmm-counter" style={{ transformBox: "view-box", transformOrigin: `${BPX}px ${BPY}px` } as CSSProperties}>
                <g transform={`translate(${BPX} ${BPY})`}>
                  <circle cx={0} cy={0} r={BOOK_R} fill={bookTone.color} opacity={bookTone.core} />
                  <circle cx={0} cy={0} r={BOOK_R} fill="url(#dm-sphere)" opacity={0.90} />
                  <circle cx={0} cy={0} r={BOOK_R} fill="none" stroke={bookTone.bright ? "#fff" : bookTone.color} strokeWidth={bookTone.bright ? 1.4 : 1} opacity={bookTone.bright ? 0.85 : 0.5} />
                  {bookTone.bright && <circle cx={0} cy={0} r={BOOK_R * 0.48} fill="url(#dm-hot)" opacity={0.80} />}
                  <text className="dmm-txt" x={BOOK_R + 8} y={0} fontSize={12} fontWeight={750} fill="rgba(255,255,255,0.94)">
                    {book.label}
                  </text>
                </g>

                {/* ── Moon, still fully orbiting — small and fast enough that
                     passing behind the planet reads as motion, not clutter ── */}
                <g className="dmm-moon-orbit" style={{ transformBox: "view-box", transformOrigin: `${BPX}px ${BPY}px` } as CSSProperties}>
                  <g className="dmm-moon-counter" style={{ transformBox: "view-box", transformOrigin: `${MPX}px ${MPY}px` } as CSSProperties}>
                    <g transform={`translate(${MPX} ${MPY})`}>
                      <circle cx={0} cy={0} r={MOON_R} fill={moonTone.color} opacity={moonTone.core} />
                      <circle cx={0} cy={0} r={MOON_R} fill="url(#dm-sphere)" opacity={0.85} />
                      <circle cx={0} cy={0} r={MOON_R} fill="none" stroke={moonTone.bright ? "#fff" : moonTone.color} strokeWidth={moonTone.bright ? 1.2 : 0.8} opacity={moonTone.bright ? 0.8 : 0.45} />
                      {chapterLabel && (
                        <text className="dmm-txt" x={MOON_R + 5} y={0} fontSize={10} fontWeight={750} fill="rgba(255,255,255,0.88)">
                          {chapterLabel}
                        </text>
                      )}
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </svg>

          <div className="dmm-hint">
            Click to explore
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </div>
        </div>

        {/* Right: text info panel */}
        <div className="dmm-panel">
          <p className="dmm-eyebrow">Reading frontier</p>
          <p className="dmm-subhead">Open the map for section and book context.</p>
          <p className="dmm-title">{leafTitle}</p>
          <p className="dmm-ref">{passageReference(leaf)}</p>
          <span className="dmm-state">
            <span className="dmm-state-dot" />
            {STATE_LABELS[leaf.state]}
            {leaf.display_score !== null ? ` · ${leaf.display_score} BLI` : ""}
          </span>

          <div className="dmm-actions">
            <a
              className="dmm-reread"
              href={rereadHref(leaf)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Reread {compactReference(leaf)}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                <path d="M7 17L17 7"/><path d="M9 7h8v8"/>
              </svg>
            </a>
            <button type="button" className="dmm-explore" onClick={(e) => { e.stopPropagation(); openMap(); }}>
              Open full map ›
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
