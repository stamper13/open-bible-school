"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import StarMap from "./StarMap";
import { SCENES } from "./introData";
import { INTRO_PAGE_STYLES } from "./introStyles";

/**
 * A scrolled tour of the project over a single fixed solar system.
 *
 * One idea per screen, in the author's own words, and nothing else on the
 * card. Whatever a scene needs to explain beyond that sentence is carried by
 * the canvas behind it — the scan sweeping outward, the drill into a section's
 * books, the route from Ezekiel's section back to the Torah.
 */
export default function IntroPage() {
  // Starts at -1, meaning "nothing measured yet", so no card is lit on the
  // first paint. The measure pass below then selects the opening card and it
  // transitions in — with the card already lit from render one there is
  // nothing for it, or the staggered lines inside it, to arrive from.
  const [active, setActive] = useState(-1);
  const [scrolled, setScrolled] = useState(false);
  const scenesRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const nodes = scenesRef.current.filter(Boolean);
    if (!nodes.length) return;

    // The current scene is whichever one's centre sits nearest the middle of
    // the viewport — computed outright rather than inferred from intersection
    // events. An IntersectionObserver batches its entries, so "the last
    // intersecting entry wins" picks an arbitrary scene whenever more than one
    // record lands in the same callback (a fast scroll, or a programmatic
    // jump), and the wrong card lights up.
    const measure = () => {
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const rect = nodes[i].getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - mid);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      }
      setActive(best);
      setScrolled(window.scrollY > 40);
    };
    // Called straight from the scroll handler rather than coalesced through
    // requestAnimationFrame: a "one frame is already queued" flag is set
    // before the frame runs, so if that frame never arrives — a tab that is
    // still in the background, say — the flag latches on and every later
    // scroll is dropped. Reading twelve rects is far too cheap to be worth
    // that risk, and the browser already fires scroll at most once a frame.
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <>
      <style>{INTRO_PAGE_STYLES}</style>

      <StarMap scene={active} />

      <SiteNav
        links={["dashboard", "assess", "knowledge-map", "about", "bli", "credential", "reading-log"]}
        cta={{ href: "/assess", label: "Start Assessment" }}
        mobileMenu
        mobileMenuId="intro-mobile-nav"
      />

      <main className="scroller">
        {SCENES.map((scene, i) => (
          <section
            key={scene.id}
            className="scene"
            ref={node => { if (node) scenesRef.current[i] = node; }}
            aria-current={i === active || undefined}
          >
            <div
              className={
                `scene-card${i === active ? " on" : ""}` +
                `${scene.stagger ? " is-title" : ""}` +
                // is-title staggers the cover's lines. is-lead steps the copy
                // down to a sans lead, which only makes sense on a card that
                // also carries a heading — so it keys off the heading itself.
                `${scene.title ? " is-lead" : ""}`
              }
            >
              {scene.kicker && <p className="scene-kicker">{scene.kicker}</p>}
              {scene.title && <h1 className="scene-title">{scene.title}</h1>}
              {scene.label && <p className="scene-label">{scene.label}</p>}
              {scene.text && <p className="scene-text">{scene.text}</p>}

              {scene.stagger && (
                <div className="scene-hint">
                  <span className="scene-hint-mouse" aria-hidden="true"><i /></span>
                  Scroll to descend — drag to spin the orbits
                </div>
              )}

              {scene.closing && (
                <div className="scene-actions">
                  <Link className="scene-btn" href="/assess">Start the assessment</Link>
                  <Link className="scene-btn ghost" href="/philosophy">Read the write-up</Link>
                  <Link className="scene-btn ghost" href="/bli">How the BLI works</Link>
                </div>
              )}
            </div>
          </section>
        ))}
      </main>

      <nav className={`orrery-rail${scrolled ? " visible" : ""}`} aria-label="Jump to scene">
        {SCENES.map((scene, i) => (
          <button
            key={scene.id}
            type="button"
            className={`orrery-dot${i === active ? " on" : ""}`}
            aria-label={scene.label ?? scene.title ?? scene.id}
            aria-current={i === active}
            onClick={() => scenesRef.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" })}
          />
        ))}
      </nav>

      <SiteFooter />
    </>
  );
}
