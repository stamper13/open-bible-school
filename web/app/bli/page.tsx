import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { BLI_LEVELS } from "@/lib/bli";

/**
 * How the BLI works — a plain document.
 *
 * This page used to be an interactive explainer: a star canvas, a draggable
 * 0-800 probe, expandable "inputs" cards, a jump rail, and ScoringLab, a
 * calculator that let you drive the formula by hand. All of that is gone. The
 * explanation itself is long, sequential and example-heavy, and widgets were
 * competing with it for attention; /intro is now the site's interactive lane,
 * so this one does not need to be a second.
 *
 * It is deliberately the short version. The long draft also walked through
 * router behaviour - broad-to-narrow probing, not hyperfixating on a weak
 * section, the granularity taxonomy for question wording - which is design
 * rationale for how the system ought to work rather than something a learner
 * arriving from the dashboard score badge needs. That material is worth
 * keeping as internal design notes; it is in git history on this file if it
 * should ever come back, either here or on a separate deeper page.
 *
 * What stayed: the two worked examples that actually teach (broad vs deep
 * knowledge, and two learners at the same accuracy), plus everything a reader
 * looks things up in - the score-band scale, the confidence tiers and the
 * exact formula. Those read better static than as the widgets they replaced.
 *
 * It opens by handing readers who want the plain version back to /philosophy,
 * in the same callout and the same slot that page uses to offer /intro — the
 * two long documents point at each other rather than each trying to be the
 * entry point.
 *
 * Styling is the shared .oba-legal-* document chrome plus the .oba-doc-*
 * blocks in app/globals.css — the same set /philosophy uses, so the site's
 * two long documents look like each other. The old bliStyles.ts and
 * ScoringLab.tsx were deleted with the widgets they dressed; both are
 * recoverable from git history if the calculator is ever wanted back.
 */

export const metadata: Metadata = {
  title: "How BLI Works | Open Bible Assessment",
  description:
    "How the Bible Literacy Index estimates biblical content knowledge: adaptive evidence across scope, depth and dimension, the 0-800 scale, the scoring formula, and why recommendations are deliberately delayed.",
};

const CONFIDENCE_STEPS = [
  { label: "Provisional", range: "0–14 answers", copy: "Not enough yet to trust a weakness." },
  { label: "Developing", range: "15–29 answers", copy: "Enough to read the section, but not enough to rely on." },
  { label: "Established", range: "30+ answers", copy: "Enough evidence to trust what the section says about you." },
];

// `label` is what the reader is told to look for on their dashboard, so it has
// to be the dashboard's own wording — DOMAIN_META in app/homeHelpers.ts, keyed
// there by these same backend keys. Printing the raw keys sent people hunting
// for "events_timeline" on a screen that says "Events & Timeline".
const DIMENSIONS = [
  { key: "events_timeline", label: "Events & Timeline", q: "Can the learner place events in order?", eg: "Which came later: Sinai or the monarchy?" },
  { key: "characters_lineage", label: "Characters & Lineage", q: "Does the learner know people and relationships?", eg: "Who is associated with the Davidic line?" },
  { key: "geography_nations", label: "Geography & Nations", q: "Does the learner know locations and nations?", eg: "Which empire is connected with Judah’s exile?" },
  { key: "law_commands", label: "Law & Commands", q: "Does the learner understand law/covenant material?", eg: "What is Leviticus especially concerned with?" },
  { key: "promise_prophecy", label: "Promise & Prophecy", q: "Does the learner understand prophetic promises and messages?", eg: "Which prophet emphasizes restoration after judgment?" },
  { key: "theological_reasoning", label: "Theological Reasoning", q: "Can the learner identify significance?", eg: "Why is the exile important in the OT storyline?" },
  { key: "structure_cross_ref", label: "Cross Ref", q: "Can the learner connect books, sections and passages?", eg: "Which later book develops themes introduced in Torah?" },
];

/**
 * Section marks for the headings below.
 *
 * Line art only, one idea each: a magnifying glass for the detective, a funnel
 * for narrowing, a clock for the wait. They are decorative — aria-hidden, with
 * the heading text left exactly as it was — so they add a visual anchor for
 * someone scanning the page without taking anything away from someone who
 * cannot see them.
 *
 * Drawn on a 24x24 grid with stroke, no fill, and currentColor, so the size
 * and colour are set once in .oba-doc-h2-icon in app/globals.css.
 */
const SECTION_ICONS = {
  // Magnifying glass.
  detective: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.3 15.3 20.5 20.5" /></>,
  // Funnel: broad at the top, narrow at the bottom.
  narrowing: <path d="M3.5 5h17l-6.6 7.9V19l-3.8 2v-8.1z" />,
  // Four cells: knowledge split by kind, not just by book.
  dimensions: (
    <>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.6" />
    </>
  ),
  // A dial with its pointer turned up.
  dial: <><circle cx="12" cy="12" r="8" /><path d="M12 12 16.2 8.4" /><path d="M12 4v1.8" /></>,
  // A rating that moves up and down rather than a fixed percentage.
  rating: <><path d="M3.5 15.5 8.5 10l3.5 2.8 5.5-6.3" /><path d="M17 6.5h3.5V10" /></>,
  // Sliders: the several things that shape what you get asked.
  factors: (
    <>
      <path d="M3.5 7h16" /><circle cx="9" cy="7" r="2.1" />
      <path d="M3.5 12h16" /><circle cx="15" cy="12" r="2.1" />
      <path d="M3.5 17h16" /><circle cx="7.5" cy="17" r="2.1" />
    </>
  ),
  // A gauge: the score itself.
  gauge: <><path d="M3.5 16.5a8.5 8.5 0 0 1 17 0" /><path d="M12 16.5 16.4 11.6" /></>,
  // A ruler, for the banded 0-800 scale.
  scale: <><rect x="3" y="8.5" width="18" height="7" rx="1.6" /><path d="M7.5 8.5v3M12 8.5v4M16.5 8.5v3" /></>,
  // A calculator, for the arithmetic.
  model: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2.2" />
      <path d="M8.5 7.5h7M8.5 12h2.5M13.5 12h2M8.5 16.5h2.5M13.5 16.5h2" />
    </>
  ),
  // A clock: why recommendations wait.
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7.6V12l3 1.9" /></>,
  // A flask, for the beta caveat.
  flask: <><path d="M9.2 3v6.4l-5 8.6A2 2 0 0 0 5.9 21h12.2a2 2 0 0 0 1.7-3l-5-8.6V3" /><path d="M8 3h8" /></>,
  // Play: see it running.
  play: <><circle cx="12" cy="12" r="8" /><path d="M10.4 8.8 15.6 12l-5.2 3.2z" /></>,
};

function H2({ icon, children }: { icon: keyof typeof SECTION_ICONS; children: React.ReactNode }) {
  return (
    <h2>
      <svg
        className="oba-doc-h2-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {SECTION_ICONS[icon]}
      </svg>
      {children}
    </h2>
  );
}

function Example({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="oba-doc-eg">
      <p className="oba-doc-eg-label">{label}</p>
      <ul>
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

export default function BliPage() {
  return (
    <div className="oba-legal-page">
      <SiteNav
        links={["dashboard", "assess", "knowledge-map", "intro", "about", "credential", "reading-log"]}
        cta={{ href: "/assess", label: "Start Assessment" }}
        mobileMenu
        mobileMenuId="bli-mobile-nav"
      />
      <main className="oba-legal-main">
        <p className="oba-legal-kicker">How BLI Works</p>
        <h1 className="oba-legal-title">The Bible Literacy Index</h1>

        <p className="oba-legal-lead">
          Open Bible Assessment was a difficult website to create. By far the hardest task was transforming a standard
          assessment with preset questions into one that changes based on how the learner answers.
        </p>

        <p className="oba-doc-lead-alt" style={{ marginBottom: 34 }}>
          Looking for the plain explanation? <Link href="/philosophy">About</Link> covers what OBA is and how to use
          it. This page is the layer underneath: how the scoring and the question selection actually work.
        </p>

        <div className="oba-legal-body">
          <section>
            <H2 icon="detective">Like a detective</H2>
            <p>
              OBA can be thought of as a detective who starts an investigation knowing nothing. They begin with broad
              questions, and as they gather evidence the questions get narrower and more specific.
            </p>
            <p>
              The assessment is trying to create a full picture of the learner by going through this same
              broad-to-narrow process. Learners are first asked things like:
            </p>
            <p className="oba-doc-lead-alt">
              Which of these events occurred first? A. The tower of Babel &nbsp;B. Daniel and the lions&rsquo; den
              &hellip;
            </p>
            <p style={{ marginTop: 14 }}>
              OBA is trying to determine whether the learner has at least a basic understanding of the Old Testament
              narrative. Part of that process is figuring out which sections of the Bible the learner understands well
              and which they understand poorly. Each section carries an estimated ability score.
            </p>
            <p className="oba-doc-lead-alt">
              You appear broadly strong in Torah narrative, moderately stable in Former Prophets, weak in Latter
              Prophets geography and prophetic context, and not yet sufficiently tested in Writings. Your current OT
              BLI estimate is X, but recommendations need more evidence before naming a confident next study area.
            </p>
            <p style={{ marginTop: 14 }}>
              But also like a detective, one piece of evidence is generally not sufficient. The assessment &mdash;
              whether the initial assessment or a later one &mdash; eventually returns to the areas where it does not
              have enough evidence to draw a conclusion about someone&rsquo;s ability.
            </p>
          </section>

          <section>
            <H2 icon="narrowing">Narrowing down</H2>
            <p>
              As you prove a given section, like the Torah, to be a strength, OBA tries to fill in the fuller, more
              detailed picture. Which books in the Torah are your strongest? Which are weakest? Genesis is
              your best book &mdash; so which part do you know better, chapters 1&ndash;11 or 12&ndash;50, the way
              Genesis is typically divided?
            </p>
            <p>
              The same process runs on weak sections. The learner does not have a broad
              understanding of the Latter Prophets &mdash; does that include the major prophets as well, like Isaiah?
            </p>
          </section>

          <section>
            <H2 icon="dimensions">Dimensions</H2>
            <p>
              Narrowing happens in a second direction too. The system tracks knowledge dimensions, not just Bible books,
              so a weakness can be named more precisely than &ldquo;the Prophets.&rdquo; A learner might be strong on
              Promise &amp; Prophecy in the Latter Prophets but weak on Geography &amp; Nations there. These names
              appear on your dashboard when a gap is identified.
            </p>
            <dl className="oba-doc-dl">
              {DIMENSIONS.map(d => (
                <div key={d.key}>
                  <dt>{d.label}</dt>
                  <dd>{d.q} <em>{d.eg}</em></dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <H2 icon="dial">Dialing the difficulty</H2>
            <p>
              As a general rule, when the learner answers correctly the question difficulty is dialed up for that
              section, and when they answer incorrectly it is dialed down. If you answer a specific question about
              Nahum incorrectly, OBA will give you a broader Latter Prophets question instead.
            </p>
          </section>

          <section>
            <H2 icon="rating">Why it is not a percentage</H2>
            <p>
              This is why OBA does not grade on a percentage system, where 8 out of 10 is 80% and 80% is good. It works
              more like the rating on a chess site such as Chess.com. Most players win about half of their games, but
              when they win their rating goes up and they play harder opponents, and when they lose it goes down and
              they play easier ones.
            </p>
            <p>
              OBA rests on a similar assumption to Chess ELO scoring: that there is a real level of knowledge
              underneath the answers, and that a test can estimate it without ever measuring it perfectly. Whether
              someone knows who led the Israelites into the promised land is not a matter of opinion. That knowledge
              does not equate to being regenerate or spiritually wise, but it is important for knowing who God is and
              who we are.
            </p>
          </section>

          <section>
            <H2 icon="factors">A few more factors</H2>
            <p>Several other things shape what you get asked.</p>
            <ol>
              <li>
                <strong>Difficulty comes in three stages.</strong>{" "}
                Stage 1 is the broad, foundational level everyone starts at. Stages 2 and 3 open up as your recent
                accuracy holds.
              </li>
              <li>
                <strong>Which estimate the next question is aimed with</strong> depends on how much you have answered.
                A section that has been answered enough times uses its own estimate; one that has not falls back to
                your testament-wide estimate; with too little of either, the question comes from stage 1. The
                thresholds are in the confidence table further down. The part doing the aiming is called the router.
              </li>
              <li>
                <strong>Confidence decays with time.</strong> The longer since a section was last tested, the wider its
                margin of error grows, even though the estimate itself does not move.
              </li>
              <li>
                <strong>The router aims a little below its own best guess</strong>{" "}
                &mdash; and the less sure it is, the further below it aims. Together with the decay above, this means that coming back after a long gap
                gets you slightly easier questions than your old score alone would suggest &mdash; not because the system thinks you got worse, but because it is less
                sure, and it would rather re-establish the floor than open with something you cannot use.
              </li>
              <li>
                <strong>The session brake.</strong> A sustained run at or below 25% correct drops straight to stage 1;
                a less severe run holds the stage where it is rather than dropping it; two misses in a row cost one step
                down rather than a reset.
              </li>
              <li>
                <strong>The dimension brake.</strong> Two misses in the same dimension flag a possible gap and a third
                confirms it, after which the router moves on to something else for this session.
              </li>
              <li>
                <strong>The repeat cooldown.</strong> A question answered recently is held back until its cooldown has
                passed, so revisiting a section does not replay the same items.
              </li>
            </ol>
            <p style={{ marginTop: 16 }}>
              The last three keep one weak patch from taking over a whole session. Weak areas are still prioritized,
              but by rule rather than by whatever you just missed: a single past miss earns one fresh confirmation
              probe, while a weakness you have confirmed by missing the same kind of question repeatedly is treated as
              settled and stops being re-tested for its own sake.
            </p>
          </section>


          <section>
            <H2 icon="gauge">What the score means</H2>
            <p>
              BLI stands for Bible Literacy Index. It is scored from 0&ndash;800 for each testament. For the Old
              Testament, a higher score means:
            </p>
            <ul>
              <li>You know broad OT structure.</li>
              <li>You know major events, people, places, and order.</li>
              <li>You can distinguish sections and books.</li>
              <li>You can answer more specific questions about a book, a stretch within it, or a chapter range.</li>
              <li>At the high end, you know meaningful textual detail, not just broad summaries.</li>
            </ul>
            <Example
              label="A learner who knows"
              items={[
                "Genesis comes before Exodus.",
                "Moses leads the Exodus.",
                "David comes before Solomon.",
                "Isaiah is a prophet.",
              ]}
            />
            <p style={{ marginTop: 14 }}>
              That learner has real knowledge, but it is mostly broad and foundational. They should not score near 800.
            </p>
            <Example
              label="A learner who also knows"
              items={[
                "Genesis 1\u201311 is primeval history; Genesis 12\u201350 follows the patriarchs.",
                "Deuteronomy is covenant renewal before entry into the land.",
                "1 Kings moves from Solomon to divided kingdom decline.",
                "Jeremiah is tied to Judah\u2019s final collapse and new covenant hope.",
                "Ezra\u2013Nehemiah belongs to post-exilic restoration.",
                "Isaiah\u2019s restoration promises are not the same thing as Amos\u2019s judgment or Haggai\u2019s temple focus.",
              ]}
            />
            <p style={{ marginTop: 14 }}>
              That learner has shown broader and deeper knowledge, so the BLI should rise. This is why a score can stall even
              while you keep answering correctly: broad questions alone support basic literacy, and moving toward the
              top of the scale takes evidence of textual depth.
            </p>
          </section>

          <section>
            <H2 icon="scale">How to read the 0&ndash;800 scale</H2>
            <p>
              The bands below are labels for ranges on the same 0&ndash;800 scale, not separate tests.
            </p>
            <div
              className="oba-doc-table-wrap"
              role="region"
              aria-label="Bible Literacy Index score bands"
              tabIndex={0}
            >
              <table className="oba-doc-table">
                <thead>
                  <tr><th>Band</th><th>Range</th><th>What it describes</th></tr>
                </thead>
                <tbody>
                  {BLI_LEVELS.map(band => (
                    <tr key={band.name}>
                      <td>
                        <span className="oba-doc-band">
                          <i style={{ background: band.color }} />
                          {band.name}
                        </span>
                      </td>
                      <td><span className="oba-doc-range">{band.min}&ndash;{band.max}</span></td>
                      <td>{band.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <H2 icon="model">The current scoring model</H2>
            <p>
              This is the arithmetic behind the number, included for review and debugging. Two things decide what a
              question is worth before difficulty enters into it: how foundational its book is, and how significant
              the event it asks about is.
            </p>
            <div className="oba-doc-code">
              <div><b>Question weight</b></div>
              <div>weight = <em>chronological_weight</em> &times; <em>importance_factor</em></div>
              <span className="oba-doc-code-gap" />
              <div><b>Importance factor</b></div>
              <div>tier 1 = <em>1.00</em></div>
              <div>tier 2 = <em>0.60</em></div>
              <div>tier 3+ = <em>0.35</em></div>
              <span className="oba-doc-code-gap" />
              <div><b>Difficulty reward</b></div>
              <div>difficulty_reward = clamp(0.70, 1.25, 1.0 + 0.20 &times; <em>irt_difficulty</em>)</div>
              <div>correct answer = weight &times; <em>difficulty_reward</em></div>
              <span className="oba-doc-code-gap" />
              <div><b>Guess adjustment</b></div>
              <div>wrong answer = &minus;weight &times; <em>(1/3)</em></div>
              <div>&ldquo;I don&rsquo;t know&rdquo; = <em>0 earned</em></div>
              <span className="oba-doc-code-gap" />
              <div><b>Raw score</b></div>
              <div>raw BLI = clamp(0, 100, weighted_earned &divide; weighted_possible &times; 100)</div>
              <span className="oba-doc-code-gap" />
              <div><b>Displayed score</b></div>
              <div>display BLI = clamp(0, 800, raw BLI &times; 8)</div>
            </div>
            <p style={{ marginTop: 16, fontSize: 14, color: "rgba(255,255,255,.55)" }}>
              <em>chronological_weight</em> runs from 0.65 to 1.00 and measures how much of the rest of Scripture
              leans on a book: Genesis, Exodus and the Gospels sit at 1.00, Deuteronomy at 0.90, Kings and Isaiah at
              0.85, Chronicles and the Minor Prophets at 0.65. It is the same dependency idea{" "}
              <Link href="/philosophy">About</Link>{" "}
              uses to explain why Exodus is recommended before Ezekiel &mdash;
              despite the name, it is not a measure of chronology. The importance tier belongs to the event a question
              asks about rather than to the question itself: tier 1 is the load-bearing episodes (the burning bush,
              Israel demanding a king), while tier 3 and below is incidental material (a second census, assorted case
              laws).
            </p>
            <p style={{ marginTop: 16, fontSize: 14, color: "rgba(255,255,255,.55)" }}>
              Harder items push the reward toward 1.25 and easier items pull it toward 0.70, so a correct answer on an
              easy question is worth less than full weight, not more. <em>irt_difficulty</em>{" "}
              is each question&rsquo;s
              difficulty parameter as calibrated by item response theory, not a hand-set label. The negative value for a
              wrong answer is a guessing correction: in a four-choice question, random guessing would be right about
              one time in four.
              Answers from attempts that fail quality checks, and individual answers marked ineligible, are excluded
              from both sides of the ratio rather than scored.
            </p>
          </section>

          <section>
            <H2 icon="clock">Why recommendations wait</H2>
            <p>
              OBA is as careful with advice as it is with difficulty. Recommending too early would look like this:
            </p>
            <p className="oba-doc-lead-alt">
              You answered 8 questions. You missed 2 Latter Prophets questions. Therefore your recommendation is
              Isaiah.
            </p>
            <p style={{ marginTop: 14 }}>That is too confident. Instead:</p>
            <p className="oba-doc-lead-alt">
              Recommendations need more evidence. Answer more questions across the OT so OBA can distinguish a real
              weakness from a short-sample accident.
            </p>
            <p style={{ marginTop: 14 }}>
              Once there is enough to go on, recommendations sharpen: from a whole section, to a book, to a stretch
              within that book, to a dimension.
            </p>
            <Example
              label="Progression"
              items={[
                "More evidence needed across OT sections.",
                "Former Prophets looks weak.",
                "The weakness seems concentrated in Kings rather than Joshua.",
                "The weak dimensions appear to be Events & Timeline and Geography & Nations.",
                "Recommended focus: divided kingdom and exile sequence in Kings.",
              ]}
            />
            <p style={{ marginTop: 14 }}>How much evidence a section carries is tracked directly:</p>
            <div
              className="oba-doc-table-wrap"
              role="region"
              aria-label="BLI recommendation confidence thresholds"
              tabIndex={0}
            >
              <table className="oba-doc-table">
                <thead>
                  <tr><th>Confidence</th><th>Section evidence</th><th>What it means</th></tr>
                </thead>
                <tbody>
                  {CONFIDENCE_STEPS.map(step => (
                    <tr key={step.label}>
                      <td><span className="oba-doc-band">{step.label}</span></td>
                      <td><span className="oba-doc-range">{step.range}</span></td>
                      <td>{step.copy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <H2 icon="flask">Beta</H2>
            <p className="oba-doc-lead-alt" style={{ marginTop: 0 }}>
              OBA is ready for beta use on the Old Testament, but the question bank is still being reviewed and
              improved.
            </p>
            <p style={{ marginTop: 16 }}>
              Concretely, that means some question wording is still awkward, a few coverage areas are thin, human
              quality ratings are sparse, and the BLI is an educational estimate rather than a credentialing-grade
              measure. Repeats and near-duplicates are handled by the cooldown described above rather than left to
              chance, but the difficulty calibration the scoring model rests on is still improving as more people
              answer.
            </p>
          </section>

          <section>
            <H2 icon="play">See it running</H2>
            <p>
              The <Link href="/knowledge-map">knowledge map</Link>{" "}
              shows the same structure this page describes &mdash;
              sections, books and passages, with evidence filled in as you answer. The{" "}
              <Link href="/intro">intro presentation</Link> walks through it visually.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
