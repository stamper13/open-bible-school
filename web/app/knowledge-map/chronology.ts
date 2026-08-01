/**
 * Conservative Old Testament chronology used by the knowledge map.
 *
 * Dates follow the standard conservative/early-date scheme: the Exodus at
 * 1446 BC, derived from the 480 years of 1 Kings 6:1 counted back from
 * Solomon's fourth year (966 BC), with the conquest beginning 1406 BC.
 * Years describe the period a book *covers*, not when it was written.
 * All values are years BC; larger numbers are earlier.
 */

export type Era = { year: number; label: string };

/**
 * Year -> 0..1 vertical position. A linear scale would crush the monarchy and
 * exile into a sliver, so the axis is piecewise: each stop gets comparable
 * screen space regardless of how many calendar years it spans.
 */
const STOPS: Array<[year: number, pos: number]> = [
  [4000, 0.00],
  [2166, 0.10],
  [1876, 0.19],
  [1526, 0.27],
  [1446, 0.35],
  [1406, 0.42],
  [1050, 0.52],
  [970, 0.60],
  [930, 0.66],
  [722, 0.75],
  [605, 0.82],
  [586, 0.87],
  [538, 0.93],
  [430, 1.00],
];

export function yearToPos(year: number): number {
  if (year >= STOPS[0][0]) return 0;
  if (year <= STOPS[STOPS.length - 1][0]) return 1;
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [y0, p0] = STOPS[i];
    const [y1, p1] = STOPS[i + 1];
    if (year <= y0 && year >= y1) {
      const span = y0 - y1;
      const f = span === 0 ? 0 : (y0 - year) / span;
      return p0 + f * (p1 - p0);
    }
  }
  return 1;
}

export function formatYear(year: number): string {
  return `${year} BC`;
}

/** Broad eras shown on the rail at the galaxy level. */
export const GALAXY_ERAS: Era[] = [
  { year: 4000, label: "Primeval" },
  { year: 2166, label: "Patriarchs" },
  { year: 1446, label: "Exodus" },
  { year: 1406, label: "Conquest" },
  { year: 1050, label: "Monarchy" },
  { year: 930, label: "Divided" },
  { year: 722, label: "Assyria" },
  { year: 586, label: "Exile" },
  { year: 538, label: "Return" },
];

export type SectionChrono = {
  key: string;
  anchor: number;
  from: number;
  to: number;
  span: string;
  dependsOn: string[];
  role: string;
};

export const SECTION_CHRONO: SectionChrono[] = [
  {
    key: "Torah",
    anchor: 1900, from: 4000, to: 1406,
    span: "Creation – 1406 BC",
    dependsOn: [],
    role: "Foundation — every later book assumes it.",
  },
  {
    key: "Former Prophets",
    anchor: 1050, from: 1406, to: 586,
    span: "1406 – 586 BC",
    dependsOn: ["Torah"],
    role: "Carries the Torah story into Israel's national history.",
  },
  {
    key: "Latter Prophets",
    anchor: 700, from: 760, to: 430,
    span: "760 – 430 BC",
    dependsOn: ["Torah", "Former Prophets"],
    role: "Indicts and consoles Israel on the basis of both.",
  },
  {
    key: "Writings",
    anchor: 520, from: 2000, to: 430,
    span: "Job – 430 BC",
    dependsOn: ["Torah", "Former Prophets"],
    role: "Worship, wisdom, and reflection on the established story.",
  },
];

export type BookChrono = {
  anchor: number;
  span: string;
  note: string;
};

/** Period each book covers, on the conservative scheme. */
export const BOOK_CHRONO: Record<string, BookChrono> = {
  // Torah
  GEN: { anchor: 2100, span: "Creation – 1806 BC", note: "Creation, flood, patriarchs, Joseph in Egypt." },
  EXO: { anchor: 1490, span: "1526 – 1445 BC", note: "Moses, the plagues, the Exodus of 1446, Sinai." },
  LEV: { anchor: 1445, span: "1445 BC", note: "One year encamped at Sinai." },
  NUM: { anchor: 1425, span: "1445 – 1406 BC", note: "Thirty-eight years of wilderness wandering." },
  DEU: { anchor: 1406, span: "1406 BC", note: "Moses' final addresses on the plains of Moab." },
  // Former Prophets
  JOS: { anchor: 1390, span: "1406 – 1375 BC", note: "Crossing the Jordan and the conquest of Canaan." },
  JDG: { anchor: 1200, span: "1375 – 1050 BC", note: "The cycle of apostasy, oppression, and deliverance." },
  RUT: { anchor: 1100, span: "c. 1100 BC", note: "Set in the days of the judges; David's ancestry." },
  "1SA": { anchor: 1060, span: "1105 – 1010 BC", note: "Samuel, Saul, and the rise of David." },
  "2SA": { anchor: 990, span: "1010 – 970 BC", note: "David's reign in Hebron and Jerusalem." },
  "1KI": { anchor: 910, span: "970 – 853 BC", note: "Solomon, the temple, and the divided kingdom." },
  "2KI": { anchor: 700, span: "853 – 586 BC", note: "Decline, Samaria's fall in 722, Jerusalem's in 586." },
  // Latter Prophets
  ISA: { anchor: 710, span: "740 – 681 BC", note: "Judah under Assyrian threat; the servant songs." },
  JER: { anchor: 600, span: "627 – 586 BC", note: "Judah's final decades and the fall of Jerusalem." },
  LAM: { anchor: 586, span: "586 BC", note: "Laments over the destroyed city." },
  EZE: { anchor: 580, span: "593 – 571 BC", note: "Prophecy among the exiles in Babylon." },
  DAN: { anchor: 570, span: "605 – 536 BC", note: "The Babylonian and early Persian courts." },
  HOS: { anchor: 735, span: "755 – 715 BC", note: "The northern kingdom's last generation." },
  JOL: { anchor: 835, span: "c. 835 BC", note: "The locust plague and the day of the LORD." },
  AMO: { anchor: 760, span: "c. 760 BC", note: "Social injustice in prosperous Israel." },
  OBA: { anchor: 845, span: "c. 845 BC", note: "Judgment on Edom." },
  JON: { anchor: 760, span: "c. 760 BC", note: "Mission to Nineveh." },
  MIC: { anchor: 717, span: "735 – 700 BC", note: "Contemporary of Isaiah; Bethlehem foretold." },
  NAM: { anchor: 650, span: "c. 650 BC", note: "The coming fall of Nineveh." },
  HAB: { anchor: 607, span: "c. 607 BC", note: "Why God uses Babylon." },
  ZEP: { anchor: 630, span: "c. 630 BC", note: "Josiah's reign; the day of the LORD." },
  HAG: { anchor: 520, span: "520 BC", note: "Rebuilding the second temple." },
  ZEC: { anchor: 500, span: "520 – 480 BC", note: "Visions of restoration and the coming king." },
  MAL: { anchor: 430, span: "c. 430 BC", note: "The final prophetic word before the silence." },
  // Writings
  "1CH": { anchor: 1000, span: "Adam – 970 BC", note: "Genealogies through David's reign." },
  "2CH": { anchor: 750, span: "970 – 538 BC", note: "Solomon to the decree of Cyrus." },
  EZR: { anchor: 500, span: "538 – 457 BC", note: "Return from exile and temple rebuilding." },
  NEH: { anchor: 440, span: "445 – 430 BC", note: "Rebuilding Jerusalem's walls." },
  EST: { anchor: 478, span: "483 – 473 BC", note: "The Persian court under Xerxes." },
  JOB: { anchor: 2000, span: "Patriarchal era", note: "Undated, but set in a patriarchal world." },
  PSA: { anchor: 1000, span: "1410 – 430 BC", note: "Moses to the post-exilic community." },
  PRO: { anchor: 950, span: "970 – 700 BC", note: "Solomon, later collected under Hezekiah." },
  ECC: { anchor: 935, span: "c. 935 BC", note: "Solomon's reflection on life under the sun." },
  SNG: { anchor: 965, span: "c. 965 BC", note: "Solomon's song of love." },
};

export function bookChrono(code: string): BookChrono {
  return BOOK_CHRONO[code] ?? { anchor: 1000, span: "Undated", note: "" };
}

/**
 * The first year a book's span covers — the number the rail actually shows.
 * Ordering by this rather than by the midpoint keeps the rail monotonic
 * (Isaiah's 740 must sit above Micah's 735, even though Micah's midpoint
 * is earlier). Spans opening on an unnumbered epoch sort to the top.
 */
export function spanStartYear(c: BookChrono): number {
  if (/^(creation|adam|patriarchal)/i.test(c.span)) return 4000;
  const match = c.span.match(/(\d{3,4})/);
  return match ? Number(match[1]) : c.anchor;
}
