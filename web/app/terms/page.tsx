import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Terms | Open Bible Assessment",
  description: "Basic beta-use terms and limitations for Open Bible Assessment.",
};

export default function TermsPage() {
  return (
    <div className="oba-legal-page">
      <main className="oba-legal-main">
        <Link className="oba-legal-back" href="/">Back to dashboard</Link>
        <p className="oba-legal-kicker">Terms</p>
        <h1 className="oba-legal-title">Beta-use terms</h1>
        <p className="oba-legal-lead">
          Open Bible Assessment is provided as a free beta diagnostic tool. These terms are intentionally plain: use the site honestly, understand its limits, and contact the project if something needs correction.
        </p>

        <div className="oba-legal-body">
          <section>
            <h2>What the tool is</h2>
            <p>
              OBA estimates Scripture content knowledge from assessment answers. It is meant to guide study and review, not to replace pastoral judgment, church processes, formal education, or personal discipleship.
            </p>
          </section>

          <section>
            <h2>What the tool is not</h2>
            <ul>
              <li>It is not an accredited credential.</li>
              <li>It is not a measure of holiness, wisdom, pastoral calling, or spiritual maturity.</li>
              <li>It is not guaranteed to be free from question errors while the beta question bank is being reviewed.</li>
            </ul>
          </section>

          <section>
            <h2>Responsible use</h2>
            <p>
              Do not treat a BLI score as a final judgment about a person. Scores are estimates, and early scores can move as more evidence is collected.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              For corrections, feedback, or account deletion requests, email{" "}
              <a href="mailto:adstamper35@gmail.com?subject=Open%20Bible%20Assessment%20feedback">
                adstamper35@gmail.com
              </a>.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
