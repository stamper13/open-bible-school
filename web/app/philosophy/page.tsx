import type { Metadata } from "next";
import Link from "next/link";
import ContactEmail from "@/components/ContactEmail";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

/**
 * The project write-up, reproduced in full. Reached as "About" throughout the
 * site — it replaced the old /about page — while the route stays /philosophy,
 * which /about redirects to (see next.config.ts).
 *
 * This is the "read the document" half of the pair in the dashboard's Learn
 * More menu; /intro is the other half, which walks the same material as a star
 * map. The text here is the author's own and should stay verbatim — if a claim
 * needs to change, change it here first, then bring /intro's cards into line
 * (they quote this document).
 *
 * Styling is the shared .oba-legal-* document chrome from app/globals.css, the
 * same set /terms and /privacy use. No page-local CSS on purpose: this is a
 * document, and it should look like the site's other documents.
 *
 * It also carries the site nav, unlike /terms and /privacy: since /about was
 * retired this page is a top-level destination reached from the nav itself,
 * not somewhere you only arrive from a footer link.
 */

export const metadata: Metadata = {
  title: "About | Open Bible Assessment",
  description:
    "The full write-up behind Open Bible Assessment: why it exists, what the assessment does, what the score means, and how it recommends what to read next.",
};

export default function PhilosophyPage() {
  return (
    <div className="oba-legal-page">
      <SiteNav
        links={["dashboard", "assess", "knowledge-map", "intro", "bli", "credential", "reading-log"]}
        cta={{ href: "/assess", label: "Start Assessment" }}
        mobileMenu
        mobileMenuId="philosophy-mobile-nav"
      />
      <main className="oba-legal-main">
        <p className="oba-legal-kicker">About</p>
        <h1 className="oba-legal-title">What Is Open Bible Assessment?</h1>

        <p className="oba-legal-lead" style={{ marginBottom: 16 }}>
          Thank you for taking the time to check out my website, Open Bible Assessment (OBA). It&rsquo;s a free
          assessment that asks you questions about the Bible, shows you what you know well and what you don&rsquo;t,
          and points you to where it would help most to read next.
        </p>

        <p className="oba-legal-lead">
          I originally got the idea when I was using the educational website Khan Academy to brush up on basic math. During that time, I became
          impressed with a number of things the website did very well, including: (1) making learning enjoyable by
          mapping progress; (2) organizing learning concepts in a way that made it very easy to see the bigger picture;
          and (3) recommending a clear next step based on what you already know.
        </p>

        <p className="oba-doc-lead-alt" style={{ marginBottom: 34 }}>
          Would you rather not read a document? The same material is laid out as an interactive map of the canon
          &mdash; the sections as stars, their books as planets, and a book&rsquo;s own sections as moons.{" "}
          <Link href="/intro">Take the tour instead</Link>.
        </p>

        <div className="oba-legal-body">
          <section>
            <h2>The idea</h2>
            <p>
              Khan Academy has a lot of great educational content, but I realized it was doing something more than that
              — it was adapting and recommending based on the user&rsquo;s ability. The primary goal of Open Bible
              Assessment is to do the same thing for learning the Bible. OBA doesn&rsquo;t have lessons, videos, or
              other course content — there&rsquo;s already no shortage of great Bible resources out there. Instead,
              it&rsquo;s a diagnostic tool.
            </p>
          </section>

          <section>
            <h2>Formal training</h2>
            <p>
              Going through seminary, I did genuinely grow in my understanding of the Bible, but there were many courses
              that I did not learn as much as I would have liked — sometimes because the courses covered material I
              already knew, other times because the material was far above my ability. This is no fault of seminary, but
              rather a difficulty inherent in trying to create a completely standardized program, where everyone takes
              the same number of courses to finish with the same credential.
            </p>
            <p>
              A second problem I noticed was that many of the people I attended seminary with had no interest in
              pursuing ministry at all — they simply wanted to grow in their faith by learning more about the Bible.
              I&rsquo;m sure most of them learned a great deal through their programs, but they also racked up a lot of
              debt in the process. My hope is that OBA can be a useful tool for both Christians who have done formal
              training but may have some remaining gaps, as well as those who want to understand their Bible better but
              don&rsquo;t have the time or money to enroll in a formal program.
            </p>
          </section>

          <section>
            <h2>Assessment</h2>
            <p>
              The website is essentially made up of an assessment and a dashboard that displays results. The first
              round is 25 questions, which is what it takes before a score can appear on your dashboard; after that,
              each new round is 15. Each question is multiple choice and there&rsquo;s no timer, and you don&rsquo;t
              have to finish a round in one sitting &mdash; answer five now, come back tomorrow, and it picks up where
              you left off. Based on your previous answers, the assessment adapts. It first tries
              to identify broad areas of knowledge and unfamiliarity — does this person understand the Torah? What about
              the Latter Prophets? — and then it drills down into specific books and sections. As you reread books of
              the Bible, it retests your knowledge and adapts accordingly.
            </p>
          </section>

          <section>
            <h2>Scoring</h2>
            <p>
              After you finish that first round, a score is displayed on your dashboard. I realize for some this might
              be viewed as problematic or even offensive. The goal here is not to discern spiritual maturity or
              giftedness; rather, the score measures how well you understand the facts of Scripture. Who led the
              Israelites across the Red Sea? Which came first, Ruth or Saul?
            </p>
            <p>
              The assessment also does not evaluate answers to complex theological questions. Both theological
              interpretation and spiritual maturity are important, but they fall outside the scope of this assessment
              (and probably any assessment!).
            </p>
            <p>
              The score is intended to make learning more enjoyable by letting you see your progress over time in a
              tangible way — as you learn more about a section of the Bible, your score improves. The reason it is not a
              simple percentage is that as you answer harder questions correctly, the assessment gives you more
              difficult questions; if you get hard questions wrong, it gives you easier ones.
            </p>
          </section>

          <section>
            <h2>Recommending</h2>
            <p>
              After you&rsquo;ve answered enough questions, the dashboard begins recommending places to read in the
              Bible, first prioritizing weak areas that are more foundational for understanding the whole Bible. For
              example, if someone has a poor grasp of both Ezekiel and Exodus, the assessment will recommend reading
              Exodus first, because Ezekiel is more dependent on Exodus for comprehension. You can understand Exodus
              without the Prophets, at least at a basic level, but you can&rsquo;t understand the Prophets without
              understanding the Sinaitic covenant, or without learning about Moses and how the Israelites came to be a
              nation. The goal is to help you build a solid foundation rather than jumping randomly between topics, so
              that the time you spend rereading actually compounds into a better grasp of the whole Bible.
            </p>
          </section>

          <section>
            <h2>Anti-innovation</h2>
            <p>
              OBA doesn&rsquo;t do anything a Christian couldn&rsquo;t already do simply by being in the Word — reading
              Scripture, reflecting on it, and returning to it over time. This mirrors what people often do on their own
              when learning about a subject — reading a bit, pausing to mull over the concepts, reviewing notes, jotting
              down thoughts, picking up something different, or talking to someone about it. Sometimes a looser structure
              helps you learn more. OBA is meant to help with that process. If
              you step away from it for six months and instead spend that time reading your Bible and a few books, the
              assessment will still be able to recognize your improved understanding when you come back.
            </p>
          </section>

          <section>
            <h2>Beta</h2>
            <p>
              An important caveat: this tool still needs to be tested and improved further before it can be considered
              reliable. It took a lot of work to get it to this point, but if you use the website, please take it with a
              grain of salt.
            </p>
          </section>

          <section>
            <h2>Feedback</h2>
            <p>
              If you have any feedback, please send me an email at{" "}
              <ContactEmail subject="Open Bible Assessment feedback" />.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
