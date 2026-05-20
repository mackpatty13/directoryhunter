// Evaluation orchestrator. Runs the full pipeline against a niche + metro
// pair (already attached to a pending dh_evaluations row) and writes
// everything back to Supabase.
//
// Order:
//   1. normalize  (Claude Sonnet)
//   2. trends      (free)
//   3. google-places  (paid, ~$0.30-0.50, within GCP $200/mo free credit)
//   4. dataforseo SERP for each keyword variation (paid in live, free sandbox)
//   5. dataforseo keyword volume (paid in live, free sandbox)
//   6. score-evaluation (Sonnet)
//   7. plan (Sonnet, only if total >= 60)
//
// All paid responses are persisted to dh_evaluation_data so they can be
// inspected later and we never re-pay for them within the 24h cache window.

import { log } from './log.js';
import { normalize } from './normalize.js';
import { fetchGoogleMapsBusinesses } from './google-places.js';
import { fetchSerpResults, fetchKeywordVolume, formatLocation } from './dataforseo.js';
import { fetchTrends } from './trends.js';
import { scoreEvaluation } from './score-evaluation.js';
import { generatePlan } from './plan.js';
import {
  updateEvaluation,
  saveEvaluationData,
  getEvaluationData,
  saveDimensionScores,
  saveBuildPlan,
  linkCandidateEvaluation
} from './db.js';

const FRESH_HOURS = 24;

async function cachedOrFetch(evalId, source, fn) {
  const existing = await getEvaluationData(evalId, source);
  const fresh = existing.find(r => {
    const age = Date.now() - new Date(r.fetched_at).getTime();
    return age < FRESH_HOURS * 3600 * 1000;
  });
  if (fresh) {
    log.info('evaluate: cache hit', { source, evalId });
    return fresh.payload;
  }
  const payload = await fn();
  await saveEvaluationData(evalId, source, payload);
  return payload;
}

export async function runEvaluation(evaluation) {
  const evalId = evaluation.id;
  const niche = evaluation.niche;
  const metro = evaluation.metro;
  log.info('evaluate.run starting', { evalId, niche, metro });
  await updateEvaluation(evalId, { status: 'running', error: null });

  try {
    // 1. Normalize
    const normalized = await cachedOrFetch(evalId, 'normalize', async () => {
      return normalize({ niche, metro });
    });
    await updateEvaluation(evalId, {
      normalized_niche: { canonical: normalized.canonical_niche, primary: normalized.primary_keyword, variations: normalized.keyword_variations },
      normalized_metro: { canonical: normalized.canonical_metro, cities: normalized.cities, country: normalized.country_code }
    });
    log.info('evaluate: normalized', { primary: normalized.primary_keyword, cities: normalized.cities.length });

    // 2. Trends (free)
    const trends = await cachedOrFetch(evalId, 'trends', async () => {
      return fetchTrends(normalized.primary_keyword, { geo: normalized.country_code });
    });

    // 3. Google Places (paid). Sample top 3 cities.
    const sampleCities = normalized.cities.slice(0, 3).map(c => c.name);
    const places = await cachedOrFetch(evalId, 'google-places', async () => {
      return fetchGoogleMapsBusinesses(normalized.primary_keyword, sampleCities, { limit: 30 });
    });

    // 4. DataforSEO SERP (5 variations), in the first city.
    const variations = normalized.keyword_variations.length > 0
      ? normalized.keyword_variations.slice(0, 5)
      : [normalized.primary_keyword];
    const primaryLocation = formatLocation(sampleCities[0], normalized.country_code);

    const serps = await cachedOrFetch(evalId, 'dataforseo-serp', async () => {
      const out = [];
      for (const kw of variations) {
        try {
          const r = await fetchSerpResults(kw, primaryLocation);
          out.push(r);
        } catch (err) {
          log.warn('evaluate: SERP failed for keyword', { kw, error: err.message });
          out.push({ keyword: kw, error: err.message, organic_top10: [] });
        }
      }
      return out;
    });

    // 5. DataforSEO keyword volume (batched).
    const keywordVolumes = await cachedOrFetch(evalId, 'dataforseo-keywords', async () => {
      return fetchKeywordVolume(variations, primaryLocation);
    });

    // 6. Score with Sonnet.
    const scoring = await scoreEvaluation({
      normalized,
      places,
      serps,
      keywordVolumes,
      trends
    });
    await saveDimensionScores(evalId, scoring.dimensions);
    log.info('evaluate: scored', { total: scoring.total, recommendation: scoring.recommendation });

    // 7. Plan if score clears 60.
    let plan = null;
    if (scoring.total >= 60) {
      plan = await generatePlan({
        normalized,
        scoring,
        places,
        serps,
        keywordVolumes
      });
      await saveBuildPlan(evalId, plan);
      log.info('evaluate: plan generated', { model: plan.recommended_model });
    }

    await updateEvaluation(evalId, {
      status: 'complete',
      total_score: scoring.total,
      recommendation: scoring.recommendation,
      completed_at: new Date().toISOString()
    });

    if (evaluation.candidate_id) {
      await linkCandidateEvaluation(evaluation.candidate_id, evalId, 'evaluated');
    }

    log.info('evaluate.run done', { evalId, total: scoring.total });
    return { ok: true, total: scoring.total, recommendation: scoring.recommendation };

  } catch (err) {
    log.error('evaluate.run failed', { evalId, error: err.message, stack: err.stack });
    await updateEvaluation(evalId, {
      status: 'failed',
      error: err.message,
      completed_at: new Date().toISOString()
    });
    return { ok: false, error: err.message };
  }
}
