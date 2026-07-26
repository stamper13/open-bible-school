// compute-final-importance-v3.js
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing Supabase credentials');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const MODEL_VERSION = 3;

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

function log1p(x) { return Math.log(1 + Math.max(0, x)); }

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

async function main() {
  console.log(`Compute FINAL importance v3 (model_version=${MODEL_VERSION})`);

  console.log('Loading v3 section metrics…');
  const metrics = await fetchAll(
    'section_metrics',
    'id,section_id,book_code,model_version,space_score,structural_score,genre_narrative,genre_instruction,genre_argument,genre_poetry_oracle,genre_poetry_wisdom,genre_list_roster,genre_list_instructional,roster_ratio',
    2000,
    'section_id'
  );
  const v3 = metrics.filter(r => r.model_version === MODEL_VERSION);
  console.log(`Loaded v3 rows: ${v3.length}`);

  if (!v3.length) {
    console.log('No v3 rows found. Run: node compute-section-metrics-v3.js');
    return;
  }

  // Map section_id -> reuse sums (incoming only)
  // We compute reuse at the verse-level first, then roll up to sections using scripture_verses.section_id.
  console.log('Loading verses (id, section_id)…');
  const verses = await fetchAll('scripture_verses', 'id,section_id', 4000);
  const sectionIdByVerseId = new Map();
  for (const v of verses) {
    if (v.id && v.section_id) sectionIdByVerseId.set(v.id, v.section_id);
  }

  console.log('Loading parsed crossrefs (incoming to_*)…');
  const cross = await fetchAll(
    'openbible_crossrefs_parsed',
    'to_book_code,to_ch_start,to_vs_start,to_ch_end,to_vs_end,votes,from_is_nt,from_is_ot',
    4000
  );

  // Build a fast lookup: (book,ch,vs) -> section_id via scripture_verses
  console.log('Loading verse refs for lookup…');
  const verseRefs = await fetchAll('scripture_verses', 'id,book_code,chapter,verse,section_id', 4000);
  const keyToSection = new Map();
  for (const v of verseRefs) {
    if (!v.section_id) continue;
    const k = `${v.book_code}.${v.chapter}.${v.verse}`;
    keyToSection.set(k, v.section_id);
  }

  const ntSumBySection = new Map();
  const otSumBySection = new Map();

  let processed = 0;
  for (const r of cross) {
    processed++;
    if (processed % 50000 === 0) console.log(`  processed crossrefs: ${processed}/${cross.length}`);

    const votes = Number(r.votes ?? 0);

    // Expand the "to" range (usually same verse; sometimes ranges)
    const bc = r.to_book_code;
    const chStart = r.to_ch_start;
    const vsStart = r.to_vs_start;
    const chEnd = r.to_ch_end ?? chStart;
    const vsEnd = r.to_vs_end ?? vsStart;

    // If range spans multiple chapters, we keep it simple: only handle same-chapter ranges here.
    // (OpenBible ranges are typically within a chapter; this keeps phase-1 lean.)
    if (chStart !== chEnd) continue;

    for (let vs = vsStart; vs <= vsEnd; vs++) {
      const sid = keyToSection.get(`${bc}.${chStart}.${vs}`);
      if (!sid) continue;

      if (r.from_is_nt) ntSumBySection.set(sid, (ntSumBySection.get(sid) ?? 0) + votes);
      if (r.from_is_ot) otSumBySection.set(sid, (otSumBySection.get(sid) ?? 0) + votes);
    }
  }

  // Compute P95 caps on log-scaled sums
  const ntLogs = [];
  const otLogs = [];
  for (const row of v3) {
    const sid = row.section_id;
    ntLogs.push(log1p(ntSumBySection.get(sid) ?? 0));
    otLogs.push(log1p(otSumBySection.get(sid) ?? 0));
  }
  const p95Nt = Math.max(1e-9, percentile(ntLogs, 0.95));
  const p95Ot = Math.max(1e-9, percentile(otLogs, 0.95));
  console.log(`P95 log1p(nt_votes_sum)=${p95Nt.toFixed(6)} | P95 log1p(ot_votes_sum)=${p95Ot.toFixed(6)}`);

  // Weights (lean, BLI-focused)
  const W_SPACE = 0.30;
  const W_STRUCT = 0.20;
  const W_REUSE = 0.30;
  const W_GENRE = 0.20;

  // Genre weights (within the genre term)
  const GW = {
    instruction: 0.40,
    narrative: 0.35,
    argument: 0.10,
    poetry_oracle: 0.10,
    poetry_wisdom: 0.03,
    list_instructional: 0.02,
    list_roster: 0.00
  };

  function genreScore100(r) {
    // r.* are 0–100 parts
    const g =
      (r.genre_instruction / 100) * GW.instruction +
      (r.genre_narrative / 100) * GW.narrative +
      (r.genre_argument / 100) * GW.argument +
      (r.genre_poetry_oracle / 100) * GW.poetry_oracle +
      (r.genre_poetry_wisdom / 100) * GW.poetry_wisdom +
      (r.genre_list_instructional / 100) * GW.list_instructional +
      (r.genre_list_roster / 100) * GW.list_roster;

    return clamp(Math.round(g * 100), 0, 100);
  }

  // Pass 1: compute raw distribution to scale 0–100 (avoid “everyone high”)
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
      W_SPACE * (r.space_score ?? 0) +
      W_STRUCT * (r.structural_score ?? 0) +
      W_REUSE * reuseScore +
      W_GENRE * gScore;

    // roster penalty (explicit)
    const rosterRatio = Number(r.roster_ratio ?? 0);
    raw = raw * (1 - 0.60 * clamp(rosterRatio, 0, 1));

    Iraw.push(raw);
  }
  const p95I = Math.max(1e-9, percentile(Iraw, 0.95));
  console.log(`P95 importance_raw=${p95I.toFixed(6)}`);

  // Pass 2: compute and upsert
  console.log('Upserting FINAL v3 rows…');
  const updates = [];
  for (let i = 0; i < v3.length; i++) {
    const r = v3[i];
    const sid = r.section_id;

    const ntLog = log1p(ntSumBySection.get(sid) ?? 0);
    const otLog = log1p(otSumBySection.get(sid) ?? 0);

    const ntScore = clamp(Math.round(100 * Math.min(1, ntLog / p95Nt)), 0, 100);
    const otScore = clamp(Math.round(100 * Math.min(1, otLog / p95Ot)), 0, 100);
    const reuseScore = Math.round((ntScore + otScore) / 2);

    const gScore = genreScore100(r);

    let raw =
      W_SPACE * (r.space_score ?? 0) +
      W_STRUCT * (r.structural_score ?? 0) +
      W_REUSE * reuseScore +
      W_GENRE * gScore;

    const rosterRatio = Number(r.roster_ratio ?? 0);
    raw = raw * (1 - 0.60 * clamp(rosterRatio, 0, 1));

    const importance = clamp(Math.round(100 * Math.min(1, raw / p95I)), 0, 100);

    updates.push({
      section_id: sid,
      model_version: MODEL_VERSION,

      nt_reuse_score: ntScore,
      ot_reuse_score: otScore,

      importance_score: importance,
      dispute_risk: 'low',
      notes: null
    });
  }

  const chunkSize = 500;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const { error } = await supabase.from('section_metrics').upsert(chunk, { onConflict: 'section_id,model_version' });
    if (error) throw error;
    if ((i / chunkSize) % 10 === 0) console.log(`  wrote ${Math.min(i + chunkSize, updates.length)}/${updates.length}`);
  }

  console.log(`DONE. Final importance written for v3 rows: ${updates.length}`);
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
