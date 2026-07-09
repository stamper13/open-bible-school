import Link from "next/link";

export default function CredentialPage() {
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
          background-repeat: repeat; background-size: 820px 820px, 100% 100%;
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
          padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 500;
          color: var(--muted); text-decoration: none; transition: color .14s, background .14s;
        }
        .nav-link:hover { color: var(--navy); background: rgba(27,36,66,.05); }
        .nav-btn {
          display: flex; align-items: center; gap: 7px; padding: 8px 18px; border-radius: 999px;
          font-size: 13px; font-weight: 600; background: var(--navy); color: #fff;
          text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 4px 14px rgba(27,36,66,.22); transition: background .15s, transform .13s;
        }
        .nav-btn:hover { background: #253566; transform: translateY(-1px); }
        .page { max-width: 860px; margin: 0 auto; padding: 56px 24px 96px; }
        .hero { margin-bottom: 60px; }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          border-radius: 999px; padding: 5px 14px; font-size: 12px; font-weight: 700;
          letter-spacing: .06em; text-transform: uppercase; color: #0a6e6e; margin-bottom: 20px;
        }
        .hero-eyebrow::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
        .hero-heading {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: clamp(30px, 4.5vw, 46px); font-weight: 600; line-height: 1.12;
          color: var(--navy); letter-spacing: .005em; margin-bottom: 18px;
        }
        .hero-lead { font-size: 16.5px; line-height: 1.75; color: var(--muted); max-width: 580px; margin-bottom: 28px; }
        .hero-note {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--beta-bg); border: 1px solid var(--beta-line);
          border-radius: 10px; padding: 10px 16px; font-size: 13px; color: #4c1d95; line-height: 1.5;
        }
        .section-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: .10em;
          text-transform: uppercase; color: var(--muted); margin-bottom: 16px; margin-top: 52px;
        }
        .products-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 52px; }
        .product-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 20px; padding: 32px 28px; box-shadow: var(--shadow);
          backdrop-filter: blur(10px); display: flex; flex-direction: column; gap: 16px;
          position: relative; overflow: hidden;
        }
        .product-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
        .product-card.full::before { background: linear-gradient(90deg, var(--accent), #2dc9c9); }
        .product-card.custom::before { background: linear-gradient(90deg, #7c3aed, #a78bfa); }
        .product-icon {
          width: 48px; height: 48px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .product-card.full .product-icon { background: var(--accent-dim); border: 1px solid var(--accent-line); }
        .product-card.custom .product-icon { background: var(--beta-bg); border: 1px solid var(--beta-line); }
        .product-card.full .product-icon svg { color: var(--accent); }
        .product-card.custom .product-icon svg { color: var(--beta); }
        .product-icon svg { width: 22px; height: 22px; }
        .product-label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
        .product-card.full .product-label { color: var(--accent); }
        .product-card.custom .product-label { color: var(--beta); }
        .product-title { font-family: "Crimson Pro", Georgia, serif; font-size: 22px; font-weight: 600; color: var(--navy); line-height: 1.2; margin-bottom: 2px; }
        .product-desc { font-size: 14px; line-height: 1.7; color: var(--muted); flex: 1; }
        .product-features { display: flex; flex-direction: column; gap: 8px; padding: 14px 0; border-top: 1px solid var(--border); }
        .feature-row { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; color: #3a4455; line-height: 1.5; }
        .feature-row svg { width: 15px; height: 15px; flex-shrink: 0; margin-top: 1px; }
        .product-card.full .feature-row svg { color: var(--accent); }
        .product-card.custom .feature-row svg { color: var(--beta); }
        .product-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px 20px; border-radius: 999px; font-size: 14px; font-weight: 600;
          border: none; cursor: pointer; text-decoration: none;
          transition: transform .13s, box-shadow .15s, background .15s;
        }
        .product-btn:hover { transform: translateY(-1px); }
        .product-card.full .product-btn { background: var(--navy); color: #fff; box-shadow: 0 8px 22px rgba(27,36,66,.22); }
        .product-card.full .product-btn:hover { background: #253566; }
        .product-card.custom .product-btn { background: var(--beta); color: #fff; box-shadow: 0 8px 22px rgba(124,58,237,.22); }
        .product-card.custom .product-btn:hover { background: #6d28d9; }
        .product-btn svg { width: 16px; height: 16px; }
        .product-coming {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 12px 20px; border-radius: 999px; font-size: 13.5px; font-weight: 600;
          color: var(--muted); background: rgba(27,36,66,.05); border: 1px solid var(--border);
        }
        .product-coming svg { width: 15px; height: 15px; }
        .how-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 52px; }
        .how-col-title {
          font-family: "Crimson Pro", Georgia, serif; font-size: 18px; font-weight: 600;
          color: var(--navy); margin-bottom: 20px; display: flex; align-items: center; gap: 10px;
        }
        .how-col-badge { font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; }
        .how-col-badge.full { background: var(--accent-dim); color: #0a6e6e; }
        .how-col-badge.custom { background: var(--beta-bg); color: var(--beta); }
        .steps { display: flex; flex-direction: column; gap: 0; }
        .step { display: flex; gap: 14px; padding-bottom: 20px; position: relative; }
        .step:last-child { padding-bottom: 0; }
        .step-line { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
        .step-num { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
        .how-col.full .step-num { background: var(--accent-dim); color: #0a6e6e; border: 1px solid var(--accent-line); }
        .how-col.custom .step-num { background: var(--beta-bg); color: var(--beta); border: 1px solid var(--beta-line); }
        .step-connector { width: 1px; flex: 1; margin-top: 4px; background: var(--border); min-height: 16px; }
        .step:last-child .step-connector { display: none; }
        .step-body { padding-top: 4px; }
        .step-title { font-size: 13.5px; font-weight: 650; color: var(--navy); margin-bottom: 3px; }
        .step-desc { font-size: 13px; line-height: 1.6; color: var(--muted); }
        .contact-strip {
          background: linear-gradient(135deg, #1b2442 0%, #243060 100%);
          border-radius: 20px; padding: 36px 40px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 24px; flex-wrap: wrap; position: relative; overflow: hidden;
        }
        .contact-strip::before {
          content: ""; position: absolute; inset: 0;
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Cg fill='none' stroke='white' stroke-opacity='.04'%3E%3Cpath d='M0 40H400M0 80H400M0 120H400M40 0V200M80 0V200M120 0V200M160 0V200M200 0V200M240 0V200M280 0V200M320 0V200M360 0V200'/%3E%3C/g%3E%3C/svg%3E");
          background-repeat: repeat; background-size: 400px 200px; pointer-events: none;
        }
        .contact-strip > * { position: relative; }
        .contact-heading { font-family: "Crimson Pro", Georgia, serif; font-size: 22px; font-weight: 600; color: #fff; margin-bottom: 8px; line-height: 1.2; }
        .contact-desc { font-size: 14px; line-height: 1.65; color: rgba(255,255,255,.65); max-width: 420px; }
        .contact-btn {
          display: flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: 999px;
          background: var(--accent); color: #fff; font-size: 14px; font-weight: 600;
          text-decoration: none; white-space: nowrap; flex-shrink: 0;
          box-shadow: 0 6px 20px rgba(10,163,163,.40); transition: background .15s, transform .13s;
        }
        .contact-btn:hover { background: #089090; transform: translateY(-1px); }
        @media (max-width: 640px) {
          .products-grid { grid-template-columns: 1fr; }
          .how-grid { grid-template-columns: 1fr; gap: 40px; }
          .contact-strip { padding: 28px 24px; flex-direction: column; }
          .nav { padding: 13px 16px; }
          .nav-links .nav-link { display: none; }
          .page { padding: 36px 16px 72px; }
          .beta-banner { padding: 9px 16px; font-size: 12px; }
        }
      `}</style>

      <div className="beta-banner">
        <span className="beta-badge">Beta</span>
        The verified assessment for church credentialing is a planned feature — not yet available. Get in touch to be notified when it launches.
      </div>

      <nav className="nav">
        <Link className="nav-brand" href="/">Open Bible School</Link>
        <div className="nav-links">
          <Link className="nav-link" href="/">Dashboard</Link>
          <Link className="nav-link" href="/about">About</Link>
        </div>
        <Link className="nav-btn" href="/">Start Assessment</Link>
      </nav>

      <main className="page">
        <header className="hero">
          <div className="hero-eyebrow">For churches &amp; sessions</div>
          <h1 className="hero-heading">An objective measure of<br/>Scripture content knowledge</h1>
          <p className="hero-lead">
            Seminary grades and an MDiv are imperfect proxies for biblical literacy. Open Bible School provides an independent, objective baseline — available to any candidate regardless of how or where they were trained.
          </p>
          <div className="hero-note">
            This feature is in development. The assessments below are not yet functional — this page shows what is being built.
          </div>
        </header>

        <p className="section-eyebrow">Two assessment options</p>
        <div className="products-grid">
          <div className="product-card full">
            <div>
              <p className="product-label">Option A</p>
              <h2 className="product-title">Standard Assessment</h2>
            </div>
            <div className="product-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <p className="product-desc">A fixed 35-question printed exam covering the most significant events across the Old Testament. No candidate account required. Each generation produces a slightly different question set.</p>
            <div className="product-features">
              {["No candidate account needed", "Randomised question set each time", "Prints as exam + separate answer key", "Space for candidate name — filled in by hand"].map(f => (
                <div key={f} className="feature-row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {f}
                </div>
              ))}
            </div>
            <a className="product-btn" href="#">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Generate &amp; Print
            </a>
          </div>

          <div className="product-card custom">
            <div>
              <p className="product-label">Option B</p>
              <h2 className="product-title">Verified Assessment</h2>
            </div>
            <div className="product-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <p className="product-desc">A custom exam generated from the candidate&apos;s BLI profile. Requires a candidate account. The exam link goes to the elder, not the candidate.</p>
            <div className="product-features">
              {["Candidate requests — elder receives the exam link", "Tailored to the candidate's claimed BLI profile", "Elder inputs results — verified report generated", "Unique exam ID · 30-day link expiry"].map(f => (
                <div key={f} className="feature-row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {f}
                </div>
              ))}
            </div>
            <div className="product-coming">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Coming soon — requires account
            </div>
          </div>
        </div>

        <p className="section-eyebrow">How each option works</p>
        <div className="how-grid">
          <div className="how-col full">
            <h3 className="how-col-title">Standard Assessment <span className="how-col-badge full">Option A</span></h3>
            <div className="steps">
              {[
                { t: "Generate the exam", d: "Click Generate & Print. The site selects 35 questions at random from the Tier 1 question bank, shuffling choice order to produce a unique set." },
                { t: "Print exam and key", d: "The PDF contains the exam and a separate answer key. Print both — give the candidate the exam, keep the key." },
                { t: "Candidate completes exam", d: "The candidate writes their name on the exam and answers the questions on paper. No internet access required." },
                { t: "Grade against the key", d: "Mark the exam using the answer key. The score speaks for itself." },
              ].map((s, i) => (
                <div key={i} className="step">
                  <div className="step-line">
                    <div className="step-num">{i + 1}</div>
                    <div className="step-connector" />
                  </div>
                  <div className="step-body">
                    <p className="step-title">{s.t}</p>
                    <p className="step-desc">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="how-col custom">
            <h3 className="how-col-title">Verified Assessment <span className="how-col-badge custom">Option B</span></h3>
            <div className="steps">
              {[
                { t: "Candidate requests exam", d: "The candidate logs in to their OBS account and requests a verified assessment, entering the elder's email address." },
                { t: "Elder receives secure link", d: "The elder receives an email with a secure link valid for 30 days. The candidate never sees this link." },
                { t: "Candidate takes paper exam", d: "The elder administers the printed exam independently. The candidate answers on paper with no access to the site." },
                { t: "Elder submits results", d: "Using a second link in the same email, the elder enters section-level scores. The site generates a verified BLI report." },
              ].map((s, i) => (
                <div key={i} className="step">
                  <div className="step-line">
                    <div className="step-num">{i + 1}</div>
                    <div className="step-connector" />
                  </div>
                  <div className="step-body">
                    <p className="step-title">{s.t}</p>
                    <p className="step-desc">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="contact-strip">
          <div>
            <h2 className="contact-heading">Interested in using OBS for your church?</h2>
            <p className="contact-desc">If you are a church leader, elder, or session clerk interested in the verified assessment feature when it launches, get in touch.</p>
          </div>
          <a className="contact-btn" href="mailto:contact@openbibleschool.com">Get in touch</a>
        </div>
      </main>
    </>
  );
}
