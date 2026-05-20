// Supabase client. Server-side only. Uses the service role key.
// Crashes immediately at import time if env is missing, per house rules.

import { createClient } from '@supabase/supabase-js';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing env var ${name}. Copy .env.example to .env.local and fill it in, ` +
      `or pass it to node via --env-file=.env.local.`
    );
  }
  return v;
}

let _client = null;

export function db() {
  if (_client) return _client;
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_KEY');
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return _client;
}

// Table names. All Directory Hunter tables are prefixed `dh_` so the schema
// can share a Supabase project with other apps without colliding.
export const T = {
  sources: 'dh_discovery_sources',
  candidates: 'dh_niche_candidates',
  evaluations: 'dh_evaluations',
  evaluation_data: 'dh_evaluation_data',
  dimension_scores: 'dh_dimension_scores',
  build_plans: 'dh_build_plans',
  digests: 'dh_digests',
  category_samples: 'dh_category_samples'
};

// Upsert a batch of candidate rows on source_url_canonical.
// Returns { inserted, conflicts } counts.
export async function upsertCandidates(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, conflicts: 0 };

  const supabase = db();
  const { data, error } = await supabase
    .from(T.candidates)
    .upsert(rows, { onConflict: 'source_url_canonical', ignoreDuplicates: true })
    .select('id');

  if (error) throw new Error(`upsertCandidates failed: ${error.message}`);
  const inserted = data?.length ?? 0;
  return { inserted, conflicts: rows.length - inserted };
}

export async function markSourceScanned(sourceId) {
  const supabase = db();
  const { error } = await supabase
    .from(T.sources)
    .update({ last_scanned_at: new Date().toISOString() })
    .eq('id', sourceId);
  if (error) throw new Error(`markSourceScanned(${sourceId}) failed: ${error.message}`);
}

// Returns { sourceId: 'Display Name', ... } for prompt building.
let _sourcesMap = null;
export async function getSourcesMap() {
  if (_sourcesMap) return _sourcesMap;
  const supabase = db();
  const { data, error } = await supabase.from(T.sources).select('id, name');
  if (error) throw new Error(`getSourcesMap failed: ${error.message}`);
  _sourcesMap = Object.fromEntries(data.map(s => [s.id, s.name]));
  return _sourcesMap;
}

// Candidates that have not yet been scored. Ordered newest first so the
// scoring pass works on whatever the latest scan produced.
export async function fetchUnscoredCandidates({ limit = 100 } = {}) {
  const supabase = db();
  const { data, error } = await supabase
    .from(T.candidates)
    .select('id, source_id, niche_raw, geographic_hint, revenue_signal, revenue_amount_usd_monthly, raw_context, discovery_category')
    .is('scored_at', null)
    .order('found_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`fetchUnscoredCandidates failed: ${error.message}`);
  return data;
}

// Writes scoring output back to a single candidate row.
export async function updateCandidateScore(id, fields) {
  const supabase = db();
  const { error } = await supabase
    .from(T.candidates)
    .update({ ...fields, scored_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`updateCandidateScore(${id}) failed: ${error.message}`);
}

// ----- UI-facing helpers -----

const ALLOWED_STATUSES = new Set(['new', 'queued_for_eval', 'evaluated', 'archived', 'building']);

// Filters: { status, minScore, source, category, q (search), page, pageSize }
// Returns { rows, total, page, pageSize, totalPages }.
export async function listCandidates(filters = {}) {
  const {
    status = 'active',
    minScore = null,
    source = null,
    category = null,
    q = null,
    page = 1,
    pageSize = 25
  } = filters;

  const supabase = db();
  let query = supabase
    .from(T.candidates)
    .select('id, source_id, source_url, niche_raw, niche_canonical, geographic_hint, revenue_signal, revenue_amount_usd_monthly, discovery_score, discovery_category, estimated_arpu_usd, fit_reasoning, status, found_at, scored_at, posted_at', { count: 'exact' });

  if (status === 'active') {
    query = query.neq('status', 'archived');
  } else if (status !== 'all') {
    query = query.eq('status', status);
  }
  if (Number.isFinite(minScore)) query = query.gte('discovery_score', minScore);
  if (source) query = query.eq('source_id', source);
  if (category) query = query.eq('discovery_category', category);
  if (q && q.trim()) {
    const term = q.trim().replace(/[%_]/g, '');
    query = query.or(`niche_raw.ilike.%${term}%,niche_canonical.ilike.%${term}%,raw_context.ilike.%${term}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query
    .order('discovery_score', { ascending: false, nullsFirst: false })
    .order('found_at', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(`listCandidates failed: ${error.message}`);
  return {
    rows: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize))
  };
}

export async function getCandidateById(id) {
  const supabase = db();
  const { data, error } = await supabase
    .from(T.candidates)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getCandidateById(${id}) failed: ${error.message}`);
  return data;
}

export async function updateCandidateStatus(id, status) {
  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error(`updateCandidateStatus: invalid status '${status}'`);
  }
  const supabase = db();
  const { error } = await supabase
    .from(T.candidates)
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(`updateCandidateStatus(${id}, ${status}) failed: ${error.message}`);
}

// ----- Evaluation helpers -----

// Creates a pending evaluation row. If a non-failed row already exists for the
// same (niche, metro), returns it (enforced by the unique partial index on
// `where status != 'failed'`). The 24h paid-API cache lives at the
// dh_evaluation_data level (saveEvaluationData / cachedOrFetch in evaluate.js),
// not here, so re-submitting an old eval re-runs scoring against cached source
// data and rewrites dimension scores + plan in place.
export async function createEvaluation({ niche, metro, candidateId = null }) {
  const supabase = db();
  const lowerNiche = niche.trim().toLowerCase();
  const lowerMetro = metro.trim().toLowerCase();

  const { data: existing, error: lookupErr } = await supabase
    .from(T.evaluations)
    .select('*')
    .ilike('niche', niche.trim())
    .ilike('metro', metro.trim())
    .neq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupErr) throw new Error(`createEvaluation lookup failed: ${lookupErr.message}`);
  if (existing) return existing;

  const { data, error } = await supabase
    .from(T.evaluations)
    .insert({
      niche: niche.trim(),
      metro: metro.trim(),
      candidate_id: candidateId,
      status: 'pending'
    })
    .select('*')
    .single();
  if (error) throw new Error(`createEvaluation insert failed: ${error.message}`);
  return data;
}

export async function getEvaluation(id) {
  const supabase = db();
  const { data, error } = await supabase
    .from(T.evaluations)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getEvaluation(${id}) failed: ${error.message}`);
  return data;
}

export async function listEvaluations({ limit = 100 } = {}) {
  const supabase = db();
  const { data, error } = await supabase
    .from(T.evaluations)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listEvaluations failed: ${error.message}`);
  return data ?? [];
}

export async function updateEvaluation(id, fields) {
  const supabase = db();
  const { error } = await supabase
    .from(T.evaluations)
    .update(fields)
    .eq('id', id);
  if (error) throw new Error(`updateEvaluation(${id}) failed: ${error.message}`);
}

// Atomically claim the oldest pending evaluation by flipping it from
// 'pending' to 'running'. Returns the claimed row, or null if nothing pending
// (or another worker beat us to it). Used by the Railway run-pending-
// evaluations cron so two concurrent crons never process the same row.
export async function claimPendingEvaluation() {
  const supabase = db();
  const { data: candidate, error: findErr } = await supabase
    .from(T.evaluations)
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findErr) throw new Error(`claimPendingEvaluation find failed: ${findErr.message}`);
  if (!candidate) return null;

  const { data: claimed, error: claimErr } = await supabase
    .from(T.evaluations)
    .update({ status: 'running' })
    .eq('id', candidate.id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  if (claimErr) throw new Error(`claimPendingEvaluation claim failed: ${claimErr.message}`);
  return claimed;  // null if the row was already claimed by another worker
}

export async function getEvaluationData(evaluationId, source = null) {
  const supabase = db();
  let q = supabase.from(T.evaluation_data).select('*').eq('evaluation_id', evaluationId);
  if (source) q = q.eq('source', source);
  const { data, error } = await q;
  if (error) throw new Error(`getEvaluationData failed: ${error.message}`);
  return data ?? [];
}

// Insert a payload (Google Places / DataforSEO / Trends). Skips if same source
// already saved fresh data within freshHours.
export async function saveEvaluationData(evaluationId, source, payload, { freshHours = 24 } = {}) {
  const supabase = db();
  const cutoff = new Date(Date.now() - freshHours * 3600 * 1000).toISOString();
  const { data: existing } = await supabase
    .from(T.evaluation_data)
    .select('id, fetched_at')
    .eq('evaluation_id', evaluationId)
    .eq('source', source)
    .gte('fetched_at', cutoff)
    .limit(1);
  if (existing && existing.length > 0) return { reused: true, id: existing[0].id };

  const { data, error } = await supabase
    .from(T.evaluation_data)
    .insert({ evaluation_id: evaluationId, source, payload })
    .select('id')
    .single();
  if (error) throw new Error(`saveEvaluationData(${source}) failed: ${error.message}`);
  return { reused: false, id: data.id };
}

export async function saveDimensionScores(evaluationId, scores) {
  if (!scores || scores.length === 0) return;
  const supabase = db();
  const rows = scores.map(s => ({
    evaluation_id: evaluationId,
    dimension: s.dimension,
    score: s.score,
    max_score: s.max_score,
    reasoning: s.reasoning,
    evidence: s.evidence ?? null
  }));
  await supabase.from(T.dimension_scores).delete().eq('evaluation_id', evaluationId);
  const { error } = await supabase.from(T.dimension_scores).insert(rows);
  if (error) throw new Error(`saveDimensionScores failed: ${error.message}`);
}

export async function getDimensionScores(evaluationId) {
  const supabase = db();
  const { data, error } = await supabase
    .from(T.dimension_scores)
    .select('*')
    .eq('evaluation_id', evaluationId);
  if (error) throw new Error(`getDimensionScores failed: ${error.message}`);
  return data ?? [];
}

export async function saveBuildPlan(evaluationId, plan) {
  const supabase = db();
  const row = {
    evaluation_id: evaluationId,
    recommended_model: plan.recommended_model,
    target_metros: plan.target_metros ?? [],
    primary_keywords: plan.primary_keywords ?? [],
    secondary_keywords: plan.secondary_keywords ?? [],
    top_competitors: plan.top_competitors ?? [],
    estimated_revenue_low: plan.estimated_revenue_low_monthly_12mo ?? null,
    estimated_revenue_high: plan.estimated_revenue_high_monthly_12mo ?? null,
    revenue_basis: plan.revenue_basis ?? null,
    first_30_days_plan: plan.first_30_days_plan ?? null,
    stop_signs: plan.stop_signs ?? []
  };
  // Upsert: there's a UNIQUE(evaluation_id) on dh_build_plans.
  const { error } = await supabase.from(T.build_plans).upsert(row, { onConflict: 'evaluation_id' });
  if (error) throw new Error(`saveBuildPlan failed: ${error.message}`);
}

export async function getBuildPlan(evaluationId) {
  const supabase = db();
  const { data, error } = await supabase
    .from(T.build_plans)
    .select('*')
    .eq('evaluation_id', evaluationId)
    .maybeSingle();
  if (error) throw new Error(`getBuildPlan failed: ${error.message}`);
  return data;
}

// Mark candidate as queued / evaluated once an eval finishes successfully.
export async function linkCandidateEvaluation(candidateId, evaluationId, status = 'evaluated') {
  if (!candidateId) return;
  const supabase = db();
  await supabase
    .from(T.candidates)
    .update({ evaluation_id: evaluationId, status })
    .eq('id', candidateId);
}

// ----- Category sampler helpers -----

// Returns the most recent sampled_at per category, as a Map.
// Missing categories (never sampled) will be absent from the map.
export async function getCategoryLastSampled(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return new Map();
  const supabase = db();
  const { data, error } = await supabase
    .from(T.category_samples)
    .select('category, sampled_at')
    .in('category', categories)
    .order('sampled_at', { ascending: false });
  if (error) throw new Error(`getCategoryLastSampled failed: ${error.message}`);
  const out = new Map();
  for (const r of data ?? []) {
    if (!out.has(r.category)) out.set(r.category, r.sampled_at);
  }
  return out;
}

export async function recordCategorySample({ category, sampledMetros, totalBusinesses, avgCompleteness, candidateCreated }) {
  const supabase = db();
  const { error } = await supabase
    .from(T.category_samples)
    .insert({
      category,
      sampled_metros: sampledMetros,
      total_businesses: totalBusinesses,
      avg_completeness: avgCompleteness,
      candidate_created: candidateCreated
    });
  if (error) throw new Error(`recordCategorySample(${category}) failed: ${error.message}`);
}

// ----- Digest helpers -----

// Pull the candidate window for the Sunday digest.
// Defaults match the spec: discovery_score >= 70, status = 'new',
// found within the last 7 days, deduped by niche_canonical, top 10.
export async function fetchDigestCandidates({ minScore = 70, sinceDays = 7, limit = 10 } = {}) {
  const supabase = db();
  const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from(T.candidates)
    .select('id, source_id, source_url, niche_raw, niche_canonical, discovery_score, estimated_arpu_usd, fit_reasoning, revenue_signal, found_at')
    .eq('status', 'new')
    .gte('discovery_score', minScore)
    .gte('found_at', since)
    .order('discovery_score', { ascending: false, nullsFirst: false })
    .order('found_at', { ascending: false })
    .limit(limit * 4);
  if (error) throw new Error(`fetchDigestCandidates failed: ${error.message}`);

  const seen = new Set();
  const out = [];
  for (const row of data ?? []) {
    const key = (row.niche_canonical || row.niche_raw || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export async function recordDigestSent({ candidateIds, subject, bodyMd, providerId }) {
  const supabase = db();
  const { data, error } = await supabase
    .from(T.digests)
    .insert({
      candidate_ids: candidateIds,
      email_subject: subject,
      email_body_md: bodyMd,
      email_provider_id: providerId
    })
    .select('id')
    .single();
  if (error) throw new Error(`recordDigestSent failed: ${error.message}`);
  return data;
}

// Aggregates for the FilterBar dropdowns.
export async function getCandidateFacets() {
  const supabase = db();
  const { data, error } = await supabase
    .from(T.candidates)
    .select('source_id, discovery_category, status');
  if (error) throw new Error(`getCandidateFacets failed: ${error.message}`);
  const sources = {};
  const categories = {};
  const statuses = {};
  for (const r of data) {
    if (r.source_id) sources[r.source_id] = (sources[r.source_id] || 0) + 1;
    if (r.discovery_category) categories[r.discovery_category] = (categories[r.discovery_category] || 0) + 1;
    if (r.status) statuses[r.status] = (statuses[r.status] || 0) + 1;
  }
  return { sources, categories, statuses, total: data.length };
}
