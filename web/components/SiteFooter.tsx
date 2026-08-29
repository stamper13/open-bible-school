"use client";

import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import ContactEmail from "@/components/ContactEmail";

export default function SiteFooter() {
  return (
    <footer className="oba-site-footer">
      <div className="oba-site-footer-inner">
        <div>
          <BrandLogo className="oba-site-footer-brand" />
          <p className="oba-site-footer-copy">
            A beta diagnostic tool for mapping Scripture content knowledge. Scores are estimates and the question bank is still being reviewed.
          </p>
        </div>
        <nav className="oba-site-footer-links" aria-label="Footer">
          <ContactEmail subject="Open Bible Assessment feedback" label="Contact" />
          <Link href="/philosophy">About</Link>
          <Link href="/bli">How BLI works</Link>
        </nav>
      </div>
    </footer>
  );
}
