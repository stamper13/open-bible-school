import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ===== CONFIG =====
const INPUT_MODEL_VERSION_REUSE_TOTALS = 1; // section_reuse_totals model_version
const OUTPUT_MODEL_VERSION_METRICS = 2;     // section_metrics model_version to write
const W_NT = 0.65;
const W_OT = 0.35;
const M_MIN = 1.0;
const M_MAX = 1.60;                         // Option B locked
const PAGE_SIZE = 2000;
const UPSERT_BATCH = 1000;

// ===== HELPERS =====
function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}
function roundInt(x) {
  return Math.round(x);
}
function ln1p(x) {
  return Math.log(1 + x);
}

// Approx p95 using ordering + offset.
// For large tables this is acceptable and simple.
async function fetchP95(table, column, filters = []) {
  // filters: [{ col, op: 'eq', val }, ...]
  // We need count first
  let countQuery = supabase.from(table).select('*', { count: 'exact', head: true });
  for (const f of filters) {
    if (f.op === 'eq') countQuery = countQuery.eq(f.col, f.val);
    else if (f.op === 'gt') countQuery = countQuery.gt(f.col, f.val);
    else if (f.op === 'gte') countQuery = countQuery.gte(f.col, f.val);
  }
  const { count, error: countErr } = await countQuery;
  if (countErr) throw countErr;
  if (!count || count === 0) return 0;

  const idx = Math.max(0, Math.floor(0.95 * (count - 1)));

  let valQuery = supabase.from(table).select(column).order(column, { ascending: true }).range(idx, idx);
  for (const f of filters) {
    if (f.op === 'eq') valQuery = valQuery.eq(f.col, f.val);
    else if (f.op === 'gt') valQuery = valQuery.gt(f.col, f.val);
    else if (f.op === 'gte') valQuery = valQuery.gte(f.col, f.val);
  }

  const { data, error: valErr } = await valQuery;
  if (valErr) throw valErr;

  const v = data?.[0]?.[column];
  return Number(v ?? 0);
}

async function clearOutputModelVersion() {
  const { error } = await supabase
    .from('section_metrics')
    .delete()
    .eq('model_version', OUTPUT_MODEL_VERSION_METRICS);
  if (error) throw error;
}

async function fetchAllReuseTotalsMap() {
  // Pull all reuse totals for model v1 into memory keyed by section_id
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
  // We compute v2 for every section that exists (active/inactive doesn’t matter for metrics)
  const { data, error } = await supabase
    .from('scripture_sections')
    .select('id, book_code, testament, ot_division, nt_division')
    .order('id')
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw error;
  return data ?? [];
}

/**
 * Base importance is already present in section_metrics v1 as importance_score,
 * but we also want the components (space_score, structural_score, genre_*) for v2 rows.
 * We will read v1 section_metrics and treat v1 importance_score as I_base.
 */
async function fetchV1MetricsMap() {
  const map = new Map();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('section_metrics')
      .select([
        'section_id',
        'model_version',
        'space_score',
        'structural_score',
        'genre_narrative',
        'genre_instruction',
        'genre_argument',
        'genre_poetry',
        'genre_list',
        'importance_score'
      ].join(','))
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
  const score = 100 * (ln1p(capped) / ln1p(p95));
  return clamp(score, 0, 100);
}

function computeMultiplier(Rcombined) {
  return M_MIN + (M_MAX - M_MIN) * (Rcombined / 100);
}

async function main() {
  console.log(`Computing FINAL importance for section_metrics model_version=${OUTPUT_MODEL_VERSION_METRICS}`);
  console.log('Loading inputs…');

  const reuseMap = await fetchAllReuseTotalsMap();
  const v1Map = await fetchV1MetricsMap();

  console.log(`Reuse totals loaded: ${reuseMap.size} sections`);
  console.log(`V1 metrics loaded: ${v1Map.size} sections`);

  console.log('Computing P95 caps for reuse sums…');
  const p95Nt = await fetchP95(
    'section_reuse_totals',
    'nt_reuse_sum',
    [{ col: 'model_version', op: 'eq', val: INPUT_MODEL_VERSION_REUSE_TOTALS }]
  );
  const p95Ot = await fetchP95(
    'section_reuse_totals',
    'ot_reuse_sum',
    [{ col: 'model_version', op: 'eq', val: INPUT_MODEL_VERSION_REUSE_TOTALS }]
  );

  console.log(`P95 nt_reuse_sum=${p95Nt}  |  P95 ot_reuse_sum=${p95Ot}`);

  console.log('Clearing any existing v2 rows in section_metrics…');
  await clearOutputModelVersion();

  // First pass: compute I_raw for all sections so we can compute P95_I
  console.log('Pass 1: computing I_raw distribution (for P95_I)…');

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
      const mult = computeMultiplier(rCombined);

      const iRaw = base * mult;
      iRawVals.push(iRaw);
    }

    offset += PAGE_SIZE;
    process.stdout.write(`  scanned sections: ${offset}\r`);
  }

  if (iRawVals.length === 0) throw new Error('No sections found in scripture_sections.');

  iRawVals.sort((a, b) => a - b);
  const idx = Math.max(0, Math.floor(0.95 * (iRawVals.length - 1)));
  const p95I = iRawVals[idx] || 1;

  console.log(`\nP95_I_raw=${p95I}`);

  // Second pass: compute final scores and upsert
  console.log('Pass 2: computing and upserting v2 metrics…');

  offset = 0;
  let upsertBuffer = [];
  let wrote = 0;

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

      const mult = computeMultiplier(rCombined);
      const iRaw = base * mult;

      const iCapped = Math.min(iRaw, p95I);
      const iFinal = p95I > 0 ? (100 * (iCapped / p95I)) : 0;

      // Store as integers (Option A)
      const ntReuseScoreInt = roundInt(rNt);
      const otReuseScoreInt = roundInt(rOt);
      const importanceInt = roundInt(clamp(iFinal, 0, 100));

      upsertBuffer.push({
        section_id: s.id,
        book_code: s.book_code,
        testament: s.testament,
        ot_division: s.ot_division,
        nt_division: s.nt_division,
        model_version: OUTPUT_MODEL_VERSION_METRICS,

        // carry forward component scores from v1 if present (keeps v2 row self-contained)
        space_score: v1?.space ?? null,
        structural_score: v1?.structural ?? null,
        genre_narrative: v1?.gNarr ?? null,
        genre_instruction: v1?.gInstr ?? null,
        genre_argument: v1?.gArg ?? null,
        genre_poetry: v1?.gPoet ?? null,
        genre_list: v1?.gList ?? null,

        // computed reuse + final importance
        nt_reuse_score: ntReuseScoreInt,
        ot_reuse_score: otReuseScoreInt,
        importance_score: importanceInt,

        updated_at: new Date().toISOString()
      });

      if (upsertBuffer.length >= UPSERT_BATCH) {
        const { error } = await supabase
          .from('section_metrics')
          .upsert(upsertBuffer, { onConflict: 'section_id,model_version' });
        if (error) throw error;
        wrote += upsertBuffer.length;
        upsertBuffer = [];
        process.stdout.write(`  wrote rows: ${wrote}\r`);
      }
    }

    offset += PAGE_SIZE;
  }

  if (upsertBuffer.length > 0) {
    const { error } = await supabase
      .from('section_metrics')
      .upsert(upsertBuffer, { onConflict: 'section_id,model_version' });
    if (error) throw error;
    wrote += upsertBuffer.length;
  }

  console.log(`\nDONE. Wrote v2 rows: ${wrote}`);

  console.log('\nQuick sanity checks:');
  const { data: chk, error: chkErr } = await supabase
    .from('section_metrics')
    .select('importance_score, nt_reuse_score, ot_reuse_score')
    .eq('model_version', OUTPUT_MODEL_VERSION_METRICS)
    .order('importance_score', { ascending: false })
    .limit(10);

  if (chkErr) throw chkErr;
  console.log('Top 10 by importance_score (v2):');
  console.log(chk);
}

main().catch(err => {
  console.error('\nERROR:', err);
  process.exit(1);
});

