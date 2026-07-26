// compute-section-metrics-v3.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing Supabase credentials');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const MODEL_VERSION = 3;

// ---------- helpers ----------
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a,b)=>a-b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function wordsOf(text) {
  if (!text) return [];
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function countRegex(text, re) {
  if (!text) return 0;
  const m = text.match(re);
  return m ? m.length : 0;
}

const STOP_CAPS = new Set([
  'The','And','But','For','In','To','Now','He','She','It','I','You','We','They','A','An','Of','On','At','As','With','From','By','Is','Are','Was','Were'
]);

function approxProperNounRatio(words) {
  // crude but works as a roster signal when aggregated
  if (!words.length) return 0;
  let caps = 0;
  for (const w of words) {
    const clean = w.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
    if (!clean) continue;
    if (STOP_CAPS.has(clean)) continue;
    if (clean[0] === clean[0].toUpperCase() && clean.slice(1) !== clean.slice(1).toUpperCase()) {
      caps++;
    }
  }
  return caps / words.length;
}

// Book priors (lean, only to stabilize poetry/oracle split)
const WISDOM_POETRY_BOOKS = new Set(['PSA','PRO','ECC','SNG','JOB','LAM']);
const PROPHET_BOOKS = new Set([
  'ISA','JER','EZK','DAN',
  'HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL'
]);

// Cue regexes
const RE_ROSTER = /\b(son of|sons of|begat|father of|descendants of|genealogy|these are the generations of)\b/gi;
const RE_INSTRUCTION = /\b(shall|must|do not|don’t|don't|you shall|you must|command|commands|statute|statutes|ordinance|ordinances|law|laws|keep|observe|remember)\b/gi;
const RE_CONDITIONAL = /\b(if|when)\b/gi;
const RE_NARRATIVE = /\b(said|went|came|took|made|sent|brought|gave|saw|heard|killed|slew|arose|entered|departed|built|dwelt)\b/gi;
const RE_ARGUMENT = /\b(therefore|because|for this reason|so that|lest|since|thus)\b/gi;

const RE_ORACLE = /\b(thus says the LORD|declares the LORD|says the LORD|oracle|woe to|hear\b|behold\b|therefore thus|in that day|day of the LORD)\b/gi;
const RE_WISDOM = /\b(blessed is|better is|my son|wisdom|fool|upright|righteous|wicked|fear of the LORD)\b/gi;

function verseSignals(bookCode, text) {
  const w = wordsOf(text);
  const wc = w.length;

  const properRatio = approxProperNounRatio(w);

  const rosterHits = countRegex(text, RE_ROSTER);
  const instructionHits = countRegex(text, RE_INSTRUCTION);
  const conditionalHits = countRegex(text, RE_CONDITIONAL);
  const narrativeHits = countRegex(text, RE_NARRATIVE);
  const argumentHits = countRegex(text, RE_ARGUMENT);

  const oracleHits = countRegex(text, RE_ORACLE);
  const wisdomHits = countRegex(text, RE_WISDOM);

  // raw contributions (lean; we normalize later)
  // roster signal: roster cues + lots of proper nouns (names)
  const rosterRaw = (rosterHits * 4) + (properRatio * 4) + (text.includes(';') ? 0.5 : 0) + (text.includes(',') ? 0.5 : 0);

  // list-ish formatting
  const listiness = (text.split(',').length - 1) * 0.15 + (text.split(';').length - 1) * 0.25;

  // instruction: imperatives / legal tone + conditionals
  const instructionRaw = (instructionHits * 1.2) + (conditionalHits * 0.5);

  // narrative: action verbs
  const narrativeRaw = (narrativeHits * 1.0);

  // argument: therefore/because/logic connectors
  const argumentRaw = (argumentHits * 1.0);

  // poetry oracle vs wisdom: cues + book priors (small)
  let poetryOracleRaw = oracleHits * 1.5;
  let poetryWisdomRaw = wisdomHits * 1.2;

  if (PROPHET_BOOKS.has(bookCode)) poetryOracleRaw += 0.6;
  if (WISDOM_POETRY_BOOKS.has(bookCode)) poetryWisdomRaw += 0.6;

  // List split: roster list vs instructional list
  const listRosterRaw = rosterRaw * 0.9 + listiness * 0.6;
  const listInstructionRaw = (instructionRaw * 0.7 + listiness * 0.4) * (rosterRaw > 1.2 ? 0.3 : 1.0); // suppress if roster-y

  return {
    wc,
    rosterRaw,
    instructionRaw,
    narrativeRaw,
    argumentRaw,
    poetryOracleRaw,
    poetryWisdomRaw,
    listRosterRaw,
    listInstructionRaw
  };
}

function normalizeTo100(raws) {
  const keys = Object.keys(raws);
  let sum = 0;
  for (const k of keys) sum += Math.max(0, raws[k]);
  if (sum <= 0) {
    // fallback: assume instruction-heavy by default
    return {
      genre_narrative: 10,
      genre_instruction: 60,
      genre_argument: 10,
      genre_poetry_oracle: 10,
      genre_poetry_wisdom: 5,
      genre_list_roster: 3,
      genre_list_instructional: 2
    };
  }

  // initial floating shares
  const shares = {};
  for (const k of keys) shares[k] = Math.max(0, raws[k]) / sum * 100;

  // round while preserving sum=100
  const out = {};
  let running = 0;
  const order = [
    'narrative','instruction','argument','poetry_oracle','poetry_wisdom','list_roster','list_instructional'
  ];
  for (let i = 0; i < order.length; i++) {
    const k = order[i];
    if (i < order.length - 1) {
      const v = Math.round(shares[k]);
      out[k] = v;
      running += v;
    } else {
      out[k] = clamp(100 - running, 0, 100);
    }
  }

  // small fix if rounding caused negative last
  const total = Object.values(out).reduce((a,b)=>a+b,0);
  if (total !== 100) out.instruction = clamp(out.instruction + (100 - total), 0, 100);

  return {
    genre_narrative: out.narrative,
    genre_instruction: out.instruction,
    genre_argument: out.argument,
    genre_poetry_oracle: out.poetry_oracle,
    genre_poetry_wisdom: out.poetry_wisdom,
    genre_list_roster: out.list_roster,
    genre_list_instructional: out.list_instructional
  };
}

async function fetchAll(table, select, pageSize = 2000) {
  let all = [];
  let from = 0;
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select(select).range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main() {
  console.log(`Compute section metrics v3 (model_version=${MODEL_VERSION})`);
  console.log('Loading books, sections, verses…');

  const books = await fetchAll('scripture_books', 'book_code,canon_order,name,testament,ot_division,nt_division', 200);
  const bookByCode = new Map(books.map(b => [b.book_code, b]));

  const sections = await fetchAll(
    'scripture_sections',
    'id,book_code,heading_level,heading_text,start_chapter,start_verse,end_chapter,end_verse',
    2000
  );

  const verses = await fetchAll(
    'scripture_verses',
    'id,book_code,chapter,verse,section_id,text_clean',
    4000
  );

  console.log(`Books: ${books.length} | Sections: ${sections.length} | Verses: ${verses.length}`);

  // Build per-book verse ordering index (chapter/verse)
  const versesByBook = new Map();
  for (const v of verses) {
    if (!versesByBook.has(v.book_code)) versesByBook.set(v.book_code, []);
    versesByBook.get(v.book_code).push(v);
  }
  for (const [bc, arr] of versesByBook.entries()) {
    arr.sort((a,b)=> (a.chapter - b.chapter) || (a.verse - b.verse));
  }

  const verseIndexById = new Map(); // verse.id -> index in book (0..n-1)
  const bookTotalVerses = new Map();
  for (const [bc, arr] of versesByBook.entries()) {
    bookTotalVerses.set(bc, arr.length);
    for (let i = 0; i < arr.length; i++) verseIndexById.set(arr[i].id, i);
  }

  // Group verses by section_id
  const versesBySection = new Map();
  for (const v of verses) {
    if (!v.section_id) continue;
    if (!versesBySection.has(v.section_id)) versesBySection.set(v.section_id, []);
    versesBySection.get(v.section_id).push(v);
  }
  for (const [sid, arr] of versesBySection.entries()) {
    arr.sort((a,b)=> (a.chapter - b.chapter) || (a.verse - b.verse));
  }

  // Compute section word counts for p95 cap
  const sectionWordCounts = [];
  for (const s of sections) {
    const arr = versesBySection.get(s.id) || [];
    let wc = 0;
    for (const v of arr) wc += wordsOf(v.text_clean).length;
    sectionWordCounts.push(wc);
  }
  const p95_wc = Math.max(1, percentile(sectionWordCounts, 0.95));
  console.log(`Global p95 section word-count: ${p95_wc.toFixed(2)}`);

  // Clear old v3 rows
  console.log('Clearing existing v3 rows in section_metrics…');
  {
    const { error } = await supabase.from('section_metrics').delete().eq('model_version', MODEL_VERSION);
    if (error) throw error;
  }

  // Compute metrics rows
  const rows = [];
  let n = 0;

  for (const s of sections) {
    n++;
    if (n % 500 === 0) console.log(`  processed sections: ${n}/${sections.length}`);

    const b = bookByCode.get(s.book_code);
    const arr = versesBySection.get(s.id) || [];

    // word count / space
    let wc = 0;
    for (const v of arr) wc += wordsOf(v.text_clean).length;
    const spaceScore = Math.round(100 * Math.min(1, wc / p95_wc));

    // position / structural (mild U-shape + heading depth + small space influence)
    let pos = 0.5;
    const total = bookTotalVerses.get(s.book_code) || 0;
    if (total > 0 && arr.length > 0) {
      const firstIdx = verseIndexById.get(arr[0].id) ?? 0;
      const lastIdx = verseIndexById.get(arr[arr.length - 1].id) ?? firstIdx;
      const midIdx = (firstIdx + lastIdx) / 2;
      pos = clamp(midIdx / Math.max(1, total - 1), 0, 1);
    }
    const edge = Math.abs(pos - 0.5) * 2; // 0 mid, 1 edges
    const posBoost = edge * 10; // max +10
    const headingBoost = (s.heading_level === 1 ? 8 : (s.heading_level === 2 ? 4 : 0));
    const structuralScore = Math.round(clamp(35 + posBoost + headingBoost + (spaceScore * 0.25), 0, 100));

    // genre signals aggregated
    let raw = {
      narrative: 0,
      instruction: 0,
      argument: 0,
      poetry_oracle: 0,
      poetry_wisdom: 0,
      list_roster: 0,
      list_instructional: 0
    };

    let rosterSignalSum = 0;
    let wordSum = 0;

    for (const v of arr) {
      const sig = verseSignals(s.book_code, v.text_clean || '');
      wordSum += sig.wc;
      rosterSignalSum += sig.rosterRaw * sig.wc;

      raw.instruction += sig.instructionRaw;
      raw.narrative += sig.narrativeRaw;
      raw.argument += sig.argumentRaw;
      raw.poetry_oracle += sig.poetryOracleRaw;
      raw.poetry_wisdom += sig.poetryWisdomRaw;
      raw.list_roster += sig.listRosterRaw;
      raw.list_instructional += sig.listInstructionRaw;
    }

    // very small stabilizers: if poetry book and signals weak, keep some poetry_wisdom
    if (WISDOM_POETRY_BOOKS.has(s.book_code) && raw.poetry_wisdom < 1) raw.poetry_wisdom += 0.8;
    if (PROPHET_BOOKS.has(s.book_code) && raw.poetry_oracle < 1) raw.poetry_oracle += 0.6;

    const genre = normalizeTo100(raw);

    // roster_ratio (0..1): normalize roster signal per word, clamp
    const rosterRatio = wordSum > 0 ? clamp((rosterSignalSum / wordSum) / 6, 0, 1) : 0;

    rows.push({
      section_id: s.id,
      book_code: s.book_code,
      testament: b?.testament ?? null,
      ot_division: b?.ot_division ?? null,
      nt_division: b?.nt_division ?? null,

      model_version: MODEL_VERSION,

      space_score: spaceScore,
      structural_score: structuralScore,

      // reuse scores will be filled in the next script (final importance)
      nt_reuse_score: 0,
      ot_reuse_score: 0,

      genre_narrative: genre.genre_narrative,
      genre_instruction: genre.genre_instruction,
      genre_argument: genre.genre_argument,

      // keep legacy fields but set to 0 for v3 so they don't confuse you later
      genre_poetry: 0,
      genre_list: 0,

      genre_poetry_oracle: genre.genre_poetry_oracle,
      genre_poetry_wisdom: genre.genre_poetry_wisdom,
      genre_list_roster: genre.genre_list_roster,
      genre_list_instructional: genre.genre_list_instructional,

      roster_ratio: rosterRatio,

      // placeholder; final script will compute
      importance_score: 0,
      dispute_risk: 'low',

      is_genre_overridden: false,
      is_dispute_overridden: false,
      notes: null,

      ot_reuse_score: 0
    });
  }

  // upsert in chunks
  console.log(`Upserting section_metrics v3 rows: ${rows.length}…`);
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from('section_metrics').upsert(chunk, { onConflict: 'section_id,model_version' });
    if (error) throw error;
    if ((i / chunkSize) % 10 === 0) console.log(`  wrote ${Math.min(i + chunkSize, rows.length)}/${rows.length}`);
  }

  console.log('DONE. Metrics v3 computed.');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
