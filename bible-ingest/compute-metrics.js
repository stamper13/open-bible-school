import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

/**
 * Usage:
 *   node compute-metrics.js JUD
 *
 * Expects .env:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const MODEL_VERSION = 1;

// Importance weights (v1, space-dominant)
const W_SPACE = 0.55;
const W_STRUCT = 0.20;
const W_ASSESS = 0.25;
const W_NT_REUSE = 0.0; // stub for later

// Assessability genre coefficients
const A_NARR = 1.00;
const A_INSTR = 0.90;
const A_ARG = 0.95;
const A_POET = 0.70;
const A_LIST = 0.10;

// Hard list clamp (stronger)
const LIST_CLAMP_THRESHOLD = 60; // if genre_list >= 60
const LIST_ASSESSABILITY_CAP = 10;

/** ----------------------------- Utilities ----------------------------- */

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function roundInt(n) {
  return Math.round(n);
}

function safeUpper(s) {
  return (s || '').toString().toUpperCase();
}

// Simple quantile on numeric array
function quantile(arr, q) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (a[base + 1] === undefined) return a[base];
  return a[base] + rest * (a[base + 1] - a[base]);
}

// log-scaled 0..100 mapping using global p95
function logScaledScore(value, p95) {
  const v = Math.max(0, value);
  const denom = Math.log(1 + Math.max(1, p95));
  const score = denom === 0 ? 0 : (100 * Math.log(1 + v) / denom);
  return clamp(roundInt(score), 0, 100);
}

/** ------------------------ DB fetch helpers -------------------------- */

async function fetchBookMeta(bookCode) {
  const { data, error } = await supabase
    .from('scripture_books')
    .select('book_code, testament, ot_division, nt_division')
    .eq('book_code', bookCode)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`No scripture_books row found for book_code=${bookCode}`);
  return data;
}

async function fetchSections(bookCode) {
  const { data, error } = await supabase
    .from('scripture_sections')
    .select('id, book_code, heading_level, heading_text, start_chapter, start_verse, end_chapter, end_verse')
    .eq('book_code', bookCode)
    .order('start_chapter', { ascending: true })
    .order('start_verse', { ascending: true })
    .order('end_chapter', { ascending: true })
    .order('end_verse', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchVersesForBook(bookCode) {
  // Fetch all verses for the book once, then slice per section in memory.
  const { data, error } = await supabase
    .from('scripture_verses')
    .select('id, book_code, chapter, verse, text_clean')
    .eq('book_code', bookCode)
    .order('chapter', { ascending: true })
    .order('verse', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchAllSectionLengths() {
  // Compute verse_count for each section by joining verses in SQL is expensive.
  // We do a lightweight approximation based on boundaries by counting verses per section in-app
  // for the current book AND compute global p95 using a global query for verse counts.
  //
  // For global p95, we need approximate section lengths across corpus.
  // We will fetch section boundaries for ALL sections, then for each book fetch verse counts.
  // To keep this practical, we compute global p95 based on:
  //   length_in_verses = (end_chapter-start_chapter)*200 + (end_verse-start_verse+1)
  // This is an approximation but stable. If you want exact later, we can add a materialized view.
  const { data, error } = await supabase
    .from('scripture_sections')
    .select('start_chapter, start_verse, end_chapter, end_verse');

  if (error) throw error;
  const sections = data || [];

  const approxLens = sections.map(s => {
    const chSpan = (s.end_chapter - s.start_chapter);
    const vSpan = (s.end_verse - s.start_verse + 1);
    // Chapter span multiplier: assume <=200 verses per chapter (safe upper bound for scaling)
    return Math.max(1, chSpan * 200 + vSpan);
  });

  return approxLens;
}

/** -------------------------- Text features --------------------------- */

function tokenizeWords(text) {
  // Basic word tokenizer for heuristics (ASCII + curly apostrophes)
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'’]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function countMatches(text, regex) {
  const m = text.match(regex);
  return m ? m.length : 0;
}

function computeTextFeatures(sectionText) {
  const text = sectionText || '';
  const words = tokenizeWords(text);
  const wordCount = words.length;

  const numbers = countMatches(text, /\b\d+\b/g);
  const sonOf = countMatches(text.toLowerCase(), /\bson of\b/g);
  const begot = countMatches(text.toLowerCase(), /\bbegot\b/g);

  // Discourse markers (argument)
  const discourseHits = countMatches(
    text.toLowerCase(),
    /\btherefore\b|\bbecause\b|\bfor\b|\bso that\b|\bsince\b|\bhowever\b|\bbut\b|\bthus\b|\bin order that\b|\bnow\b|\bfor this reason\b/g
  );

  // Imperative markers (instruction)
  const imperativeHits = countMatches(
    text.toLowerCase(),
    /\byou shall\b|\bshall not\b|\bdo not\b|\bmust\b|\bcommand\b|\bcommands\b|\bkeep\b|\bobey\b|\blet us\b|\burge\b/g
  );

  // Poetry markers: rough proxy (parallel punctuation / exclamations / short clauses)
  // (We did not preserve \q markers in text_clean, so use a mild heuristic.)
  const semicolons = countMatches(text, /;/g);
  const exclaims = countMatches(text, /!/g);

  // Proper-name-ish density proxy: Capitalized words in original text_clean may be inconsistent.
  // We'll use "and X" repetition proxy:
  const andCount = countMatches(text.toLowerCase(), /\band\b/g);

  // List-ness proxy: high density of commas, "and", numbers, and genealogical markers
  const commas = countMatches(text, /,/g);

  return {
    wordCount,
    numbers,
    sonOf,
    begot,
    discourseHits,
    imperativeHits,
    semicolons,
    exclaims,
    commas,
    andCount
  };
}

/** -------------------- Genre classification (v1) --------------------- */

function bookPriors(bookCode, testament) {
  // Soft priors: add small boosts to raw scores before normalization
  // Values are in "points" for raw scoring.
  const bc = safeUpper(bookCode);

  // Defaults
  const priors = { narrative: 0, instruction: 0, argument: 0, poetry: 0, list: 0 };

  // Poetry/wisdom heavy books
  const poetryBooks = new Set(['PSA', 'PRO', 'JOB', 'ECC', 'SNG', 'LAM']);
  if (poetryBooks.has(bc)) priors.poetry += 8;

  // Epistles: argument/instruction
  const pauline = new Set(['ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM']);
  const general = new Set(['HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD']);
  if (pauline.has(bc)) { priors.argument += 8; priors.instruction += 3; }
  if (general.has(bc)) { priors.argument += 6; priors.instruction += 4; }

  // Pentateuch tends to have instruction + narrative
  const torah = new Set(['GEN','EXO','LEV','NUM','DEU']);
  if (torah.has(bc)) { priors.narrative += 4; priors.instruction += 6; }

  // Chronicles/Ezra/Nehemiah have lists sprinkled (not always, but prior helps)
  const listHeavy = new Set(['1CH','2CH','EZR','NEH']);
  if (listHeavy.has(bc)) priors.list += 4;

  // Prophets: mixture; mild boost to poetry/argument-like oracles
  const prophets = new Set(['ISA','JER','EZK','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL']);
  if (prophets.has(bc)) { priors.poetry += 4; priors.argument += 2; }

  // Gospels/Acts: narrative
  const gospelsActs = new Set(['MAT','MRK','LUK','JHN','ACT']);
  if (gospelsActs.has(bc)) priors.narrative += 10;

  // Revelation: mix of prophecy/vision; approximate as poetry/argument
  if (bc === 'REV') { priors.poetry += 6; priors.argument += 2; }

  // If testament is OT and unknown: mild narrative prior
  if (testament === 'OT') priors.narrative += 1;

  return priors;
}

function computeGenreProbs({ bookCode, testament, sectionText, headingText }) {
  const text = (sectionText || '').trim();
  const head = (headingText || '').toLowerCase();

  const f = computeTextFeatures(text);

  // Raw scores before normalization
  let rawNarr = 10;
  let rawInstr = 10;
  let rawArg = 10;
  let rawPoet = 10;
  let rawList = 10;

  // Heuristic signals
  // LIST: genealogical markers, heavy numbers, heavy punctuation enumeration
  rawList += f.sonOf * 8 + f.begot * 8 + f.numbers * 0.8;
  rawList += (f.commas * 0.15) + (f.andCount * 0.05);

  // INSTRUCTION: imperatives
  rawInstr += f.imperativeHits * 3;

  // ARGUMENT: discourse markers
  rawArg += f.discourseHits * 2;

  // POETRY: semicolons/exclamations can correlate weakly; headings often help
  rawPoet += f.semicolons * 0.25 + f.exclaims * 0.5;
  if (head.includes('psalm') || head.includes('song') || head.includes('lament')) rawPoet += 8;

  // NARRATIVE: default when others are not strong; add based on "said", "went", etc.
  const narrativeVerbs = countMatches(text.toLowerCase(), /\bsaid\b|\bwent\b|\bcame\b|\btook\b|\bmade\b|\bwas\b|\bwere\b|\bdid\b|\banswered\b|\bcalled\b/g);
  rawNarr += narrativeVerbs * 0.2;

  // Headings that indicate lists or genealogies
  if (head.includes('genealogy') || head.includes('descendants') || head.includes('list') || head.includes('census')) {
    rawList += 12;
  }

  // Apply book priors (soft)
  const pri = bookPriors(bookCode, testament);
  rawNarr += pri.narrative;
  rawInstr += pri.instruction;
  rawArg += pri.argument;
  rawPoet += pri.poetry;
  rawList += pri.list;

  // Prevent negatives
  rawNarr = Math.max(0, rawNarr);
  rawInstr = Math.max(0, rawInstr);
  rawArg = Math.max(0, rawArg);
  rawPoet = Math.max(0, rawPoet);
  rawList = Math.max(0, rawList);

  // Normalize to 100 integer points
  const sum = rawNarr + rawInstr + rawArg + rawPoet + rawList;
  if (sum === 0) {
    return { narrative: 20, instruction: 20, argument: 20, poetry: 20, list: 20 };
  }

  // Convert to ints summing exactly to 100
  const floats = {
    narrative: (rawNarr / sum) * 100,
    instruction: (rawInstr / sum) * 100,
    argument: (rawArg / sum) * 100,
    poetry: (rawPoet / sum) * 100,
    list: (rawList / sum) * 100
  };

  // Round with remainder correction
  const rounded = {
    narrative: Math.floor(floats.narrative),
    instruction: Math.floor(floats.instruction),
    argument: Math.floor(floats.argument),
    poetry: Math.floor(floats.poetry),
    list: Math.floor(floats.list)
  };

  let total = rounded.narrative + rounded.instruction + rounded.argument + rounded.poetry + rounded.list;
  let remainder = 100 - total;

  if (remainder !== 0) {
    // Distribute remainder to highest fractional parts
    const fracs = Object.entries(floats).map(([k, v]) => [k, v - Math.floor(v)]);
    fracs.sort((a, b) => b[1] - a[1]);
    for (let i = 0; i < Math.abs(remainder); i++) {
      const key = fracs[i % fracs.length][0];
      rounded[key] += remainder > 0 ? 1 : -1;
    }
  }

  // Final clamp to keep 0..100 and sum 100
  for (const k of Object.keys(rounded)) rounded[k] = clamp(rounded[k], 0, 100);
  const finalSum = rounded.narrative + rounded.instruction + rounded.argument + rounded.poetry + rounded.list;
  if (finalSum !== 100) {
    // Fix by adjusting narrative (arbitrary but deterministic)
    rounded.narrative = clamp(rounded.narrative + (100 - finalSum), 0, 100);
  }

  return rounded;
}

/** ------------------ Structural score (v1 heuristic) ------------------ */

function computeStructuralScore({ sectionIndex, sectionCount, headingLevel }) {
  // Position edge signal: emphasize beginnings and endings modestly
  // pos in [0,1]
  const pos = sectionCount <= 1 ? 0.5 : (sectionIndex / (sectionCount - 1));
  // edge in [0,1], higher near edges
  const edge = 1 - (2 * Math.abs(pos - 0.5)); // 0 at center, 1 at edges
  const edgeBoost = 60 * edge; // 0..60

  // Heading bonus
  // heading_level in your ingest: usually 1 for \s1, 2 for \s2, etc.
  let headingBonus = 0;
  if (headingLevel === 1) headingBonus = 25;
  else if (headingLevel === 2) headingBonus = 15;
  else if (headingLevel >= 3) headingBonus = 8;
  else headingBonus = 0;

  // Base
  const base = 15;

  const score = base + edgeBoost + headingBonus;
  return clamp(roundInt(score), 0, 100);
}

/** ---------------- Assessability + importance (v1) ------------------- */

function computeAssessabilityScore(genre) {
  let assess =
    A_NARR * genre.narrative +
    A_INSTR * genre.instruction +
    A_ARG * genre.argument +
    A_POET * genre.poetry +
    A_LIST * genre.list;

  // Hard list clamp (strong)
  if (genre.list >= LIST_CLAMP_THRESHOLD) {
    assess = Math.min(assess, LIST_ASSESSABILITY_CAP);
  }
  return clamp(roundInt(assess), 0, 100);
}

function computeImportanceScore({ space, structural, assessability, ntReuse }) {
  const val =
    W_SPACE * space +
    W_STRUCT * structural +
    W_ASSESS * assessability +
    W_NT_REUSE * ntReuse;

  return clamp(roundInt(val), 0, 100);
}

/** --------------------------- Main logic ----------------------------- */

function verseKey(v) {
  return v.chapter * 1000 + v.verse;
}

function sectionContainsVerse(section, verse) {
  const v = verseKey(verse);
  const start = section.start_chapter * 1000 + section.start_verse;
  const end = section.end_chapter * 1000 + section.end_verse;
  return v >= start && v <= end;
}

function buildSectionText(section, verses) {
  // Join verse text_clean within boundaries
  const texts = [];
  for (const v of verses) {
    if (sectionContainsVerse(section, v)) {
      if (v.text_clean) texts.push(v.text_clean.trim());
    }
  }
  return texts.join(' ');
}

async function upsertSectionMetrics(row) {
  const { error } = await supabase
    .from('section_metrics')
    .upsert(row, { onConflict: 'section_id,model_version' });

  if (error) throw error;
}

async function main() {
  const bookCodeArg = process.argv[2];
  if (!bookCodeArg) {
    console.error('Usage: node compute-metrics.js <BOOK_CODE>, e.g. node compute-metrics.js JUD');
    process.exit(1);
  }
  const bookCode = safeUpper(bookCodeArg);

  console.log(`Computing section metrics for book: ${bookCode} (model_version=${MODEL_VERSION})`);

  const bookMeta = await fetchBookMeta(bookCode);
  const sections = await fetchSections(bookCode);
  const verses = await fetchVersesForBook(bookCode);

  if (!sections.length) {
    console.log(`No sections found for ${bookCode}. Nothing to do.`);
    return;
  }

  // Global p95 (approx) for section lengths
  console.log('Computing global p95 section length (approx)...');
  const globalLens = await fetchAllSectionLengths();
  const globalP95 = quantile(globalLens, 0.95);
  console.log(`Global p95 (approx length units): ${globalP95}`);

  // Prepare per-section exact-ish length using verse counts from this book’s verses
  // We compute actual verse count per section for this book (accurate within book).
  // Space score uses globalP95 as denominator, so it is comparable across corpus.
  const sectionCount = sections.length;

  console.log(`Sections: ${sectionCount}, Verses in book: ${verses.length}`);

  let success = 0;

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const sectionText = buildSectionText(s, verses);

    // Count verses inside section (accurate for this book)
    let verseCount = 0;
    for (const v of verses) {
      if (sectionContainsVerse(s, v)) verseCount++;
    }
    verseCount = Math.max(1, verseCount);

    // Compute metrics
    const genre = computeGenreProbs({
      bookCode,
      testament: bookMeta.testament,
      sectionText,
      headingText: s.heading_text
    });

    const assessability = computeAssessabilityScore(genre);
    const spaceScore = logScaledScore(verseCount, globalP95);
    const structuralScore = computeStructuralScore({
      sectionIndex: i,
      sectionCount,
      headingLevel: s.heading_level ?? 0
    });

    const ntReuseScore = 0;
    const importanceScore = computeImportanceScore({
      space: spaceScore,
      structural: structuralScore,
      assessability,
      ntReuse: ntReuseScore
    });

    const row = {
      section_id: s.id,
      book_code: bookCode,
      testament: bookMeta.testament,
      ot_division: bookMeta.ot_division,
      nt_division: bookMeta.nt_division,
      model_version: MODEL_VERSION,

      space_score: spaceScore,
      structural_score: structuralScore,
      nt_reuse_score: ntReuseScore,

      genre_narrative: genre.narrative,
      genre_instruction: genre.instruction,
      genre_argument: genre.argument,
      genre_poetry: genre.poetry,
      genre_list: genre.list,

      importance_score: importanceScore,

      // v1 defaults (manual later)
      dispute_risk: 'low',
      is_genre_overridden: false,
      is_dispute_overridden: false
    };

    await upsertSectionMetrics(row);
    success++;

    // Print a light trace for the first few sections
    if (i < 3) {
      console.log(`\n[Section ${i + 1}/${sectionCount}] section_id=${s.id}`);
      console.log(`  heading: ${s.heading_text || '(none)'}`);
      console.log(`  verseCount=${verseCount}, space=${spaceScore}, structural=${structuralScore}`);
      console.log(`  genre:`, genre);
      console.log(`  assessability=${assessability}, importance=${importanceScore}`);
    }
  }

  console.log(`\nDONE. Upserted section_metrics rows: ${success}`);
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
