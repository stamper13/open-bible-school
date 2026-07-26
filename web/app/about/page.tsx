import Link from "next/link";

export default function AboutPage() {
  return (
    <>
      <style>{`
        :root {
          --ink: #0e1116; --muted: #566070; --navy: #1b2442;
          --accent: #0aa3a3; --accent-dim: rgba(10,163,163,.10);
          --accent-line: rgba(10,163,163,.22); --bg: #f6f8fb;
          --card: rgba(255,255,255,.86); --border: rgba(27,36,66,.09);
          --shadow: 0 22px 58px rgba(18,30,54,.13), 0 4px 14px rgba(18,30,54,.06);
          --shadow-sm: 0 6px 20px rgba(18,30,54,.09);
          --beta: #7c3aed; --beta-bg: #f5f3ff; --beta-line: rgba(124,58,237,.18);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; scroll-behavior: smooth; }
        body {
          font-family: "Inter", system-ui, -apple-system, sans-serif;
          color: var(--ink); background-color: var(--bg);
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='820' height='820'%3E%3Cg fill='none'%3E%3Cpath stroke='%231b2442' stroke-opacity='.038' d='M0 20H820M0 40H820M0 60H820M0 80H820M0 100H820M20 0V820M40 0V820M60 0V820M80 0V820M100 0V820'/%3E%3Cpath stroke='%231b2442' stroke-opacity='.07' stroke-width='1.2' d='M0 100H820M0 200H820M0 300H820M100 0V820M200 0V820M300 0V820M400 0V820M500 0V820'/%3E%3C/g%3E%3C/svg%3E"),
            linear-gradient(180deg, #f9fafc 0%, #f0f4fb 100%);
          background-repeat: repeat;
          background-size: 820px 820px, 100% 100%;
          min-height: 100vh;
        }
        .beta-banner {
          background: var(--beta-bg); border-bottom: 1px solid var(--beta-line);
          padding: 9px 32px; display: flex; align-items: center; justify-content: center;
          gap: 10px; font-size: 13px; color: var(--beta); text-align: center;
        }
        .beta-badge {
          font-size: 10px; font-weight: 800; letter-spacing: .08em;
          text-transform: uppercase; background: var(--beta);
          color: #fff; padding: 2px 7px; border-radius: 4px; flex-shrink: 0;
        }
        .nav {
          position: sticky; top: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 32px; background: rgba(249,250,252,.90);
          backdrop-filter: blur(12px); border-bottom: 1px solid var(--border);
        }
        .nav-brand {
          font-family: "Crimson Pro", Georgia, serif;
          font-weight: 600; font-size: 18px;
          color: var(--navy); text-decoration: none; letter-spacing: .01em;
        }
        .nav-links { display: flex; align-items: center; gap: 6px; }
        .nav-link {
          padding: 7px 14px; border-radius: 999px;
          font-size: 13px; font-weight: 500; color: var(--muted);
          text-decoration: none; transition: color .14s, background .14s;
        }
        .nav-link:hover { color: var(--navy); background: rgba(27,36,66,.05); }
        .nav-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 18px; border-radius: 999px;
          font-size: 13px; font-weight: 600;
          background: var(--navy); color: #fff;
          text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 4px 14px rgba(27,36,66,.22);
          transition: background .15s, transform .13s;
        }
        .nav-btn:hover { background: #253566; transform: translateY(-1px); }
        .page { max-width: 740px; margin: 0 auto; padding: 64px 24px 96px; }
        .hero { margin-bottom: 72px; }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          border-radius: 999px; padding: 5px 14px;
          font-size: 12px; font-weight: 700; letter-spacing: .06em;
          text-transform: uppercase; color: #0a6e6e; margin-bottom: 20px;
        }
        .hero-eyebrow::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
        .hero-heading {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: clamp(34px, 5vw, 50px); font-weight: 600; line-height: 1.12;
          color: var(--navy); letter-spacing: .005em; margin-bottom: 20px;
        }
        .hero-heading em { font-style: italic; color: var(--accent); }
        .hero-lead { font-size: 17px; line-height: 1.75; color: var(--muted); max-width: 580px; }
        .pull-quote { border-left: 3px solid var(--accent); margin: 48px 0; padding: 4px 0 4px 24px; }
        .pull-quote p {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 21px; font-style: italic; line-height: 1.55; color: var(--navy); font-weight: 500;
        }
        .section { margin-bottom: 60px; }
        .section-label { font-size: 11px; font-weight: 700; letter-spacing: .10em; text-transform: uppercase; color: var(--accent); margin-bottom: 12px; }
        .section-heading { font-family: "Crimson Pro", Georgia, serif; font-size: 26px; font-weight: 600; line-height: 1.2; color: var(--navy); margin-bottom: 16px; }
        .section-body { font-size: 15.5px; line-height: 1.80; color: #3a4455; }
        .section-body p + p { margin-top: 14px; }
        .section-body strong { color: var(--navy); font-weight: 650; }
        .inline-link { color: #0a6e6e; font-weight: 650; text-decoration: none; border-bottom: 1px solid rgba(10,163,163,.30); }
        .inline-link:hover { color: var(--accent); border-bottom-color: var(--accent); }
        .principle-grid {
          display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px; margin: 28px 0 8px;
        }
        .principle-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 12px; padding: 16px 14px;
          box-shadow: var(--shadow-sm); min-height: 128px;
        }
        .principle-step {
          width: 28px; height: 28px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--accent-dim); color: #0a6e6e;
          font-size: 12px; font-weight: 800; margin-bottom: 10px;
        }
        .principle-title {
          font-size: 13px; font-weight: 750; color: var(--navy);
          text-transform: uppercase; letter-spacing: .06em; margin-bottom: 7px;
        }
        .principle-copy { font-size: 13px; line-height: 1.55; color: var(--muted); }
        .rule { border: none; border-top: 1px solid var(--border); margin: 60px 0; }
        .objection {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 16px; padding: 28px 32px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(8px); margin: 48px 0;
        }
        .objection-q {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 18px; font-style: italic; font-weight: 600;
          color: var(--navy); margin-bottom: 14px;
          display: flex; align-items: flex-start; gap: 10px;
        }
        .objection-q::before { content: "Q."; font-style: normal; font-size: 13px; font-weight: 700; letter-spacing: .06em; color: var(--accent); padding-top: 3px; flex-shrink: 0; }
        .objection-a { font-size: 15px; line-height: 1.78; color: #3a4455; padding-left: 26px; }
        .objection-a p + p { margin-top: 12px; }
        .future-note {
          display: flex; align-items: flex-start; gap: 12px;
          background: var(--beta-bg); border: 1px solid var(--beta-line);
          border-radius: 12px; padding: 16px 20px;
          font-size: 13.5px; line-height: 1.65; color: #4c1d95; margin-top: 20px;
        }
        .confession-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
        .conf-badge {
          font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 999px;
          background: rgba(27,36,66,.06); border: 1px solid var(--border); color: var(--navy);
        }
        .donate-block {
          background: linear-gradient(135deg, #1b2442 0%, #243060 100%);
          border-radius: 20px; padding: 36px 40px; color: #fff; margin: 60px 0;
          position: relative; overflow: hidden;
        }
        .donate-block::before {
          content: ""; position: absolute; inset: 0;
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Cg fill='none' stroke='white' stroke-opacity='.04'%3E%3Cpath d='M0 40H400M0 80H400M0 120H400M40 0V200M80 0V200M120 0V200M160 0V200M200 0V200M240 0V200M280 0V200M320 0V200M360 0V200'/%3E%3C/g%3E%3C/svg%3E");
          background-repeat: repeat; background-size: 400px 200px; pointer-events: none;
        }
        .donate-block > * { position: relative; }
        .donate-heading { font-family: "Crimson Pro", Georgia, serif; font-size: 24px; font-weight: 600; color: #fff; margin-bottom: 12px; }
        .donate-body { font-size: 15px; line-height: 1.72; color: rgba(255,255,255,.72); margin-bottom: 24px; max-width: 480px; }
        .donate-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 24px; border-radius: 999px;
          background: var(--accent); color: #fff;
          font-size: 14px; font-weight: 600; text-decoration: none;
          box-shadow: 0 6px 20px rgba(10,163,163,.40);
          transition: background .15s, transform .13s;
        }
        .donate-btn:hover { background: #089090; transform: translateY(-1px); }
        .cta-row { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 48px; }
        .btn-primary {
          display: flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 999px;
          background: var(--navy); color: #fff; font-size: 15px; font-weight: 600;
          text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 10px 28px rgba(27,36,66,.24); transition: background .15s, transform .13s;
        }
        .btn-primary:hover { background: #253566; transform: translateY(-2px); }
        .btn-secondary {
          display: flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 999px;
          background: var(--card); color: var(--navy); font-size: 15px; font-weight: 600;
          text-decoration: none; border: 1px solid var(--border); cursor: pointer;
          backdrop-filter: blur(8px); box-shadow: var(--shadow-sm); transition: transform .13s, box-shadow .15s;
        }
        .btn-secondary:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
        @media (max-width: 600px) {
          .nav { padding: 13px 16px; }
          .nav-links .nav-link { display: none; }
          .page { padding: 40px 16px 72px; }
          .donate-block { padding: 28px 24px; }
          .objection { padding: 22px 20px; }
          .cta-row { flex-direction: column; }
          .beta-banner { padding: 9px 16px; font-size: 12px; }
          .principle-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="beta-banner">
        <span className="beta-badge">Beta</span>
        Open Bible Assessment is in active development. Questions and resources are being refined — feedback on accuracy and wording is welcome.
      </div>

      <nav className="nav">
        <Link className="nav-brand" href="/">Open Bible Assessment</Link>
        <div className="nav-links">
          <Link className="nav-link" href="/">Dashboard</Link>
          <Link className="nav-link" href="/bli">How BLI Works</Link>
          <Link className="nav-link" href="/credential">For Churches</Link>
        </div>
        <Link className="nav-btn" href="/">Start Assessment</Link>
      </nav>

      <main className="page">
        <header className="hero">
          <div className="hero-eyebrow">About Open Bible Assessment</div>
          <h1 className="hero-heading">The grammar of<br/><em>biblical knowledge</em></h1>
          <p className="hero-lead">
            Open Bible Assessment is a free, adaptive tool that helps you find out what you actually know about the Bible, where your gaps are, and what to study next. It is not a spiritual barometer. It measures one thing: familiarity with the content of Scripture.
          </p>
        </header>

        <section className="section">
          <p className="section-label">The basic idea</p>
          <h2 className="section-heading">Assess, map, route, repeat</h2>
          <div className="section-body">
            <p>
              Open Bible Assessment is built around a simple cycle: <strong>assess, map, route, repeat</strong>. First, it assesses underlying competency directly rather than relying on proxies like credentials, course completion, reading plans, or self-confidence. Then it maps where your knowledge is strong and where it is thin. From there, it can route you toward the passages and resources most relevant to your actual gaps. Over time, repeated assessment gives a clearer picture of growth.
            </p>
            <p>
              This is different from many approaches to Bible training. The problem is not a lack of resources. There are more books, sermons, courses, podcasts, study guides, and curricula than any one person could ever use. The harder question is knowing what you actually need next.
            </p>
          </div>
          <div className="principle-grid">
            <div className="principle-card">
              <span className="principle-step">1</span>
              <div className="principle-title">Assess</div>
              <p className="principle-copy">Measure real content familiarity instead of assuming knowledge from credentials or completed material.</p>
            </div>
            <div className="principle-card">
              <span className="principle-step">2</span>
              <div className="principle-title">Map</div>
              <p className="principle-copy">Show the shape of your knowledge by section, book, and eventually other domains.</p>
            </div>
            <div className="principle-card">
              <span className="principle-step">3</span>
              <div className="principle-title">Route</div>
              <p className="principle-copy">Point you toward the passages and resources that match your actual gaps.</p>
            </div>
            <div className="principle-card">
              <span className="principle-step">4</span>
              <div className="principle-title">Repeat</div>
              <p className="principle-copy">Return after study and let the map become more accurate as evidence accumulates.</p>
            </div>
          </div>
        </section>

        <section className="section">
          <p className="section-label">What it measures</p>
          <h2 className="section-heading">Content knowledge, nothing more</h2>
          <div className="section-body">
            <p>
              The Bible Literacy Index (BLI) measures the <strong>grammar of biblical knowledge</strong> — the foundational content that underlies all serious engagement with Scripture: the events, the people, the sequence, the textual detail. What happened in Genesis 15. What the two goats in Leviticus 16 represent. What 2 Kings says about the northern kingdom and why. These are mostly questions of textual content rather than denominational position. They can be tested. They can be measured.
            </p>
            <p>
              In some cases a question may presume a particular reading of a text — that is unavoidable at this level of detail. What the BLI does not test are positions that require drawing multiple passages together into a theological argument: whether infant baptism or believer&apos;s baptism is correct, for instance, is a question that falls entirely outside its scope.
            </p>
            <p>
              What the BLI cannot measure — and does not attempt to — is wisdom, interpretive skill, theological depth, or how the Bible has shaped a person&apos;s life. Strong Scripture content knowledge is something a Presbyterian, a Baptist, an Anglican, and a Pentecostal can all demonstrate — or lack. The tool belongs to no denomination and tilts toward no tradition in what it tests.
            </p>
            <p>
              A high BLI score does not make someone a better Christian, a more faithful elder, or a wiser pastor. It means they know the content of Scripture well. That knowledge matters — it undergirds everything else. But it is the floor, not the ceiling.
            </p>
          </div>
        </section>

        <div className="objection">
          <div className="objection-q">Can you really quantify Bible knowledge?</div>
          <div className="objection-a">
            <p>Not fully — and we&apos;re not trying to. But testing it is not a new idea. Seminaries run Bible content exams. Ordination boards test Scripture knowledge before licensing ministers. What they&apos;re all doing is the same thing: assessing something real — whether a person has engaged with and retained the content of Scripture.</p>
            <p>The BLI works on the same principle. It won&apos;t capture wisdom, interpretive skill, or spiritual formation. But it can tell whether someone knows the events, people, and passages of the Old Testament. Think of the score as a proxy — useful and honest within its scope, not a final verdict on anything.</p>
          </div>
        </div>

        <section className="section">
          <p className="section-label">How it works</p>
          <h2 className="section-heading">Adaptive, continuous, honest</h2>
          <div className="section-body">
            <p>
              The assessment adapts to you. It weights questions toward the most significant events and passages in Scripture, then focuses on areas where it is most uncertain about your knowledge. The more questions you answer, the more precise your profile becomes. There is no finished state — you can always go deeper.
            </p>
            <p>
              Your BLI score is a snapshot, not a verdict. Early in the process it reflects a small sample; over time it becomes a genuinely informative picture of where you stand. The dashboard shows you not just an overall score but a breakdown by section — Torah, Former Prophets, Latter Prophets — so you can see exactly where your knowledge is strong and where it thins out.
            </p>
            <p>
              For readers who want the technical details, including how weighting and the display scale work, see <Link className="inline-link" href="/bli">How the Bible Literacy Index Works</Link>.
            </p>
          </div>
        </section>

        <hr className="rule" />

        <blockquote className="pull-quote">
          <p>&ldquo;The destination is the real goal. The score, the map, and the recommendations are only useful if they send you back to Scripture with a clearer sense of where to go.&rdquo;</p>
        </blockquote>

        <section className="section">
          <p className="section-label">The destination</p>
          <h2 className="section-heading">Resources are means, not the goal</h2>
          <div className="section-body">
            <p>
              People grow in biblical knowledge through many faithful means: reading Scripture, hearing sermons, studying commentaries, taking courses, talking with pastors and teachers, memorizing passages, and discussing the Bible with other Christians. Open Bible Assessment does not replace any of those. It helps you use them more tactically.
            </p>
            <p>
              The point is not to collect resources, complete courses, or accumulate credentials as though those automatically equal biblical competence. Those things can be valuable. But they are means. The goal is to know Scripture better.
            </p>
            <p>
              Open Bible Assessment is not trying to solve biblical literacy by becoming one more content library in an already crowded world. It is trying to become a competency map: a way to see what is actually there, what is missing, and what would be most fruitful to pursue next.
            </p>
          </div>
        </section>

        <hr className="rule" />

        <section className="section">
          <p className="section-label">For churches</p>
          <h2 className="section-heading">An objective baseline for biblical literacy</h2>
          <div className="section-body">
            <p>
              Seminary grades and an MDiv in hand are imperfect proxies for biblical knowledge. That is not a criticism of seminary education — it is an observation about what credentials measure and what they do not. Course grades reflect performance in academic contexts. They do not reliably tell a session whether a candidate has read and absorbed the Old Testament. And the converse is equally true: some of the most biblically knowledgeable people have no formal training at all. The credential and the knowledge are not the same thing.
            </p>
            <p>
              Open Bible Assessment is working toward something that does not yet exist: an independent, objective measure of Scripture content knowledge — available to any candidate regardless of how or where they were trained, and interpretable by any session without specialized knowledge of seminary curricula or grading standards.
            </p>
            <p>
              This is the core advantage of direct competency assessment: it bypasses proxies and looks at the underlying thing itself. Credentials, courses, and libraries all have a place. But the question beneath them is simpler and more demanding: what does this person actually know?
            </p>
          </div>
          <div className="future-note">
            <span>The verified assessment feature for church credentialing is a planned feature, not yet available. The question bank is currently in beta and being refined through community feedback. If you are a church leader or session clerk interested in using Open Bible Assessment when it is ready, you are welcome to get in touch.</span>
          </div>
          <div className="confession-row">
            </div>
        </section>

        <section className="section">
          <p className="section-label">Curated resources</p>
          <h2 className="section-heading">Where to go from here</h2>
          <div className="section-body">
            <p>
              The dashboard identifies your gaps and links to curated resources for each area.
            </p>
          </div>
        </section>

        <section className="section">
          <p className="section-label">Beta project</p>
          <h2 className="section-heading">A proof of concept being refined in public</h2>
          <div className="section-body">
            <p>
              Open Bible Assessment is currently a beta project. The goal is to build a useful diagnostic tool for Bible content knowledge, not to pretend that the present score is already a fully validated psychometric instrument. The BLI is provisional: useful for mapping gaps and guiding study, but still in need of more question review, more user data, and more statistical validation.
            </p>
            <p>
              That means feedback is part of the work. Biblical insight matters: question wording, textual accuracy, passage selection, book coverage, and theological neutrality all need careful review. Technical insight matters too: scoring, data modeling, accessibility, security, analytics, and frontend/backend reliability all affect whether this can become genuinely useful.
            </p>
            <p>
              If the idea has potential, it will need more than one person. The hope is to make the early version good enough to test honestly, learn from real use, and invite help from people who care about Scripture, education, statistics, and software.
            </p>
          </div>
        </section>

        <div className="donate-block">
          <h2 className="donate-heading">Free, and staying that way</h2>
          <p className="donate-body">
            Open Bible Assessment is not a product. There is no subscription, no premium tier, no advertising. The tool is free to use and will remain so. If you find it useful and want to support the ongoing work, you can make a donation. If not, use it anyway.
          </p>
          <a className="donate-btn" href="/donate">Support the work</a>
        </div>

        <div className="cta-row">
          <Link className="btn-primary" href="/">Start the assessment</Link>
          <Link className="btn-secondary" href="/bli">How BLI works</Link>
          <Link className="btn-secondary" href="/credential">For churches</Link>
        </div>
      </main>
    </>
  );
}
