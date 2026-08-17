"use client";

import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

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
          <a href="mailto:adstamper35@gmail.com?subject=Open%20Bible%20Assessment%20feedback">Contact</a>
          <Link href="/about">About</Link>
          <Link href="/bli">How BLI works</Link>
        </nav>
      </div>
    </footer>
  );
}
