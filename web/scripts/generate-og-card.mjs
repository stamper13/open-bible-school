/* Regenerates public/brand/og-card.png, the 1200x630 link-preview image that
 * Facebook/LinkedIn/Slack/iMessage/X show when the site is shared. It is a
 * checked-in static PNG rather than a Next `opengraph-image.tsx`: scrapers get
 * a plain file with no runtime render, and the card only changes when the
 * brand does. Re-run after editing this file:
 *
 *   node scripts/generate-og-card.mjs
 *
 * The background is #000206, sampled from the emblem's own corner pixels, so
 * the emblem sits on the card with no visible square edge.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const emblem = fs.readFileSync(path.join(root, "public/brand/oba-emblem.png")).toString("base64");
const out = path.join(root, "public/brand/og-card.png");

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@500;600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: #000206;
    display: grid; place-items: center;
    font-family: Inter, system-ui, sans-serif;
    position: relative;
  }
  /* Warm bloom behind the orbit, echoing the homepage starfield. */
  .glow {
    position: absolute; inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
    width: 840px; height: 840px; border-radius: 50%;
    background: radial-gradient(circle, rgba(227,179,76,.16) 0%, rgba(227,179,76,.05) 42%, transparent 68%);
  }
  .emblem {
    width: 430px; height: 430px; position: relative;
    /* Feathered edge so the emblem's own square canvas never reads as a box. */
    -webkit-mask-image: radial-gradient(circle, #000 60%, transparent 78%);
    mask-image: radial-gradient(circle, #000 60%, transparent 78%);
  }
  .emblem img { width: 100%; height: 100%; display: block; }
</style></head>
<body>
  <div class="glow"></div>
  <div class="emblem"><img src="data:image/png;base64,${emblem}"></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await browser.close();
console.log(`wrote ${path.relative(root, out)}`);
