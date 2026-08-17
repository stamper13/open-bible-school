"use client";

import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import SiteFooter from "@/components/SiteFooter";
import { useEffect, useRef, useState } from "react";
import {
  EMPTY_EXPLORE_TREE,
  EMPTY_FOCUS_PATH,
  focusNodeDomId,
  loadExploreTree,
  loadFocusPath,
  type ExploreTree,
  type FocusPath,
} from "@/lib/focusPath";
import { supabase } from "@/lib/supabase/client";
import FocusStarMap from "./FocusStarMap";
import FocusTransition from "./FocusTransition";
import MapOverview from "./MapOverview";
import StarfieldBackground from "./StarfieldBackground";

/**
 * The knowledge map shows where the router's attention currently is — not the
 * structure of the Old Testament for the user to explore.
 *
 * Three levels, terminal at level 3, rendered as a star field: sections are
 * stars down a spine, the open section branches into its books as planets, and
 * the open book expands into its sections. Only the `is_focus` node at each
 * level opens; the rest stay collapsed and carry their own state. Dimensions
 * and individual events are deliberately not nodes here.
 */

const FOCUS_MEMORY_KEY = "obs_km_focus";

type FocusMemory = { l1: string; l2: string; l3: string };

function readFocusMemory(userId: string): FocusMemory | null {
  try {
    const raw = window.localStorage.getItem(`${FOCUS_MEMORY_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FocusMemory>;
    if (!parsed?.l3) return null;
    return { l1: parsed.l1 ?? "", l2: parsed.l2 ?? "", l3: parsed.l3 };
  } catch {
    return null;
  }
}

function writeFocusMemory(userId: string, memory: FocusMemory) {
  try {
    window.localStorage.setItem(`${FOCUS_MEMORY_KEY}:${userId}`, JSON.stringify(memory));
  } catch {
    // A full or blocked storage quota only costs the transition, not the map.
  }
}

export default function KnowledgeMapPage() {
  const [path, setPath] = useState<FocusPath>(EMPTY_FOCUS_PATH);
  const [tree, setTree] = useState<ExploreTree>(EMPTY_EXPLORE_TREE);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [transition, setTransition] = useState<{ token: string; fromId: string; toId: string } | null>(null);
  const transitionPlayedRef = useRef(false);
  // "focus" is the study workflow around the router's current recommendation;
  // "overview" is the galaxy-style atlas. The course-grid "coverage" view
  // moved to the dashboard, where it lives alongside the rest of the summary.
  const [mapView, setMapView] = useState<"focus" | "overview">("focus");
  const [focusTarget, setFocusTarget] = useState<{ sectionKey: string; bookCode?: string } | null>(null);
  const [ntComingSoon, setNtComingSoon] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [focusFullView, setFocusFullView] = useState(false);

  const openMapView = (view: "focus" | "overview") => {
    setMapView(view);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };
  const hasMapStructure = tree.sections.length > 0;
  const hasRecommendation = !path.isEmpty;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const id = sessionData.session?.user?.id ?? null;
        const [nextPath, nextTree] = await Promise.all([
          loadFocusPath(id),
          loadExploreTree(id),
        ]);
        if (cancelled) return;
        setUserId(id);
        setPath(nextPath);
        setTree(nextTree);
        setLoading(false);
      } catch (error) {
        // Log the underlying cause; show the user a recoverable message.
        console.error("Focus path load failed:", error);
        if (cancelled) return;
        setLoadError("The knowledge map could not be loaded. This is usually a temporary connection problem.");
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // A cleared section is detected by comparing the focus we last showed this
  // user against the one the backend is returning now. The light then travels
  // from the node that cleared to the node that just opened.
  useEffect(() => {
    if (!userId || path.isEmpty || transitionPlayedRef.current) return;
    const { focusSection, focusBook, focusLeaf } = path;
    if (!focusSection || !focusBook || !focusLeaf) return;

    transitionPlayedRef.current = true;
    const next: FocusMemory = {
      l1: focusSection.node_key,
      l2: focusBook.node_key,
      l3: focusLeaf.node_key,
    };
    const previous = readFocusMemory(userId);
    writeFocusMemory(userId, next);

    if (!previous || previous.l3 === next.l3) return;

    // The cleared node is usually still on the map as a non-focus sibling. If
    // its whole level moved on, fall back to the nearest ancestor still drawn.
    const candidates = [
      `km-node-3-${previous.l3}`,
      previous.l2 ? `km-node-2-${previous.l2}` : "",
      previous.l1 ? `km-node-1-${previous.l1}` : "",
    ].filter(Boolean);

    const raf = requestAnimationFrame(() => {
      const fromId = candidates.find((id) => document.getElementById(id));
      const toId = focusNodeDomId(focusLeaf);
      if (!fromId || fromId === toId || !document.getElementById(toId)) return;
      setTransition({ token: `${previous.l3}->${next.l3}`, fromId, toId });
    });
    return () => cancelAnimationFrame(raf);
  }, [path, userId]);

  return (
    <>
      <style>{`
        :root {
          --navy: #1b2442;
          --muted: #596477;
          --accent: #0aa3a3;
          --line: rgba(209,224,235,.30);
        }
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        html { background: #060a14; }
        body {
          margin: 0; min-height: 100vh; color: #edf4fb;
          font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
          /* A base fill that always paints plus fixed nebulae for depth; the
             base scrolls with the document so there is never a bare gap behind
             the fixed star canvas. */
          background:
            linear-gradient(180deg,#070b16 0%,#0a1122 50%,#060a16 100%) no-repeat,
            #060a14;
        }
        body::before {
          content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none;
          background:
            radial-gradient(ellipse at 22% 8%, rgba(36,80,120,.32), transparent 55%),
            radial-gradient(ellipse at 84% 30%, rgba(88,52,150,.26), transparent 52%),
            radial-gradient(ellipse at 60% 98%, rgba(10,90,90,.24), transparent 56%);
        }
        button, a { font: inherit; }
        /* animated starfield sits behind everything; content is lifted above it */
        .km-starfield { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
        .page { position: relative; z-index: 1; }
        .focus-transition { position: fixed; inset: 0; z-index: 15; pointer-events: none; }
        .nav {
          position: sticky; top: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 32px;
          background: rgba(8,13,29,.86);
          border-bottom: 1px solid rgba(255,255,255,.10);
          backdrop-filter: blur(16px);
        }
        .nav-brand {
          color: #fff; text-decoration: none;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 18px; font-weight: 700;
        }
        .nav-links { display: flex; align-items: center; gap: 7px; }
        .nav-link {
          color: rgba(255,255,255,.67); text-decoration: none;
          padding: 8px 12px; border-radius: 6px;
          font-size: 12px; font-weight: 800;
        }
        .nav-link:hover, .nav-link.active { color: #fff; background: rgba(255,255,255,.09); }
        .page { width: min(1560px, calc(100% - 48px)); margin: 0 auto; padding: 26px 0 70px; }
        .page-head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 20px; flex-wrap: wrap; margin-bottom: 20px;
        }
        .eyebrow {
          margin: 0; color: #7de5e5;
          font-size: 11px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase;
        }
        .title {
          margin: 0; color: #fff;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(32px,4vw,48px); line-height: 1;
        }
        .subtitle {
          max-width: 720px; margin: 10px 0 0;
          color: rgba(237,244,251,.68); font-size: 14px; line-height: 1.55;
        }
        .summary {
          display: grid; grid-template-columns: repeat(3,minmax(92px,1fr));
          gap: 8px; min-width: 330px;
        }
        .summary-item {
          min-height: 66px; padding: 11px 13px;
          border: 1px solid rgba(255,255,255,.12); border-radius: 6px;
          background: rgba(255,255,255,.055);
        }
        .summary-value {
          display: block; color: #fff;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 21px; font-weight: 750; line-height: 1.1;
        }
        .summary-label {
          display: block; margin-top: 6px;
          color: rgba(237,244,251,.56); font-size: 9px;
          font-weight: 850; letter-spacing: .08em; text-transform: uppercase;
        }
        .next-band {
          position: relative; display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          gap: 24px; align-items: center;
          margin-bottom: 26px; padding: 20px 22px 20px 27px;
          border: 1px solid rgba(114,231,255,.34); border-radius: 8px;
          background: linear-gradient(105deg,rgba(10,163,163,.17),rgba(255,255,255,.06) 56%,rgba(212,160,23,.09));
          box-shadow: 0 18px 42px rgba(0,0,0,.24); overflow: hidden;
        }
        .next-band::before {
          content: ""; position: absolute; inset: 0 auto 0 0; width: 5px;
          background: linear-gradient(180deg,#72e7ff,#d4a017);
        }
        .next-kicker {
          margin: 0 0 5px; color: #8debf5;
          font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase;
        }
        .next-title { margin: 0; color: #fff; font-family: var(--font-crimson),Georgia,serif; font-size: 26px; line-height: 1.05; }
        .next-ref { margin: 6px 0 0; color: #f0c674; font-size: 12px; font-weight: 800; letter-spacing: .03em; }
        .next-copy { max-width: 720px; margin: 7px 0 0; color: rgba(237,244,251,.70); font-size: 13px; line-height: 1.5; }
        .next-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; justify-content: flex-end; }
        .btn-primary, .btn-secondary {
          display: inline-flex; min-height: 40px; align-items: center; justify-content: center;
          gap: 7px; padding: 9px 14px; border-radius: 6px;
          font-size: 12px; font-weight: 850; text-decoration: none; cursor: pointer;
        }
        .btn-primary { border: 1px solid #cff9ff; background: #b9f3ff; color: #07111d; }
        .btn-secondary { border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.07); color: #fff; }
        button.btn-secondary { appearance: none; }
        .map-head { margin-bottom: 16px; }
        .map-title { margin: 0; color: #fff; font-family: var(--font-crimson),Georgia,serif; font-size: 24px; line-height: 1; }
        .map-copy { max-width: 720px; margin: 7px 0 0; color: rgba(237,244,251,.6); font-size: 12.5px; line-height: 1.5; }
        .km-view-bar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .km-view-toggle {
          position: relative; display: inline-grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          padding: 4px; border-radius: 999px;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14);
        }
        .km-view-thumb {
          display: none;
        }
        .km-view-btn {
          position: relative; z-index: 1; border: 0; background: transparent !important;
          min-width: 96px; padding: 8px 13px; border-radius: 999px; cursor: pointer;
          font: inherit; font-size: 12.5px; font-weight: 800; color: rgba(255,255,255,.62);
          transition: color .2s ease, box-shadow .2s ease;
        }
        .km-view-btn:not(.is-active) {
          background: transparent !important;
          box-shadow: none !important;
        }
        .km-view-btn.is-active,
        .km-view-btn[aria-selected="true"] {
          color: #fff !important; background: #0aa3a3 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,.3);
        }
        .km-testament-toggle {
          display: inline-flex; align-items: center; gap: 5px; padding: 4px;
          border-radius: 999px; background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.13);
        }
        .km-testament-pill,
        .km-testament-btn {
          min-width: 42px; border: 0; border-radius: 999px; padding: 8px 13px;
          font: inherit; font-size: 12.5px; font-weight: 850;
        }
        .km-testament-pill { display: inline-flex; justify-content: center; color: #06111f; background: #d6b857; }
        .km-testament-btn {
          cursor: pointer; color: rgba(255,255,255,.68); background: transparent;
        }
        .km-testament-btn:hover,
        .km-testament-btn:focus-visible { color: #fff; background: rgba(255,255,255,.09); }
        .km-coming-soon {
          margin: 0; padding: 7px 10px; border-radius: 999px;
          border: 1px solid rgba(255,207,92,.34);
          background: rgba(255,207,92,.10); color: #ffe08a;
          font-size: 12px; font-weight: 850; letter-spacing: .02em;
        }
        .km-motion-btn {
          display: inline-flex; align-items: center; gap: 8px;
          min-height: 36px; padding: 8px 13px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,.16);
          background: rgba(255,255,255,.075); color: rgba(255,255,255,.84);
          cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 850;
        }
        .km-motion-btn:hover,
        .km-motion-btn:focus-visible {
          color: #fff; background: rgba(255,255,255,.13); outline: none;
        }
        .km-motion-btn.is-paused {
          color: #06111f; background: #d6b857; border-color: rgba(255,223,128,.78);
        }
        .km-motion-btn.is-active {
          color: #06111f; background: #b9f3ff; border-color: rgba(207,249,255,.86);
        }
        .km-motion-icon {
          width: 15px; height: 15px; flex: 0 0 auto;
        }
        .km-view-copy { margin: 0; font-size: 12.5px; color: rgba(237,244,251,.56); max-width: 480px; }
        @media (max-width: 640px) {
          .km-view-bar { flex-direction: column; align-items: flex-start; gap: 8px; }
        }
        .loading, .error, .empty {
          display: grid; place-items: center; gap: 14px; min-height: 260px;
          padding: 24px; text-align: center;
          border: 1px solid rgba(255,255,255,.13); border-radius: 8px;
          color: rgba(237,244,251,.70); background: rgba(4,8,20,.44);
        }
        .state-line { margin: 0; max-width: 470px; line-height: 1.6; }
        .retry-btn {
          min-height: 44px; padding: 11px 22px; border-radius: 999px; cursor: pointer;
          font: 650 13.5px var(--font-inter), system-ui, sans-serif;
          color: #fff; background: rgba(255,255,255,.09); border: 1px solid rgba(255,255,255,.22);
          transition: background .15s;
        }
        .retry-btn:hover { background: rgba(255,255,255,.16); }
        .retry-btn:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
        @media (max-width: 760px) {
          .nav { padding: 12px 16px; }
          .nav-link:not(.active) { display: none; }
          .page { width: min(100% - 22px,620px); padding-top: 24px; }
          .page-head { grid-template-columns: 1fr; align-items: start; margin-bottom: 18px; }
          .summary { width: 100%; min-width: 0; }
          .next-band { grid-template-columns: 1fr; padding: 19px 18px 19px 23px; }
          .next-actions { justify-content: flex-start; }
        }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          *, *::before, *::after { transition: none !important; }
        }
      `}</style>

      <StarfieldBackground motionPaused={motionPaused} />

      <nav className="nav">
        <BrandLogo className="nav-brand" />
        <div className="nav-links">
          <Link className="nav-link" href="/">Dashboard</Link>
          <Link className="nav-link active" href="/knowledge-map">Knowledge Map</Link>
          <Link className="nav-link" href="/assess">Assess</Link>
          <Link className="nav-link" href="/about">About</Link>
          <Link className="nav-link" href="/bli">How BLI Works</Link>
          <Link className="nav-link" href="/credential">Future Ideas</Link>
        </div>
      </nav>

      <FocusTransition
        token={transition?.token ?? null}
        fromId={transition?.fromId ?? null}
        toId={transition?.toId ?? null}
        onDone={() => setTransition(null)}
      />

      <main className="page">
        {loadError ? (
          <div className="error" role="alert">
            <p className="state-line">{loadError}</p>
            <button type="button" className="retry-btn" onClick={() => setReloadToken((token) => token + 1)}>
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="loading" role="status" aria-live="polite">
            Finding your current focus...
          </div>
        ) : path.isEmpty && !hasMapStructure ? (
          <div className="empty" role="status">
            <p className="state-line">
              {userId
                ? "There is no map to show yet. Take an assessment to start filling in the Old Testament atlas."
                : "Sign in and take an assessment to see where your attention should go next."}
            </p>
            <Link className="retry-btn" href="/assess">
              {userId ? "Take an assessment" : "Get started"}
            </Link>
          </div>
        ) : (
          <>
            <div className="km-view-bar">
              <div className="km-view-toggle" role="tablist" aria-label="Map view">
                <button type="button" role="tab" aria-selected={mapView === "focus"} className={`km-view-btn ${mapView === "focus" ? "is-active" : ""}`} onClick={() => openMapView("focus")}>
                  Study view
                </button>
                <button type="button" role="tab" aria-selected={mapView === "overview"} className={`km-view-btn ${mapView === "overview" ? "is-active" : ""}`} onClick={() => openMapView("overview")}>
                  Atlas view
                </button>
              </div>
              <div className="km-testament-toggle" aria-label="Testament">
                <span className="km-testament-pill" aria-current="true">OT</span>
                <button type="button" className="km-testament-btn" onClick={() => setNtComingSoon(true)}>
                  NT
                </button>
              </div>
              <button
                type="button"
                className={`km-motion-btn ${motionPaused ? "is-paused" : ""}`}
                aria-pressed={motionPaused}
                onClick={() => setMotionPaused((paused) => !paused)}
              >
                {motionPaused ? (
                  <svg className="km-motion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 5v14l11-7-11-7z" />
                  </svg>
                ) : (
                  <svg className="km-motion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8 5v14" />
                    <path d="M16 5v14" />
                  </svg>
                )}
                {motionPaused ? "Start motion" : "Stop motion"}
              </button>
              {mapView === "focus" && (
                <button
                  type="button"
                  className={`km-motion-btn ${focusFullView ? "is-active" : ""}`}
                  aria-pressed={focusFullView}
                  onClick={() => setFocusFullView((full) => !full)}
                >
                  <svg className="km-motion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {focusFullView ? (
                      <>
                        <path d="M4 4h6v6" />
                        <path d="M20 20h-6v-6" />
                        <path d="M10 4 4 10" />
                        <path d="m14 20 6-6" />
                      </>
                    ) : (
                      <>
                        <path d="M9 3H3v6" />
                        <path d="M15 3h6v6" />
                        <path d="M21 15v6h-6" />
                        <path d="M3 15v6h6" />
                      </>
                    )}
                  </svg>
                  {focusFullView ? "Show outline" : "Full map"}
                </button>
              )}
              {ntComingSoon && (
                <p className="km-coming-soon" role="status" aria-live="polite">
                  NT coming soon
                </p>
              )}
              <p className="km-view-copy">
                {mapView === "focus"
                  ? focusFullView
                    ? "Map-only view. Show the outline again when you want the section list back."
                    : hasRecommendation
                      ? "Recommended passage, course outline, and map context together."
                      : "Blank course map. Take an assessment to fill in recommendations and scores."
                  : "Every section, book, and chapter section at once — chronology down, dependency across."}
              </p>
            </div>

            {mapView === "focus" ? (
              <section aria-label="Focus path star map">
                <FocusStarMap
                  path={path}
                  tree={tree}
                  focusTarget={focusTarget}
                  motionPaused={motionPaused}
                  fullView={focusFullView}
                  hasRecommendation={hasRecommendation}
                />
              </section>
            ) : (
              <section aria-label="Full Old Testament map">
                <MapOverview
                  tree={tree}
                  motionPaused={motionPaused}
                  onFocusView={(target) => {
                    setFocusTarget(target);
                    openMapView("focus");
                  }}
                />
              </section>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
