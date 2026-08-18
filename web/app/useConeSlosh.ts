"use client";

// The knowledge cone's water-slosh interaction: two damped harmonic
// oscillators (fundamental sloshing mode ~1.05 Hz + a faster, more damped
// second mode). Pointer movement injects energy proportional to swipe
// distance and speed, so the water responds to *how* you move, keeps
// ringing after the pointer leaves, and settles naturally as the
// oscillators decay. Values are written to CSS custom properties on the
// cone directly (no React re-renders per frame). Split out of HomePage's
// ~1300-line body — this cluster only ever talked to its own ref and the
// DOM node it animates.

import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export function useConeSlosh() {
  const coneRef = useRef<HTMLDivElement>(null);
  const sloshRef = useRef({
    x1: 0, v1: 0, x2: 0, v2: 0,
    lastPointerX: null as number | null,
    lastPointerT: 0,
    raf: 0,
    running: false,
    lastFrameT: 0,
  });

  useEffect(() => {
    const slosh = sloshRef.current;
    return () => {
      cancelAnimationFrame(slosh.raf);
    };
  }, []);

  const runSloshLoop = () => {
    const slosh = sloshRef.current;
    if (slosh.running) return;
    slosh.running = true;
    slosh.lastFrameT = performance.now();
    const step = (now: number) => {
      const cone = coneRef.current;
      if (!cone) {
        slosh.running = false;
        return;
      }
      const dt = Math.min((now - slosh.lastFrameT) / 1000, 0.05);
      slosh.lastFrameT = now;
      const w1 = 2 * Math.PI * 1.05;
      const z1 = 0.055;
      const w2 = 2 * Math.PI * 2.0;
      const z2 = 0.12;
      slosh.v1 += (-w1 * w1 * slosh.x1 - 2 * z1 * w1 * slosh.v1) * dt;
      slosh.x1 += slosh.v1 * dt;
      slosh.v2 += (-w2 * w2 * slosh.x2 - 2 * z2 * w2 * slosh.v2) * dt;
      slosh.x2 += slosh.v2 * dt;
      const amp = Math.min(1, Math.abs(slosh.x1) * 1.1 + Math.abs(slosh.x2) * 0.6);
      cone.style.setProperty("--slosh-x", slosh.x1.toFixed(4));
      cone.style.setProperty("--slosh-x2", slosh.x2.toFixed(4));
      cone.style.setProperty("--slosh-amp", amp.toFixed(4));
      const energy = Math.abs(slosh.x1) + Math.abs(slosh.v1) / w1 + Math.abs(slosh.x2) + Math.abs(slosh.v2) / w2;
      if (energy > 0.003) {
        slosh.raf = requestAnimationFrame(step);
      } else {
        slosh.running = false;
        slosh.x1 = 0; slosh.v1 = 0; slosh.x2 = 0; slosh.v2 = 0;
        cone.style.setProperty("--slosh-x", "0");
        cone.style.setProperty("--slosh-x2", "0");
        cone.style.setProperty("--slosh-amp", "0");
      }
    };
    slosh.raf = requestAnimationFrame(step);
  };

  const injectSloshImpulse = (kick: number) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const slosh = sloshRef.current;
    const clamped = Math.max(-2.4, Math.min(2.4, kick));
    slosh.v1 += clamped * 2.4;
    slosh.v2 += clamped * 4.6;
    // Clamp stored energy so frantic scrubbing can't blow up the surface
    slosh.v1 = Math.max(-8, Math.min(8, slosh.v1));
    slosh.v2 = Math.max(-15, Math.min(15, slosh.v2));
    runSloshLoop();
  };

  const handleConePointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    const slosh = sloshRef.current;
    slosh.lastPointerX = event.clientX;
    slosh.lastPointerT = performance.now();
    injectSloshImpulse(0.5);
  };

  const handleConePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const slosh = sloshRef.current;
    const now = performance.now();
    if (slosh.lastPointerX !== null) {
      const dx = event.clientX - slosh.lastPointerX;
      const dtMs = Math.max(now - slosh.lastPointerT, 8);
      if (Math.abs(dx) >= 1) {
        const speed = Math.min(Math.abs(dx) / dtMs, 2);
        injectSloshImpulse(dx * 0.004 * (0.6 + speed));
      }
    }
    slosh.lastPointerX = event.clientX;
    slosh.lastPointerT = now;
  };

  const handleConePointerLeave = () => {
    sloshRef.current.lastPointerX = null;
  };

  return {
    coneRef,
    handleConePointerEnter,
    handleConePointerMove,
    handleConePointerLeave,
  };
}
