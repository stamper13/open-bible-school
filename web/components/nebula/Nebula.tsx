"use client";

import { useEffect, useRef } from "react";
import { NEB_SEEDS, hash2, noiseSprite, tintSprite } from "./noise";

/**
 * A standalone nebula background: a few tinted clouds on a dark field, drifting
 * slowly, with a scatter of stars behind them.
 *
 * This is the /intro star map's cloud, without the star map. Use it on pages
 * that have no cosmic treatment of their own and little sustained reading —
 * the sign-in screens rather than the long documents, where a coloured cloud
 * behind body text costs more legibility than it buys atmosphere.
 *
 * The expensive part is paid once: each base cloud is baked to a sprite at
 * mount (~40ms), and every frame after is a handful of drawImage calls. Under
 * prefers-reduced-motion it renders one static frame and stops.
 *
 * It paints its own background, sits at z-index 0 behind everything, and is
 * aria-hidden — it is scenery, and nothing depends on it.
 */

export type NebulaProps = {
  /** Cloud colours. One cloud is placed per entry. */
  tints?: string[];
  /** Overall strength, 0-1. Lower it behind anything that must stay readable. */
  intensity?: number;
  /** Changes the layout without changing the palette. */
  seed?: number;
  className?: string;
};

const DEFAULT_TINTS = ["#d4a017", "#0e8c6a", "#2563c4", "#7c3aed"];

export default function Nebula({
  tints = DEFAULT_TINTS,
  intensity = 1,
  seed = 7,
  className,
}: NebulaProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Read through refs so a prop change re-tunes the running loop instead of
  // tearing it down and re-baking every sprite.
  const cfg = useRef({ tints, intensity, seed });
  useEffect(() => {
    cfg.current = { tints, intensity, seed };
  }, [tints, intensity, seed]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, DPR = 1, raf = 0;

    const resize = () => {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth || window.innerWidth;
      H = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
    };
    resize();

    // One base cloud up front so the first frame has something to draw; the
    // rest arrive one per frame, invisibly, while the field is still faint.
    const bases: HTMLCanvasElement[] = [noiseSprite(NEB_SEEDS[0])];
    const clouds = cfg.current.tints.map((tint, i) => ({
      sprite: tintSprite(bases[0], tint),
      tint,
      // Hand placement would not survive an arbitrary tint list, so positions
      // are hashed from the seed: stable across reloads, spread across the
      // frame, and never exactly centred.
      x: 0.16 + hash2(i, 1, cfg.current.seed) * 0.68,
      y: 0.18 + hash2(i, 2, cfg.current.seed) * 0.64,
      r: 0.42 + hash2(i, 3, cfg.current.seed) * 0.36,
      rot: hash2(i, 4, cfg.current.seed) * Math.PI * 2,
      drift: 0.6 + hash2(i, 5, cfg.current.seed) * 0.8,
    }));

    const ensureBases = () => {
      if (bases.length >= NEB_SEEDS.length) return;
      const index = bases.length;
      bases.push(noiseSprite(NEB_SEEDS[index]));
      clouds.forEach((cloud, i) => {
        if (i % NEB_SEEDS.length === index) cloud.sprite = tintSprite(bases[index], cloud.tint);
      });
    };

    const stars = Array.from({ length: 150 }, (_, i) => ({
      x: hash2(i, 11, cfg.current.seed),
      y: hash2(i, 13, cfg.current.seed),
      r: 0.4 + hash2(i, 17, cfg.current.seed) * 1.3,
      o: 0.2 + hash2(i, 19, cfg.current.seed) * 0.6,
    }));

    const frame = (t: number) => {
      ensureBases();
      const { intensity: k } = cfg.current;

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#05070f");
      g.addColorStop(0.5, "#080c18");
      g.addColorStop(1, "#060a14");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      for (const s of stars) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${s.o * 0.7 * k})`;
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const span = Math.max(W, H);
      clouds.forEach(cloud => {
        const R = cloud.r * span * 0.62;
        ctx.save();
        ctx.translate(cloud.x * W, cloud.y * H);
        ctx.rotate(cloud.rot + (reduced ? 0 : Math.sin(t / 9000 * cloud.drift) * 0.06));
        ctx.globalAlpha = 0.72 * k;
        ctx.drawImage(cloud.sprite, -R, -R, R * 2, R * 2);
        ctx.restore();
      });
      ctx.restore();

      if (!reduced) raf = requestAnimationFrame(frame);
    };

    frame(0);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, zIndex: 0, width: "100%", height: "100%" }}
    />
  );
}
