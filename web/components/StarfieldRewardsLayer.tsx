"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type StarfieldReward = {
  id: string;
  reward_type: "star" | "planet";
  seed: number;
  guessed_book_code: string | null;
  created_at: string;
};

/**
 * Renders a user's permanent black-hole rewards (see BlackHoleEvent, earned
 * on the assessment page) as extra stars/planets scattered into whatever
 * starfield is behind it. Purely decorative and read-only — this is the
 * "your sky remembers this" payoff, so it's mounted wherever the app already
 * shows a night sky (assess page, dashboard) rather than being tied to one
 * screen. Each reward's look is derived deterministically from its `seed` so
 * it sits in the same spot with the same color every time it renders.
 */
export default function StarfieldRewardsLayer({
  userId,
  refreshToken,
}: {
  userId: string | null;
  /** Bump this (e.g. after inserting a new reward) to force a refetch — the
   * layer otherwise only loads once per userId. */
  refreshToken?: number | string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rewards, setRewards] = useState<StarfieldReward[]>([]);

  useEffect(() => {
    if (!userId) {
      setRewards([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("obs_starfield_rewards")
      .select("id, reward_type, seed, guessed_book_code, created_at")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Starfield rewards load failed:", error);
          return;
        }
        setRewards((data ?? []) as StarfieldReward[]);
      });
    return () => { cancelled = true; };
  }, [userId, refreshToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rewards.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function seeded(seed: number) {
      let v = (seed >>> 0) || 1;
      return () => {
        v = (v * 1664525 + 1013904223) >>> 0;
        return v / 4294967296;
      };
    }

    // Deterministic placement + look per reward, derived from its own seed
    // so refreshing the page never moves or recolors a reward the user has
    // already earned.
    const placed = rewards.map(r => {
      const rand = seeded(r.seed);
      const x = 0.08 + rand() * 0.84;
      const y = 0.1 + rand() * 0.8;
      const hueRoll = rand();
      const planetPalette = [
        ["#ffd8a8", "#e6ad12", "#7a4f06"],
        ["#c9f7ff", "#0aa3a3", "#075e61"],
        ["#e6d6ff", "#7c3aed", "#3d1f80"],
        ["#ffd6e0", "#e05b7a", "#7a2c3e"],
      ][Math.floor(hueRoll * 4)];
      return {
        ...r,
        x, y,
        radius: r.reward_type === "planet" ? 5 + rand() * 4 : 1.6 + rand() * 1.1,
        twinkleSpeed: 0.0015 + rand() * 0.003,
        twinkleOffset: rand() * Math.PI * 2,
        palette: planetPalette,
        ringTilt: rand() * Math.PI,
      };
    });

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth * DPR;
      canvas.height = window.innerHeight * DPR;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    }
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let frame = 0;

    function drawStarReward(x: number, y: number, r: number, opacity: number) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = `rgba(255,244,210,${opacity})`;
      ctx.shadowColor = `rgba(245,200,66,${opacity * 0.9})`;
      ctx.shadowBlur = r * 6;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      // four-point sparkle cross
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255,244,210,${opacity * 0.7})`;
      ctx.lineWidth = Math.max(0.6, r * 0.28);
      const spike = r * 3.4;
      ctx.beginPath();
      ctx.moveTo(-spike, 0); ctx.lineTo(spike, 0);
      ctx.moveTo(0, -spike); ctx.lineTo(0, spike);
      ctx.stroke();
      ctx.restore();
    }

    function drawPlanetReward(x: number, y: number, r: number, palette: string[], tilt: number, opacity: number) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(x, y);
      const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 0, 0, 0, r);
      grad.addColorStop(0, palette[0]);
      grad.addColorStop(0.55, palette[1]);
      grad.addColorStop(1, palette[2]);
      ctx.globalAlpha = opacity;
      ctx.shadowColor = palette[1];
      ctx.shadowBlur = r * 1.6;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255,255,255,0.28)`;
      ctx.lineWidth = Math.max(0.8, r * 0.18);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.7, r * 0.42, tilt, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      placed.forEach(p => {
        const twinkle = reduceMotion ? 1 : 0.72 + 0.28 * Math.sin(frame * p.twinkleSpeed + p.twinkleOffset);
        const x = p.x * w, y = p.y * h;
        const r = p.radius * DPR;
        if (p.reward_type === "star") {
          drawStarReward(x, y, r, twinkle);
        } else {
          drawPlanetReward(x, y, r, p.palette, p.ringTilt, twinkle);
        }
      });
      frame++;
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [rewards]);

  if (rewards.length === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        zIndex: 0, pointerEvents: "none",
      }}
    />
  );
}
