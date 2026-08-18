"use client";

// The app's animated canvas starfield backgrounds, all in one place.
//
// Previously three separate, independently-maintained implementations:
// app/useHomeStarfield.ts, app/assess/useAssessmentStarfield.ts, and
// app/knowledge-map/StarfieldBackground.tsx (~1,100 lines combined) — same
// genre (twinkling stars + shooting stars on a canvas) but different enough
// in practice (bespoke nebula/traveler/satellite systems on assess, a
// domain-constellation overlay on home, a simpler always-on field on
// knowledge-map) that they were never byte-for-byte duplicates of each
// other. Unifying the actual per-pixel drawing math into one shared
// algorithm would change how each page's sky looks — a design decision,
// not a refactor — so each variant's drawing logic is preserved here
// as-is. What this consolidation actually buys:
//   - one file / one import (`import Starfield from "@/components/Starfield"`)
//     instead of two hooks and a component living in three different
//     directories with three different calling conventions;
//   - the genuinely-shared pieces (seeded RNG, shooting-star streak
//     drawing) already live in lib/skyStreak.ts and all three variants
//     use them;
//   - each page no longer renders its own <canvas ref={...}> — the
//     component owns its canvas, and pages that need to reach in
//     (assess's answer-triggered "traveler" star, and the cross-page
//     sky-rotation handoff into the home dashboard) do it through one
//     typed imperative handle instead of exposing raw refs.
//
// Page-specific business logic (e.g. "which knowledge-profile tab is
// active" for home's constellation, or "what's the evidence strength" for
// assess's nebula) is computed by the caller and passed in as plain,
// already-shaped values — this component doesn't know what a
// BreakdownTab or a BliEvidence is.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { createSeededRandom, getOrCreateSkySeed, nebulaStageIndex, SHOOTING_PALETTES, drawStreak } from "@/lib/skyStreak";

export type StarfieldHandle = {
  /** assess variant only: record the screen point an answer was submitted
   * from, so the next spawnTraveler() call launches a star from there. */
  setPendingSpawn: (x: number, y: number) => void;
  /** assess variant only: cancel a pending spawn point without launching a
   * traveler — used when a new question starts loading before the previous
   * answer's traveler fired. */
  clearPendingSpawn: () => void;
  /** assess variant only: launch a "traveler" star toward the corner
   * evidence icon from the last setPendingSpawn() point. */
  spawnTraveler: () => void;
  /** assess variant only: nudge the sky sideways — used after answering so
   * consecutive questions don't sit on an identical background. */
  shiftSky: () => void;
  /** assess variant only: read the current animation frame and sky offset,
   * for handing off to the home dashboard's sky on transition (see
   * TRANSITION_* keys below, read by the "home" variant on arrival). */
  getHandoffState: () => { frame: number; offset: { x: number; y: number } };
};

type HomeVariantProps = {
  variant: "home";
  /** Whether the domain-constellation overlay (a few sky stars fly into a
   * polygon shaped by skill scores) should be active right now. */
  constellationActive: boolean;
  constellationPoints: { angle: number; pct: number }[];
};

type AssessVariantProps = {
  variant: "assess";
  /** Drives the nebula's growth stage. Lifetime evidence responses persist
   * across sessions while the in-session answered count resets, so callers
   * should pass whichever is larger (Math.max(evidence?.n_responses ?? 0,
   * answeredCount)) rather than the raw session counter. */
  nebulaAnswered: number;
  /** 0-96ish; the visual strength the nebula's growth/glow scales with —
   * callers derive this from their own evidence-level lookup. */
  evidenceStrength: number;
  isDashboardTransitioning: boolean;
};

type KnowledgeMapVariantProps = {
  variant: "knowledgeMap";
  motionPaused?: boolean;
};

export type StarfieldProps = HomeVariantProps | AssessVariantProps | KnowledgeMapVariantProps;

// The cross-page handoff keys the assess sky writes on transitionToDashboard
// and the home sky reads on arrival, so the dashboard's sky picks up mid
// rotation/offset instead of resetting. Plain sessionStorage, not a shared
// constants module — this is starfield-internal state, not app data.
const TRANSITION_ARRIVING_KEY = "obs_dashboard_arriving";
const TRANSITION_ROTATION_KEY = "obs_dashboard_sky_rotation";
const TRANSITION_FRAME_KEY = "obs_dashboard_sky_frame";
const TRANSITION_OFFSET_KEY = "obs_dashboard_sky_offset";

// ---------------------------------------------------------------------------
// Home variant
// ---------------------------------------------------------------------------

function HomeStarfield({ constellationActive, constellationPoints }: HomeVariantProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef(0);
  const constellationRef = useRef<{ active: boolean; t: number; points: { angle: number; pct: number }[]; lastTargets?: { x: number; y: number }[] }>({ active: false, t: 0, points: [] });
  const radarSvgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    constellationRef.current.active = constellationActive;
    constellationRef.current.points = constellationPoints;
  }, [constellationActive, constellationPoints]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const isArrivingFromAssessment = sessionStorage.getItem(TRANSITION_ARRIVING_KEY) === "1";
    const initialRotation = isArrivingFromAssessment
      ? Number(sessionStorage.getItem(TRANSITION_ROTATION_KEY) || 0)
      : 0;
    canvas.style.setProperty("--sky-start-rotation", `${initialRotation}deg`);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const SKY_OVERSCAN = 2.35;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const random = createSeededRandom(getOrCreateSkySeed());
    const isArrivingFromAssessment = sessionStorage.getItem(TRANSITION_ARRIVING_KEY) === "1";
    const initialRotation = isArrivingFromAssessment
      ? Number(sessionStorage.getItem(TRANSITION_ROTATION_KEY) || 0)
      : 0;
    const initialFrame = isArrivingFromAssessment
      ? Number(sessionStorage.getItem(TRANSITION_FRAME_KEY) || 0)
      : 0;
    let initialOffset = { x: 0, y: 0 };
    if (isArrivingFromAssessment) {
      try {
        initialOffset = JSON.parse(sessionStorage.getItem(TRANSITION_OFFSET_KEY) || "{}") || initialOffset;
      } catch {}
    }
    canvas.style.setProperty("--sky-start-rotation", `${initialRotation}deg`);
    sessionStorage.removeItem(TRANSITION_ARRIVING_KEY);
    sessionStorage.removeItem(TRANSITION_ROTATION_KEY);
    sessionStorage.removeItem(TRANSITION_FRAME_KEY);
    sessionStorage.removeItem(TRANSITION_OFFSET_KEY);

    function resize() {
      if (!canvas || !ctx) return;
      const skyWidth = window.innerWidth * SKY_OVERSCAN;
      const skyHeight = window.innerHeight * SKY_OVERSCAN;
      canvas.width = skyWidth * DPR;
      canvas.height = skyHeight * DPR;
      canvas.style.width = skyWidth + "px";
      canvas.style.height = skyHeight + "px";
    }

    resize();
    window.addEventListener("resize", resize);

    function handleScroll() {
      scrollRef.current = window.scrollY || window.pageYOffset || 0;
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Generate stars
    const STAR_COUNT = 1400;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: random(),
      y: random(),
      r: (0.5 + random() * 1.8) * DPR,
      opacity: 0.5 + random() * 0.5,
      twinkleSpeed: 0.002 + random() * 0.004,
      twinkleOffset: random() * Math.PI * 2,
    }));

    const shootingPalettes = SHOOTING_PALETTES;
    const nextShootingStarGap = () => 420 + Math.floor(random() * 300);
    const createShootingStar = (startFrame: number) => {
      const fromLeft = random() > 0.28;
      const palette = shootingPalettes[Math.floor(random() * shootingPalettes.length)];
      return {
        x: fromLeft ? -0.22 : 1.08,
        y: 0.02 + random() * 0.48,
        dx: (fromLeft ? 1 : -1) * (0.18 + random() * 0.12),
        dy: 0.055 + random() * 0.16,
        startFrame,
        duration: 220 + Math.floor(random() * 110),
        length: (90 + random() * 80) * DPR,
        width: (1.25 + random() * 0.8) * DPR,
        palette,
      };
    };
    const shootingStars = [createShootingStar(240 + Math.floor(random() * 360))];

    function resetShootingStar(star: (typeof shootingStars)[number]) {
      Object.assign(star, createShootingStar(star.startFrame + nextShootingStarGap()));
    }

    let frame = initialFrame;
    const skyOffsetX = Number(initialOffset.x || 0) * DPR;
    const skyOffsetY = Number(initialOffset.y || 0) * DPR;

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;

      // Deep navy gradient background
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#0b0f1e");
      grad.addColorStop(0.5, "#111827");
      grad.addColorStop(1, "#0d1530");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Advance domain-constellation activation (eased 0..1)
      const constellation = constellationRef.current;
      constellation.t += ((constellation.active ? 1 : 0) - constellation.t) * 0.05;
      if (constellation.t < 0.005) constellation.t = constellation.active ? constellation.t : 0;
      // Map radar-chart SVG coordinates into sky-canvas pixels so the
      // constellation overlays the radar exactly (accounts for canvas
      // centering, overscan, DPR, and initial rotation).
      let constellationTargets: { x: number; y: number }[] | null = null;
      const radarRect = radarSvgRef.current?.getBoundingClientRect();
      if (radarRect && radarRect.width > 0) {
        const theta = (initialRotation * Math.PI) / 180;
        const cosT = Math.cos(-theta);
        const sinT = Math.sin(-theta);
        const viewportCx = window.innerWidth / 2;
        const viewportCy = window.innerHeight / 2;
        constellationTargets = constellation.points.map(point => {
          const svgX = 160 + Math.cos(point.angle) * 104 * (point.pct / 100);
          const svgY = 160 + Math.sin(point.angle) * 104 * (point.pct / 100);
          const px = radarRect.left + (svgX / 320) * radarRect.width;
          const py = radarRect.top + (svgY / 320) * radarRect.height;
          const dx = px - viewportCx;
          const dy = py - viewportCy;
          return {
            x: w / 2 + (dx * cosT - dy * sinT) * DPR,
            y: h / 2 + (dx * sinT + dy * cosT) * DPR,
          };
        });
        constellation.lastTargets = constellationTargets;
      } else if (constellation.lastTargets && constellation.lastTargets.length === constellation.points.length) {
        constellationTargets = constellation.lastTargets;
      }
      const memberCount = constellation.t > 0.01 && constellationTargets ? constellation.points.length : 0;
      const constellationEase = constellation.t * constellation.t * (3 - 2 * constellation.t);

      // Draw stars with twinkle (constellation members are drawn separately below)
      stars.forEach((star, index) => {
        if (index < memberCount) return;
        const twinkle = Math.sin(frame * star.twinkleSpeed + star.twinkleOffset);
        const opacity = star.opacity * (0.6 + 0.4 * twinkle);
        const x = ((star.x * w + skyOffsetX) % (w + 40) + w + 40) % (w + 40) - 20;
        const y = ((star.y * h + skyOffsetY - scrollRef.current * 0.15 * DPR) % (h + 40) + h + 40) % (h + 40) - 20;
        ctx.beginPath();
        ctx.arc(x, y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.fill();
      });

      // Domain constellation: repositioned, brightened, connected stars.
      // Vertex distance from center is exactly proportional to each domain score.
      if (memberCount > 0) {
        const targets = constellationTargets as { x: number; y: number }[];
        const memberPoints = constellation.points.map((_point, index) => {
          const star = stars[index];
          const homeX = ((star.x * w + skyOffsetX) % (w + 40) + w + 40) % (w + 40) - 20;
          const homeY = ((star.y * h + skyOffsetY - scrollRef.current * 0.15 * DPR) % (h + 40) + h + 40) % (h + 40) - 20;
          const target = targets[index];
          return {
            x: homeX + (target.x - homeX) * constellationEase,
            y: homeY + (target.y - homeY) * constellationEase,
            star,
          };
        });

        const lineAlpha = Math.max(0, (constellationEase - 0.55) / 0.45);
        if (lineAlpha > 0) {
          ctx.save();
          ctx.strokeStyle = `rgba(173,232,255,${0.55 * lineAlpha})`;
          ctx.lineWidth = 1.1 * DPR;
          ctx.shadowColor = `rgba(10,163,163,${0.5 * lineAlpha})`;
          ctx.shadowBlur = 8 * DPR;
          ctx.beginPath();
          memberPoints.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
          });
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        memberPoints.forEach(point => {
          const twinkle = Math.sin(frame * point.star.twinkleSpeed * 2 + point.star.twinkleOffset);
          const brightRadius = point.star.r * (1 + 2.4 * constellationEase) + 0.4 * twinkle * DPR * constellationEase;
          ctx.save();
          ctx.shadowColor = `rgba(173,232,255,${0.9 * constellationEase})`;
          ctx.shadowBlur = 14 * DPR * constellationEase;
          ctx.beginPath();
          ctx.arc(point.x, point.y, Math.max(brightRadius, 0.4), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${0.55 + 0.45 * constellationEase})`;
          ctx.fill();
          ctx.restore();
        });
      }

      shootingStars.forEach(star => {
        const progress = (frame - star.startFrame) / star.duration;
        if (progress > 1) {
          resetShootingStar(star);
          return;
        }
        if (progress < 0) return;

        const opacity = Math.sin(progress * Math.PI) * 0.9;
        const headX = star.x * w + progress * w * star.dx + skyOffsetX * 0.12;
        const headY = star.y * h + progress * h * star.dy + skyOffsetY * 0.12;
        const angle = Math.atan2(h * star.dy, w * star.dx);
        const tailX = headX - Math.cos(angle) * star.length;
        const tailY = headY - Math.sin(angle) * star.length;
        drawStreak(ctx, {
          tailX,
          tailY,
          headX,
          headY,
          opacity,
          width: star.width,
          blur: 10 * DPR,
          palette: star.palette,
        });
      });

      // Teal nebula glow
      const nebula = ctx.createRadialGradient(w * 0.7 + skyOffsetX * 0.1, h * 0.3, 0, w * 0.7, h * 0.3, w * 0.4);
      nebula.addColorStop(0, "rgba(10,163,163,0.05)");
      nebula.addColorStop(1, "transparent");
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, w, h);

      frame++;
      if (!reduceMotion) animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return <canvas ref={canvasRef} className="stars" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Assess variant
// ---------------------------------------------------------------------------

// Deterministic per-index pseudo-random: star #29 always looks like star #29.
function nebHash(i: number) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const AssessStarfield = forwardRef<StarfieldHandle, AssessVariantProps>(function AssessStarfield(
  { nebulaAnswered, evidenceStrength, isDashboardTransitioning },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const skyFrameRef = useRef(0);
  const offsetRef = useRef({ x: 0, y: 0 });
  const targetOffsetRef = useRef({ x: 0, y: 0 });
  const travelersRef = useRef<Array<{ sx: number; sy: number; cx: number; cy: number; t: number; dur: number }>>([]);
  const nebulaPulseRef = useRef(-999);
  const evidenceStrengthRef = useRef(0);
  const answeredCountRef = useRef(0);
  const flareMilestoneRef = useRef(-1);
  const flareFrameRef = useRef(-999);
  const pendingSpawnRef = useRef<{ x: number; y: number } | null>(null);
  const transitioningRef = useRef(false);

  useEffect(() => {
    evidenceStrengthRef.current = evidenceStrength;
  }, [evidenceStrength]);

  useEffect(() => {
    answeredCountRef.current = nebulaAnswered;
  }, [nebulaAnswered]);

  useEffect(() => {
    transitioningRef.current = isDashboardTransitioning;
  }, [isDashboardTransitioning]);

  const spawnTraveler = useCallback(() => {
    const p = pendingSpawnRef.current;
    if (!p) return;
    const tx = window.innerWidth - 110;
    const ty = window.innerHeight - 130;
    travelersRef.current.push({
      sx: p.x,
      sy: p.y,
      cx: (p.x + tx) / 2 + (Math.random() - 0.5) * 160,
      cy: Math.min(p.y, ty) - 80 - Math.random() * 120,
      t: 0,
      dur: 66,
    });
    pendingSpawnRef.current = null;
  }, []);

  const shiftSky = useCallback(() => {
    targetOffsetRef.current = {
      x: targetOffsetRef.current.x + (Math.random() - 0.5) * 300,
      y: targetOffsetRef.current.y + (Math.random() - 0.5) * 150,
    };
  }, []);

  useImperativeHandle(ref, () => ({
    setPendingSpawn: (x: number, y: number) => {
      pendingSpawnRef.current = { x, y };
    },
    clearPendingSpawn: () => {
      pendingSpawnRef.current = null;
    },
    spawnTraveler,
    shiftSky,
    getHandoffState: () => ({
      frame: skyFrameRef.current,
      offset: offsetRef.current,
    }),
  }), [spawnTraveler, shiftSky]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const SKY_OVERSCAN = 2.35;
    const random = createSeededRandom(getOrCreateSkySeed());
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      if (!canvas) return;
      const skyWidth = window.innerWidth * SKY_OVERSCAN;
      const skyHeight = window.innerHeight * SKY_OVERSCAN;
      canvas.width = skyWidth * DPR;
      canvas.height = skyHeight * DPR;
      canvas.style.width = skyWidth + "px";
      canvas.style.height = skyHeight + "px";
    }
    resize();
    window.addEventListener("resize", resize);

    const STAR_COUNT = 1400;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: random(),
      y: random(),
      r: (0.5 + random() * 1.8) * DPR,
      opacity: 0.5 + random() * 0.5,
      twinkleSpeed: 0.002 + random() * 0.004,
      twinkleOffset: random() * Math.PI * 2,
    }));

    const shootingPalettes = SHOOTING_PALETTES;
    const nextShootingStarGap = () => 420 + Math.floor(random() * 300);
    const createShootingStar = (startFrame: number) => {
      const palette = shootingPalettes[Math.floor(random() * shootingPalettes.length)];
      const edge = Math.floor(random() * 4);
      let x = 0;
      let y = 0;
      let dx = 0;
      let dy = 0;
      const speed = 0.82 + random() * 0.32;
      const drift = (random() - 0.5) * 0.76;
      if (edge === 0) { x = -0.2; y = random(); dx = speed; dy = drift; }
      else if (edge === 1) { x = 1.2; y = random(); dx = -speed; dy = drift; }
      else if (edge === 2) { x = random(); y = -0.2; dy = speed; dx = drift; }
      else { x = random(); y = 1.2; dy = -speed; dx = drift; }
      return {
        x,
        y,
        dx,
        dy,
        startFrame,
        duration: 220 + Math.floor(random() * 110),
        length: (90 + random() * 80) * DPR,
        width: (1.25 + random() * 0.8) * DPR,
        palette,
      };
    };

    const createSatellite = (startFrame: number) => {
      const horizontal = random() > 0.45;
      const speed = 1.25 + random() * 0.25;
      const drift = (random() - 0.5) * 0.35;
      const forward = random() > 0.5 ? 1 : -1;
      return {
        x: horizontal ? (forward > 0 ? -0.08 : 1.08) : random(),
        y: horizontal ? random() * 0.9 + 0.05 : (forward > 0 ? -0.08 : 1.08),
        dx: horizontal ? forward * speed : drift,
        dy: horizontal ? drift : forward * speed,
        startFrame,
        duration: 900 + Math.floor(random() * 700),
        r: (0.9 + random() * 0.7) * DPR,
        blink: 0.03 + random() * 0.05,
        warm: random() > 0.6,
      };
    };
    const shootingStars = [createShootingStar(180 + Math.floor(random() * 360))];
    const satellites = Array.from({ length: 2 }, () => createSatellite(90 + Math.floor(random() * 500)));

    let frame = 0;
    function resetShootingStar(star: (typeof shootingStars)[number]) {
      Object.assign(star, createShootingStar(star.startFrame + nextShootingStarGap()));
    }
    function resetSatellite(sat: (typeof satellites)[number]) {
      Object.assign(sat, createSatellite(frame + 500 + Math.floor(random() * 1400)));
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;

      offsetRef.current.x += (targetOffsetRef.current.x - offsetRef.current.x) * 0.03;
      offsetRef.current.y += (targetOffsetRef.current.y - offsetRef.current.y) * 0.03;
      const ox = offsetRef.current.x * DPR;
      const oy = offsetRef.current.y * DPR;

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#0b0f1e");
      grad.addColorStop(0.5, "#111827");
      grad.addColorStop(1, "#0d1530");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      stars.forEach(star => {
        const twinkle = Math.sin(frame * star.twinkleSpeed + star.twinkleOffset);
        const opacity = star.opacity * (0.6 + 0.4 * twinkle);
        const sx = ((star.x * w + ox) % (w + 40) + w + 40) % (w + 40) - 20;
        const sy = ((star.y * h + oy) % (h + 40) + h + 40) % (h + 40) - 20;
        ctx.beginPath();
        ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.fill();
      });

      satellites.forEach(sat => {
        const progress = (frame - sat.startFrame) / sat.duration;
        if (progress > 1) {
          resetSatellite(sat);
          return;
        }
        if (progress < 0) return;
        const fade = Math.min(1, Math.sin(progress * Math.PI) * 2.4);
        const blink = 0.45 + 0.55 * Math.pow(Math.abs(Math.sin(frame * sat.blink)), 3);
        const px3 = sat.x * w + progress * w * sat.dx + ox * 0.06;
        const py3 = sat.y * h + progress * h * sat.dy + oy * 0.06;
        ctx.save();
        ctx.shadowColor = sat.warm ? "rgba(255,214,150,.7)" : "rgba(200,235,255,.7)";
        ctx.shadowBlur = 6 * DPR;
        ctx.fillStyle = sat.warm
          ? `rgba(255,226,176,${0.72 * fade * blink})`
          : `rgba(226,244,255,${0.72 * fade * blink})`;
        ctx.beginPath();
        ctx.arc(px3, py3, sat.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      shootingStars.forEach(star => {
        const progress = (frame - star.startFrame) / star.duration;
        if (progress > 1) {
          resetShootingStar(star);
          return;
        }
        if (progress < 0) return;

        const opacity = Math.sin(progress * Math.PI) * 0.9;
        const headX = star.x * w + progress * w * star.dx + ox * 0.12;
        const headY = star.y * h + progress * h * star.dy + oy * 0.12;
        const angle = Math.atan2(h * star.dy, w * star.dx);
        const tailX = headX - Math.cos(angle) * star.length;
        const tailY = headY - Math.sin(angle) * star.length;
        drawStreak(ctx, {
          tailX,
          tailY,
          headX,
          headY,
          opacity,
          width: star.width,
          blur: 10 * DPR,
          palette: star.palette,
        });
      });

      const nebula = ctx.createRadialGradient(w * 0.7 + ox * 0.1, h * 0.3, 0, w * 0.7, h * 0.3, w * 0.4);
      nebula.addColorStop(0, "rgba(10,163,163,0.05)");
      nebula.addColorStop(1, "transparent");
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, w, h);

      if (!transitioningRef.current) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const toCX = (vx: number) => (vx + (w / DPR - vw) / 2) * DPR;
        const toCY = (vy: number) => (vy + (h / DPR - vh) / 2) * DPR;
        const ax = toCX(vw - 110);
        const ay = toCY(vh - 130);
        const evidenceStrengthNow = evidenceStrengthRef.current;
        const nAns = answeredCountRef.current;
        if (nAns > 0) {
          const pulseAge = frame - nebulaPulseRef.current;
          const pulse = pulseAge >= 0 && pulseAge < 36 ? Math.sin((pulseAge / 36) * Math.PI) : 0;
          const stage = nebulaStageIndex(nAns);
          const growth = Math.log(1 + nAns) / Math.log(1001);
          const evidenceBoost = 0.74 + (evidenceStrengthNow / 96) * 0.46;
          const milestone = Math.floor(nAns / 100);
          if (flareMilestoneRef.current < 0) {
            flareMilestoneRef.current = milestone;
          } else if (milestone > flareMilestoneRef.current) {
            flareMilestoneRef.current = milestone;
            flareFrameRef.current = frame;
          }
          const flareAge = frame - flareFrameRef.current;
          const flare = flareAge >= 0 && flareAge < 90 ? 1 - flareAge / 90 : 0;
          const baseR = (52 + 206 * growth) * DPR * (1 + pulse * 0.14 + flare * 0.1);
          const alpha = (0.16 + 0.72 * growth) * evidenceBoost * (1 + pulse * 0.9);
          const layerCount = stage === 0 ? 2 : stage === 1 ? 3 : stage === 2 ? 4 : 5;
          const hueDrift = stage >= 4 ? ((nAns - 200) / 800) * 42 : 0;
          const hues = [180, 265, 320, 45, 195];
          for (let i = 0; i < layerCount; i++) {
            const wob = frame * (0.004 + i * 0.0021) + i * 1.7;
            const nx = ax + Math.cos(wob) * (8 + i * 11) * DPR;
            const ny = ay + Math.sin(wob * 0.8) * (7 + i * 9) * DPR;
            const r = baseR * (1 - i * 0.16);
            const hue = (hues[i] + hueDrift) % 360;
            const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, r);
            g.addColorStop(0, `hsla(${hue},78%,62%,${alpha * (0.9 - i * 0.12)})`);
            g.addColorStop(1, "transparent");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(nx, ny, r, 0, Math.PI * 2);
            ctx.fill();
          }

          if (stage >= 4) {
            const winding = 1.35 + Math.log(nAns / 200 + 1) * 0.95;
            ctx.save();
            ctx.lineWidth = 1.2 * DPR;
            ctx.strokeStyle = `hsla(${(196 + hueDrift) % 360},85%,76%,${0.14 + 0.1 * growth})`;
            for (let arm = 0; arm < 2; arm++) {
              ctx.beginPath();
              for (let t = 0; t <= 1.001; t += 0.05) {
                const ang = arm * Math.PI + t * Math.PI * winding + frame * 0.0016;
                const rr = baseR * 0.2 + t * baseR * 0.7;
                const px2 = ax + Math.cos(ang) * rr;
                const py2 = ay + Math.sin(ang) * rr * 0.72;
                if (t === 0) ctx.moveTo(px2, py2);
                else ctx.lineTo(px2, py2);
              }
              ctx.stroke();
            }
            ctx.restore();
          }

          const starCount = stage >= 3 ? Math.min(48, Math.floor((nAns - 100) / 25)) : 0;
          for (let i = 0; i < starCount; i++) {
            const r1 = nebHash(i);
            const r2 = nebHash(i + 91);
            const r3 = nebHash(i + 187);
            const orbit = baseR * (0.3 + r1 * 0.6);
            const ang = i * 2.399 + frame * (0.0022 + r2 * 0.0034);
            const sx2 = ax + Math.cos(ang) * orbit;
            const sy2 = ay + Math.sin(ang) * orbit * 0.74;
            const tw = 0.55 + 0.45 * Math.sin(frame * 0.03 + i * 1.7);
            const isAnchor = i < milestone;
            const sr = (isAnchor ? 3.1 : 1.9) * DPR * (0.8 + r3 * 0.5);
            ctx.save();
            ctx.shadowColor = isAnchor ? "rgba(245,200,66,.9)" : "rgba(200,240,255,.8)";
            ctx.shadowBlur = (isAnchor ? 11 : 6) * DPR;
            ctx.fillStyle = isAnchor
              ? `rgba(255,228,158,${0.88 * tw + flare * 0.28})`
              : `rgba(235,250,255,${0.74 * tw})`;
            ctx.beginPath();
            ctx.arc(sx2, sy2, sr, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          if (flare > 0) {
            ctx.save();
            ctx.lineWidth = 2.2 * DPR * flare;
            ctx.strokeStyle = `rgba(255,236,182,${0.5 * flare})`;
            ctx.shadowColor = "rgba(255,220,140,.85)";
            ctx.shadowBlur = 14 * DPR;
            ctx.beginPath();
            ctx.arc(ax, ay, baseR * (0.24 + (1 - flare) * 1.1), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          const ignited = stage >= 2;
          const coreR = (12 + 46 * growth) * DPR * (1 + pulse) * (ignited ? 1.25 : 1);
          const breathe = ignited ? 0.9 + 0.1 * Math.sin(frame * 0.021) : 1;
          const core = ctx.createRadialGradient(ax, ay, 0, ax, ay, coreR);
          core.addColorStop(0, `rgba(255,252,238,${(0.5 + pulse * 0.4) * breathe + flare * 0.3})`);
          if (ignited) core.addColorStop(0.45, `rgba(255,224,150,${0.3 * breathe})`);
          core.addColorStop(1, "transparent");
          ctx.fillStyle = core;
          ctx.beginPath();
          ctx.arc(ax, ay, coreR, 0, Math.PI * 2);
          ctx.fill();
        }

        const list = travelersRef.current;
        for (let i = list.length - 1; i >= 0; i--) {
          const tr = list[i];
          tr.t += 1;
          const p = Math.min(1, tr.t / tr.dur);
          const ease = p * p * (3 - 2 * p);
          const x0 = toCX(tr.sx);
          const y0 = toCY(tr.sy);
          const x1 = toCX(tr.cx);
          const y1 = toCY(tr.cy);
          const mt = 1 - ease;
          const px = mt * mt * x0 + 2 * mt * ease * x1 + ease * ease * ax;
          const py = mt * mt * y0 + 2 * mt * ease * y1 + ease * ease * ay;
          const tp = Math.max(0, ease - 0.12);
          const tmt = 1 - tp;
          const trailX = tmt * tmt * x0 + 2 * tmt * tp * x1 + tp * tp * ax;
          const trailY = tmt * tmt * y0 + 2 * tmt * tp * y1 + tp * tp * ay;
          const trail = ctx.createLinearGradient(trailX, trailY, px, py);
          trail.addColorStop(0, "rgba(173,232,255,0)");
          trail.addColorStop(1, `rgba(173,232,255,${0.75 * (1 - p * 0.3)})`);
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineWidth = 2.2 * DPR;
          ctx.strokeStyle = trail;
          ctx.beginPath();
          ctx.moveTo(trailX, trailY);
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.shadowColor = "rgba(173,232,255,0.8)";
          ctx.shadowBlur = 8 * DPR;
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.beginPath();
          ctx.arc(px, py, 2.6 * DPR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          if (p >= 1) {
            list.splice(i, 1);
            nebulaPulseRef.current = frame;
          }
        }
      }

      frame++;
      skyFrameRef.current = frame;
      if (!prefersReducedMotion) animRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`stars ${isDashboardTransitioning ? "dashboard-transition" : ""}`}
      aria-hidden="true"
    />
  );
});

// ---------------------------------------------------------------------------
// Knowledge-map variant
// ---------------------------------------------------------------------------

type KmStar = { x: number; y: number; r: number; o: number; ts: number; to: number; layer: number };
type KmShooting = {
  x: number; y: number; dx: number; dy: number;
  start: number; dur: number; len: number; w: number;
  palette: (typeof SHOOTING_PALETTES)[number];
};

function KnowledgeMapStarfield({ motionPaused = false }: KnowledgeMapVariantProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Fixed (not session-persistent) seed: this sky is meant to look
    // identical for every visitor, unlike home/assess's per-session sky.
    const rand = createSeededRandom(20260808);

    const STAR_COUNT = 540;
    const stars: KmStar[] = Array.from({ length: STAR_COUNT }, () => ({
      x: rand(),
      y: rand(),
      r: (0.4 + rand() * 1.7) * DPR,
      o: 0.4 + rand() * 0.6,
      ts: 0.002 + rand() * 0.004,
      to: rand() * Math.PI * 2,
      layer: rand(),
    }));

    const makeShooting = (start: number): KmShooting => {
      const fromLeft = rand() > 0.3;
      return {
        x: fromLeft ? -0.1 : 1.1,
        y: 0.04 + rand() * 0.5,
        dx: (fromLeft ? 1 : -1) * (0.24 + rand() * 0.2),
        dy: 0.08 + rand() * 0.22,
        start,
        dur: 120 + rand() * 80,
        len: (120 + rand() * 120) * DPR,
        w: (1.3 + rand() * 0.9) * DPR,
        palette: SHOOTING_PALETTES[Math.floor(rand() * SHOOTING_PALETTES.length)],
      };
    };
    const shooting: KmShooting[] = Array.from({ length: 2 }, () => makeShooting(150 + rand() * 700));

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth * DPR;
      canvas.height = window.innerHeight * DPR;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let frame = 0;

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const drift = frame * 0.015 * DPR;
      stars.forEach((s) => {
        const twinkle = Math.sin(frame * s.ts + s.to);
        const opacity = s.o * (0.55 + 0.45 * twinkle);
        const x = (((s.x * w + drift * (0.3 + s.layer)) % w) + w) % w;
        const y = s.y * h;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.fill();
      });

      shooting.forEach((st) => {
        const progress = (frame - st.start) / st.dur;
        if (progress > 1) {
          Object.assign(st, makeShooting(frame + 320 + rand() * 1000));
          return;
        }
        if (progress < 0) return;
        const opacity = Math.sin(progress * Math.PI) * 0.9;
        const headX = st.x * w + progress * w * st.dx;
        const headY = st.y * h + progress * h * st.dy;
        const angle = Math.atan2(h * st.dy, w * st.dx);
        drawStreak(ctx, {
          tailX: headX - Math.cos(angle) * st.len,
          tailY: headY - Math.sin(angle) * st.len,
          headX,
          headY,
          opacity,
          width: st.w,
          blur: 10 * DPR,
          palette: st.palette,
        });
      });

      if (!motionPaused) frame++;
      if (!reduceMotion && !motionPaused) raf = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [motionPaused]);

  return <canvas ref={canvasRef} className="km-starfield" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const Starfield = forwardRef<StarfieldHandle, StarfieldProps>(function Starfield(props, ref) {
  if (props.variant === "home") {
    return <HomeStarfield {...props} />;
  }
  if (props.variant === "assess") {
    return <AssessStarfield {...props} ref={ref} />;
  }
  return <KnowledgeMapStarfield {...props} />;
});

export default Starfield;
