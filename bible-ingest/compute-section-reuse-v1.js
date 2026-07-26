import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Config
 */
const MODEL_VERSION = 1;
const PAGE_SIZE = 2000;          // rows per fetch from parsed crossrefs
const UPSERT_BATCH = 1000;       // rows per upsert into section_reuse_totals

/**
 * Helpers
 */
function clampInt(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function isPositiveNumber(x) {
  return typeof x === 'number' && Number.isFinite(x) && x > 0;
}

/**
 * Expand (book_code, ch_start, vs_start) → (ch_end, vs_end) into an array of verse keys.
 * NOTE: For multi-chapter ranges, we need a chapter->maxVerse lookup.
 * We fetch max verse per chapter from scripture_verses on demand and cache it.
 */
class VerseRangeExpander {
  constructor() {
    this.maxVerseCache = new Map(); // key: `${book}|${ch}` -> maxVerse
  }

  async getMaxVerse(bookCode, chapter) {
    const k = `${bookCode}|${chapter}`;
    if (this.maxVerseCache.has(k)) return this.maxVerseCache.get(k);

    const { data, error } = await supabase
      .from('scripture_verses')
      .select('verse')
      .eq('book_code', bookCode)
      .eq('chapter', chapter)
      .order('verse', { ascending: false })
      .limit(1);

    if (error) throw error;
    const maxV = data?.[0]?.verse ?? null;
    if (!maxV) throw new Error(`Could not find max verse for ${bookCode} ch ${chapter}`);

    this.maxVerseCache.set(k, maxV);
    return maxV;
  }

  async expand(bookCode, chStart, vsStart, chEnd, vsEnd) {
    // Defensive
    chStart = clampInt(chStart, 1, 999);
    vsStart = clampInt(vsStart, 1, 999);
    chEnd = clampInt(chEnd, 1, 999);
    vsEnd = clampInt(vsEnd, 1, 999);

    if (chEnd < chStart || (chEnd === chStart && vsEnd < vsStart)) {
      // invalid range; return empty
      return [];
    }

    // Single-chapter range
    if (chStart === chEnd) {
      const out = [];
      for (let v = vsStart; v <= vsEnd; v++) out.push({ bookCode, chapter: chStart, verse: v });
      return out;
    }

    // Multi-chapter range (rare, but handle correctly)
    const out = [];

    // start chapter slice
    const maxStart = await this.getMaxVerse(bookCode, chStart);
    for (let v = vsStart; v <= maxStart; v++) out.push({ bookCode, chapter: chStart, verse: v });

    // middle chapters
    for (let ch = chStart + 1; ch <= chEnd - 1; ch++) {
      const maxMid = await this.getMaxVerse(bookCode, ch);
      for (let v = 1; v <= maxMid; v++) out.push({ bookCode, chapter: ch, verse: v });
    }

    // end chapter slice
    for (let v = 1; v <= vsEnd; v++) out.push({ bookCode, chapter: chEnd, verse: v });

    return out;
  }
}

async function fetchParsedCrossrefsPage(offset) {
  // We only need rows that can contribute to one of our two channels
  // and with votes > 0 (since we ignore nonpositive).
  const { data, error } = await supabase
    .from('openbible_crossrefs_parsed')
    .select(
      [
        'raw_id',
        'votes',
        'from_is_nt',
        'to_is_ot',
        'ot_later_to_earlier',
        'to_book_code',
        'to_ch_start',
        'to_vs_start',
        'to_ch_end',
        'to_vs_end'
      ].join(',')
    )
    .gt('votes', 0)
    .or('and(from_is_nt.eq.true,to_is_ot.eq.true),ot_later_to_earlier.eq.true')
    .order('raw_id')
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw error;
  return data ?? [];
}

async function lookupSectionsForVerses(verseKeys) {
  // Batch lookup using IN conditions by building a composite key list:
  // We'll group by book_code/chapter to reduce calls.
  // Approach: fetch all verses for each (book_code, chapter) present and filter in JS.
  // This is efficient because ranges are typically within one chapter.

  const byBookChapter = new Map(); // key `${book}|${ch}` -> Set(verseNumbers)
  for (const vk of verseKeys) {
    const k = `${vk.bookCode}|${vk.chapter}`;
    if (!byBookChapter.has(k)) byBookChapter.set(k, new Set());
    byBookChapter.get(k).add(vk.verse);
  }

  const results = []; // { section_id, count }
  // We'll build a section_id -> count map of verses in that section for this range.
  const sectionCounts = new Map();

  for (const [k, verseSet] of byBookChapter.entries()) {
    const [bookCode, chStr] = k.split('|');
    const chapter = parseInt(chStr, 10);

    // fetch rows for that book+chapter, but only needed verses
    // PostgREST doesn't support IN on integer set directly via supabase-js elegantly without `.in()`.
    const versesArr = Array.from(verseSet);

    const { data, error } = await supabase
      .from('scripture_verses')
      .select('verse,section_id')
      .eq('book_code', bookCode)
      .eq('chapter', chapter)
      .in('verse', versesArr);

    if (error) throw error;

    for (const row of data ?? []) {
      if (!row.section_id) continue;
      sectionCounts.set(row.section_id, (sectionCounts.get(row.section_id) ?? 0) + 1);
    }
  }

  for (const [section_id, count] of sectionCounts.entries()) {
    results.push({ section_id, count });
  }
  return results;
}

async function upsertSectionReuseTotals(sectionTotalsMap) {
  // sectionTotalsMap: section_id -> { ntSum, otSum }
  const rows = [];
  for (const [section_id, v] of sectionTotalsMap.entries()) {
    rows.push({
      section_id,
      model_version: MODEL_VERSION,
      nt_reuse_sum: v.ntSum,
      ot_reuse_sum: v.otSum,
      updated_at: new Date().toISOString()
    });
    if (rows.length >= UPSERT_BATCH) {
      const { error } = await supabase
        .from('section_reuse_totals')
        .upsert(rows, { onConflict: 'section_id,model_version' });
      if (error) throw error;
      rows.length = 0;
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from('section_reuse_totals')
      .upsert(rows, { onConflict: 'section_id,model_version' });
    if (error) throw error;
  }
}

async function clearModelVersion() {
  const { error } = await supabase
    .from('section_reuse_totals')
    .delete()
    .eq('model_version', MODEL_VERSION);
  if (error) throw error;
}

async function main() {
  console.log(`Computing section reuse totals (model_version=${MODEL_VERSION})`);
  console.log('Clearing existing totals for this model_version…');
  await clearModelVersion();

  const expander = new VerseRangeExpander();

  let offset = 0;
  let fetched = 0;
  let processed = 0;

  // Accumulate in memory per page, then upsert. This prevents huge RAM use.
  while (true) {
    const page = await fetchParsedCrossrefsPage(offset);
    if (page.length === 0) break;

    fetched += page.length;

    // section_id -> { ntSum, otSum }
    const sectionTotals = new Map();

    for (const r of page) {
      const votes = r.votes;
      if (!isPositiveNumber(votes)) continue;

      const isNT = r.from_is_nt === true && r.to_is_ot === true;
      const isOT = r.ot_later_to_earlier === true;

      // Should always be true due to filter, but keep safe
      if (!isNT && !isOT) continue;

      const verses = await expander.expand(
        r.to_book_code,
        r.to_ch_start,
        r.to_vs_start,
        r.to_ch_end,
        r.to_vs_end
      );

      if (verses.length === 0) continue;

      const sectionCounts = await lookupSectionsForVerses(verses);
      const totalVersesFound = sectionCounts.reduce((a, b) => a + b.count, 0);
      if (totalVersesFound === 0) continue;

      const wPerVerse = votes / totalVersesFound;

      for (const sc of sectionCounts) {
        const add = wPerVerse * sc.count;
        const cur = sectionTotals.get(sc.section_id) ?? { ntSum: 0, otSum: 0 };
        if (isNT) cur.ntSum += add;
        if (isOT) cur.otSum += add;
        sectionTotals.set(sc.section_id, cur);
      }

      processed++;
      if (processed % 250 === 0) {
        process.stdout.write(`Processed ${processed} rows…\r`);
      }
    }

    await upsertSectionReuseTotals(sectionTotals);

    console.log(
      `Page done. fetched=${fetched}, processed=${processed}, next_offset=${offset + PAGE_SIZE}`
    );
    offset += PAGE_SIZE;
  }

  console.log('DONE computing section reuse totals.');
  console.log(`Total parsed crossref rows fetched: ${fetched}`);
  console.log(`Total rows processed (votes>0 and matched): ${processed}`);
  console.log(`Model version: ${MODEL_VERSION}`);
}

main().catch(err => {
  console.error('\nERROR:', err);
  process.exit(1);
});

