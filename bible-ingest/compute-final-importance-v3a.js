/**
 * compute-final-importance-v3a.js
 *
 * Computes FINAL v3 importance for ALL sections using:
 * - Base metrics from section_metrics model_version=1 (space_score, structural_score, genre_*).
 * - Incoming OpenBible crossref votes mapped to sections via verses.
 * - Genre weighting revised per your guidance:
 *   - Narrative + Instruction weighted highest
 *   - Argument moderate
 *   - Poetry downweighted
 *   - List (name/place lists) strongly downweighted
 *
 * Writes results back to section_metrics as model_version=3:
 * - nt_reuse_score, ot_reuse_score (0-100 each)
 * - importance_score (0-100)
 *
 * Requirements:
 * - section_metrics exists with model_version=1 rows for all sections
 * - verses table exists with (book_code, chapter, verse, section_id)
 * - openbible_crossrefs_parsed exists with:
 *   to_book_code, to_ch_start, to_vs_start, to_ch_end, to_vs_end, votes, from_is_nt, from_is_ot
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const MODEL_VERSION_BASE = 1;
const MODEL_VERSION_OUT = 3;

// Pagination sizes (safe, not huge)
const PAGE_SIZE = 5000;
const UPSERT_BATCH = 500;

// Revised genre weights (sum does NOT need to be 1.0)
const GENRE_WEIGHTS = {
  narrative: 1.00,
  instruction: 1.00,
  argument: 0.70,
  poetry: 0.30,
  list: 0.15
};

// Utility
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function log1p(x) {
  return Math.log(1 + Math.max(0, x));
}
function safeInt(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

// percentile on numeric array
function percentile(arr, p) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const idx = (a.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return a[lo];
  const w = idx - lo;
  return a[lo] * (1 - w) + a[hi] * w;
}

async function fetchAll(table, select, orderCol = 'id') {
  let all = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderCol, { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

/**
 * Build a lookup:
 *   verseKey = `${BOOK}|${CH}|${VS}` -> section_id
 * Also count verse_count per section_id.
 */
function buildVerseMaps(verses) {
  const verseToSection = new Map();
  const sectionVerseCount = new Map();

  for (const v of verses) {
    const book = v.book_code;
    const ch = v.chapter;
    const vs = v.verse;
    const sid = v.section_id;

    if (!book || !ch || !vs || !sid) continue;

    const key = `${book}|${ch}|${vs}`;
    verseToSection.set(key, sid);

    sectionVerseCount.set(sid, (sectionVerseCount.get(sid) || 0) + 1);
  }

  return { verseToSection, sectionVerseCount };
}

/**
 * Apply a crossref row to all verses in its target range.
 * Range usually small; we iterate chapter/verse naïvely.
 */
function applyCrossrefToSections(row, verseToSection, accumNtVotes, accumOtVotes) {
  const book = row.to_book_code;
  const chStart = safeInt(row.to_ch_start);
  const vsStart = safeInt(row.to_vs_start);
  const chEnd = safeInt(row.to_ch_end ?? row.to_ch_start);
  const vsEnd = safeInt(row.to_vs_end ?? row.to_vs_start);
  const votes = safeInt(row.votes, 0);

  if (!book || !chStart || !vsStart) return;
  if (votes === 0) return;

  const isFromNT = !!row.from_is_nt;
  const isFromOT = !!row.from_is_ot;

  // normalize ordering if needed
  let c1 = chStart, v1 = vsStart, c2 = chEnd, v2 = vsEnd;
  if (c2 < c1 || (c2 === c1 && v2 < v1)) {
    c1 = chEnd; v1 = vsEnd;
    c2 = chStart; v2 = vsStart;
  }

  // iterate
  for (let ch = c1; ch <= c2; ch++) {
    const vMin = (ch === c1) ? v1 : 1;
    const vMax = (ch === c2) ? v2 : 200; // hard cap; verses rarely exceed this
    for (let vs = vMin; vs <= vMax; vs++) {
      const key = `${book}|${ch}|${vs}`;
      const sid = verseToSection.get(key);
      if (!sid) continue;

      if (isFromNT) accumNtVotes.set(sid, (accumNtVotes.get(sid) || 0) + votes);
      if (isFromOT) accumOtVotes.set(sid, (accumOtVotes.get(sid) || 0) + votes);
    }
  }
}

/**
 * Convert vote sums to 0–100 scores using:
 * - density = votes_sum / verse_count
 * - log1p(density) scaled by p95
 */
function scoreReuse(density, p95Log) {
  if (p95Log <= 0) return 0;
  const s = (log1p(density) / p95Log) * 100;
  return clamp(Math.round(s), 0, 100);
}

/**
 * Genre score:
 * Take the section’s 0–100 genre distribution (integers),
 * apply weights, normalize to 0–100-ish range.
 *
 * We do NOT try to be “perfect”; we just want a stable signal.
 */
function scoreGenre(row) {
  const n = safeInt(row.genre_narrative);
  const i = safeInt(row.genre_instruction);
  const a = safeInt(row.genre_argument);
  const p = safeInt(row.genre_poetry);
  const l = safeInt(row.genre_list);

  // weighted sum (0..100 scale-ish)
  const weighted =
    n * GENRE_WEIGHTS.narrative +
    i * GENRE_WEIGHTS.instruction +
    a * GENRE_WEIGHTS.argument +
    p * GENRE_WEIGHTS.poetry +
    l * GENRE_WEIGHTS.list;

  // The theoretical max is 100 * maxWeight = 100 * 1.0 here.
  // Still, keep it clamped.
  return clamp(Math.round(weighted), 0, 100);
}

/**
 * Final importance:
 * Keep it simple and “few markers” as you requested:
 *
 * importance_raw =
 *   0.40 * space_score +
 *   0.30 * structural_score +
 *   0.20 * genre_score +
 *   0.10 * nt_reuse_score +
 *   0.00 * ot_reuse_score   (OT reuse kept stored, but not driving importance yet)
 *
 * Rationale:
 * - Your current focus is OT prioritization; OT-to-OT reuse is useful but can over-dominate (law/ritual loops).
 * - NT reuse is the “canonical spotlight” signal you explicitly want kept active.
 *
 * You can later move OT reuse into the importance formula once OT ordering looks sane.
 */
function computeImportance(space, structural, genre, ntReuse /*, otReuse */) {
  const raw =
    0.40 * space +
    0.30 * structural +
    0.20 * genre +
    0.10 * ntReuse;

  return clamp(Math.round(raw), 0, 100);
}

async function clearV3Rows() {
  // Clear existing v3 rows to avoid mixed duplicates
  const { error } = await supabase
    .from('section_metrics')
    .delete()
    .eq('model_version', MODEL_VERSION_OUT);

  if (error) throw error;
}

async function upsertBatched(rows) {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase
      .from('section_metrics')
      .upsert(batch, { onConflict: 'section_id,model_version' });

    if (error) throw error;
  }
}

async function main() {
  console.log(`Compute FINAL importance v3a (model_version=${MODEL_VERSION_OUT})`);
  console.log('Loading base section_metrics (model_version=1)…');

  const base = await fetchAll(
    'section_metrics',
    'section_id,book_code,testament,ot_division,nt_division,space_score,structural_score,genre_narrative,genre_instruction,genre_argument,genre_poetry,genre_list',
    'section_id'
  );

  const baseRows = base.filter(r => safeInt(r.model_version, MODEL_VERSION_BASE) !== MODEL_VERSION_OUT); // harmless

  // Actually filter by model_version=1 via server-side to avoid confusion
  // (Some Supabase clients can’t filter inside fetchAll without keyset. So do a separate fetch.)
  const baseV1 = [];
  let from = 0;
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('section_metrics')
      .select('section_id,book_code,testament,ot_division,nt_division,space_score,structural_score,genre_narrative,genre_instruction,genre_argument,genre_poetry,genre_list,model_version')
      .eq('model_version', MODEL_VERSION_BASE)
      .order('section_id', { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;
    baseV1.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log('Loaded v1 rows:', baseV1.length);

  console.log('Loading verses (book_code, chapter, verse, section_id)…');
  const verses = await fetchAll('verses', 'book_code,chapter,verse,section_id', 'id');
  console.log('Loaded verses:', verses.length);

  console.log('Loading parsed crossrefs (OpenBible)…');
  // Only fields we need
  const crossrefs = await fetchAll(
    'openbible_crossrefs_parsed',
    'to_book_code,to_ch_start,to_vs_start,to_ch_end,to_vs_end,votes,from_is_nt,from_is_ot',
    'id'
  );
  console.log('Loaded crossrefs:', crossrefs.length);

  console.log('Building verse lookup maps…');
  const { verseToSection, sectionVerseCount } = buildVerseMaps(verses);

  console.log('Accumulating incoming vote sums per section…');
  const ntVotesBySection = new Map();
  const otVotesBySection = new Map();

  let processed = 0;
  for (const row of crossrefs) {
    applyCrossrefToSections(row, verseToSection, ntVotesBySection, otVotesBySection);
    processed++;
    if (processed % 50000 === 0) console.log(`  processed crossrefs: ${processed}`);
  }

  console.log('Computing p95 caps for log1p(density)…');
  const ntLogVals = [];
  const otLogVals = [];

  for (const r of baseV1) {
    const sid = r.section_id;
    const vcount = sectionVerseCount.get(sid) || 0;
    const ntSum = ntVotesBySection.get(sid) || 0;
    const otSum = otVotesBySection.get(sid) || 0;

    const ntDensity = vcount > 0 ? ntSum / vcount : 0;
    const otDensity = vcount > 0 ? otSum / vcount : 0;

    ntLogVals.push(log1p(ntDensity));
    otLogVals.push(log1p(otDensity));
  }

  const p95Nt = percentile(ntLogVals, 0.95);
  const p95Ot = percentile(otLogVals, 0.95);

  console.log(`P95 log1p(nt_density)=${p95Nt.toFixed(6)} | P95 log1p(ot_density)=${p95Ot.toFixed(6)}`);

  console.log('Clearing existing v3 rows…');
  await clearV3Rows();

  console.log('Computing and upserting v3 rows…');
  const out = [];
  let n = 0;

  for (const r of baseV1) {
    const sectionId = r.section_id;
    const bookCode = r.book_code;

    // Hard guard: avoid the exact failure you saw
    if (!sectionId || !bookCode) continue;

    const vcount = sectionVerseCount.get(sectionId) || 0;
    const ntSum = ntVotesBySection.get(sectionId) || 0;
    const otSum = otVotesBySection.get(sectionId) || 0;

    const ntDensity = vcount > 0 ? ntSum / vcount : 0;
    const otDensity = vcount > 0 ? otSum / vcount : 0;

    const ntReuse = scoreReuse(ntDensity, p95Nt);
    const otReuse = scoreReuse(otDensity, p95Ot);

    const space = clamp(safeInt(r.space_score, 0), 0, 100);
    const structural = clamp(safeInt(r.structural_score, 0), 0, 100);
    const genre = scoreGenre(r);

    const importance = computeImportance(space, structural, genre, ntReuse);

    out.push({
      section_id: sectionId,
      book_code: bookCode,
      testament: r.testament,
      ot_division: r.ot_division,
      nt_division: r.nt_division,
      model_version: MODEL_VERSION_OUT,
      space_score: space,
      structural_score: structural,
      nt_reuse_score: ntReuse,
      ot_reuse_score: otReuse,
      genre_narrative: safeInt(r.genre_narrative, 0),
      genre_instruction: safeInt(r.genre_instruction, 0),
      genre_argument: safeInt(r.genre_argument, 0),
      genre_poetry: safeInt(r.genre_poetry, 0),
      genre_list: safeInt(r.genre_list, 0),
      importance_score: importance,
      dispute_risk: 'low',
      is_genre_overridden: false,
      is_dispute_overridden: false,
      notes: null
    });

    n++;
    if (out.length >= UPSERT_BATCH) {
      await upsertBatched(out.splice(0, out.length));
      if (n % 1000 === 0) console.log(`  wrote rows: ${n}`);
    }
  }

  if (out.length) {
    await upsertBatched(out);
  }

  console.log('DONE. Wrote v3 rows:', n);
  console.log('Note: sections missing book_code were skipped (should be zero).');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
