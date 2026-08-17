"use client";

import { useEffect, useRef } from "react";
import { SHOOTING_PALETTES, drawStreak, type StreakPalette } from "@/lib/skyStreak";

/**
 * A fixed, full-viewport starfield behind the knowledge map — twinkling stars
 * across a few parallax layers, a slow drift, and the occasional shooting star
 * drawn with the same streak routine the dashboard sky uses. Purely decorative,
 * so it sits behind the content and is skipped under reduced-motion after one
 * static paint.
 */

type Star = { x: number; y: number; r: number; o: number; ts: number; to: number; layer: number };
type Shooting = {
  x: number; y: number; dx: number; dy: number;
  start: number; dur: number; len: number; w: number; palette: StreakPalette;
};

/** Deterministic PRNG so the field is identical between renders. */
function seeded(seed: number) {
  let v = seed >>> 0;
  return () => {
    v = (v * 1664525 + 1013904223) >>> 0;
    return v / 4294967296;
  };
}

export default function StarfieldBackground({ motionPaused = false }: { motionPaused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rand = seeded(20260808);

    const STAR_COUNT = 540;
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x: rand(),
      y: rand(),
      r: (0.4 + rand() * 1.7) * DPR,
      o: 0.4 + rand() * 0.6,
      ts: 0.002 + rand() * 0.004,
      to: rand() * Math.PI * 2,
      layer: rand(),
    }));

    const makeShooting = (start: number): Shooting => {
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
    const shooting: Shooting[] = Array.from({ length: 2 }, () => makeShooting(150 + rand() * 700));

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
