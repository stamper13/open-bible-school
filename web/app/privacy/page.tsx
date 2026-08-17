import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy | Open Bible Assessment",
  description: "How Open Bible Assessment handles assessment progress, account data, and deletion requests.",
};

export default function PrivacyPage() {
  return (
    <div className="oba-legal-page">
      <main className="oba-legal-main">
        <Link className="oba-legal-back" href="/">Back to dashboard</Link>
        <p className="oba-legal-kicker">Privacy</p>
        <h1 className="oba-legal-title">What is stored</h1>
        <p className="oba-legal-lead">
          Open Bible Assessment is a beta project. The goal is to collect only what is needed to run the assessment, preserve progress, and improve the question bank.
        </p>

        <div className="oba-legal-body">
          <section>
            <h2>Without an account</h2>
            <p>
              Assessment progress may be kept in your browser so the dashboard can show a temporary result. Clearing browser data, changing devices, or changing browsers can remove it.
            </p>
          </section>

          <section>
            <h2>With an account</h2>
            <p>
              If you sign in, the app stores your email address, assessment attempts, answers, and the scores derived from those answers so your progress can be preserved across devices.
            </p>
          </section>

          <section>
            <h2>What is not done</h2>
            <ul>
              <li>No advertising profile is built from your answers.</li>
              <li>Your responses are not sold.</li>
              <li>The BLI is not an accredited credential or a judgment of faithfulness.</li>
            </ul>
          </section>

          <section>
            <h2>Data requests</h2>
            <p>
              To request a copy of your data, send feedback, or ask for account and assessment-history deletion, email{" "}
              <a href="mailto:adstamper35@gmail.com?subject=Open%20Bible%20Assessment%20data%20request">
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
