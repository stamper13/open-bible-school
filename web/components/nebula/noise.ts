/**
 * The nebula's fractal noise, lifted out of app/intro/StarMap.tsx so more than
 * one surface can use it.
 *
 * The trick that makes these read as emission nebulae rather than as coloured
 * smudges is domain warping: a first noise field is fed back in as a coordinate
 * offset for a second, which is what produces filaments and dust lanes. A plain
 * radial gradient cannot get there no matter how it is tuned.
 *
 * Everything here is per-pixel JavaScript, so it is meant to be run once and
 * cached. `noiseSprite` bakes a cloud into an offscreen canvas; after that,
 * drawing one is a single drawImage per frame at any size or rotation.
 */

/**
 * Sprite resolution.
 *
 * A direct cost at mount: three at 192px measured ~205ms on a desktop, a
 * visible stall, and several times worse on a phone. 160px with slightly fewer
 * octaves lands near 40ms each, which is cheap enough to build one per frame.
 */
export const NEB_PX = 160;

/** Seeds for the three base clouds, so no two neighbours share a shape. */
export const NEB_SEEDS = [11, 523, 907];

export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f, seed + i * 101);
    f *= 2.07;
    amp *= 0.5;
  }
  return sum;
}

/** A soft-edged cloud of warped fractal noise, white with varying alpha. */
export function noiseSprite(seed: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = NEB_PX;
  const g = c.getContext("2d");
  if (!g) return c;
  const img = g.createImageData(NEB_PX, NEB_PX);
  const data = img.data;
  for (let y = 0; y < NEB_PX; y++) {
    for (let x = 0; x < NEB_PX; x++) {
      const nx = (x / NEB_PX) * 3.4, ny = (y / NEB_PX) * 3.4;
      // Feeding the first noise field back in as a coordinate offset is what
      // turns round blobs into filaments and dust lanes.
      const w = fbm(nx, ny, seed, 4);
      let n = fbm(nx + w * 1.9, ny + w * 1.9, seed + 37, 3);
      const dx = (x / NEB_PX - 0.5) * 2, dy = (y / NEB_PX - 0.5) * 2;
      const fall = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      n = Math.pow(Math.max(0, n * 1.6 - 0.38), 1.5) * fall * fall;
      const i = (y * NEB_PX + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      data[i + 3] = Math.min(255, n * 340);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Recolour a white noise sprite, keeping a hot white core. */
export function tintSprite(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = NEB_PX;
  const g = c.getContext("2d");
  if (!g) return c;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, NEB_PX, NEB_PX);
  // The densest parts of a real cloud burn out toward white.
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = 0.3;
  g.drawImage(src, 0, 0);
  return c;
}
