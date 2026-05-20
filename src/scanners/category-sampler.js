// Google Maps category sampler. PAID. The only scanner that costs real money.
//
// Each run:
//   1. Loads the category list from data/sampler-categories.json
//   2. Picks up to `limit` categories that have NOT been sampled in the last
//      COOLDOWN_DAYS days (oldest first, never-sampled first)
//   3. For each category: picks 3 random metros from data/sampler-metros.json,
//      calls Google Places API, computes weighted completeness across the cities
//   4. Writes a dh_category_samples row for every category processed
//   5. Returns a candidate row for any category whose completeness < 0.50
//
// Run via the master runner:
//   npm run discover -- --only=category-sampler
//   npm run discover -- --only=category-sampler --limit=50   (full weekly run)
// Or via the test-scanner script (no DB writes unless --store):
//   npm run test:scanner -- category-sampler --limit=2 --store
//
// The first manual run should keep --limit small (2-5) so you can spot-check
// the data before committing budget on the full 50-category sweep.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchGoogleMapsBusinesses } from '../lib/google-places.js';
import { canonicalUrl } from '../lib/dedupe.js';
import { getCategoryLastSampled, recordCategorySample } from '../lib/db.js';
import { log } from '../lib/log.js';

const SOURCE_ID = 'category-sampler';
const COOLDOWN_DAYS = 90;
const METROS_PER_CATEGORY = 3;
const BUSINESSES_PER_METRO = 30;
const COMPLETENESS_THRESHOLD = 0.50;
const DEFAULT_LIMIT = 5;  // safety floor; cron should pass --limit=50

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATEGORIES_PATH = resolve(__dirname, '../../data/sampler-categories.json');
const METROS_PATH = resolve(__dirname, '../../data/sampler-metros.json');

async function loadJson(path) {
  const txt = await readFile(path, 'utf8');
  return JSON.parse(txt);
}

function pickRandom(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function aggregateCompleteness(perCity) {
  let totalBusinesses = 0;
  let totalComplete = 0;
  for (const c of perCity) {
    totalBusinesses += c.completeness.total;
    totalComplete += c.completeness.complete;
  }
  const rate = totalBusinesses > 0 ? totalComplete / totalBusinesses : 0;
  return { rate, complete: totalComplete, total: totalBusinesses };
}

function buildContext(category, perCity, agg) {
  const cityLines = perCity.map(c =>
    `${c.city}: ${c.completeness.complete}/${c.completeness.total} complete (${(c.completeness.rate * 100).toFixed(0)}%)`
  ).join(', ');
  return `Sampled "${category}" across ${perCity.length} metros: ${cityLines}. Aggregate completeness: ${agg.complete}/${agg.total} (${(agg.rate * 100).toFixed(0)}%). Low completeness indicates a disorganized Google Maps category, which is the Frey Chu signal for a buildable directory niche.`;
}

export async function scan({ limit = DEFAULT_LIMIT, categories: categoriesOverride = null, metros: metrosOverride = null } = {}) {
  const categoriesFile = categoriesOverride ? { categories: categoriesOverride } : await loadJson(CATEGORIES_PATH);
  const metrosFile = metrosOverride ? { metros: metrosOverride } : await loadJson(METROS_PATH);

  const allCategories = categoriesFile.categories;
  const allMetros = metrosFile.metros;
  if (!Array.isArray(allCategories) || allCategories.length === 0) {
    throw new Error('category-sampler: no categories loaded');
  }
  if (!Array.isArray(allMetros) || allMetros.length < METROS_PER_CATEGORY) {
    throw new Error(`category-sampler: need at least ${METROS_PER_CATEGORY} metros, got ${allMetros?.length ?? 0}`);
  }

  const lastSampled = await getCategoryLastSampled(allCategories);
  const cutoff = Date.now() - COOLDOWN_DAYS * 24 * 3600 * 1000;

  const eligible = allCategories
    .map(c => ({ category: c, lastSampledAt: lastSampled.get(c) ?? null }))
    .filter(x => x.lastSampledAt === null || new Date(x.lastSampledAt).getTime() < cutoff)
    .sort((a, b) => {
      if (a.lastSampledAt === null && b.lastSampledAt === null) return 0;
      if (a.lastSampledAt === null) return -1;
      if (b.lastSampledAt === null) return 1;
      return new Date(a.lastSampledAt) - new Date(b.lastSampledAt);
    });

  const toProcess = eligible.slice(0, limit);
  log.info('category-sampler: planning run', {
    total_categories: allCategories.length,
    eligible: eligible.length,
    selected: toProcess.length,
    limit,
    cooldown_days: COOLDOWN_DAYS
  });

  if (toProcess.length === 0) {
    log.info('category-sampler: nothing eligible to sample');
    return [];
  }

  const candidates = [];
  for (const { category } of toProcess) {
    const metros = pickRandom(allMetros, METROS_PER_CATEGORY);
    log.info('category-sampler: sampling', { category, metros });

    let perCity;
    try {
      perCity = await fetchGoogleMapsBusinesses(category, metros, { limit: BUSINESSES_PER_METRO });
    } catch (err) {
      log.error('category-sampler: places api failed', { category, metros, error: err.message });
      continue;
    }

    const agg = aggregateCompleteness(perCity);
    log.info('category-sampler: result', {
      category,
      total_businesses: agg.total,
      avg_completeness: agg.rate.toFixed(3),
      below_threshold: agg.rate < COMPLETENESS_THRESHOLD
    });

    // Skip categories where we got no data at all. Don't write a sample row
    // either, so we retry next week instead of waiting 90 days.
    if (agg.total === 0) {
      log.warn('category-sampler: no businesses returned, skipping sample row', { category, metros });
      continue;
    }

    const candidateCreated = agg.rate < COMPLETENESS_THRESHOLD;

    if (candidateCreated) {
      const slug = slugify(category);
      const synthetic = `https://places.googleapis.com/v1/places:searchText?dh_category=${slug}`;
      candidates.push({
        source_id: SOURCE_ID,
        source_url: synthetic,
        source_url_canonical: canonicalUrl(synthetic),
        niche_raw: category,
        geographic_hint: metros.join('; '),
        revenue_signal: null,
        revenue_amount_usd_monthly: null,
        posted_at: null,
        raw_context: buildContext(category, perCity, agg),
        raw_payload: {
          category,
          metros,
          aggregate: agg,
          per_city: perCity.map(c => ({
            city: c.city,
            completeness: c.completeness,
            sample_business_names: (c.businesses || []).slice(0, 5).map(b => b.name)
          }))
        },
        discovery_category: 'opportunity_signal'
      });
    }

    try {
      await recordCategorySample({
        category,
        sampledMetros: metros,
        totalBusinesses: agg.total,
        avgCompleteness: Number(agg.rate.toFixed(3)),
        candidateCreated
      });
    } catch (err) {
      log.error('category-sampler: recordCategorySample failed', { category, error: err.message });
    }
  }

  log.info('category-sampler.scan complete', {
    processed: toProcess.length,
    candidates_generated: candidates.length
  });
  return candidates;
}
