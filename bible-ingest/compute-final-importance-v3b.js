// compute-final-importance-v3b.js
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing Supabase credentials');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const MODEL_VERSION = 3;

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function log1p(x) { return Math.log(1 + Math.max(0, x)); }

function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  const w = idx - lo;
  return s[lo] * (1 - w) + s[hi] * w;
}

async function fetchAll(table, select, pageSize = 2000, orderCol = null) {
  let all = [];
  let from = 0;
  while (true) {
    const to = from + pageSize - 1;
    let q = supabase.from(table).select(select).range(from, to);
    if (orderCol) q = q.order(orderCol, { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function genreScore100(r) {
  // Genre weights (BLI-focused)
  const GW = {
    instruction: 0.40,
    narrative: 0.35,
    argument: 0.10,
    poetry_oracle: 0.10,
    poetry_wisdom: 0.03,
    list_instructional: 0.02,
    list_roster: 0.00
  };

  const g =
    (Number(r.genre_instruction || 0) / 100) * GW.instruction +
    (Number(r.genre_narrative || 0) / 100) * GW.narrative +
    (Number(r.genre_argument || 0) / 100) * GW.argument +
    (Number(r.genre_poetry_oracle || 0) / 100) * GW.poetry_oracle +
    (Number(r.genre_poetry_wisdom || 0) / 100) * GW.poetry_wisdom +
    (Number(r.genre_list_instructional || 0) / 100) * GW.list_instructional +
    (Number(r.genre_list_roster || 0) / 100) * GW.list_roster;

  return clamp(Math.round(g * 100), 0, 100);
}

async function main() {
  console.log(`Compute FINAL importance v3b (model_version=${MODEL_VERSION})`);

  console.log('Loading v3 section metrics…');
  const metricsAll = await fetchAll(
    'section_metrics',
    [
      'section_id',
      'book_code',
      'testament',
      'ot_division',
      'nt_division',
      'model_version',
      'space_score',
      'structural_score',
      'genre_narrative',
      'genre_instruction',
      'genre_argument',
      'genre_poetry_oracle',
      'genre_poetry_wisdom',
      'genre_list_roster',
      'genre_list_instructional',
      'roster_ratio'
    ].join(','),
    2000,
    'section_id'
  );

  const v3 = metricsAll.filter(r => r.model_version === MODEL_VERSION);
  console.log(`Loaded v3 rows: ${v3.length}`);
  if (!v3.length) {
    console.log('No v3 rows found. Run: node compute-section-metrics-v3.js');
    return;
  }

  // Quick sanity check: if many rows missing book_code, stop early.
  const nullBook = v3.filter(r => !r.book_code).length;
  if (nullBook > 0) {
    throw new Error(`v3 contains ${nullBook} rows with null book_code. Recompute v3 metrics before final.`);
  }

  console.log('Loading verse refs for lookup…');
  const verseRefs = await fetchAll('scripture_verses', 'book_code,chapter,verse,section_id', 4000);

  // (book.ch.vs) -> section_id
  const keyToSection = new Map();
  for (const v of verseRefs) {
    if (!v.section_id) continue;
    keyToSection.set(`${v.book_code}.${v.chapter}.${v.verse}`, v.section_id);
  }

  console.log('Loading parsed crossrefs (incoming)…');
  const cross = await fetchAll(
    'openbible_crossrefs_parsed',
    'to_book_code,to_ch_start,to_vs_start,to_ch_end,to_vs_end,votes,from_is_nt,from_is_ot',
    4000
  );

  const ntSumBySection = new Map();
  const otSumBySection = new Map();

  let processed = 0;
  for (const r of cross) {
    processed++;
    if (processed % 50000 === 0) console.log(`  processed crossrefs: ${processed}/${cross.length}`);

    const votes = Number(r.votes ?? 0);
    const bc = r.to_book_code;
    const chStart = r.to_ch_start;
    const vsStart = r.to_vs_start;
    const chEnd = r.to_ch_end ?? chStart;
    const vsEnd = r.to_vs_end ?? vsStart;

    // keep phase-1 simple: only same-chapter ranges
    if (chStart !== chEnd) continue;

    for (let vs = vsStart; vs <= vsEnd; vs++) {
      const sid = keyToSection.get(`${bc}.${chStart}.${vs}`);
      if (!sid) continue;

      if (r.from_is_nt) ntSumBySection.set(sid, (ntSumBySection.get(sid) ?? 0) + votes);
      if (r.from_is_ot) otSumBySection.set(sid, (otSumBySection.get(sid) ?? 0) + votes);
    }
  }

  // P95 caps on log1p sums
  const ntLogs = [];
  const otLogs = [];
  for (const row of v3) {
    const sid = row.section_id;
    ntLogs.push(log1p(ntSumBySection.get(sid) ?? 0));
    otLogs.push(log1p(otSumBySection.get(sid) ?? 0));
  }

  // If everything is zero, set p95 to 1 to avoid divide-by-zero; scores will remain 0 anyway.
  let p95Nt = percentile(ntLogs, 0.95);
  let p95Ot = percentile(otLogs, 0.95);
  if (p95Nt <= 0) p95Nt = 1;
  if (p95Ot <= 0) p95Ot = 1;

  console.log(`P95 log1p(nt_votes_sum)=${p95Nt.toFixed(6)} | P95 log1p(ot_votes_sum)=${p95Ot.toFixed(6)}`);

  // Lean weights
  const W_SPACE = 0.30;
  const W_STRUCT = 0.20;
  const W_REUSE = 0.30;
  const W_GENRE = 0.20;

  // Pass 1: compute raw distribution to scale 0–100
  const Iraw = [];
  for (const r of v3) {
    const sid = r.section_id;
    const ntLog = log1p(ntSumBySection.get(sid) ?? 0);
    const otLog = log1p(otSumBySection.get(sid) ?? 0);

    const ntScore = clamp(Math.round(100 * Math.min(1, ntLog / p95Nt)), 0, 100);
    const otScore = clamp(Math.round(100 * Math.min(1, otLog / p95Ot)), 0, 100);
    const reuseScore = Math.round((ntScore + otScore) / 2);

    const gScore = genreScore100(r);

    let raw =
      W_SPACE * Number(r.space_score ?? 0) +
      W_STRUCT * Number(r.structural_score ?? 0) +
      W_REUSE * reuseScore +
      W_GENRE * gScore;

    const rosterRatio = clamp(Number(r.roster_ratio ?? 0), 0, 1);
    raw = raw * (1 - 0.60 * rosterRatio);

    Iraw.push(raw);
  }

  let p95I = percentile(Iraw, 0.95);
  if (p95I <= 0) p95I = 1;
  console.log(`P95 importance_raw=${p95I.toFixed(6)}`);

  // Pass 2: upsert updates INCLUDING required base fields (book_code, etc.)
  console.log('Upserting FINAL v3 rows…');

  const updates = [];
  for (const r of v3) {
    const sid = r.section_id;
    const ntLog = log1p(ntSumBySection.get(sid) ?? 0);
    const otLog = log1p(otSumBySection.get(sid) ?? 0);

    const ntScore = clamp(Math.round(100 * Math.min(1, ntLog / p95Nt)), 0, 100);
    const otScore = clamp(Math.round(100 * Math.min(1, otLog / p95Ot)), 0, 100);
    const reuseScore = Math.round((ntScore + otScore) / 2);

    const gScore = genreScore100(r);

    let raw =
      W_SPACE * Number(r.space_score ?? 0) +
      W_STRUCT * Number(r.structural_score ?? 0) +
      W_REUSE * reuseScore +
      W_GENRE * gScore;

    const rosterRatio = clamp(Number(r.roster_ratio ?? 0), 0, 1);
    raw = raw * (1 - 0.60 * rosterRatio);

    const importance = clamp(Math.round(100 * Math.min(1, raw / p95I)), 0, 100);

    // Include all NOT-NULL-ish / base columns so inserts are valid
    updates.push({
      section_id: sid,
      model_version: MODEL_VERSION,

      book_code: r.book_code,
      testament: r.testament ?? null,
      ot_division: r.ot_division ?? null,
      nt_division: r.nt_division ?? null,

      space_score: Number(r.space_score ?? 0),
      structural_score: Number(r.structural_score ?? 0),

      genre_narrative: Number(r.genre_narrative ?? 0),
      genre_instruction: Number(r.genre_instruction ?? 0),
      genre_argument: Number(r.genre_argument ?? 0),

      // legacy fields (keep at 0 for v3)
      genre_poetry: 0,
      genre_list: 0,

      genre_poetry_oracle: Number(r.genre_poetry_oracle ?? 0),
      genre_poetry_wisdom: Number(r.genre_poetry_wisdom ?? 0),
      genre_list_roster: Number(r.genre_list_roster ?? 0),
      genre_list_instructional: Number(r.genre_list_instructional ?? 0),

      roster_ratio: rosterRatio,

      nt_reuse_score: ntScore,
      ot_reuse_score: otScore,

      importance_score: importance,
      dispute_risk: 'low',
      notes: null,
      is_genre_overridden: false,
      is_dispute_overridden: false
    });
  }

  const chunkSize = 500;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const { error } = await supabase
      .from('section_metrics')
      .upsert(chunk, { onConflict: 'section_id,model_version' });
    if (error) throw error;
    if (i % (chunkSize * 10) === 0) console.log(`  wrote ${Math.min(i + chunkSize, updates.length)}/${updates.length}`);
  }

  console.log(`DONE. Final importance written for v3 rows: ${updates.length}`);
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
