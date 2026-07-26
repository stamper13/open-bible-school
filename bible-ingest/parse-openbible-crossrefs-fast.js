import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const PAGE_SIZE = 5000;     // much fewer round trips
const UPSERT_BATCH = 2000;  // keep payload sizes reasonable

function parseRef(ref) {
  // Accepts:
  //   Ps.148.4
  //   Ps.148.4-Ps.148.5
  //   Eph.6.23–Eph.6.24 (en dash)
  const normalized = ref.replace(/–/g, '-').trim();
  const parts = normalized.split('-');

  const parseSingle = (s) => {
    const m = s.trim().match(/^(.+?)\.(\d+)\.(\d+)$/);
    if (!m) throw new Error(`Bad ref: ${s}`);
    return {
      book_ext: m[1].trim(),
      ch: parseInt(m[2], 10),
      vs: parseInt(m[3], 10)
    };
  };

  if (parts.length === 1) {
    const p = parseSingle(parts[0]);
    return { ...p, ch_end: p.ch, vs_end: p.vs };
  }

  const start = parseSingle(parts[0]);
  const end = parseSingle(parts[1]);

  // Most ranges keep the same book_ext; if not, we still store using start.book_ext.
  return {
    book_ext: start.book_ext,
    ch: start.ch,
    vs: start.vs,
    ch_end: end.ch,
    vs_end: end.vs
  };
}

async function loadBookRefMap() {
  const { data, error } = await supabase
    .from('book_ref_map')
    .select('external_book, internal_code')
    .eq('source', 'openbible');

  if (error) throw error;

  const map = new Map();
  for (const r of data) map.set(r.external_book, r.internal_code);
  return map;
}

async function loadCanonOrderMap() {
  const { data, error } = await supabase
    .from('scripture_books')
    .select('book_code, canon_order');

  if (error) throw error;

  const map = new Map();
  for (const r of data) map.set(r.code, r.canon_order);
  return map;
}

async function upsertParsedRows(rows) {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('openbible_crossrefs_parsed')
    .upsert(rows, { onConflict: 'raw_id' });
  if (error) throw error;
}

async function main() {
  console.log('Fast parsing OpenBible crossrefs…');

  const bookRefMap = await loadBookRefMap();
  const canonOrderMap = await loadCanonOrderMap();

  console.log(`Loaded book_ref_map entries: ${bookRefMap.size}`);
  console.log(`Loaded scripture_books entries: ${canonOrderMap.size}`);

  let offset = 0;
  let totalFetched = 0;
  let totalPrepared = 0;
  let totalSkipped = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('openbible_crossrefs_raw')
      .select('id, from_ref, to_ref, votes')
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!rows || rows.length === 0) break;

    totalFetched += rows.length;

    const toUpsert = [];

    for (const r of rows) {
      let from, to;
      try {
        from = parseRef(r.from_ref);
        to = parseRef(r.to_ref);
      } catch {
        totalSkipped++;
        continue;
      }

      const fromCode = bookRefMap.get(from.book_ext);
      const toCode = bookRefMap.get(to.book_ext);

      if (!fromCode || !toCode) {
        totalSkipped++;
        continue;
      }

      const fromOrder = canonOrderMap.get(fromCode);
      const toOrder = canonOrderMap.get(toCode);

      if (fromOrder == null || toOrder == null) {
        totalSkipped++;
        continue;
      }

      const from_is_ot = fromOrder <= 39;
      const from_is_nt = fromOrder >= 40;
      const to_is_ot = toOrder <= 39;
      const to_is_nt = toOrder >= 40;

      const ot_later_to_earlier =
        from_is_ot && to_is_ot && fromOrder > toOrder;

      toUpsert.push({
        raw_id: r.id,

        from_book_ext: from.book_ext,
        from_book_code: fromCode,
        from_ch: from.ch,
        from_vs: from.vs,

        to_book_ext: to.book_ext,
        to_book_code: toCode,
        to_ch_start: to.ch,
        to_vs_start: to.vs,
        to_ch_end: to.ch_end,
        to_vs_end: to.vs_end,

        votes: r.votes,

        from_is_ot,
        from_is_nt,
        to_is_ot,
        to_is_nt,
        ot_later_to_earlier
      });

      if (toUpsert.length >= UPSERT_BATCH) {
        await upsertParsedRows(toUpsert);
        totalPrepared += toUpsert.length;
        toUpsert.length = 0;
      }
    }

    if (toUpsert.length > 0) {
      await upsertParsedRows(toUpsert);
      totalPrepared += toUpsert.length;
    }

    console.log(
      `Fetched ${totalFetched} raw rows… prepared ${totalPrepared} parsed rows… skipped ${totalSkipped}…`
    );

    offset += PAGE_SIZE;
  }

  console.log('DONE parsing crossrefs (fast).');
  console.log(`Total fetched: ${totalFetched}`);
  console.log(`Total parsed/upserted: ${totalPrepared}`);
  console.log(`Total skipped: ${totalSkipped}`);
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});

