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
  digests: 'dh_digests'
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
