"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BIBLE_BOOKS,
  chapterCountForBook,
  testamentForBook,
  type BibleBook,
} from "@/lib/bibleTaxonomy";
import {
  addReadingLogEntry,
  lastLoggedChapterForBook,
  loadReadingLog,
  persistReadingLogEntryRemote,
  type ReadingLogEntry,
} from "@/lib/readingLog";

/**
 * "What did I read?" — a self-directed companion to the recommendation
 * engine above it. Logging a passage never changes a score by itself.
 * There is no manual retest action here: the log itself is the signal.
 * Logged chapters are meant to feed the recommendation router so it can
 * plan retests from what a learner says they've read, rather than the
 * learner picking their own retest scope by hand. See lib/readingLog.ts
 * for the current (local-only) storage boundary that still needs to be
 * bridged to the backend for that to happen.
 *
 * The entry form starts open (not tucked behind a collapsed trigger) so the
 * "log a passage" affordance is obvious the moment this renders. The full
 * history no longer lives here — see /reading-log — so this widget's only
 * job is capturing a new entry quickly.
 */

type RangeMode = "full" | "custom";

function latestContinuableBook(log: ReadingLogEntry[]) {
  for (const entry of log) {
    const book = BIBLE_BOOKS.find(b => b.code === entry.bookCode);
    const count = chapterCountForBook(entry.bookCode);
    if (book && count !== null && entry.endChapter < count) {
      return { book, nextChapter: entry.endChapter + 1 };
    }
  }
  return null;
}

export default function ReadingLogWidget({
  userId = null,
  onLogged,
}: {
  userId?: string | null;
  /** Called after a new entry is saved locally — lets a parent (e.g. the
   *  /reading-log page, which embeds this widget above its own full list)
   *  update its own view without waiting on the best-effort remote mirror. */
  onLogged?: (entry: ReadingLogEntry) => void;
}) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [rangeMode, setRangeMode] = useState<RangeMode>("full");
  const [startInput, setStartInput] = useState("1");
  const [endInput, setEndInput] = useState("1");
  const [log, setLog] = useState<ReadingLogEntry[]>([]);
  const [justLogged, setJustLogged] = useState<ReadingLogEntry | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // localStorage is unavailable during SSR, so the log starts empty and is
  // filled in after mount — matching the same pattern used elsewhere on the
  // dashboard for other browser-only progress data (e.g. the NT pilot
  // summary), which avoids a hydration mismatch between server and client.
  useEffect(() => {
    // localStorage only exists client-side; this fills in the real log
    // post-hydration rather than mismatching the empty SSR render.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLog(loadReadingLog());
    } catch {
      setLog([]);
    }
  }, []);

  const chapterCount = selectedBook ? chapterCountForBook(selectedBook.code) : null;
  const lastChapter = selectedBook ? lastLoggedChapterForBook(selectedBook.code) : null;

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return BIBLE_BOOKS.filter(b => b.name.toLowerCase().includes(term)).slice(0, 6);
  }, [query]);

  const pickBook = (book: BibleBook) => {
    setSelectedBook(book);
    setQuery(book.name);
    const count = chapterCountForBook(book.code) ?? 1;
    setRangeMode("full");
    setStartInput("1");
    setEndInput(String(count));
  };

  const applyContinuableBook = (entry: { book: BibleBook; nextChapter: number }) => {
    setSelectedBook(entry.book);
    setQuery(entry.book.name);
    setRangeMode("custom");
    setStartInput(String(entry.nextChapter));
    setEndInput(String(entry.nextChapter));
  };

  const applyRangeMode = (mode: RangeMode) => {
    setRangeMode(mode);
    if (!selectedBook) return;
    const count = chapterCountForBook(selectedBook.code) ?? 1;
    if (mode === "full") {
      setStartInput("1");
      setEndInput(String(count));
    } else {
      const last = lastLoggedChapterForBook(selectedBook.code);
      const next = last ? Math.min(last + 1, count) : 1;
      setStartInput(String(next));
      setEndInput(String(next));
    }
  };

  const resetForm = () => {
    setSelectedBook(null);
    setQuery("");
    setRangeMode("full");
    setStartInput("1");
    setEndInput("1");
  };

  const start = Number(startInput);
  const end = Number(endInput);
  const isValidRange = Boolean(
    selectedBook
    && chapterCount
    && Number.isInteger(start) && Number.isInteger(end)
    && start >= 1 && end <= chapterCount && start <= end,
  );

  const handleLog = () => {
    if (!selectedBook || !isValidRange) return;
    const entry = addReadingLogEntry({
      bookCode: selectedBook.code,
      startChapter: start,
      endChapter: end,
    });
    setLog(loadReadingLog());
    setJustLogged(entry);
    resetForm();
    setOpen(false);
    // Best-effort mirror to the backend; the local log above is already the
    // source of truth for this widget and never waits on this.
    if (userId) void persistReadingLogEntryRemote(userId, entry);
    onLogged?.(entry);
  };

  const handleTriggerClick = () => {
    const willOpen = !open;
    setOpen(willOpen);
    setJustLogged(null);
    if (!willOpen) return;
    const continuable = latestContinuableBook(log);
    if (continuable) applyContinuableBook(continuable);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  return (
    <section className="reading-log" aria-label="Log your Bible reading">
      <style>{`
        .reading-log {
          margin-top: 16px; border: 1px solid rgba(255,255,255,.14); border-radius: 16px;
          background: rgba(255,255,255,.045);
        }
        /* Not overflow:hidden on the outer card — the book-search dropdown
           is absolutely positioned and needs to pop out past this edge, so
           the header's own corners are rounded to match by hand instead. */
        .rl-header { display: flex; align-items: stretch; }
        .rl-trigger {
          flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px;
          padding: 16px 18px; background: transparent; border: 0; cursor: pointer; text-align: left;
          color: #fff; font-family: inherit; border-radius: 16px 0 0 0;
        }
        .rl-trigger:hover { background: rgba(255,255,255,.04); }
        .rl-trigger-icon {
          flex-shrink: 0; width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: rgba(212,160,23,.14); border: 1px solid rgba(212,160,23,.34); color: #f0c674;
        }
        .rl-trigger-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .rl-trigger-title { display: block; font-size: 15px; line-height: 1.25; font-weight: 850; color: #fff; }
        .rl-trigger-sub { display: block; font-size: 13px; line-height: 1.35; color: rgba(255,255,255,.68); font-weight: 550; }
        .rl-trigger-chevron { color: rgba(255,255,255,.5); transition: transform .15s ease; flex-shrink: 0; }
        .rl-trigger[aria-expanded="true"] .rl-trigger-chevron { transform: rotate(180deg); }
        .rl-full-log-link {
          flex-shrink: 0; align-self: center; margin-right: 14px;
          display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px;
          border-radius: 999px; border: 1px solid rgba(255,255,255,.16);
          background: rgba(255,255,255,.05); color: rgba(255,255,255,.72);
          font-size: 12px; font-weight: 800; text-decoration: none; white-space: nowrap;
          transition: background .15s ease, color .15s ease, border-color .15s ease;
        }
        .rl-full-log-link:hover, .rl-full-log-link:focus-visible {
          background: rgba(255,255,255,.11); color: #fff; border-color: rgba(255,255,255,.3); outline: none;
        }
        .rl-full-log-link svg { width: 12px; height: 12px; }

        .rl-form { padding: 0 18px 18px; border-top: 1px solid rgba(255,255,255,.08); }
        .rl-field { margin-top: 16px; position: relative; }
        .rl-label { display: block; font-size: 12px; line-height: 1.2; font-weight: 850; letter-spacing: .055em; text-transform: uppercase; color: rgba(255,255,255,.62); margin-bottom: 9px; }
        /* Made deliberately bubble-shaped and higher-contrast than a plain
           text input — this is the field the whole widget now opens onto by
           default, so it should read as the obvious place to start typing. */
        .rl-search {
          width: 100%; padding: 14px 18px; border-radius: 999px; font-size: 15.5px; line-height: 1.3;
          background: rgba(255,255,255,.10); border: 1.5px solid rgba(255,255,255,.26); color: #fff;
          font-family: inherit; font-weight: 650;
          box-shadow: 0 6px 18px rgba(0,0,0,.16);
          transition: border-color .15s ease, background .15s ease;
        }
        .rl-search:hover { background: rgba(255,255,255,.12); }
        .rl-search:focus { outline: none; border-color: rgba(111,224,224,.75); background: rgba(255,255,255,.13); }
        .rl-search::placeholder { color: rgba(255,255,255,.42); }
        .rl-matches {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 10;
          background: rgba(11,15,30,.98); border: 1px solid rgba(255,255,255,.16); border-radius: 10px;
          overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,.5);
        }
        .rl-match {
          display: block; width: 100%; text-align: left; padding: 10px 12px; font-size: 14px; line-height: 1.25;
          background: transparent; border: 0; color: #fff; cursor: pointer; font-family: inherit; font-weight: 750;
        }
        .rl-match:hover, .rl-match:focus-visible { background: rgba(255,255,255,.08); outline: none; }
        .rl-match span { display: block; color: rgba(255,255,255,.58); font-size: 12px; font-weight: 600; margin-top: 3px; }

        .rl-range-modes { display: flex; flex-wrap: wrap; gap: 8px; }
        .rl-mode-btn {
          padding: 9px 14px; border-radius: 999px; font-size: 13px; line-height: 1.2; font-weight: 850;
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.14); color: rgba(255,255,255,.7);
          cursor: pointer; font-family: inherit;
        }
        .rl-mode-btn:disabled { opacity: .35; cursor: not-allowed; }
        .rl-mode-btn.on { background: rgba(10,163,163,.16); border-color: rgba(10,163,163,.4); color: #fff; }
        .rl-nt-note {
          margin-top: 10px; font-size: 11.5px; line-height: 1.5; color: rgba(255,255,255,.48);
        }

        .rl-chapters { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
        .rl-chapter-input {
          width: 70px; padding: 10px 11px; border-radius: 8px; font-size: 15px; line-height: 1.2; text-align: center;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16); color: #fff;
          font-family: inherit; font-weight: 700;
        }
        .rl-chapter-sep { color: rgba(255,255,255,.55); font-size: 13px; font-weight: 650; }
        .rl-chapter-hint { color: rgba(255,255,255,.58); font-size: 12.5px; line-height: 1.45; font-weight: 600; }

        .rl-submit-row { display: flex; align-items: center; gap: 12px; margin-top: 18px; }
        .rl-submit {
          padding: 11px 22px; border-radius: 999px; font-size: 13.5px; line-height: 1.2; font-weight: 850;
          background: #d4a017; color: #1b2442; border: 0; cursor: pointer; font-family: inherit;
        }
        .rl-submit:disabled { opacity: .4; cursor: not-allowed; }
        .rl-cancel {
          padding: 10px 14px; border-radius: 999px; font-size: 13px; line-height: 1.2; font-weight: 750;
          background: transparent; color: rgba(255,255,255,.68); border: 0; cursor: pointer; font-family: inherit;
        }
        .rl-cancel:hover { color: #fff; }

        .rl-bubble {
          margin: 0 18px 16px; padding: 14px 16px; border-radius: 12px;
          background: rgba(10,163,163,.1); border: 1px solid rgba(10,163,163,.32);
          display: flex; align-items: flex-start; gap: 12px;
        }
        .rl-bubble-body { flex: 1; min-width: 0; }
        .rl-bubble-title { font-size: 13.5px; font-weight: 700; color: #fff; }
        .rl-bubble-note { font-size: 12px; color: rgba(255,255,255,.6); margin-top: 4px; line-height: 1.5; }
        .rl-bubble-dismiss {
          flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center;
          justify-content: center; background: rgba(255,255,255,.08); border: 0; color: rgba(255,255,255,.7);
          cursor: pointer;
        }
        .rl-bubble-dismiss:hover { background: rgba(255,255,255,.16); color: #fff; }

        @media (max-width: 640px) {
          /* These sat at ~31px and 26px — fine with a cursor, tight for a thumb. */
          .rl-full-log-link { min-height: 44px; font-size: 13px; padding: 7px 15px; }
          .rl-bubble-dismiss { width: 32px; height: 32px; }
          .rl-match span { font-size: 12.5px; }
        }
      `}</style>

      <div className="rl-header">
      <button
        type="button"
        className="rl-trigger"
        aria-expanded={open}
        aria-controls="reading-log-form"
        onClick={handleTriggerClick}
      >
        <span className="rl-trigger-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </span>
        <span className="rl-trigger-copy">
          <span className="rl-trigger-title">Reading Log</span>
          <span className="rl-trigger-sub">Log a passage to keep track of what you&rsquo;ve read.</span>
        </span>
        <svg className="rl-trigger-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <Link className="rl-full-log-link" href="/reading-log">
        View full log
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
        </svg>
      </Link>
      </div>

      {open && (
        <div className="rl-form" id="reading-log-form">
          <div className="rl-field">
            <label className="rl-label" htmlFor="reading-log-search">Book</label>
            <input
              id="reading-log-search"
              ref={searchRef}
              className="rl-search"
              type="text"
              placeholder="Start typing a book name…"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setSelectedBook(null);
              }}
              autoComplete="off"
            />
            {matches.length > 0 && !selectedBook && (
              <div className="rl-matches" role="listbox">
                {matches.map(book => (
                  <button key={book.code} type="button" className="rl-match" onClick={() => pickBook(book)}>
                    {book.name}
                    <span>{book.testament === "OT" ? "Old Testament" : "New Testament"} · {book.section}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedBook && chapterCount && (
            <>
              <div className="rl-field">
                <label className="rl-label">How much?</label>
                <div className="rl-range-modes" role="group" aria-label="Reading range">
                  <button type="button" className={`rl-mode-btn${rangeMode === "full" ? " on" : ""}`} onClick={() => applyRangeMode("full")}>
                    Full book
                  </button>
                  <button type="button" className={`rl-mode-btn${rangeMode === "custom" ? " on" : ""}`} onClick={() => applyRangeMode("custom")}>
                    Choose chapters
                  </button>
                </div>
                {testamentForBook(selectedBook.code) === "NT" && (
                  <p className="rl-nt-note">
                    Chapter-level retest planning isn&rsquo;t available for the New Testament yet, so any future retest
                    built from this log will cover all of {selectedBook.name} — the reading itself is still logged
                    exactly as you enter it.
                  </p>
                )}
              </div>

              {rangeMode === "custom" && (
                <div className="rl-field">
                  <label className="rl-label">Chapters</label>
                  <div className="rl-chapters">
                    <input
                      className="rl-chapter-input" type="number" min={1} max={chapterCount}
                      value={startInput} onChange={e => setStartInput(e.target.value)}
                      aria-label="Start chapter"
                    />
                    <span className="rl-chapter-sep">to</span>
                    <input
                      className="rl-chapter-input" type="number" min={1} max={chapterCount}
                      value={endInput} onChange={e => setEndInput(e.target.value)}
                      aria-label="End chapter"
                    />
                    <span className="rl-chapter-hint">of {chapterCount}</span>
                  </div>
                  {lastChapter !== null && lastChapter < chapterCount && startInput === String(lastChapter + 1) && (
                    <p className="rl-chapter-hint">
                      Continuing {selectedBook.name} from chapter {lastChapter + 1}.
                    </p>
                  )}
                </div>
              )}

              <div className="rl-submit-row">
                <button type="button" className="rl-submit" disabled={!isValidRange} onClick={handleLog}>
                  Log this reading
                </button>
                <button type="button" className="rl-cancel" onClick={() => { resetForm(); setOpen(false); }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {justLogged && (() => {
        const book = BIBLE_BOOKS.find(b => b.code === justLogged.bookCode);
        const chapterCountJL = chapterCountForBook(justLogged.bookCode);
        const isFull = chapterCountJL !== null && justLogged.startChapter === 1 && justLogged.endChapter === chapterCountJL;
        return (
          <div className="rl-bubble" role="status">
            <div className="rl-bubble-body">
              <div className="rl-bubble-title">
                Logged {book?.name ?? justLogged.bookCode}{isFull ? "" : ` ${justLogged.startChapter}-${justLogged.endChapter}`}
              </div>
              <p className="rl-bubble-note">
                This doesn&rsquo;t change your score — only answering questions does.
              </p>
            </div>
            <button type="button" className="rl-bubble-dismiss" aria-label="Dismiss" onClick={() => setJustLogged(null)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        );
      })()}

    </section>
  );
}
