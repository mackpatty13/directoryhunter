// Sonnet-backed 6-dimension scoring. Rubric is the canonical spec in
// docs/evaluation-rubric.md. Returns { dimensions: [...], total: int,
// recommendation: 'build'|'validate'|'risky'|'skip', summary: string }.

import { sonnet } from './claude.js';

const SYSTEM = [
  'You are a directory-site niche evaluator scoring against a precise 6-dimension rubric.',
  'Be strict with the rubric thresholds. Cite specific numbers from the provided data.',
  'You return JSON only, no prose, no markdown fencing.'
].join(' ');

function buildPrompt({ normalized, outscraper, serps, keywordVolumes, trends }) {
  return `Score this directory-site niche on a 100-point rubric.

Niche: ${normalized.canonical_niche}
Metro: ${normalized.canonical_metro}
Primary keyword: ${normalized.primary_keyword}
Cities sampled: ${normalized.cities.map(c => c.name).join(', ')}

----- Outscraper Google Maps data (per city) -----
${JSON.stringify(outscraper.map(c => ({
  city: c.city,
  business_count: c.businesses?.length ?? 0,
  completeness_rate: c.completeness?.rate ?? null,
  top_5_names: (c.businesses ?? []).slice(0, 5).map(b => b.name)
})), null, 2)}

----- DataforSEO SERP (per keyword variation) -----
${JSON.stringify(serps.map(s => ({
  keyword: s.keyword,
  has_ai_overview: s.has_ai_overview,
  has_local_pack: s.has_local_pack,
  top10: (s.organic_top10 ?? []).map(o => ({ rank: o.rank, domain: o.domain, title: o.title }))
})), null, 2)}

----- DataforSEO keyword volume -----
${JSON.stringify(keywordVolumes, null, 2)}

----- Google Trends -----
${JSON.stringify(trends, null, 2)}

----- Rubric -----

Dimension 1: Market size (max 20)
- 0 pts: under 50 businesses in top metro OR search volume under 100/mo
- 8 pts: 50-200 businesses, 100-500/mo volume
- 14 pts: 200-1000 businesses, 500-2000/mo volume
- 20 pts: 1000+ businesses, 2000+/mo volume

Dimension 2: Competition strength (max 20, inverse)
- 0 pts: Top 3 SERP are Yelp/Angi/Yellowpages/BBB/Thumbtack (DA 80+)
- 5 pts: Top 3 are mid-strength directories (DA 40-70)
- 12 pts: Top 3 are weak directories (DA <40) or mixed with business sites
- 20 pts: Top 3 are individual business sites, Maps pack dominates

Dimension 3: Buyer-intent strength (max 20)
- 0 pts: ARPU under $100
- 8 pts: $100-500
- 14 pts: $500-2000
- 20 pts: $2000+

Dimension 4: Google Maps disorganization (max 15)
- 0 pts: 90%+ businesses have complete profiles
- 5 pts: 60-90% complete
- 10 pts: 30-60% complete
- 15 pts: under 30% complete

Dimension 5: Geographic distribution (max 10)
- 0 pts: only 3-5 viable metros
- 5 pts: 10-20 viable metros
- 10 pts: 30+ viable metros

Dimension 6: AI Overview resistance (max 15)
- 0 pts: 30%+ of niche keywords trigger AI Overview
- 5 pts: 10-30% trigger
- 15 pts: under 10% trigger

Recommendation tiers:
- 80-100: build
- 60-79: validate
- 40-59: risky
- under 40: skip

Return JSON:
{
  "dimensions": [
    {
      "dimension": "market_size",
      "score": <int>,
      "max_score": 20,
      "reasoning": "<2-3 sentences citing the specific numbers above>",
      "evidence": { "<key>": "<short cited value>", "...": "..." }
    },
    { "dimension": "competition_strength", "score": <int>, "max_score": 20, ... },
    { "dimension": "buyer_intent", "score": <int>, "max_score": 20, ... },
    { "dimension": "maps_disorganization", "score": <int>, "max_score": 15, ... },
    { "dimension": "geographic_distribution", "score": <int>, "max_score": 10, ... },
    { "dimension": "ai_overview_resistance", "score": <int>, "max_score": 15, ... }
  ],
  "total": <sum of scores>,
  "recommendation": "build"|"validate"|"risky"|"skip",
  "summary": "<2-3 sentences plain language, what to take away>"
}`;
}

const DIMENSIONS = [
  'market_size',
  'competition_strength',
  'buyer_intent',
  'maps_disorganization',
  'geographic_distribution',
  'ai_overview_resistance'
];

const MAX = {
  market_size: 20,
  competition_strength: 20,
  buyer_intent: 20,
  maps_disorganization: 15,
  geographic_distribution: 10,
  ai_overview_resistance: 15
};

function clampInt(v, max) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, n));
}

function deriveRecommendation(total) {
  if (total >= 80) return 'build';
  if (total >= 60) return 'validate';
  if (total >= 40) return 'risky';
  return 'skip';
}

export async function scoreEvaluation(context) {
  const raw = await sonnet({
    system: SYSTEM,
    user: buildPrompt(context),
    maxTokens: 3500,
    temperature: 0,
    jsonOutput: true
  });

  const byName = {};
  for (const d of raw.dimensions ?? []) {
    if (!d?.dimension) continue;
    byName[d.dimension] = d;
  }

  const dimensions = DIMENSIONS.map(name => {
    const d = byName[name] ?? {};
    return {
      dimension: name,
      score: clampInt(d.score, MAX[name]),
      max_score: MAX[name],
      reasoning: d.reasoning ? String(d.reasoning).trim() : '',
      evidence: d.evidence ?? null
    };
  });
  const total = dimensions.reduce((s, d) => s + d.score, 0);
  return {
    dimensions,
    total,
    recommendation: raw.recommendation || deriveRecommendation(total),
    summary: raw.summary || ''
  };
}
