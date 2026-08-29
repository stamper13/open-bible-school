"use client";

import { useEffect, useRef } from "react";
import { BLI_LEVELS, levelForScore } from "@/lib/bli";
// The nebula's noise lives in components/nebula so the sign-in screens can use
// the same clouds; this file keeps the star map that sits in front of them.
import { NEB_SEEDS, hash2, noiseSprite, tintSprite } from "@/components/nebula/noise";
import {
  QUESTIONS_BY_SECTION,
  ROUTE_FROM,
  ROUTE_TO,
  SCENES,
  STARS,
  STAR_INDEX,
  type Planet,
  type SectionKey,
  type Star,
} from "./introData";

/**
 * The fixed backdrop for /intro: the canon drawn the way the knowledge map
 * draws it, with the camera moving through it as the reader scrolls.
 *
 *   nebula  ->  the canon before any of it is mapped
 *   star    ->  a section        (Torah, Former Prophets, ...)
 *   planet  ->  a book orbiting its section
 *   moon    ->  a section of that book, labelled by chapter range
 *
 * Those are the same three levels, in the same colours, as
 * app/knowledge-map/FocusStarMap.tsx. Detail is revealed by zoom: planets
 * resolve as the camera closes on a star, moons as it closes on a planet.
 *
 * The bodies are rendered to look like the real things rather than like icons:
 *
 *   - the nebula is fractal noise fed back into itself (domain warping), which
 *     is what gives real emission nebulae their filaments and dust lanes — a
 *     plain radial gradient reads as a coloured smudge no matter how it is
 *     tuned. Each section's cloud is baked to its own sprite once at startup,
 *     so the per-pixel cost is paid a single time and every frame after that
 *     is one drawImage;
 *   - stars get a saturated core that blows out to white, a wide halo, and
 *     long thin diffraction spikes. The spike geometry is the whole trick: a
 *     short fat four-pointed star is a clipart sparkle, a long thin one reads
 *     as a photograph;
 *   - planets and moons are lit *from their star*, with a terminator, a rim
 *     highlight on the lit limb, and a little surface mottling — so which way
 *     a body is lit tells you where it is in its orbit.
 *
 * The render loop starts once and reads the current scene from a ref, so
 * scrolling never tears down and rebuilds the animation.
 */

const TILT_WIDE = 0.42;
const TILT_NARROW = 0.6;

const PLANET_IN = 1.6, PLANET_FULL = 2.6;
const MOON_IN = 4.0, MOON_FULL = 6.0;

/** The example score the convergence resolves to, and where it lands. */
const DEMO_BLI = 512;
/** Where the plotted course ends: the passage the tour keeps pointing at. */
const PLOT_LABEL = "Exodus 19–24";

const FIT_WIDE = { w: 1320, h: 620 };
const FIT_NARROW = { w: 820, h: 900 };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** "#rrggbb" -> "rgba(r,g,b,a)", so alpha can be computed rather than baked. */
function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * A small deterministic lightness/warmth nudge, so the books of one section
 * are recognisably a family without being identical castings of the same ball.
 * The knowledge map does the same thing to its bodies (see `jitter` in
 * app/knowledge-map/focusStarMapParts.tsx); this is the local, dependency-free
 * version, kept small enough that section identity still reads at a glance.
 */
function vary(hex: string, seed: number): string {
  const p = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const l = (hash2(seed, 3, 91) - 0.5) * 0.30;        // -15% .. +15% lightness
  const wobble = [1 + (hash2(seed, 5, 13) - 0.5) * 0.16,
                  1,
                  1 + (hash2(seed, 9, 29) - 0.5) * 0.16];
  const out = p.map((c, i) => {
    const mixed = l >= 0 ? c + (255 - c) * l : c * (1 + l);
    return Math.max(0, Math.min(255, Math.round(mixed * wobble[i])));
  });
  return `rgb(${out[0]},${out[1]},${out[2]})`;
}

/** Stable numeric seed for a book or moon. */
function codeSeed(code: string): number {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) h = Math.imul(h ^ code.charCodeAt(i), 16777619) >>> 0;
  return h % 100000;
}

export default function StarMap({ scene }: { scene: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(scene);

  useEffect(() => { sceneRef.current = scene; }, [scene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, DPR = 1, tilt = TILT_WIDE;
    let raf = 0;
    let t = 0;
    let last = performance.now();

    const cam = { zoom: 1, cx: 0, cy: 0, nebula: 1 };
    // 1 on the opening card, 0 on every other scene. It gates the two things
    // that belong to the opening and nowhere else: the ambient sky's twinkle,
    // and the embedded question stars with their SAMPLE QUESTION cards. Past
    // the title the sky is scenery — it should sit still and let the orrery
    // (the scan, the books, the route) be the only thing moving. Eased rather
    // than switched, so both die away over the scroll into scene two instead
    // of stopping dead on the boundary.
    let opening = 1;
    // How far the star map is curtained off. The last two scenes are not about
    // the canon, so they draw over it rather than on it: the scrim is painted
    // in the page background colour and the scene's own graphic goes on top.
    // Eased, so the sky dissolves away and comes back rather than cutting.
    let curtain = 0;
    let started = false;
    // Scenes that play a timed sequence need to know when they were entered.
    let sceneId = "";
    let sceneAt = 0;

    let userRot = 0, spin = 0;
    let dragging = false, lastX = 0;
    let px = 0, py = 0, pxs = 0, pys = 0;
    // Pointer in screen pixels. Parked far off-canvas when there is no pointer
    // (touch, or the cursor has left), so proximity maths reads as "nowhere
    // near" rather than as the top-left corner.
    let mouseX = -99999, mouseY = -99999;
    let hoverLabel: { text: string; x: number; y: number } | null = null;

    // Three base clouds, tinted per section, each with its own rotation so no
    // two sections show the same shape.
    //
    // Only the first is built now — enough for every star to have a cloud on
    // the very first frame — and the other two are built one per frame after
    // that, with the sections that want them re-tinted as they arrive. The
    // swap is invisible: it happens within the first few frames, while the
    // clouds are still fading up.
    const bases: HTMLCanvasElement[] = [noiseSprite(NEB_SEEDS[0])];
    const clouds = STARS.map((star, i) => ({
      sprite: tintSprite(bases[0], star.hue),
      rot: (i * 2.399) % (Math.PI * 2),
    }));

    function ensureBases() {
      if (bases.length >= NEB_SEEDS.length) return;
      const index = bases.length;
      bases.push(noiseSprite(NEB_SEEDS[index]));
      STARS.forEach((star, i) => {
        if (i % NEB_SEEDS.length === index) clouds[i].sprite = tintSprite(bases[index], star.hue);
      });
    }

    // A real sky is not uniformly white: most stars are faint and slightly
    // coloured, a few are bright.
    const SKY_TINTS = ["255,255,255", "202,222,255", "255,236,210", "255,214,180"];
    const sky = Array.from({ length: 420 }, () => {
      const mag = Math.pow(Math.random(), 2.4);   // many faint, few bright
      return {
        x: Math.random(), y: Math.random(),
        r: 0.35 + mag * 1.9,
        o: 0.18 + mag * 0.72,
        tint: SKY_TINTS[Math.floor(Math.random() * SKY_TINTS.length)],
        s: 0.002 + Math.random() * 0.004,
        p: Math.random() * Math.PI * 2,
        big: mag > 0.82,
      };
    });

    // Young stars embedded in the cloud. Unlike the dust these do not condense
    // — they are already stars, so holding them still is what makes the cloud
    // look like it is thinning to reveal them. Each breathes on its own cycle,
    // and brightens when the pointer passes near it.
    const embers = Array.from({ length: 120 }, () => {
      const star = STARS[Math.floor(Math.random() * STARS.length)];
      const a = Math.random() * Math.PI * 2;
      const d = 18 + Math.random() * 255;
      return {
        star,
        ox: Math.cos(a) * d, oy: Math.sin(a) * d * 0.75,
        r: 0.7 + Math.random() * 1.7,
        base: 0.22 + Math.random() * 0.5,
        sp: 0.0005 + Math.random() * 0.0016,
        ph: Math.random() * Math.PI * 2,
        hot: Math.random() < 0.16,
        // Only the bright, spiked ones carry a question: they are the ones a
        // reader can actually aim at, and a card on every mote would strobe.
        // The question comes from the section this star belongs to, so
        // hovering in the Torah asks about the Torah.
        q: (() => {
          const pool = QUESTIONS_BY_SECTION[star.key];
          return pool.length
            ? pool[Math.floor(Math.random() * pool.length)]
            : "Which came first — the events of Ruth, or the reign of Saul?";
        })(),
      };
    });

    // Motes that stream inward during "converge". Independent of the dust so
    // the two effects can run on different scenes without interfering.
    const motes = Array.from({ length: 150 }, () => ({
      ang: Math.random() * Math.PI * 2,
      dist: 180 + Math.random() * 520,
      delay: Math.random() * 0.42,
      r: 0.8 + Math.random() * 1.9,
      hue: STARS[Math.floor(Math.random() * STARS.length)].hue,
    }));

    const dust = Array.from({ length: 300 }, () => {
      const star = STARS[Math.floor(Math.random() * STARS.length)];
      const a = Math.random() * Math.PI * 2;
      const d = 40 + Math.random() * 300;
      return {
        star, ox: Math.cos(a) * d, oy: Math.sin(a) * d * 0.7,
        r: 0.5 + Math.random() * 1.3,
        o: 0.2 + Math.random() * 0.5,
      };
    });

    function resize() {
      if (!canvas) return;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      tilt = W >= 900 ? TILT_WIDE : TILT_NARROW;
    }
    resize();
    window.addEventListener("resize", resize);

    const anchor = () => (W >= 900 ? { ax: 0.66, ay: 0.5 } : { ax: 0.5, ay: 0.37 });
    const baseScale = () => {
      const fit = W >= 900 ? FIT_WIDE : FIT_NARROW;
      return Math.min(W / fit.w, H / fit.h);
    };

    const planetPos = (star: Star, p: Planet): [number, number] => {
      const a = p.angle0 + t * p.speed + userRot;
      return [star.x + Math.cos(a) * p.orbit, star.y + Math.sin(a) * p.orbit * tilt];
    };

    // --- pointer ------------------------------------------------------------
    const onDown = (e: PointerEvent) => {
      dragging = true; lastX = e.clientX;
      canvas?.setPointerCapture(e.pointerId);
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      // A finger fires pointermove while it drags but no pointerleave when it
      // lifts, so without this a sample-question card raised by a touch would
      // sit on screen for good. Mouse cursors still have somewhere to be, so
      // only touch/pen park the pointer.
      if (e.pointerType !== "mouse") { mouseX = -99999; mouseY = -99999; hoverLabel = null; }
      try { canvas?.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      mouseX = mx; mouseY = my;
      px = (mx / W) * 2 - 1;
      py = (my / H) * 2 - 1;
      if (dragging) {
        spin = (e.clientX - lastX) * 0.0045;
        lastX = e.clientX;
        userRot += spin;
      }
      const { ax, ay } = anchor();
      const s = baseScale() * cam.zoom;
      const ox = W * ax - cam.cx * s + pxs * 14;
      const oy = H * ay - cam.cy * s + pys * 9;
      const planetsOn = clamp01((cam.zoom - PLANET_IN) / (PLANET_FULL - PLANET_IN));

      let found: { text: string; x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const star of STARS) {
        const sx = ox + star.x * s, sy = oy + star.y * s;
        const d = Math.hypot(mx - sx, my - sy);
        if (d < Math.max(18, star.r * s) && d < bestD) {
          bestD = d;
          found = { text: `${star.name} · ${star.planets.length} books`, x: sx, y: sy - star.r * s - 16 };
        }
        if (planetsOn > 0.4) {
          for (const p of star.planets) {
            const [wx, wy] = planetPos(star, p);
            const ppx = ox + wx * s, ppy = oy + wy * s;
            const pd = Math.hypot(mx - ppx, my - ppy);
            if (pd < Math.max(13, 6 * s) && pd < bestD) {
              bestD = pd;
              found = { text: p.name, x: ppx, y: ppy - Math.max(13, 6 * s) - 12 };
            }
          }
        }
      }
      hoverLabel = found;
      canvas!.style.cursor = dragging ? "grabbing" : found ? "pointer" : "grab";
    };
    const onLeave = () => { hoverLabel = null; px = 0; py = 0; mouseX = -99999; mouseY = -99999; };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    function label(text: string, x: number, y: number, color: string, size = 13, weight = "700", alpha = 1) {
      if (!ctx || alpha <= 0.02) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Nudge a label back inside the viewport rather than letting it run off
      // the edge; a half-cut word reads as a bug.
      const half = ctx.measureText(text).width / 2;
      const cx = Math.min(W - 6 - half, Math.max(6 + half, x));
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "rgba(6,10,20,.85)";
      ctx.strokeText(text, cx, y);
      ctx.fillStyle = color;
      ctx.fillText(text, cx, y);
      ctx.restore();
    }

    /** The sample-question card that follows the cursor onto a bright star. */
    function questionCard(text: string, x: number, y: number, alpha: number) {
      if (!ctx || alpha <= 0.02) return;
      const MAXW = 248, PADX = 14, PADY = 11, LH = 18;
      ctx.save();
      ctx.font = "600 13px ui-sans-serif, system-ui, -apple-system, sans-serif";
      const lines: string[] = [];
      let line = "";
      for (const word of text.split(" ")) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > MAXW && line) { lines.push(line); line = word; }
        else line = test;
      }
      if (line) lines.push(line);

      const textW = Math.max(...lines.map(l => ctx.measureText(l).width));
      ctx.font = "800 9.5px ui-sans-serif, system-ui, -apple-system, sans-serif";
      const w = Math.max(textW, ctx.measureText("SAMPLE QUESTION").width) + PADX * 2;
      const h = lines.length * LH + PADY * 2 + 16;
      // Keep the whole card on screen no matter which star is hovered.
      const bx = Math.min(W - w - 10, Math.max(10, x + 18));
      const by = Math.min(H - h - 10, Math.max(10, y - h - 14));

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") ctx.roundRect(bx, by, w, h, 12);
      else ctx.rect(bx, by, w, h);
      ctx.fillStyle = "rgba(7,11,22,.92)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,207,92,.42)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#ffcf5c";
      ctx.fillText("SAMPLE QUESTION", bx + PADX, by + PADY);
      ctx.font = "600 13px ui-sans-serif, system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,.93)";
      lines.forEach((l, i) => ctx.fillText(l, bx + PADX, by + PADY + 17 + i * LH));
      ctx.restore();
    }

    /** One diffraction spike: long, thin, and brightest at the core. */
    function spike(x: number, y: number, len: number, wide: number, angle: number, color: string) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      const g = ctx.createLinearGradient(-len, 0, len, 0);
      g.addColorStop(0, "transparent");
      g.addColorStop(0.5, color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(0, -wide);
      ctx.lineTo(len, 0);
      ctx.lineTo(0, wide);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function drawStarBody(x: number, y: number, r: number, hue: string, alpha: number) {
      if (!ctx || alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = "lighter";

      // Spikes and halo belong to a *point source*. Letting them scale with
      // the star's apparent radius means that flying the camera up to a star
      // grows a thousand-pixel cross across the whole frame, which is both
      // ugly and backwards: as a star resolves into a disk its diffraction
      // spikes should fade out, not take over. So both are capped in screen
      // pixels, and the spikes fade as the disk gets large.
      const haloR = Math.min(r * 7, 380);
      const point = clamp01((92 - r) / 68);
      const spikeL = Math.min(r * 8.5, 280);

      const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
      halo.addColorStop(0, rgba(hue, 0.40));
      halo.addColorStop(0.18, rgba(hue, 0.20));
      halo.addColorStop(0.5, rgba(hue, 0.07));
      halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(x, y, haloR, 0, Math.PI * 2); ctx.fill();

      if (point > 0.01) {
        const w = Math.min(r * 0.20, 7);
        spike(x, y, spikeL, w, 0, rgba(hue, 0.66 * point));
        spike(x, y, spikeL, w, Math.PI / 2, rgba(hue, 0.66 * point));
        spike(x, y, spikeL * 0.52, w * 0.55, Math.PI / 4, rgba(hue, 0.32 * point));
        spike(x, y, spikeL * 0.52, w * 0.55, -Math.PI / 4, rgba(hue, 0.32 * point));
      }

      // Core: saturated at the edge, blown out to white at the centre.
      const core = ctx.createRadialGradient(x, y, 0, x, y, r * 1.25);
      core.addColorStop(0, "#ffffff");
      core.addColorStop(0.30, "#fffdf6");
      core.addColorStop(0.52, hue);
      core.addColorStop(1, "transparent");
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    /** A lit sphere: terminator away from the star, rim light toward it. */
    function drawSphere(
      x: number, y: number, r: number, color: string,
      lx: number, ly: number, alpha: number, seed: number, mottle: number,
    ) {
      if (!ctx || alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = alpha;

      if (r < 2.4) {
        // Too small for shading to read; a lit dot is more honest than mush.
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.7, r), 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.restore();
        return;
      }

      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();

      ctx.fillStyle = color;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);

      // Sunward highlight.
      const hx = x + lx * r * 0.42, hy = y + ly * r * 0.42;
      const hi = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 1.5);
      hi.addColorStop(0, "rgba(255,255,255,.85)");
      hi.addColorStop(0.35, "rgba(255,255,255,.22)");
      hi.addColorStop(1, "transparent");
      ctx.fillStyle = hi;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);

      // Night side.
      const sx = x - lx * r * 0.85, sy = y - ly * r * 0.85;
      const sh = ctx.createRadialGradient(sx, sy, r * 0.1, sx, sy, r * 1.85);
      sh.addColorStop(0, "rgba(0,0,6,.94)");
      sh.addColorStop(0.55, "rgba(0,0,6,.52)");
      sh.addColorStop(1, "transparent");
      ctx.fillStyle = sh;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);

      // A little surface variation so it is not a billiard ball.
      if (mottle > 0 && r > 4) {
        for (let i = 0; i < 4; i++) {
          const a = hash2(i, seed, 7) * Math.PI * 2;
          const d = hash2(i, seed, 13) * r * 0.75;
          const rr = r * (0.16 + hash2(i, seed, 19) * 0.3);
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, rr * 0.72, a, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,0,10,${0.10 * mottle})`;
          ctx.fill();
        }
      }
      ctx.restore();

      // Rim light along the lit limb.
      const rimA = Math.atan2(ly, lx);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.97, rimA - 1.15, rimA + 1.15);
      ctx.strokeStyle = "rgba(255,255,255,.5)";
      ctx.lineWidth = Math.max(0.6, r * 0.09);
      ctx.stroke();
      ctx.restore();
    }

    function draw(now: number) {
      if (!canvas || !ctx) return;
      const dt = Math.min(48, now - last);
      last = now;
      if (!reduced) t += dt;
      ensureBases();

      if (!dragging) {
        userRot += spin;
        spin *= 0.94;
        if (Math.abs(spin) < 1e-5) spin = 0;
      }
      const pEase = 1 - Math.exp(-dt / 320);
      pxs = lerp(pxs, px, pEase);
      pys = lerp(pys, py, pEase);

      const sc = SCENES[Math.max(0, Math.min(SCENES.length - 1, sceneRef.current))];
      if (sc.id !== sceneId) { sceneId = sc.id; sceneAt = t; }
      const since = t - sceneAt;

      let tcx = sc.center?.[0] ?? 0, tcy = sc.center?.[1] ?? 0;
      if (sc.focus) {
        const star = STARS[STAR_INDEX[sc.focus.section]];
        if (star) {
          if (sc.focus.book) {
            const p = star.planets.find(q => q.code === sc.focus!.book);
            if (p) [tcx, tcy] = planetPos(star, p);
            else { tcx = star.x; tcy = star.y; }
          } else { tcx = star.x; tcy = star.y; }
        }
      }
      // Time-based, so the glide is identical on 60Hz, 120Hz or a throttled tab.
      const ease = started ? 1 - Math.exp(-dt / 240) : 1;
      started = true;
      cam.zoom = lerp(cam.zoom, sc.zoom, ease);
      cam.cx = lerp(cam.cx, tcx, ease);
      cam.cy = lerp(cam.cy, tcy, ease);
      cam.nebula = lerp(cam.nebula, sc.nebula, ease);
      opening = lerp(opening, sc.id === "title" ? 1 : 0, ease);
      curtain = lerp(curtain, sc.mode === "draft" || sc.mode === "docs" ? 1 : 0, ease);

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.globalCompositeOperation = "source-over";

      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#05070f"); g.addColorStop(0.5, "#080c18"); g.addColorStop(1, "#060a14");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      const { ax, ay } = anchor();
      const s = baseScale() * cam.zoom;
      const ox = W * ax - cam.cx * s + pxs * 14;
      const oy = H * ay - cam.cy * s + pys * 9;
      const neb = cam.nebula;

      // Ambient sky.
      ctx.save();
      ctx.globalAlpha = 1 - neb * 0.55;
      for (const st of sky) {
        const tw = reduced ? 1 : 0.65 + 0.35 * Math.sin(t * st.s + st.p) * opening;
        const sx = st.x * W, sy = st.y * H;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${st.tint},${st.o * tw})`;
        ctx.arc(sx, sy, st.r, 0, Math.PI * 2);
        ctx.fill();
        if (st.big) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          spike(sx, sy, st.r * 6, st.r * 0.28, 0, `rgba(${st.tint},${0.28 * tw})`);
          spike(sx, sy, st.r * 6, st.r * 0.28, Math.PI / 2, `rgba(${st.tint},${0.28 * tw})`);
          ctx.restore();
        }
      }
      ctx.restore();

      // --- nebula ---
      if (neb > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        STARS.forEach((star, i) => {
          const cloud = clouds[i];
          const cx = ox + star.x * s, cy = oy + star.y * s;
          const R = (star.r * 2.2 + neb * 265) * s;
          if (R < 2) return;
          const drift = reduced ? 0 : Math.sin(t / 6400 + i) * 0.05;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(cloud.rot + drift);
          ctx.globalAlpha = Math.min(1, 0.30 + neb * 0.75);
          ctx.drawImage(cloud.sprite, -R, -R, R * 2, R * 2);
          ctx.restore();
        });
        for (const d of dust) {
          const x = ox + (d.star.x + d.ox * neb) * s;
          const y = oy + (d.star.y + d.oy * neb) * s;
          ctx.beginPath();
          ctx.fillStyle = `rgba(255,255,255,${d.o * neb * 0.6})`;
          ctx.arc(x, y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Embedded stars. Drawn outside the nebula block so they survive as the
      // cloud thins, but weighted toward it — they are its brightest feature.
      let question: { text: string; x: number; y: number; a: number } | null = null;
      if (opening > 0.01) {
        const vis = (0.3 + neb * 0.7) * opening;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const e of embers) {
          const x = ox + (e.star.x + e.ox) * s;
          const y = oy + (e.star.y + e.oy) * s;
          if (x < -50 || x > W + 50 || y < -50 || y > H + 50) continue;
          const tw = reduced ? 1 : 0.55 + 0.45 * Math.sin(t * e.sp + e.ph);
          const dx = x - mouseX, dy = y - mouseY;
          const near = Math.exp(-(dx * dx + dy * dy) / (2 * 115 * 115));
          const a = Math.min(1, e.base * tw * vis * (1 + near * 2.8));
          if (a < 0.02) continue;
          // Sized partly with the view: fixed pixel sizes look right on a
          // desktop but turn into bokeh on a phone, where the cloud itself is
          // half the size. Clamped so a deep zoom does not inflate them.
          const sizeK = Math.max(0.55, Math.min(1.25, s));
          const rr = e.r * sizeK * (1 + near * 1.1);

          ctx.beginPath();
          ctx.fillStyle = `rgba(255,246,232,${a * 0.22})`;
          ctx.arc(x, y, rr * 3.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.arc(x, y, rr, 0, Math.PI * 2);
          ctx.fill();
          if (e.hot || near > 0.22) {
            const sa = a * (e.hot ? 0.42 : 0.3) * (0.4 + near);
            spike(x, y, rr * 9, rr * 0.32, 0, `rgba(255,250,240,${sa})`);
            spike(x, y, rr * 9, rr * 0.32, Math.PI / 2, `rgba(255,250,240,${sa})`);
          }
          // Closest bright star under the cursor wins the card.
          if (e.hot && near > 0.42 && (!question || near > question.a)) {
            question = { text: e.q, x, y, a: near };
          }
        }
        ctx.restore();
      }

      // Early probing, shown rather than implied. Three rings washing out of
      // the middle said "a sweep is happening" but not what was being swept —
      // and centred on the field they read as coming out of one section. This
      // walks a probe from star to star instead: each one pulses as it is
      // touched, the trail shows where the probe just came from, and the order
      // deliberately jumps the long way across the canon rather than visiting
      // neighbours. That is the actual routing behaviour — broad before deep,
      // moving between sections instead of drilling into the first miss — and
      // it sets up the next scene's descent into the Torah as a real contrast.
      if (sc.mode === "scan") {
        const ORDER: SectionKey[] = [
          "TORAH", "LATTER", "WRITINGS", "GOSPELS_ACTS",
          "FORMER", "APOCALYPSE", "PAULINE", "GENERAL",
        ];
        const at = (k: number) => {
          const st = STARS[STAR_INDEX[ORDER[k % ORDER.length]]];
          return [ox + st.x * s, oy + st.y * s] as const;
        };

        ctx.save();
        if (reduced) {
          // No travel: every station marked at once, held still.
          for (let k = 0; k < ORDER.length; k++) {
            const [sx, sy] = at(k);
            ctx.beginPath();
            ctx.arc(sx, sy, 26 * Math.max(0.6, Math.min(1.4, s)), 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(79,214,214,.34)";
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }
        } else {
          const HOP = 620;
          const span = ORDER.length * HOP;
          const now = since % span;
          const idx = Math.floor(now / HOP);
          const f = (now % HOP) / HOP;

          // Each station keeps ringing for a couple of hops after the probe
          // has moved on, so the map fills in rather than lighting one at a
          // time — the point being how much ground the early questions cover.
          for (let k = 0; k <= idx; k++) {
            const age = (now - k * HOP) / HOP;
            const life = Math.max(0, 1 - age / 2.4);
            if (life <= 0.02) continue;
            const [sx, sy] = at(k);
            const grow = (1 - life) * 44 * Math.max(0.6, Math.min(1.4, s));
            ctx.beginPath();
            ctx.arc(sx, sy, 9 + grow, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(79,214,214,${life * 0.5})`;
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }

          const [x0, y0] = at(idx);
          const [x1, y1] = at(idx + 1);
          const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
          const hx = x0 + (x1 - x0) * e;
          const hy = y0 + (y1 - y0) * e;

          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(hx, hy);
          ctx.strokeStyle = `rgba(79,214,214,${0.42 * (1 - e * 0.55)})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.globalCompositeOperation = "lighter";
          ctx.beginPath();
          ctx.fillStyle = "rgba(79,214,214,.28)";
          ctx.arc(hx, hy, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.fillStyle = "rgba(206,250,250,.95)";
          ctx.arc(hx, hy, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      const planetsOn = clamp01((cam.zoom - PLANET_IN) / (PLANET_FULL - PLANET_IN));
      const moonsOn = clamp01((cam.zoom - MOON_IN) / (MOON_FULL - MOON_IN));
      const starsOn = 1 - clamp01((neb - 0.35) / 0.5);
      const isRoute = sc.mode === "route";

      for (const star of STARS) {
        const cx = ox + star.x * s, cy = oy + star.y * s;
        const R = Math.max(2, star.r * s);
        const focused = sc.focus?.section === star.key;
        const inBook = sc.mode === "moons" && Boolean(sc.focus?.book);
        // The score resolves at the camera anchor — which is the world origin,
        // where the Torah sits. Without pulling the sky down the number lands
        // inside that star's glare and eight labels crowd it.
        const quiet = sc.mode === "converge" ? 0.4 : 1;
        const dim = isRoute && star.key !== ROUTE_FROM.section && star.key !== ROUTE_TO.section ? 0.4 : 1;

        // Inside a book the parent star drops back: at that zoom its core is
        // wider than the whole moon ring and simply swallows it.
        drawStarBody(cx, cy, R, star.hue, starsOn * dim * quiet * (inBook ? 0.26 : 1));

        const hasFocus = Boolean(sc.focus);
        const localPlanets = focused
          ? Math.max(planetsOn, 0.85)
          : planetsOn * (hasFocus ? 0.22 : 1);

        if (localPlanets > 0.02 || isRoute) {
          for (const p of star.planets) {
            const isRoutePlanet =
              isRoute &&
              ((star.key === ROUTE_FROM.section && p.code === ROUTE_FROM.book) ||
               (star.key === ROUTE_TO.section && p.code === ROUTE_TO.book));
            const isFocusBook = focused && sc.focus?.book === p.code;
            const sibling = inBook && !isFocusBook ? 0.28 : 1;
            const alpha = isRoutePlanet ? 1 : localPlanets * starsOn * dim * sibling;
            if (alpha <= 0.02) continue;

            const [wx, wy] = planetPos(star, p);
            const ppx = ox + wx * s, ppy = oy + wy * s;
            const pr = Math.max(1.2, 6 * s);

            ctx.save();
            ctx.globalAlpha = alpha * 0.4;
            ctx.beginPath();
            ctx.ellipse(cx, cy, p.orbit * s, p.orbit * s * tilt, 0, 0, Math.PI * 2);
            ctx.strokeStyle = `${star.hue}3a`;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();

            // Lit from its own star.
            const dxl = cx - ppx, dyl = cy - ppy;
            const dl = Math.hypot(dxl, dyl) || 1;
            const seed = codeSeed(p.code);
            drawSphere(ppx, ppy, pr, vary(star.hue, seed), dxl / dl, dyl / dl, alpha, seed, 1);

            const nameable = hasFocus ? focused : localPlanets > 0.55;
            if (nameable && localPlanets > 0.55 && !isRoute) {
              label(
                p.name, ppx, ppy - pr - 11,
                isFocusBook ? "#fff" : "rgba(255,255,255,.82)",
                isFocusBook ? 14 : 11.5,
                isFocusBook ? "800" : "700",
                localPlanets * sibling,
              );
            }
            if (isRoutePlanet) {
              const gold = star.key === ROUTE_TO.section ? "#ffcf5c" : "rgba(255,255,255,.88)";
              const name = star.key === ROUTE_TO.section ? ROUTE_TO.label : ROUTE_FROM.label;
              label(name, ppx, ppy - pr - 14, gold, 13, "800");
            }

            if (isFocusBook && moonsOn > 0.02 && p.divisions.length) {
              const mOrbit = 26 * s;
              const mr = Math.max(1.2, 2.2 * s);
              ctx.save();
              ctx.globalAlpha = moonsOn * 0.5;
              ctx.beginPath();
              ctx.ellipse(ppx, ppy, mOrbit, mOrbit * tilt, 0, 0, Math.PI * 2);
              ctx.strokeStyle = "rgba(255,255,255,.24)";
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.restore();

              p.divisions.forEach((d, k) => {
                const a = (k / p.divisions.length) * Math.PI * 2 + (reduced ? 0 : t / 9000) + userRot;
                const mx = ppx + Math.cos(a) * mOrbit;
                const my = ppy + Math.sin(a) * mOrbit * tilt;
                const mdx = cx - mx, mdy = cy - my;
                const md = Math.hypot(mdx, mdy) || 1;
                const mseed = seed + k * 7919;
                drawSphere(mx, my, mr, vary("#b9bcc6", mseed), mdx / md, mdy / md, moonsOn, mseed, 2.4);
                const lx = ppx + Math.cos(a) * (mOrbit + mr + 16);
                const ly = my + Math.sin(a) * (mr + 14) - 4;
                label(d.chapters, lx, ly, "rgba(255,255,255,.85)", 11.5, "800", moonsOn);
              });
            }
          }
        }

        if (sc.mode === "score" && (focused || (!sc.focus && star.key === "LATTER"))) {
          const fill = reduced ? 0.68 : 0.52 + 0.18 * Math.sin(t / 1400);
          ctx.save();
          ctx.globalAlpha = starsOn;
          ctx.beginPath();
          ctx.arc(cx, cy, R * 2.6, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,255,255,.15)";
          ctx.lineWidth = Math.max(1, R * 0.1);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx, cy, R * 2.6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fill);
          ctx.strokeStyle = "#ffcf5c";
          ctx.lineWidth = Math.max(2, R * 0.18);
          ctx.lineCap = "round";
          ctx.stroke();
          ctx.restore();
        }

        // No section names during the score beat or on the plotted star: the
        // number and the passage callout are what those moments are about.
        const nameSuppressed =
          sc.mode === "converge" || (sc.mode === "plot" && star.key === "TORAH");
        if ((!isRoute || dim === 1) && !nameSuppressed) {
          const nameAlpha = starsOn * dim * (sc.focus && !focused ? 0.45 : 1);
          label(star.name, cx, cy - R * 2.2 - 12, focused ? "#fff" : "rgba(255,255,255,.8)",
                focused ? 14.5 : 12.5, "800", nameAlpha);
        }
      }

      if (isRoute) {
        const fromStar = STARS[STAR_INDEX[ROUTE_FROM.section]];
        const toStar = STARS[STAR_INDEX[ROUTE_TO.section]];
        const from = fromStar?.planets.find(p => p.code === ROUTE_FROM.book);
        const to = toStar?.planets.find(p => p.code === ROUTE_TO.book);
        if (fromStar && toStar && from && to) {
          const [fx, fy] = planetPos(fromStar, from);
          const [tx, ty] = planetPos(toStar, to);
          const ax1 = ox + fx * s, ay1 = oy + fy * s;
          const bx = ox + tx * s, by = oy + ty * s;
          ctx.save();
          ctx.setLineDash([7, 9]);
          ctx.lineDashOffset = reduced ? 0 : -(t / 34) % 16;
          ctx.beginPath();
          ctx.moveTo(ax1, ay1);
          ctx.quadraticCurveTo((ax1 + bx) / 2, (ay1 + by) / 2 - 110 * cam.zoom, bx, by);
          ctx.strokeStyle = "rgba(255,207,92,.9)";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      }

      // --- the score resolving out of the sky ---
      if (sc.mode === "converge") {
        const P = reduced ? 1 : clamp01(since / 2800);
        const ease3 = (v: number) => 1 - Math.pow(1 - v, 3);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const m of motes) {
          const p = clamp01((P - m.delay) / (1 - m.delay));
          if (p <= 0) continue;
          const e = ease3(p);
          const d = m.dist * (1 - e);
          const x = ox + Math.cos(m.ang) * d * baseScale();
          const y = oy + Math.sin(m.ang) * d * baseScale() * tilt;
          // Bright on the way in, extinguished as it lands on the number.
          const a = Math.min(1, p * 2) * (1 - e * e) * 0.9;
          if (a < 0.02) continue;
          ctx.beginPath();
          ctx.fillStyle = rgba(m.hue, a * 0.5);
          ctx.arc(x, y, m.r * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.arc(x, y, m.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        const numA = clamp01((P - 0.42) / 0.32);
        if (numA > 0.01) {
          // A scrim so the figure reads against whatever it has landed on.
          const scrim = ctx.createRadialGradient(ox, oy, 0, ox, oy, Math.min(W, H) * 0.34);
          scrim.addColorStop(0, `rgba(4,6,14,${0.82 * numA})`);
          scrim.addColorStop(0.55, `rgba(4,6,14,${0.45 * numA})`);
          scrim.addColorStop(1, "transparent");
          ctx.fillStyle = scrim;
          ctx.fillRect(0, 0, W, H);
          const value = Math.round(DEMO_BLI * ease3(clamp01((P - 0.34) / 0.5)));
          const band = BLI_LEVELS.find(b => b.name === levelForScore(value)) ?? BLI_LEVELS[0];
          const size = Math.min(112, Math.max(56, Math.min(W, H) * 0.13));
          ctx.save();
          ctx.globalAlpha = numA;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          ctx.shadowColor = "rgba(255,207,92,.55)";
          ctx.shadowBlur = 34;
          // Canvas cannot resolve CSS custom properties in a font string:
          // "var(--font-crimson)" makes the whole declaration invalid and the
          // previous font stays in force. Name real families here.
          ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
          ctx.fillStyle = "#fff";
          ctx.fillText(String(value), ox, oy);
          ctx.shadowBlur = 0;

          ctx.font = "800 11px ui-sans-serif, system-ui, sans-serif";
          ctx.fillStyle = "rgba(255,255,255,.5)";
          ctx.fillText("BIBLE LITERACY INDEX · 0–800", ox, oy - size * 0.62);

          ctx.font = "800 13.5px ui-sans-serif, system-ui, sans-serif";
          ctx.fillStyle = band.color;
          ctx.fillText(band.name.toUpperCase(), ox, oy + size * 0.58);

          ctx.font = "700 10.5px ui-sans-serif, system-ui, sans-serif";
          ctx.fillStyle = "rgba(255,255,255,.34)";
          ctx.fillText("EXAMPLE SCORE", ox, oy + size * 0.58 + 19);
          ctx.restore();
        }
      }

      // --- plotting the course to one passage ---
      if (sc.mode === "plot") {
        const P = reduced ? 1 : clamp01(since / 2000);
        const torah = STARS[STAR_INDEX.TORAH];
        if (torah) {
          const tx = ox + torah.x * s, ty = oy + torah.y * s;
          // The course sweeps in from the copy side of the screen.
          const sx = W * 0.06, sy = H * 0.78;
          const mx2 = (sx + tx) / 2, my2 = (sy + ty) / 2 - 150;

          ctx.save();
          ctx.setLineDash([6, 8]);
          ctx.lineDashOffset = reduced ? 0 : -(t / 30) % 14;
          ctx.strokeStyle = "rgba(255,207,92,.85)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          // Draw only the travelled part of the curve.
          const STEPS = 60;
          for (let i = 0; i <= STEPS * P; i++) {
            const u = i / STEPS;
            const x = (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * mx2 + u * u * tx;
            const y = (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * my2 + u * u * ty;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.restore();

          const landed = clamp01((P - 0.72) / 0.28);
          if (landed > 0.01) {
            // A reticle closing on the destination.
            const ring = 34 + (1 - landed) * 46;
            ctx.save();
            ctx.globalAlpha = landed;
            ctx.strokeStyle = "rgba(255,207,92,.9)";
            ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(tx, ty, ring, 0, Math.PI * 2); ctx.stroke();
            for (let k = 0; k < 4; k++) {
              const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
              ctx.beginPath();
              ctx.moveTo(tx + Math.cos(a) * (ring - 9), ty + Math.sin(a) * (ring - 9));
              ctx.lineTo(tx + Math.cos(a) * (ring + 9), ty + Math.sin(a) * (ring + 9));
              ctx.stroke();
            }
            ctx.restore();

            ctx.save();
            ctx.globalAlpha = landed;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "800 10.5px ui-sans-serif, system-ui, sans-serif";
            ctx.fillStyle = "#ffcf5c";
            ctx.fillText("READ NEXT", tx, ty - ring - 30);
            ctx.font = '700 20px Georgia, "Times New Roman", serif';
            ctx.fillStyle = "#fff";
            ctx.fillText(PLOT_LABEL, tx, ty - ring - 12);
            ctx.restore();
          }
        }
      }

      if (curtain > 0.004) {
        ctx.save();
        ctx.fillStyle = `rgba(11,15,30,${curtain})`;
        ctx.fillRect(0, 0, W, H);

        // Both graphics are built from the same parts — a rounded panel and
        // rows standing in for lines of text — so the two scenes read as one
        // idea rather than two unrelated drawings.
        const panel = (x: number, y: number, w: number, h: number, a: number, accent?: string) => {
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, 14);
          else ctx.rect(x, y, w, h);
          ctx.fillStyle = `rgba(255,255,255,${0.035 * a})`;
          ctx.fill();
          ctx.strokeStyle = accent ?? `rgba(255,255,255,${0.16 * a})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        };
        const rows = (x: number, y: number, w: number, n: number, a: number, gap = 15) => {
          for (let i = 0; i < n; i++) {
            const rw = w * (i === n - 1 ? 0.55 : 0.82 + 0.18 * Math.sin(i * 2.1));
            ctx.fillStyle = `rgba(255,255,255,${0.2 * a})`;
            ctx.fillRect(x, y + i * gap, rw, 4);
          }
        };

        const k = Math.max(0.72, Math.min(1.5, Math.min(W / 1180, H / 760)));
        const cx = W * (W >= 900 ? 0.68 : 0.5);
        const cy = H * 0.5;

        if (sc.mode === "draft") {
          // A question being put right: one line reads wrong, gets flagged,
          // and is redrawn straight. That is the whole caveat on the card —
          // you will meet bad questions, and the fix is the feedback button.
          const CYCLE = 4200;
          const P = reduced ? 0.99 : (since % CYCLE) / CYCLE;
          const w = 300 * k, h = 168 * k;
          const x = cx - w / 2, y = cy - h / 2;
          const flagged = P > 0.34;
          const fixed = P > 0.66;

          panel(x, y, w, h, curtain,
            `rgba(${fixed ? "79,214,214" : "255,207,92"},${(flagged ? 0.5 : 0.2) * curtain})`);

          ctx.save();
          ctx.globalAlpha = curtain;
          ctx.font = `800 ${9.5 * k}px ui-sans-serif, system-ui, sans-serif`;
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillStyle = fixed ? "#6fe0e0" : "#ffcf5c";
          ctx.fillText(fixed ? "CORRECTED" : "SAMPLE QUESTION", x + 20 * k, y + 18 * k);

          rows(x + 20 * k, y + 44 * k, w - 40 * k, 2, curtain, 15 * k);

          // The suspect line: crooked and amber until it is fixed, level and
          // teal after.
          const ly = y + 84 * k;
          const wobble = fixed || reduced ? 0 : Math.sin(since / 190) * 1.6;
          ctx.save();
          ctx.translate(x + 20 * k, ly + wobble);
          ctx.rotate(fixed ? 0 : -0.012);
          ctx.fillStyle = fixed ? "rgba(111,224,224,.85)" : "rgba(255,207,92,.85)";
          ctx.fillRect(0, 0, (w - 40 * k) * 0.66, 4);
          ctx.restore();

          rows(x + 20 * k, y + 106 * k, w - 40 * k, 2, curtain * 0.75, 15 * k);

          // The flag, pinned to the corner, struck once when the line is
          // reported and quiet again once it has been dealt with.
          const fx = x + w - 30 * k, fy = y + 26 * k;
          const hit = flagged && !fixed ? 1 : 0.32;
          ctx.strokeStyle = `rgba(255,207,92,${hit * curtain})`;
          ctx.lineWidth = 1.6 * k;
          ctx.beginPath();
          ctx.moveTo(fx, fy - 9 * k);
          ctx.lineTo(fx, fy + 10 * k);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(fx, fy - 9 * k);
          ctx.lineTo(fx + 13 * k, fy - 4 * k);
          ctx.lineTo(fx, fy + 1 * k);
          ctx.closePath();
          ctx.fillStyle = `rgba(255,207,92,${hit * 0.8 * curtain})`;
          ctx.fill();
          if (flagged && !fixed && !reduced) {
            const r = 14 * k + ((since % 1200) / 1200) * 26 * k;
            ctx.beginPath();
            ctx.arc(fx, fy, r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,207,92,${(1 - (since % 1200) / 1200) * 0.4 * curtain})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
          ctx.restore();
        }

        if (sc.mode === "docs") {
          // The two write-ups, side by side and breathing gently: the buttons
          // under the card lead to exactly these.
          const w = 156 * k, h = 200 * k, gap = 30 * k;
          const titles = ["About", "How BLI Works"];
          for (let i = 0; i < 2; i++) {
            const drift = reduced ? 0 : Math.sin(since / 1600 + i * 1.7) * 5 * k;
            const x = cx - w - gap / 2 + i * (w + gap);
            const y = cy - h / 2 + drift;
            panel(x, y, w, h, curtain,
              `rgba(${i ? "111,224,224" : "255,207,92"},${0.34 * curtain})`);
            ctx.save();
            ctx.globalAlpha = curtain;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.font = `800 ${9 * k}px ui-sans-serif, system-ui, sans-serif`;
            ctx.fillStyle = i ? "#6fe0e0" : "#ffcf5c";
            ctx.fillText(titles[i].toUpperCase(), x + 16 * k, y + 16 * k);
            rows(x + 16 * k, y + 40 * k, w - 32 * k, 8, curtain, 14 * k);
            ctx.restore();
          }
        }
        ctx.restore();
      }

      // Nothing hover-driven survives the curtain: the stars it names are
      // behind the scrim on those scenes, so a floating "Torah · 5 books"
      // would be labelling something the reader cannot see.
      if (curtain > 0.5) { /* curtained: no hover chrome */ }
      else if (hoverLabel) label(hoverLabel.text, hoverLabel.x, hoverLabel.y, "#fff", 13, "800");
      // A named section or book always outranks a sample question, so the two
      // never stack on top of each other.
      else if (question) questionCard(question.text, question.x, question.y, Math.min(1, (question.a - 0.42) / 0.25));

      // Vignette — the last thing that makes it read as a photograph.
      const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.34, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(2,4,10,.55)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="orrery" aria-hidden="true" />;
}
