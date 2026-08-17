// A self-directed reading log: "what did I read". localStorage remains the
// source of truth for the widget's own UI (works signed-out and offline);
// see persistReadingLogEntryRemote below for the best-effort mirror to
// Supabase.
//
// This is deliberately NOT a knowledge input on its own. Logging a passage
// never changes a score by itself — the BLI measures what testing shows you
// know, not what you say you read. See docs on the About/BLI pages for the
// same argument made to users.
//
// There is no manual retest UI here anymore. The remote copy
// (public.obs_reading_log_entries) exists so the recommendation router can
// eventually plan retests from what a learner says they've read, rather
// than the learner picking a retest scope by hand — but the router
// (obs_get_user_recommendation_v2) does not read this table yet. That's a
// deliberately separate follow-up, reviewed and shadow-tested on its own,
// the same way other router changes in this codebase are.

import { supabase } from "@/lib/supabase/client";

export type ReadingLogEntry = {
  id: string;
  bookCode: string;
  startChapter: number;
  endChapter: number;
  loggedAt: string; // ISO timestamp
};

const STORAGE_KEY = "obs_reading_log";
const MAX_ENTRIES = 50;

function readRaw(): ReadingLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is ReadingLogEntry => (
      entry
      && typeof entry.id === "string"
      && typeof entry.bookCode === "string"
      && typeof entry.startChapter === "number"
      && typeof entry.endChapter === "number"
      && typeof entry.loggedAt === "string"
    ));
  } catch {
    return [];
  }
}

/** Newest first. */
export function loadReadingLog(): ReadingLogEntry[] {
  return [...readRaw()].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

export function addReadingLogEntry(input: {
  bookCode: string;
  startChapter: number;
  endChapter: number;
}): ReadingLogEntry {
  const entry: ReadingLogEntry = {
    id: globalThis.crypto.randomUUID(),
    bookCode: input.bookCode.toUpperCase(),
    startChapter: input.startChapter,
    endChapter: input.endChapter,
    loggedAt: new Date().toISOString(),
  };
  const next = [entry, ...readRaw()].slice(0, MAX_ENTRIES);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return entry;
}

/**
 * Where a reader last left off in a book, derived from their own log rather
 * than a separately-tracked "position" — the most recent entry's end
 * chapter *is* the position. Returns null if nothing is logged for this
 * book yet, so callers can start manual chapter selection at chapter 1.
 */
export function lastLoggedChapterForBook(bookCode: string): number | null {
  const entries = readRaw().filter(e => e.bookCode === bookCode.toUpperCase());
  if (entries.length === 0) return null;
  const latest = entries.reduce((a, b) => (a.loggedAt > b.loggedAt ? a : b));
  return latest.endChapter;
}

type ReadingLogEntryRow = {
  id: string;
  book_code: string;
  start_chapter: number;
  end_chapter: number;
  logged_at: string;
};

/**
 * The full log from `public.obs_reading_log_entries` — the dedicated
 * /reading-log page's source of truth for signed-in users, since it's the
 * cross-device history rather than one browser's localStorage. RLS already
 * restricts reads to the caller's own rows; the explicit `user_id` filter
 * here is just belt-and-suspenders, not the only thing enforcing it.
 */
export async function loadReadingLogRemote(userId: string): Promise<ReadingLogEntry[]> {
  const { data, error } = await supabase
    .from("obs_reading_log_entries")
    .select("id, book_code, start_chapter, end_chapter, logged_at")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false });
  if (error) {
    console.warn("Reading log could not be loaded from the backend:", error);
    return [];
  }
  return ((data ?? []) as ReadingLogEntryRow[]).map((row) => ({
    id: row.id,
    bookCode: row.book_code,
    startChapter: row.start_chapter,
    endChapter: row.end_chapter,
    loggedAt: row.logged_at,
  }));
}

/**
 * Best-effort mirror of a just-logged entry to `public.obs_reading_log_entries`.
 * Fire-and-forget from the caller's point of view: the local entry is
 * already saved and already drives the widget's own UI by the time this is
 * called, so a failure here (signed out, offline, RLS mismatch) is logged
 * and swallowed rather than surfaced — the reading log itself never fails
 * because the backend mirror did. There is no retry queue; a dropped mirror
 * just means that one entry is missing from the router's future input, not
 * that anything the learner sees is wrong.
 */
export async function persistReadingLogEntryRemote(userId: string, entry: ReadingLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from("obs_reading_log_entries").insert({
      user_id: userId,
      book_code: entry.bookCode,
      start_chapter: entry.startChapter,
      end_chapter: entry.endChapter,
      logged_at: entry.loggedAt,
    });
    if (error) console.warn("Reading log entry was not mirrored to the backend:", error);
  } catch (err) {
    console.warn("Reading log entry was not mirrored to the backend:", err);
  }
}
