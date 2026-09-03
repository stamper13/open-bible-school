import { BIBLE_BOOKS, type BibleSectionKey } from "@/lib/bibleTaxonomy";
import { sectionHue } from "@/lib/focusPath";
export { SAMPLE_QUESTIONS, QUESTIONS_BY_SECTION } from "./introQuestions";

/**
 * Data for the /intro tour.
 *
 * The structure deliberately mirrors the knowledge map's, so the two pages are
 * describing the same universe rather than two different metaphors:
 *
 *   nebula  ->  the canon before any of it is mapped
 *   star    ->  a section        (testament_section)
 *   planet  ->  a book           (book)
 *   moon    ->  a book's section (book_section)
 *
 * Those are exactly the three levels app/knowledge-map/FocusStarMap.tsx
 * renders, and the section colours come from `sectionHue` in lib/focusPath —
 * the single place those hues are defined — so Torah is the same gold here as
 * it is on the map, the coverage grid, and the legend. Do not hard-code them
 * again in this file.
 *
 * All prose is the author's own, lifted from the project write-up. Keep it
 * that way: it is edited, it is in his voice, and it is why the page needs so
 * little text.
 */

export type SectionKey = BibleSectionKey;

const SECTION_NAMES: Record<SectionKey, string> = {
  TORAH: "Torah",
  FORMER: "Former Prophets",
  LATTER: "Latter Prophets",
  WRITINGS: "Writings",
  GOSPELS_ACTS: "Gospels & Acts",
  PAULINE: "Pauline Epistles",
  GENERAL: "General Epistles",
  APOCALYPSE: "Apocalypse",
};

/**
 * Where each section's star sits, in world units. Hand-placed rather than
 * generated: this is a composition, and a seeded scatter kept dropping two
 * stars close enough that their planetary systems overlapped. The Torah sits
 * at the origin because the tour keeps returning to it.
 */
const STAR_POSITIONS: Record<SectionKey, [number, number]> = {
  TORAH: [0, 0],
  FORMER: [174, -70],
  LATTER: [326, 46],
  WRITINGS: [186, 166],
  GOSPELS_ACTS: [-166, 134],
  PAULINE: [-318, 30],
  GENERAL: [-202, -138],
  APOCALYPSE: [-26, -202],
};

/**
 * Orbital rings a section's books are distributed across. Kept well inside the
 * ~170-unit gap between neighbouring stars so one section's books never drift
 * through the next section's. They are only drawn once the camera has closed
 * on a single star anyway.
 */
const BOOK_RINGS = [40, 56, 72];

/**
 * A book's own sections, as the moons of that planet.
 *
 * Only authored for the books the tour actually visits. The live product gets
 * these from the question bank's learning units; inventing plausible-looking
 * divisions for the other sixty-four books would be dressing the demo up as
 * data it does not have, so books without an entry here simply have no moons
 * and the camera never goes to them.
 */
export type Division = { chapters: string; title: string };

const DIVISIONS: Record<string, Division[]> = {
  GEN: [
    { chapters: "1–11", title: "Primeval history" },
    { chapters: "12–24", title: "Abraham" },
    { chapters: "25–36", title: "Isaac and Jacob" },
    { chapters: "37–50", title: "Joseph" },
  ],
  EXO: [
    { chapters: "1–4", title: "Bondage and the call of Moses" },
    { chapters: "5–13", title: "The plagues and Passover" },
    { chapters: "14–18", title: "The sea and the wilderness" },
    { chapters: "19–24", title: "Sinai and the covenant" },
    { chapters: "25–31", title: "Tabernacle instructions" },
    { chapters: "32–40", title: "The golden calf, and the tabernacle built" },
  ],
};

export type Planet = {
  code: string;
  name: string;
  /** Orbital radius around its star. */
  orbit: number;
  angle0: number;
  /** Radians per millisecond. */
  speed: number;
  divisions: Division[];
};

export type Star = {
  key: SectionKey;
  name: string;
  hue: string;
  x: number;
  y: number;
  /** Core radius, scaled gently by how many books the section carries. */
  r: number;
  planets: Planet[];
};

function buildStar(key: SectionKey): Star {
  const books = BIBLE_BOOKS.filter(b => b.sectionKey === key);
  const ringCount = books.length <= 6 ? 1 : books.length <= 12 ? 2 : 3;
  // Count per ring first, so each ring can space its own books evenly instead
  // of inheriting gaps from the interleave.
  const perRing: number[] = Array.from({ length: ringCount }, (_, r) =>
    books.filter((_, i) => i % ringCount === r).length,
  );
  const placed: number[] = Array(ringCount).fill(0);

  const planets: Planet[] = books.map((book, i) => {
    const ring = i % ringCount;
    const slot = placed[ring]++;
    const orbit = BOOK_RINGS[ring];
    return {
      code: book.code,
      name: book.name,
      orbit,
      // Offset each ring so books on different rings do not line up radially.
      angle0: (slot / perRing[ring]) * Math.PI * 2 + ring * 0.7,
      // Outer rings move slower, the way they ought to.
      speed: 0.000048 / (1 + ring * 0.45),
      divisions: DIVISIONS[book.code] ?? [],
    };
  });

  const [x, y] = STAR_POSITIONS[key];
  return {
    key,
    name: SECTION_NAMES[key],
    hue: sectionHue({ node_key: key, label: SECTION_NAMES[key] }),
    x,
    y,
    r: 15 + Math.sqrt(books.length) * 3.5,
    planets,
  };
}

export const STARS: Star[] = (Object.keys(STAR_POSITIONS) as SectionKey[]).map(buildStar);

export const STAR_INDEX: Record<string, number> = Object.fromEntries(
  STARS.map((s, i) => [s.key, i]),
);

export function findPlanet(starKey: SectionKey, code: string) {
  const star = STARS[STAR_INDEX[starKey]];
  const planet = star?.planets.find(p => p.code === code) ?? null;
  return planet ? { star, planet } : null;
}

/** What the canvas is doing during a scene. */
export type SceneMode =
  | "nebula" | "idle" | "scan" | "books" | "moons" | "score" | "route"
  | "converge"   // stars stream inward and resolve into a single BLI number
  | "plot"       // a course is drawn across the map to one passage
  | "draft"      // a question card being corrected: the beta caveat, shown
  | "docs";      // the two write-ups, offered at the end

export type Scene = {
  id: string;
  label?: string;
  text?: string;
  title?: string;
  kicker?: string;
  closing?: boolean;
  /** Reveal the card a line at a time. The cover only. */
  stagger?: boolean;

  zoom: number;
  /** Star to centre on, and optionally a book of that star. */
  focus: { section: SectionKey; book?: string } | null;
  mode: SceneMode;
  /**
   * Explicit world-space camera centre, for scenes that need to frame
   * something other than a single body — the worked example has to hold
   * Ezekiel and Exodus on screen at once, and centring on the origin pushes
   * the Latter Prophets off the right edge. Ignored when `focus` is set.
   */
  center?: [number, number];
  /** 1 = full cloud, 0 = fully condensed into stars. */
  nebula: number;
};

export const SCENES: Scene[] = [
  // The opening paragraph is delivered in three beats: the first scrolls swap
  // the sentence rather than leaving the cloud. All three hold the same camera
  // and a thick nebula, so it reads as one slide changing its mind rather than
  // as three.
  //
  // The rule for every scene below: say what the canvas cannot. The prose was
  // originally lifted wholesale from the project write-up, which made four
  // scenes restate an argument the picture was already making — those are gone.
  // /philosophy is where the argument lives; this page shows it happening.
  {
    // The cover: the cloud and the question, nothing else. No embedded
    // question stars — those are gated to the "title" scene in StarMap, so
    // there is nothing here to hover and nothing lit inside the nebula.
    id: "cover",
    kicker: "Open Bible Assessment",
    title: "What Is Open Bible Assessment?",
    stagger: true,
    zoom: 0.86,
    focus: null,
    mode: "nebula",
    nebula: 1,
  },
  {
    // Same camera, same cloud — now with the sentence answering the cover's
    // question, and with the lit question stars alive inside the nebula. No
    // heading of its own: the cover just asked it.
    id: "title",
    text:
      "Open Bible Assessment (OBA) is a free tool that asks Bible questions to help you see what parts of Scripture you know well and where your knowledge could improve.",
    zoom: 0.86,
    focus: null,
    mode: "nebula",
    nebula: 1,
  },
  {
    id: "title-2",
    // Paired with "converge": the stars stream inward and resolve into one
    // number, so the sentence names what the camera is doing.
    text:
      "After 25 questions in the initial assessment, you are graded on a scale called the Bible Literacy Index — BLI for short.",
    zoom: 1,
    focus: null,
    mode: "converge",
    nebula: 0.34,
  },
  {
    id: "title-3",
    // "plot" draws a course to a single passage; "plots a course" is the verb
    // for what is on screen, and carries the reader off the number.
    text: "OBA uses your results to prioritize what to read next.",
    zoom: 1.12,
    focus: null,
    mode: "plot",
    nebula: 0.14,
  },
  {
    id: "assessment",
    label: "Assessment",
    // "scan" throws its rings from the camera centre, and with no focus that
    // is world origin — which is where the Torah's star is pinned, so the
    // sweep read as something radiating out of the Torah specifically. The
    // centre here is empty space between Torah, Former Prophets and the
    // General Epistles, so the rings wash over the field instead of appearing
    // to come from one section. Pulled back a little so they cross every star.
    text:
      "Early questions focus on assessing broad understanding of the overall storyline of the Bible.",
    zoom: 0.98,
    focus: null,
    center: [70, -30],
    mode: "scan",
    nebula: 0.1,
  },
  {
    id: "adapts",
    label: "How it adapts",
    // The camera is already descending into the Torah's books here, so the
    // sentence only has to name the move. The long version — "does this
    // person understand the Torah? What about the Latter Prophets?" — was the
    // write-up talking about a learner in the third person, on a page that
    // says "you" everywhere else.
    text: "As more time is spent using OBA, questions become more focused on finer details.",
    zoom: 2.9,
    focus: { section: "TORAH" },
    mode: "books",
    nebula: 0.06,
  },
  {
    id: "reread",
    label: "Down to the passage",
    text: "As you reread books of the Bible, it retests your knowledge and adapts accordingly.",
    zoom: 7.4,
    focus: { section: "TORAH", book: "EXO" },
    mode: "moons",
    nebula: 0,
  },
  {
    id: "scoring",
    label: "Scoring",
    // Names what the canvas is doing — a gauge filling on one section's star
    // — and nothing else. The "not spiritual maturity or giftedness" caveat
    // that used to hang off this sentence is an argument, and arguments belong
    // in the write-up; /philosophy makes it there, at length. A slide gets to
    // just say the thing.
    text:
      "Every section is scored on its own, so a strong Torah doesn't hide a thin grasp of the Prophets.",
    zoom: 2.4,
    focus: { section: "FORMER" },
    mode: "score",
    nebula: 0.05,
  },
  {
    id: "recommending",
    label: "How OBA Prioritizes",
    // Two beats share the "route" camera move. This one states the principle
    // so the next can be purely the worked case, instead of both saying that
    // OBA recommends things.
    text: "Weak areas come first — but the foundational ones before the rest.",
    zoom: 1.06,
    focus: null,
    center: [163, 23],
    mode: "route",
    nebula: 0.08,
  },
  {
    id: "example",
    label: "For example",
    text:
      "If someone has a poor grasp of both Ezekiel and Exodus, the assessment will recommend reading Exodus first, because Ezekiel is more dependent on Exodus for comprehension.",
    zoom: 1.15,
    focus: null,
    center: [163, 23],
    mode: "route",
    nebula: 0.08,
  },
  {
    id: "beta",
    label: "Beta",
    // Said plainly and once. The fuller caveat — what still needs work and
    // why — is on /philosophy, which is where a caveat can be argued.
    text:
      "OBA is still in its early stages. You are sure to come across poorly worded or even inaccurate questions, and scoring will improve over time. Take your results with a grain of salt, and use the feedback button on any question to flag what looks wrong.",
    // The last two scenes leave the star map behind: the sky is drawn over
    // and the card gets a graphic that is actually about what it says. Here
    // that is a question being corrected — the caveat, shown rather than
    // asserted. The camera still retreats underneath (1.15 at the worked
    // example, 0.90 here, widest at the end) so the curtain lifts onto a
    // pulled-back field if a reader scrolls back up.
    zoom: 0.9,
    focus: null,
    mode: "draft",
    nebula: 0.2,
  },
  {
    id: "more",
    label: "Learn more",
    // The tour hands off rather than concluding: what it showed in five
    // seconds a slide is argued properly in the two write-ups, and this is
    // where a reader who wants that goes.
    text: "Are you interested in learning more about OBA?",
    closing: true,
    zoom: 0.76,
    focus: null,
    mode: "docs",
    nebula: 0.28,
  },
];

/** Endpoints of the worked example, drawn on the canvas during "route". */
export const ROUTE_FROM = { section: "LATTER" as SectionKey, book: "EZE", label: "Ezekiel" };
export const ROUTE_TO = { section: "TORAH" as SectionKey, book: "EXO", label: "Exodus" };
