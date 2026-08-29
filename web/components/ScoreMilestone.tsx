"use client";

import { useEffect, useRef, useState } from "react";
import Nebula from "@/components/nebula/Nebula";
import type { ScoreMilestoneResult } from "@/lib/scoreMilestone";

/**
 * The crossing-a-hundred moment: the nebula, the new number, and a few
 * shooting stars.
 *
 * Shown once, on arriving at the dashboard from a finished round — see the
 * gate in app/page.tsx. It is a full-screen overlay rather than a card in the
 * page because the point is that the sky does something, and a sky boxed into
 * a panel is just a picture.
 *
 * Reduced motion is honoured properly: no count-up, no firework, the final
 * number straight away.
 */
export default function ScoreMilestone({
  milestone,
  onClose,
}: {
  milestone: ScoreMilestoneResult;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(milestone.from);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Escape closes it, like any other overlay on the site.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Count the score up from where they were to where they are. The old number
  // is the whole point — it is what makes the new one mean something.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Reduced motion runs the same path with a zero-length count, so the first
    // frame lands on the final number. Setting state straight from the effect
    // body would be the obvious way to do it and is exactly what
    // react-hooks/set-state-in-effect exists to stop.
    const DURATION = reduced ? 0 : 1600;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = DURATION === 0 ? 1 : Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(milestone.from + (milestone.to - milestone.from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [milestone.from, milestone.to]);

  // One firework, once.
  //
  // A stream of shooting stars kept drawing the eye away from the number,
  // which is the thing the screen is actually about. A single burst that
  // blooms and fades reads as punctuation instead of weather: it happens, it
  // is over, and what is left on screen is the score.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let W = 0, H = 0, DPR = 1, raf = 0;
    const resize = () => {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
    };
    resize();

    // Fired a beat after the card arrives, so it lands with the count-up
    // rather than before the reader has looked up.
    const DELAY = 420;
    const LIFE = 2600;
    const TINTS = ["#ffcf5c", "#6fe0e0", "#ffffff", "#ffe6a8"];
    const particles = Array.from({ length: 96 }, (_, i) => {
      const ang = (i / 96) * Math.PI * 2 + Math.random() * 0.09;
      // Varying the speed is what stops it looking like a clock face.
      const sp = 74 + Math.random() * 188;
      return {
        ang,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        x: 0,
        y: 0,
        tint: TINTS[i % TINTS.length],
        life: 0.72 + Math.random() * 0.28,
      };
    });

    const start = performance.now();
    let last = start;

    const frame = (now: number) => {
      const dt = Math.min(48, now - last) / 1000;
      last = now;
      const since = now - start - DELAY;

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      if (since > 0) {
        const p = Math.min(1, since / LIFE);
        // Sits above the number rather than behind it.
        const ox = W * 0.5;
        const oy = H * 0.34;

        // The flash of the burst itself, gone within a few hundred ms.
        const flash = Math.max(0, 1 - since / 260);
        if (flash > 0.01) {
          const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, 130);
          g.addColorStop(0, `rgba(255,242,214,${0.5 * flash})`);
          g.addColorStop(1, "rgba(255,242,214,0)");
          ctx.fillStyle = g;
          ctx.fillRect(ox - 130, oy - 130, 260, 260);
        }

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const q of particles) {
          const t = p / q.life;
          if (t >= 1) continue;
          // Drag, then gravity: they slow as they spread and begin to fall.
          q.vx *= 1 - 1.05 * dt;
          q.vy = q.vy * (1 - 1.05 * dt) + 52 * dt;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          const a = Math.pow(1 - t, 1.7);
          if (a < 0.02) continue;
          const px = ox + q.x;
          const py = oy + q.y;
          // A short tail along the direction of travel reads as a spark
          // rather than a dot.
          ctx.strokeStyle = q.tint;
          ctx.globalAlpha = a * 0.85;
          ctx.lineWidth = 1.7;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - q.vx * 0.028, py - q.vy * 0.028);
          ctx.stroke();
        }
        ctx.restore();

        if (p >= 1) {
          ctx.clearRect(0, 0, W, H);
          return; // Burnt out; stop the loop rather than idle on it.
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const gained = milestone.to - milestone.from;

  return (
    <div className="obs-ms" role="dialog" aria-modal="true" aria-labelledby="obs-ms-title">
      <style>{`
        .obs-ms {
          position: fixed; inset: 0; z-index: 90;
          display: flex; align-items: center; justify-content: center;
          padding: 24px; text-align: center;
          font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
          animation: obsMsIn .5s ease both;
        }
        .obs-ms-fx { position: fixed; inset: 0; z-index: 1; pointer-events: none; }
        .obs-ms-card { position: relative; z-index: 2; max-width: 460px; }
        .obs-ms-kicker {
          margin: 0 0 14px; color: #6fe0e0;
          font-size: 11.5px; font-weight: 850; letter-spacing: .16em; text-transform: uppercase;
        }
        .obs-ms-score {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(76px, 15vw, 132px); line-height: 1; color: #fff;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 6px 46px rgba(0,0,0,.6);
        }
        .obs-ms-level {
          margin: 12px 0 0; color: #ffcf5c;
          font-family: var(--font-crimson), Georgia, serif; font-size: 25px;
        }
        .obs-ms-copy {
          margin: 14px auto 0; max-width: 360px;
          color: rgba(255,255,255,.72); font-size: 14.5px; line-height: 1.6;
        }
        .obs-ms-btn {
          margin-top: 26px; min-height: 44px; padding: 11px 26px; border-radius: 999px;
          background: #0aa3a3; color: #fff; border: none; cursor: pointer;
          font: inherit; font-weight: 650;
        }
        .obs-ms-btn:hover { background: #089090; }
        .obs-ms-btn:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
        @keyframes obsMsIn { from { opacity: 0 } to { opacity: 1 } }
        @media (prefers-reduced-motion: reduce) {
          .obs-ms { animation: none; }
        }
      `}</style>

      <Nebula intensity={0.9} seed={milestone.threshold} />
      <canvas ref={canvasRef} className="obs-ms-fx" aria-hidden="true" />

      <div className="obs-ms-card">
        <p className="obs-ms-kicker">You crossed {milestone.threshold}</p>
        <div className="obs-ms-score" id="obs-ms-title">{shown}</div>
        {milestone.levelChanged && <p className="obs-ms-level">{milestone.level}</p>}
        <p className="obs-ms-copy">
          Up {gained} from {milestone.from}
          {milestone.levelChanged
            ? `, and into ${milestone.level}.`
            : "."}{" "}
          That is the reading showing up in the questions.
        </p>
        <button type="button" className="obs-ms-btn" onClick={onClose} autoFocus>
          See your dashboard
        </button>
      </div>
    </div>
  );
}
