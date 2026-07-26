import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const INPUT_MODEL_VERSION_REUSE_TOTALS = 1;
const OUTPUT_MODEL_VERSION_METRICS = 2;

const W_NT = 0.65;
const W_OT = 0.35;
const M_MIN = 1.0;
const M_MAX = 1.60;

const PAGE_SIZE = 2000;
const UPSERT_BATCH = 1000;

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function roundInt(x) { return Math.round(x); }
function ln1p(x) { return Math.log(1 + x); }

async function fetchP95(table, column, filters = []) {
  let countQuery = supabase.from(table).select('*', { count: 'exact', head: true });
  for (const f of filters) {
    if (f.op === 'eq') countQuery = countQuery.eq(f.col, f.val);
  }
  const { count, error: countErr } = await countQuery;
  if (countErr) throw countErr;
  if (!count || count === 0) return 0;

  const idx = Math.max(0, Math.floor(0.95 * (count - 1)));

  let valQuery = supabase.from(table).select(column).order(column, { ascending: true }).range(idx, idx);
  for (const f of filters) {
    if (f.op === 'eq') valQuery = valQuery.eq(f.col, f.val);
  }

  const { data, error: valErr } = await valQuery;
  if (valErr) throw valErr;

  return Number(data?.[0]?.[column] ?? 0);
}

async function clearOutputModelVersion() {
  const { error } = await supabase
    .from('section_metrics')
    .delete()
    .eq('model_version', OUTPUT_MODEL_VERSION_METRICS);
  if (error) throw error;
}

async function fetchBooksMap() {
  const map = new Map();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('scripture_books')
      .select('book_code, testament, ot_division, nt_division, canon_order')
      .order('canon_order', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const b of data) {
      map.set(b.book_code, {
        testament: b.testament ?? null,
        ot_division: b.ot_division ?? null,
        nt_division: b.nt_division ?? null
      });
    }
    offset += PAGE_SIZE;
  }
  return map;
}

async function fetchAllReuseTotalsMap() {
  const map = new Map();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('section_reuse_totals')
      .select('section_id, nt_reuse_sum, ot_reuse_sum')
      .eq('model_version', INPUT_MODEL_VERSION_REUSE_TOTALS)
      .order('section_id')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const r of data) {
      map.set(r.section_id, {
        nt: Number(r.nt_reuse_sum ?? 0),
        ot: Number(r.ot_reuse_sum ?? 0)
      });
    }
    offset += PAGE_SIZE;
  }
  return map;
}

async function fetchSectionsPage(offset) {
  const { data, error } = await supabase
    .from('scripture_sections')
    .select('id, book_code')
    .order('id')
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return data ?? [];
}

async function fetchV1MetricsMap() {
  const map = new Map();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('section_metrics')
      .select('section_id, space_score, structural_score, genre_narrative, genre_instruction, genre_argument, genre_poetry, genre_list, importance_score')
      .eq('model_version', 1)
      .order('section_id')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const r of data) {
      map.set(r.section_id, {
        space: Number(r.space_score ?? 0),
        structural: Number(r.structural_score ?? 0),
        gNarr: Number(r.genre_narrative ?? 0),
        gInstr: Number(r.genre_instruction ?? 0),
        gArg: Number(r.genre_argument ?? 0),
        gPoet: Number(r.genre_poetry ?? 0),
        gList: Number(r.genre_list ?? 0),
        baseImportance: Number(r.importance_score ?? 0)
      });
    }
    offset += PAGE_SIZE;
  }
  return map;
}

function computeReuseScore(sum, p95) {
  if (!p95 || p95 <= 0) return 0;
  const capped = Math.min(sum, p95);
  return clamp(100 * (ln1p(capped) / ln1p(p95)), 0, 100);
}
function computeMultiplier(rCombined) {
  return M_MIN + (M_MAX - M_MIN) * (rCombined / 100);
}

async function main() {
  console.log(`Computing FINAL importance for section_metrics model_version=${OUTPUT_MODEL_VERSION_METRICS}`);
  console.log('Loading inputs…');

  const booksMap = await fetchBooksMap();
  const reuseMap = await fetchAllReuseTotalsMap();
  const v1Map = await fetchV1MetricsMap();

  console.log(`Books loaded: ${booksMap.size}`);
  console.log(`Reuse totals loaded: ${reuseMap.size} sections`);
  console.log(`V1 metrics loaded: ${v1Map.size} sections`);

  const p95Nt = await fetchP95('section_reuse_totals', 'nt_reuse_sum', [{ col: 'model_version', op: 'eq', val: INPUT_MODEL_VERSION_REUSE_TOTALS }]);
  const p95Ot = await fetchP95('section_reuse_totals', 'ot_reuse_sum', [{ col: 'model_version', op: 'eq', val: INPUT_MODEL_VERSION_REUSE_TOTALS }]);

  console.log(`P95 nt_reuse_sum=${p95Nt}  |  P95 ot_reuse_sum=${p95Ot}`);

  await clearOutputModelVersion();

  // Pass 1
  const iRawVals = [];
  let offset = 0;
  while (true) {
    const secs = await fetchSectionsPage(offset);
    if (secs.length === 0) break;

    for (const s of secs) {
      const v1 = v1Map.get(s.id);
      const base = v1?.baseImportance ?? 0;

      const reuse = reuseMap.get(s.id) ?? { nt: 0, ot: 0 };
      const rNt = computeReuseScore(reuse.nt, p95Nt);
      const rOt = computeReuseScore(reuse.ot, p95Ot);
      const rCombined = clamp(W_NT * rNt + W_OT * rOt, 0, 100);
      iRawVals.push(base * computeMultiplier(rCombined));
    }
    offset += PAGE_SIZE;
  }

  iRawVals.sort((a, b) => a - b);
  const p95I = iRawVals[Math.max(0, Math.floor(0.95 * (iRawVals.length - 1)))] || 1;
  console.log(`P95_I_raw=${p95I}`);

  // Pass 2
  offset = 0;
  let wrote = 0;
  let buffer = [];

  while (true) {
    const secs = await fetchSectionsPage(offset);
    if (secs.length === 0) break;

    for (const s of secs) {
      const b = booksMap.get(s.book_code) ?? {};

      const v1 = v1Map.get(s.id) ?? {
        space: 0, structural: 0, gNarr: 0, gInstr: 0, gArg: 0, gPoet: 0, gList: 0, baseImportance: 0
      };

      const reuse = reuseMap.get(s.id) ?? { nt: 0, ot: 0 };
      const rNt = computeReuseScore(reuse.nt, p95Nt);
      const rOt = computeReuseScore(reuse.ot, p95Ot);
      const rCombined = clamp(W_NT * rNt + W_OT * rOt, 0, 100);

      const iRaw = v1.baseImportance * computeMultiplier(rCombined);
      const iFinal = (p95I > 0) ? (100 * (Math.min(iRaw, p95I) / p95I)) : 0;

      buffer.push({
        section_id: s.id,
        book_code: s.book_code,
        testament: b.testament ?? null,
        ot_division: b.ot_division ?? null,
        nt_division: b.nt_division ?? null,
        model_version: OUTPUT_MODEL_VERSION_METRICS,

        // NEVER NULL now:
        space_score: v1.space,
        structural_score: v1.structural,
        genre_narrative: v1.gNarr,
        genre_instruction: v1.gInstr,
        genre_argument: v1.gArg,
        genre_poetry: v1.gPoet,
        genre_list: v1.gList,

        nt_reuse_score: roundInt(rNt),
        ot_reuse_score: roundInt(rOt),
        importance_score: roundInt(clamp(iFinal, 0, 100))
      });

      if (buffer.length >= UPSERT_BATCH) {
        const { error } = await supabase
          .from('section_metrics')
          .upsert(buffer, { onConflict: 'section_id,model_version' });
        if (error) throw error;
        wrote += buffer.length;
        buffer = [];
        process.stdout.write(`wrote: ${wrote}\r`);
      }
    }

    offset += PAGE_SIZE;
  }

  if (buffer.length) {
    const { error } = await supabase
      .from('section_metrics')
      .upsert(buffer, { onConflict: 'section_id,model_version' });
    if (error) throw error;
    wrote += buffer.length;
  }

  console.log(`\nDONE. Wrote v2 rows: ${wrote}`);
  console.log('Reminder: until v1 metrics exist for all sections, most v2 importance will be 0.');
}

main().catch(err => {
  console.error('\nERROR:', err);
  process.exit(1);
});

