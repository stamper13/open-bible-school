
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const PAGE_SIZE = 1000;

// Parse refs like:
//   Ps.148.4
//   Ps.148.4-Ps.148.5
//   2 Cor.13.14
function parseRef(ref) {
  const parts = ref.split('-');

  const parseSingle = (s) => {
    const m = s.match(/^(.+?)\.(\d+)\.(\d+)$/);
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

  return {
    book_ext: start.book_ext,
    ch: start.ch,
    vs: start.vs,
    ch_end: end.ch,
    vs_end: end.vs
  };
}

async function main() {
  console.log('Parsing OpenBible crossrefs…');

  let offset = 0;
  let total = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('openbible_crossrefs_raw')
      .select('*')
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!rows.length) break;

    const parsedRows = [];

    for (const r of rows) {
      const from = parseRef(r.from_ref);
      const to = parseRef(r.to_ref);

      const { data: fromMap } = await supabase
        .from('book_ref_map')
        .select('internal_code')
        .eq('source', 'openbible')
        .eq('external_book', from.book_ext)
        .single();

      const { data: toMap } = await supabase
        .from('book_ref_map')
        .select('internal_code')
        .eq('source', 'openbible')
        .eq('external_book', to.book_ext)
        .single();

      if (!fromMap || !toMap) continue;

      const { data: fromBook } = await supabase
        .from('scripture_books')
        .select('canon_order')
        .eq('code', fromMap.internal_code)
        .single();

      const { data: toBook } = await supabase
        .from('scripture_books')
        .select('canon_order')
        .eq('code', toMap.internal_code)
        .single();

      if (!fromBook || !toBook) continue;

      const from_is_ot = fromBook.canon_order <= 39;
      const from_is_nt = fromBook.canon_order >= 40;
      const to_is_ot = toBook.canon_order <= 39;
      const to_is_nt = toBook.canon_order >= 40;

      const ot_later_to_earlier =
        from_is_ot &&
        to_is_ot &&
        fromBook.canon_order > toBook.canon_order;

      parsedRows.push({
        raw_id: r.id,
        from_book_ext: from.book_ext,
        from_book_code: fromMap.internal_code,
        from_ch: from.ch,
        from_vs: from.vs,

        to_book_ext: to.book_ext,
        to_book_code: toMap.internal_code,
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
    }

    if (parsedRows.length) {
      const { error: upsertErr } = await supabase
        .from('openbible_crossrefs_parsed')
        .upsert(parsedRows, { onConflict: 'raw_id' });

      if (upsertErr) throw upsertErr;
    }

    total += rows.length;
    offset += PAGE_SIZE;
    console.log(`Parsed ${total} rows…`);
  }

  console.log('DONE parsing crossrefs.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

