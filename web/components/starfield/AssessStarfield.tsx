"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { createSeededRandom, drawStreak, getOrCreateSkySeed, nebulaStageIndex, SHOOTING_PALETTES } from "@/lib/skyStreak";
import type { AssessVariantProps, StarfieldHandle } from "./types";

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

      stars.forEach((star) => {
        const twinkle = Math.sin(frame * star.twinkleSpeed + star.twinkleOffset);
        const opacity = star.opacity * (0.6 + 0.4 * twinkle);
        const sx = ((star.x * w + ox) % (w + 40) + w + 40) % (w + 40) - 20;
        const sy = ((star.y * h + oy) % (h + 40) + h + 40) % (h + 40) - 20;
        ctx.beginPath();
        ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.fill();
      });

      satellites.forEach((sat) => {
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

      shootingStars.forEach((star) => {
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

export default AssessStarfield;

