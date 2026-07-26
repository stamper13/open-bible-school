import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const MODEL_VERSION = 1;

// ---------- helpers ----------
function cmpRef(aCh, aVs, bCh, bVs) {
  if (aCh !== bCh) return aCh - bCh;
  return aVs - bVs;
}

function lowerBound(arr, ch, vs) {
  // first index i such that arr[i] >= (ch,vs)
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const c = cmpRef(arr[mid].chapter, arr[mid].verse, ch, vs);
    if (c < 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(arr, ch, vs) {
  // first index i such that arr[i] > (ch,vs)
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const c = cmpRef(arr[mid].chapter, arr[mid].verse, ch, vs);
    if (c <= 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

async function fetchAllPaged(table, select, pageSize = 1000, filters = []) {
  let all = [];
  let from = 0;

  for (;;) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    for (const fn of filters) q = fn(q);

    const { data, error } = await q;
    if (error) throw error;

    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function main() {
  console.log(`Compute NT→NT and ADD into section_reuse_totals.nt_reuse_sum (model_version=${MODEL_VERSION})`);

  // 1) Load ALL NT verses (small enough to hold in memory) to map verse ranges -> section_ids
  console.log('Loading NT verses (book_code, chapter, verse, section_id)…');
  const ntVerses = await fetchAllPaged(
    'scripture_verses',
    'book_code, chapter, verse, section_id',
    5000,
    [
      (q) => q.in(
        'book_code',
        // Use scripture_books to identify NT books without a join:
        // We'll fetch NT books first, then use .in(book_code, [...])
        []
      )
    ]
  );
  // The above placeholder approach can’t run because it needs NT book codes first.
  // So: fetch NT book codes, then fetch verses with an IN clause.

  // Re-load properly:
  console.log('Loading NT book codes…');
  const ntBooks = await fetchAllPaged(
    'scripture_books',
    'book_code',
    200,
    [(q) => q.eq('testament', 'NT')]
  );
  const ntBookCodes = ntBooks.map(r => r.book_code);
  if (ntBookCodes.length === 0) throw new Error('No NT books found in scripture_books');

  console.log(`NT books loaded: ${ntBookCodes.length}`);
  console.log('Loading NT verses (this may take a moment)…');
  const ntVerses2 = await fetchAllPaged(
    'scripture_verses',
    'book_code, chapter, verse, section_id',
    5000,
    [(q) => q.in('book_code', ntBookCodes)]
  );

  // Organize verses per book, sorted
  const versesByBook = new Map();
  for (const v of ntVerses2) {
    const key = v.book_code;
    if (!versesByBook.has(key)) versesByBook.set(key, []);
    versesByBook.get(key).push({
      chapter: v.chapter,
      verse: v.verse,
      section_id: v.section_id,
    });
  }
  for (const [book, arr] of versesByBook.entries()) {
    arr.sort((a, b) => cmpRef(a.chapter, a.verse, b.chapter, b.verse));
    versesByBook.set(book, arr);
  }
  console.log(`NT verses loaded: ${ntVerses2.length}`);

  // 2) Load existing section_reuse_totals (model_version=1) into memory
  console.log('Loading existing section_reuse_totals…');
  const existingTotals = await fetchAllPaged(
    'section_reuse_totals',
    'section_id, model_version, nt_reuse_sum, ot_reuse_sum',
    5000,
    [(q) => q.eq('model_version', MODEL_VERSION)]
  );

  const totalsMap = new Map();
  for (const row of existingTotals) {
    totalsMap.set(row.section_id, {
      nt: Number(row.nt_reuse_sum || 0),
      ot: Number(row.ot_reuse_sum || 0),
    });
  }
  console.log(`Existing totals loaded: ${existingTotals.length} rows`);

  // 3) Stream/open all parsed crossrefs and accumulate NT→NT votes by TARGET section_id (unique per range)
  console.log('Loading openbible_crossrefs_parsed rows (NT→NT only)…');
  const crossrefs = await fetchAllPaged(
    'openbible_crossrefs_parsed',
    'to_book_code, to_ch_start, to_vs_start, to_ch_end, to_vs_end, votes, from_is_nt, to_is_nt',
    5000,
    [(q) => q.eq('from_is_nt', true).eq('to_is_nt', true)]
  );
  console.log(`NT→NT crossrefs loaded: ${crossrefs.length}`);

  const deltaBySection = new Map();

  let processed = 0;
  for (const r of crossrefs) {
    processed++;
    if (processed % 25000 === 0) console.log(`Processed ${processed} NT→NT crossrefs…`);

    const book = r.to_book_code;
    const arr = versesByBook.get(book);
    if (!arr || arr.length === 0) continue;

    const ch1 = Number(r.to_ch_start);
    const vs1 = Number(r.to_vs_start);
    const ch2 = Number(r.to_ch_end);
    const vs2 = Number(r.to_vs_end);
    const votes = Number(r.votes || 0);
    if (!Number.isFinite(votes) || votes === 0) continue;

    // Range boundaries (ensure start <= end)
    let startCh = ch1, startVs = vs1, endCh = ch2, endVs = vs2;
    if (cmpRef(startCh, startVs, endCh, endVs) > 0) {
      // swap
      startCh = ch2; startVs = vs2;
      endCh = ch1; endVs = vs1;
    }

    const i0 = lowerBound(arr, startCh, startVs);
    const i1 = upperBound(arr, endCh, endVs);
    if (i0 >= i1) continue;

    // Unique section_ids for this target range (prevents long ranges inflating by verse count)
    const seenSections = new Set();
    for (let i = i0; i < i1; i++) {
      const sid = arr[i].section_id;
      if (sid) seenSections.add(sid);
    }

    for (const sid of seenSections) {
      deltaBySection.set(sid, (deltaBySection.get(sid) || 0) + votes);
    }
  }

  console.log(`Accumulated NT→NT deltas for sections: ${deltaBySection.size}`);

  // 4) Apply deltas into totalsMap (creating rows if missing)
  for (const [sectionId, delta] of deltaBySection.entries()) {
    const cur = totalsMap.get(sectionId) || { nt: 0, ot: 0 };
    cur.nt += delta;
    totalsMap.set(sectionId, cur);
  }

  // 5) Upsert back to section_reuse_totals in batches
  console.log('Upserting updated section_reuse_totals (model_version=1)…');
  const rows = [];
  for (const [section_id, v] of totalsMap.entries()) {
    rows.push({
      section_id,
      model_version: MODEL_VERSION,
      nt_reuse_sum: Math.trunc(v.nt),
      ot_reuse_sum: Math.trunc(v.ot),
    });
  }

  const BATCH = 500;
  let wrote = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('section_reuse_totals')
      .upsert(batch, { onConflict: 'section_id,model_version' });

    if (error) throw error;

    wrote += batch.length;
    if (wrote % 5000 === 0) console.log(`Upserted ${wrote}/${rows.length}…`);
  }

  console.log(`DONE. Upserted rows: ${wrote}`);
  console.log('Next: re-run your importance recompute: node compute-final-importance-v2e2.js');
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
