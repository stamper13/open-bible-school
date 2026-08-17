"use client";

import { useEffect, useRef } from "react";
import { SHOOTING_PALETTES, drawArrival, drawStreak } from "@/lib/skyStreak";

/**
 * The moment a section clears and a new focus opens.
 *
 * Rather than swapping one node's colour for another's, light leaves the
 * cleared node and travels to the newly opened one — drawn with the same
 * streak routine the dashboard sky already uses for its shooting stars, so
 * this introduces no second animation system.
 *
 * The overlay is a fixed, pointer-transparent canvas above the map. It runs
 * once per `token` change and then clears itself.
 */

const DURATION_MS = 1150;
const HOLD_MS = 420;

export default function FocusTransition({
  token,
  fromId,
  toId,
  onDone,
}: {
  /** Changes exactly once per cleared-focus event; null means nothing to play. */
  token: string | null;
  /** DOM id of the node that just cleared. */
  fromId: string | null;
  /** DOM id of the node that just became the focus. */
  toId: string | null;
  onDone?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);

  // Keep the callback current without making it a dependency of the animation
  // effect — a new closure each render must not restart a running transition.
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    if (!token || !fromId || !toId) return;

    const canvas = canvasRef.current;
    const from = document.getElementById(fromId);
    const to = document.getElementById(toId);
    if (!canvas || !from || !to) {
      doneRef.current?.();
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      doneRef.current?.();
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      doneRef.current?.();
      return;
    }

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let animId = 0;
    let cancelled = false;

    // The travelling light should land on the node wherever it currently sits,
    // so the map is scrolled to the new focus first and the endpoints are read
    // after that scroll settles.
    to.scrollIntoView({ behavior: "smooth", block: "center" });

    const palette = SHOOTING_PALETTES[1];

    function sizeCanvas() {
      if (!canvas || !ctx) return;
      canvas.width = window.innerWidth * DPR;
      canvas.height = window.innerHeight * DPR;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }

    const start = performance.now();

    function frame(now: number) {
      if (cancelled || !canvas || !ctx || !from || !to) return;

      sizeCanvas();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Endpoints are re-read every frame: the smooth scroll above is still
      // moving under us, and the light has to stay attached to the nodes.
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const ax = (a.left + a.width / 2) * DPR;
      const ay = (a.top + a.height / 2) * DPR;
      const bx = (b.left + b.width / 2) * DPR;
      const by = (b.top + b.height / 2) * DPR;

      const elapsed = now - start;
      const travel = Math.min(1, elapsed / DURATION_MS);
      // Ease-out so the light leaves fast and settles onto its destination.
      const eased = 1 - Math.pow(1 - travel, 3);

      const headX = ax + (bx - ax) * eased;
      const headY = ay + (by - ay) * eased;
      const trail = Math.min(0.38, eased);
      const tailX = headX - (bx - ax) * trail;
      const tailY = headY - (by - ay) * trail;

      const fade = travel < 1 ? 1 : Math.max(0, 1 - (elapsed - DURATION_MS) / HOLD_MS);
      const opacity = Math.min(1, travel * 4) * fade * 0.95;

      if (opacity > 0.01) {
        drawStreak(ctx, {
          tailX,
          tailY,
          headX,
          headY,
          opacity,
          width: 2.2 * DPR,
          blur: 12 * DPR,
          palette,
        });
        drawArrival(ctx, headX, headY, (2 + 4 * eased) * DPR, opacity, palette);
      }

      if (elapsed < DURATION_MS + HOLD_MS) {
        animId = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        doneRef.current?.();
      }
    }

    animId = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
    };
  }, [fromId, toId, token]);

  return (
    <canvas
      ref={canvasRef}
      className="focus-transition"
      aria-hidden="true"
    />
  );
}
