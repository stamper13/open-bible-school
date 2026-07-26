import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ===== CONFIG =====
const INPUT_MODEL_VERSION_REUSE_TOTALS = 1; // section_reuse_totals.model_version
const INPUT_MODEL_VERSION_BASE = 1;        // section_metrics.model_version (base importance)
const OUTPUT_MODEL_VERSION = 2;            // section_metrics.model_version (final)

const W_NT = 0.65;
const W_OT = 0.35;

const M_MIN = 1.0;
const M_MAX = 1.60;

const PAGE_SIZE = 1000;     // important: avoid server/page caps
const UPSERT_BATCH = 1000;

// ===== HELPERS =====
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function roundInt(x) { return Math.round(x); }
function ln1p(x) { return Math.log(1 + x); }

async function clearOutputModelVersion() {
  const { error } = await supabase
    .from('section_metrics')
    .delete()
    .eq('model_version', OUTPUT_MODEL_VERSION);
  if (error) throw error;
}

async function fetchP95Reuse(column) {
  const { count, error: cErr } = await supabase
    .from('section_reuse_totals')
    .select('*', { count: 'exact', head: true })
    .eq('model_version', INPUT_MODEL_VERSION_REUSE_TOTALS);
  if (cErr) throw cErr;
  if (!count || count === 0) return 0;

  const idx = Math.max(0, Math.floor(0.95 * (count - 1)));

  const { data, error } = await supabase
    .from('section_reuse_totals')
    .select(column)
    .eq('model_version', INPUT_MODEL_VERSION_REUSE_TOTALS)
    .order(column, { ascending: true })
    .range(idx, idx);

  if (error) throw error;
  return Number(data?.[0]?.[column] ?? 0);
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

    offset += data.length;
    if (data.length < PAGE_SIZE) break;
  }

  return map;
}

async function fetchReuseMap() {
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

    offset += data.length;
    if (data.length < PAGE_SIZE) break;
  }

  return map;
}

async function fetchV1Map() {
  const map = new Map();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('section_metrics')
      .select([
        'section_id',
        'book_code',
        'space_score',
        'structural_score',
        'genre_narrative',
        'genre_instruction',
        'genre_argument',
        'genre_poetry',
        'genre_list',
        'importance_score'
      ].join(','))
      .eq('model_version', INPUT_MODEL_VERSION_BASE)
      .order('section_id')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const r of data) {
      map.set(r.section_id, {
        book_code: r.book_code,
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

    offset += data.length;
    if (data.length < PAGE_SIZE) break;
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

function computeReuseScore(sum, p95) {
  if (!p95 || p95 <= 0) return 0;
  const capped = Math.min(sum, p95);
  return clamp(100 * (ln1p(capped) / ln1p(p95)), 0, 100);
}

function computeMultiplier(rCombined) {
  return M_MIN + (M_MAX - M_MIN) * (rCombined / 100);
}

async function main() {
  console.log(`Compute v2 importance (model_version=${OUTPUT_MODEL_VERSION}) with SAFE pagination`);

  const booksMap = await fetchBooksMap();
  const reuseMap = await fetchReuseMap();
  const v1Map = await fetchV1Map();

  console.log(`Books loaded: ${booksMap.size}`);
  console.log(`Reuse totals loaded: ${reuseMap.size} sections (missing => reuse=0)`);
  console.log(`V1 metrics loaded: ${v1Map.size} sections`);

  const p95Nt = await fetchP95Reuse('nt_reuse_sum');
  const p95Ot = await fetchP95Reuse('ot_reuse_sum');
  console.log(`P95 nt_reuse_sum=${p95Nt} | P95 ot_reuse_sum=${p95Ot}`);

  await clearOutputModelVersion();
  console.log('Cleared existing v2 rows in section_metrics.');

  // Pass 1: compute P95_I_raw across ALL sections
  const iRawVals = [];
  let offset = 0;

  while (true) {
    const secs = await fetchSectionsPage(offset);
    if (!secs.length) break;

    for (const s of secs) {
      const v1 = v1Map.get(s.id);
      if (!v1) throw new Error(`Missing v1 metrics for section_id=${s.id}`);

      const reuse = reuseMap.get(s.id) ?? { nt: 0, ot: 0 };
      const rNt = computeReuseScore(reuse.nt, p95Nt);
      const rOt = computeReuseScore(reuse.ot, p95Ot);
      const rCombined = clamp(W_NT * rNt + W_OT * rOt, 0, 100);

      const mult = computeMultiplier(rCombined);
      iRawVals.push(v1.baseImportance * mult);
    }

    offset += secs.length;
    process.stdout.write(`Scanned sections: ${offset}\r`);
    if (secs.length < PAGE_SIZE) break;
  }

  iRawVals.sort((a, b) => a - b);
  const p95I = iRawVals[Math.max(0, Math.floor(0.95 * (iRawVals.length - 1)))] || 1;
  console.log(`\nP95_I_raw=${p95I} (computed over ${iRawVals.length} sections)`);

  // Pass 2: compute and upsert v2
  offset = 0;
  let wrote = 0;
  let buffer = [];

  while (true) {
    const secs = await fetchSectionsPage(offset);
    if (!secs.length) break;

    for (const s of secs) {
      const v1 = v1Map.get(s.id);
      if (!v1) throw new Error(`Missing v1 metrics for section_id=${s.id}`);

      const b = booksMap.get(s.book_code) ?? {};
      const reuse = reuseMap.get(s.id) ?? { nt: 0, ot: 0 };

      const rNt = computeReuseScore(reuse.nt, p95Nt);
      const rOt = computeReuseScore(reuse.ot, p95Ot);
      const rCombined = clamp(W_NT * rNt + W_OT * rOt, 0, 100);

      const mult = computeMultiplier(rCombined);
      const iRaw = v1.baseImportance * mult;
      const iFinal = (p95I > 0) ? (100 * (Math.min(iRaw, p95I) / p95I)) : 0;

      buffer.push({
        section_id: s.id,
        book_code: v1.book_code ?? s.book_code,
        testament: b.testament ?? null,
        ot_division: b.ot_division ?? null,
        nt_division: b.nt_division ?? null,
        model_version: OUTPUT_MODEL_VERSION,

        // carry v1 to satisfy constraints
        space_score: v1.space,
        structural_score: v1.structural,
        genre_narrative: v1.gNarr,
        genre_instruction: v1.gInstr,
        genre_argument: v1.gArg,
        genre_poetry: v1.gPoet,
        genre_list: v1.gList,

        // v2 values
        nt_reuse_score: roundInt(rNt),
        ot_reuse_score: roundInt(rOt),
        importance_score: roundInt(clamp(iFinal, 0, 100)),

        updated_at: new Date().toISOString()
      });

      if (buffer.length >= UPSERT_BATCH) {
        const { error } = await supabase
          .from('section_metrics')
          .upsert(buffer, { onConflict: 'section_id,model_version' });

        if (error) throw error;

        wrote += buffer.length;
        buffer = [];
        process.stdout.write(`Wrote rows: ${wrote}\r`);
      }
    }

    offset += secs.length;
    if (secs.length < PAGE_SIZE) break;
  }

  if (buffer.length) {
    const { error } = await supabase
      .from('section_metrics')
      .upsert(buffer, { onConflict: 'section_id,model_version' });

    if (error) throw error;
    wrote += buffer.length;
  }

  console.log(`\nDONE. Wrote v2 rows: ${wrote}`);
}

main().catch(err => {
  console.error('\nERROR:', err);
  process.exit(1);
});

