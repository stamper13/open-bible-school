"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import SiteFooter from "@/components/SiteFooter";
import { BIBLE_BOOKS, chapterCountForBook } from "@/lib/bibleTaxonomy";
import {
  loadReadingLog,
  loadReadingLogRemote,
  type ReadingLogEntry,
} from "@/lib/readingLog";
import { supabase } from "@/lib/supabase/client";
import ReadingLogWidget from "../ReadingLogWidget";

/**
 * The full reading history that no longer fits (or belongs) inline on the
 * dashboard widget, which now only captures a new entry. Signed-in users get
 * the server copy (public.obs_reading_log_entries — cross-device); signed-
 * out users, or a failed fetch, fall back to this browser's localStorage log
 * rather than a dead end.
 */

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function groupByDay(entries: ReadingLogEntry[]): { label: string; entries: ReadingLogEntry[] }[] {
  const groups: { label: string; entries: ReadingLogEntry[] }[] = [];
  for (const entry of entries) {
    const label = dayLabel(entry.loggedAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.entries.push(entry);
    } else {
      groups.push({ label, entries: [entry] });
    }
  }
  return groups;
}

export default function ReadingLogPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ReadingLogEntry[]>([]);
  const [source, setSource] = useState<"remote" | "local" | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const { data } = await supabase.auth.getSession();
        const id = data.session?.user?.id ?? null;
        if (cancelled) return;
        setUserId(id);

        if (id) {
          const remote = await loadReadingLogRemote(id);
          if (cancelled) return;
          setEntries(remote);
          setSource("remote");
        } else {
          setEntries(loadReadingLog());
          setSource("local");
        }
      } catch (error) {
        console.error("Reading log load failed:", error);
        if (cancelled) return;
        // A failed fetch still has this device's own log to fall back on —
        // showing that beats a dead end.
        setEntries(loadReadingLog());
        setSource("local");
        setLoadError("Your synced history couldn't be loaded right now — showing what's on this device instead.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const groups = useMemo(() => groupByDay(entries), [entries]);
  const bookCount = useMemo(() => new Set(entries.map(e => e.bookCode)).size, [entries]);

  return (
    <>
      <style>{`
        :root {
          --navy: #1b2442;
          --muted: #596477;
          --accent: #0aa3a3;
        }
        *, *::before, *::after { box-sizing: border-box; }
        html { background: #060a14; }
        body {
          margin: 0; min-height: 100vh; color: #edf4fb;
          font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
          background:
            radial-gradient(ellipse at 18% 6%, rgba(36,80,120,.30), transparent 52%),
            radial-gradient(ellipse at 86% 24%, rgba(88,52,150,.24), transparent 50%),
            radial-gradient(ellipse at 60% 100%, rgba(10,90,90,.22), transparent 54%),
            linear-gradient(180deg,#070b16 0%,#0a1122 50%,#060a16 100%);
        }
        button, a { font: inherit; }
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

        .page { width: min(760px, calc(100% - 48px)); margin: 0 auto; padding: 40px 0 80px; }
        .eyebrow {
          margin: 0 0 6px; color: #7de5e5;
          font-size: 11px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase;
        }
        .title {
          margin: 0; color: #fff;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(30px, 4vw, 42px); line-height: 1;
        }
        .subtitle {
          max-width: 560px; margin: 10px 0 0;
          color: rgba(237,244,251,.68); font-size: 13.5px; line-height: 1.55;
        }
        .summary-row {
          display: flex; flex-wrap: wrap; gap: 18px;
          margin: 22px 0 26px; padding: 16px 20px;
          border: 1px solid rgba(255,255,255,.12); border-radius: 12px;
          background: rgba(255,255,255,.04);
        }
        .summary-stat strong {
          display: block; color: #fff; font-family: var(--font-crimson), Georgia, serif;
          font-size: 22px; line-height: 1;
        }
        .summary-stat span {
          display: block; margin-top: 4px; color: rgba(237,244,251,.55);
          font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase;
        }
        .source-note {
          margin: -12px 0 26px; font-size: 12px; line-height: 1.5; color: rgba(237,244,251,.5);
        }
        .source-note strong { color: rgba(237,244,251,.72); }
        .error-note {
          margin: -12px 0 26px; padding: 10px 14px; border-radius: 8px;
          border: 1px solid rgba(255,207,92,.32); background: rgba(255,207,92,.08);
          color: #ffe08a; font-size: 12.5px; line-height: 1.5;
        }

        .day-group { margin-bottom: 28px; }
        .day-label {
          margin: 0 0 10px; color: rgba(237,244,251,.5);
          font-size: 11px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase;
        }
        .entry-row {
          display: flex; align-items: center; justify-content: space-between; gap: 14px;
          padding: 13px 4px; border-top: 1px solid rgba(255,255,255,.07);
        }
        .day-group .entry-row:first-of-type { border-top: none; }
        .entry-main { min-width: 0; }
        .entry-ref {
          margin: 0; color: #fff; font-family: var(--font-crimson), Georgia, serif;
          font-size: 17px; font-weight: 650; line-height: 1.2;
        }
        .entry-time { flex-shrink: 0; color: rgba(237,244,251,.48); font-size: 11.5px; font-weight: 700; white-space: nowrap; }

        .loading, .empty, .error {
          display: grid; place-items: center; gap: 14px; min-height: 200px;
          padding: 24px; text-align: center;
          border: 1px solid rgba(255,255,255,.13); border-radius: 10px;
          color: rgba(237,244,251,.70); background: rgba(4,8,20,.44);
        }
        .state-line { margin: 0; max-width: 440px; line-height: 1.6; }
        .retry-btn {
          min-height: 40px; padding: 10px 20px; border-radius: 999px; cursor: pointer;
          font: 650 13px var(--font-inter), system-ui, sans-serif;
          color: #fff; background: rgba(255,255,255,.09); border: 1px solid rgba(255,255,255,.22);
        }
        .retry-btn:hover { background: rgba(255,255,255,.16); }

        @media (max-width: 640px) {
          .nav { padding: 12px 16px; }
          .nav-link:not(.active) { display: none; }
          .page { width: min(100% - 22px, 620px); padding-top: 26px; }
        }
      `}</style>

      <nav className="nav">
        <BrandLogo className="nav-brand" />
        <div className="nav-links">
          <Link className="nav-link" href="/">Dashboard</Link>
          <Link className="nav-link" href="/knowledge-map">Knowledge Map</Link>
          <Link className="nav-link" href="/assess">Assess</Link>
          <Link className="nav-link active" href="/reading-log">Reading Log</Link>
        </div>
      </nav>

      <main className="page">
        <p className="eyebrow">What you&rsquo;ve read</p>
        <h1 className="title">Reading Log</h1>
        <p className="subtitle">
          When you log your reading, it helps the assessment page know when you&rsquo;re ready
          to retest your knowledge on a section of Scripture.
        </p>

        <ReadingLogWidget
          userId={userId}
          onLogged={(entry) => setEntries(prev => [entry, ...prev])}
        />

        {!loading && entries.length > 0 && (
          <div className="summary-row" aria-label="Reading log totals">
            <div className="summary-stat"><strong>{entries.length}</strong><span>Entries</span></div>
            <div className="summary-stat"><strong>{bookCount}</strong><span>Books</span></div>
          </div>
        )}

        {!loading && source === "local" && !loadError && (
          <p className="source-note">
            {userId
              ? <>Showing <strong>this device&rsquo;s</strong> log.</>
              : <>Showing <strong>this device&rsquo;s</strong> log — sign in to sync it across devices.</>}
          </p>
        )}
        {loadError && <p className="error-note">{loadError}</p>}

        {loading ? (
          <div className="loading" role="status" aria-live="polite">
            Loading your reading log…
          </div>
        ) : entries.length === 0 ? (
          <div className="empty" role="status">
            <p className="state-line">Nothing logged yet. Use the form above to log your first passage.</p>
          </div>
        ) : (
          groups.map(group => (
            <div className="day-group" key={group.label}>
              <p className="day-label">{group.label}</p>
              {group.entries.map(entry => {
                const book = BIBLE_BOOKS.find(b => b.code === entry.bookCode);
                const count = chapterCountForBook(entry.bookCode);
                const isFull = count !== null && entry.startChapter === 1 && entry.endChapter === count;
                return (
                  <div className="entry-row" key={entry.id}>
                    <div className="entry-main">
                      <p className="entry-ref">
                        {book?.name ?? entry.bookCode}{isFull ? "" : ` ${entry.startChapter}-${entry.endChapter}`}
                      </p>
                    </div>
                    <span className="entry-time">{timeLabel(entry.loggedAt)}</span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </main>
      <SiteFooter />
    </>
  );
}
