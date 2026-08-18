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
import Starfield from "@/components/Starfield";
import { KNOWLEDGE_MAP_PAGE_STYLES } from "./knowledgeMapPageStyles";

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
      <style>{KNOWLEDGE_MAP_PAGE_STYLES}</style>

      <Starfield variant="knowledgeMap" motionPaused={motionPaused} />

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
