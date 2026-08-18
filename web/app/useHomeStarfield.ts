"use client";

// The home dashboard's animated starfield background: a seeded star field,
// shooting stars, and a "domain constellation" overlay (a few stars fly into
// a polygon shaped by the learner's skill scores when the Skills tab is
// active). Mirrors app/assess/useAssessmentStarfield.ts's shape — same idea,
// different visual payload — so both pages' canvas backgrounds are a hook
// call instead of one being an inline effect in the page component.
//
// Note: the constellation overlay's radar-chart targeting (the
// `radarSvgRef.current?.getBoundingClientRect()` branch below) has had
// nothing to target since the hidden legacy radar-chart markup it measured
// was deleted from page.tsx in an earlier cleanup pass. The constellation
// still activates (`constellation.active`/`.t` still animate), but it never
// finds a target rect, so the "fly into a polygon" visual currently never
// triggers. Left as-is here since fixing or removing that is a product
// decision, not a refactor one.

import { useEffect, useLayoutEffect, useRef } from "react";
import { createSeededRandom, getOrCreateSkySeed, SHOOTING_PALETTES, drawStreak } from "@/lib/skyStreak";
import type { Testament as BibleTestament } from "@/lib/bibleTaxonomy";
import type { BreakdownTab, ScopeScore } from "./homeTypes";

type UseHomeStarfieldOptions = {
  activeBreakdownTab: BreakdownTab;
  profileTestament: BibleTestament;
  domainScores: ScopeScore[];
  scriptureConnectionsUnlocked: boolean;
};

export function useHomeStarfield({
  activeBreakdownTab,
  profileTestament,
  domainScores,
  scriptureConnectionsUnlocked,
}: UseHomeStarfieldOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef(0);
  // Skill constellation: when the Skills tab is active, a few sky stars fly
  // into a polygon whose vertex radii correspond exactly to domain scores.
  const constellationRef = useRef<{ active: boolean; t: number; points: { angle: number; pct: number }[]; lastTargets?: { x: number; y: number }[] }>({ active: false, t: 0, points: [] });
  const radarSvgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const constellation = constellationRef.current;
    if (activeBreakdownTab !== "domains") {
      constellation.active = false;
      return;
    }
    const domains = domainScores.filter(score => score.testament === profileTestament);
    constellation.points = domains.map((score, index) => {
      const isLockedConnection = score.key.endsWith(":scripture_connections") && !scriptureConnectionsUnlocked;
      const pct = isLockedConnection || score.rawScore === null || score.answered === 0 ? 0 : Math.max(0, Math.min(100, score.rawScore));
      const angle = -Math.PI / 2 + (index / Math.max(domains.length, 1)) * Math.PI * 2;
      return { angle, pct };
    });
    constellation.active = true;
  }, [activeBreakdownTab, profileTestament, domainScores, scriptureConnectionsUnlocked]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const isArrivingFromAssessment = sessionStorage.getItem("obs_dashboard_arriving") === "1";
    const initialRotation = isArrivingFromAssessment
      ? Number(sessionStorage.getItem("obs_dashboard_sky_rotation") || 0)
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
    const isArrivingFromAssessment = sessionStorage.getItem("obs_dashboard_arriving") === "1";
    const initialRotation = isArrivingFromAssessment
      ? Number(sessionStorage.getItem("obs_dashboard_sky_rotation") || 0)
      : 0;
    const initialFrame = isArrivingFromAssessment
      ? Number(sessionStorage.getItem("obs_dashboard_sky_frame") || 0)
      : 0;
    let initialOffset = { x: 0, y: 0 };
    if (isArrivingFromAssessment) {
      try {
        initialOffset = JSON.parse(sessionStorage.getItem("obs_dashboard_sky_offset") || "{}") || initialOffset;
      } catch {}
    }
    canvas.style.setProperty("--sky-start-rotation", `${initialRotation}deg`);
    sessionStorage.removeItem("obs_dashboard_arriving");
    sessionStorage.removeItem("obs_dashboard_sky_rotation");
    sessionStorage.removeItem("obs_dashboard_sky_frame");
    sessionStorage.removeItem("obs_dashboard_sky_offset");

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

  return { canvasRef };
}
