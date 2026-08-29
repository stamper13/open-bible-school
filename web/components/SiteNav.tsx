"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "./BrandLogo";

// Shared top nav for the "secondary" pages (about, credential, bli,
// knowledge-map, reading-log). These previously each hand-rolled the same
// <nav className="nav"> markup with a slightly different link order and,
// in bli's case, its own mobile-menu state/effects — five copies that had
// already started drifting (about/credential never marked a link active;
// reading-log dropped About/BLI/Future Ideas entirely). Extracted here so
// the link list, active-state, and optional mobile menu live in one place.
//
// The home page's nav (in app/homeDashboard.tsx) is a different, signed-in
// app shell with an account menu and "Learn More" dropdown — not the same
// component, and deliberately not unified with this one.

export type NavLinkKey =
  | "dashboard"
  | "assess"
  | "knowledge-map"
  | "intro"
  | "about"
  | "bli"
  | "credential"
  | "reading-log";

const NAV_LINKS: Record<NavLinkKey, { href: string; label: string }> = {
  dashboard: { href: "/", label: "Dashboard" },
  assess: { href: "/assess", label: "Assess" },
  "knowledge-map": { href: "/knowledge-map", label: "Knowledge Map" },
  // "Intro Presentation" rather than the full "OBA Intro Presentation" used in
  // the dashboard's Learn More menu: inside the site's own nav the OBA prefix
  // is redundant, and this row already carries seven pills.
  intro: { href: "/intro", label: "Intro Presentation" },
  // /about was retired; the philosophy write-up is the about page now.
  about: { href: "/philosophy", label: "About" },
  bli: { href: "/bli", label: "How BLI Works" },
  credential: { href: "/credential", label: "Future Ideas" },
  "reading-log": { href: "/reading-log", label: "Reading Log" },
};

export type SiteNavProps = {
  /** Links to show, in order. */
  links: NavLinkKey[];
  /** Which link (if any) to mark .active. */
  active?: NavLinkKey;
  /** Optional trailing CTA pill (e.g. "Start Assessment"). */
  cta?: { href: string; label: string };
  /**
   * Include the hamburger + slide-down panel for narrow viewports (ported
   * verbatim from app/bli/page.tsx, the only page that had it: Escape
   * closes it, and it never survives a resize past the 640px breakpoint
   * where the inline nav-links reappear).
   */
  mobileMenu?: boolean;
  mobileMenuId?: string;
  /**
   * "pill" (default): rounded nav-link pills — about, credential, bli.
   * "block": compact square links with an .active state — knowledge-map,
   * reading-log. CSS for both lives in app/globals.css under
   * .oba-site-nav / .oba-site-nav--block.
   */
  variant?: "pill" | "block";
};

export default function SiteNav({
  links,
  active,
  cta,
  mobileMenu = false,
  mobileMenuId = "site-mobile-nav",
  variant = "pill",
}: SiteNavProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 680) setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileNavOpen]);

  const navLinks = links.map(key => {
    const { href, label } = NAV_LINKS[key];
    return (
      <Link
        key={key}
        className={`nav-link${key === active ? " active" : ""}`}
        href={href}
      >
        {label}
      </Link>
    );
  });

  const navClassName = `nav oba-site-nav${variant === "block" ? " oba-site-nav--block" : ""}`;

  return (
    <>
      <nav className={navClassName}>
        <BrandLogo className="nav-brand" />
        <div className="nav-links">{navLinks}</div>
        {mobileMenu ? (
          <div className="nav-right">
            {cta && (
              <Link className="nav-btn" href={cta.href}>
                {cta.label}
              </Link>
            )}
            <button
              type="button"
              className="mobile-nav-toggle"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              aria-controls={mobileMenuId}
              onClick={() => setMobileNavOpen(open => !open)}
            >
              <span className="mobile-nav-toggle-bar" />
              <span className="mobile-nav-toggle-bar" />
              <span className="mobile-nav-toggle-bar" />
            </button>
          </div>
        ) : (
          cta && (
            <Link className="nav-btn" href={cta.href}>
              {cta.label}
            </Link>
          )
        )}
      </nav>

      {mobileMenu && mobileNavOpen && (
        <div className="oba-site-mobile-nav-panel" id={mobileMenuId} role="menu" aria-label="Site">
          {cta && (
            <Link
              className="mobile-nav-link mobile-nav-cta"
              role="menuitem"
              href={cta.href}
              onClick={() => setMobileNavOpen(false)}
            >
              {cta.label}
            </Link>
          )}
          {links.map(key => {
            const { href, label } = NAV_LINKS[key];
            return (
              <Link
                key={key}
                className="mobile-nav-link"
                role="menuitem"
                href={href}
                onClick={() => setMobileNavOpen(false)}
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
