// Sonnet build-plan generator. Only called when the evaluation score >= 60.
// Returns the full plan object shaped for dh_build_plans insert.

import { sonnet } from './claude.js';

const SYSTEM = [
  'You generate concrete 30-day directory site build plans for Patrick.',
  'You return JSON only, no prose, no markdown fencing.',
  'No em-dashes, no AI-slop language (banned: dive, leverage, robust, seamless, delve, embark, unleash, empower, harness).'
].join(' ');

function buildPrompt({ normalized, scoring, outscraper, serps, keywordVolumes }) {
  return `You are generating a 30-day action plan for Patrick to build a directory site.

Niche: ${normalized.canonical_niche}
Metro: ${normalized.canonical_metro}
Total score: ${scoring.total}/100
Recommendation: ${scoring.recommendation}
Dimension scores: ${JSON.stringify(scoring.dimensions.map(d => ({ d: d.dimension, s: d.score, max: d.max_score })))}

Top SERP competitors (across keyword variations):
${JSON.stringify(serps.flatMap(s => (s.organic_top10 ?? []).slice(0, 5).map(o => ({ keyword: s.keyword, rank: o.rank, domain: o.domain, title: o.title }))).slice(0, 20), null, 2)}

Outscraper data summary:
${JSON.stringify(outscraper.map(c => ({ city: c.city, count: c.businesses?.length ?? 0, completeness: c.completeness?.rate })), null, 2)}

Keyword volume:
${JSON.stringify(keywordVolumes, null, 2)}

Patrick's context:
- Self-taught builder on Next.js + Supabase + Vercel + Playwright
- Already builds scrapers and programmatic pages
- Uses Outscraper for data, Mediavine/Ezoic for ads if traffic justifies
- DFW-based, ~10 hours/week side capacity
- Frey Chu playbook: boring + local + buyer intent

Return JSON:
{
  "recommended_model": "passive_ad" | "lead_gen" | "hybrid",
  "model_reasoning": "<2-3 sentences>",
  "target_metros": ["<5-10 specific cities, mid-sized preferred>"],
  "primary_keywords": ["<top 5>"],
  "secondary_keywords": ["<10-20 long-tail>"],
  "top_competitors": [{"domain": "...", "da": <int or null>, "weakness": "..."}],
  "estimated_revenue_low_monthly_12mo": <integer USD>,
  "estimated_revenue_high_monthly_12mo": <integer USD>,
  "revenue_basis": "<one paragraph citing comp benchmarks>",
  "first_30_days_plan": "<markdown checklist with weekly milestones for weeks 1, 2, 3, 4>",
  "stop_signs": ["<5-7 early failure signals>"]
}`;
}

export async function generatePlan(context) {
  const raw = await sonnet({
    system: SYSTEM,
    user: buildPrompt(context),
    maxTokens: 4000,
    temperature: 0,
    jsonOutput: true
  });
  return {
    recommended_model: raw.recommended_model || 'passive_ad',
    model_reasoning: raw.model_reasoning || '',
    target_metros: Array.isArray(raw.target_metros) ? raw.target_metros.slice(0, 12) : [],
    primary_keywords: Array.isArray(raw.primary_keywords) ? raw.primary_keywords.slice(0, 8) : [],
    secondary_keywords: Array.isArray(raw.secondary_keywords) ? raw.secondary_keywords.slice(0, 25) : [],
    top_competitors: Array.isArray(raw.top_competitors) ? raw.top_competitors.slice(0, 10) : [],
    estimated_revenue_low_monthly_12mo: Number.isFinite(parseInt(raw.estimated_revenue_low_monthly_12mo, 10))
      ? parseInt(raw.estimated_revenue_low_monthly_12mo, 10) : null,
    estimated_revenue_high_monthly_12mo: Number.isFinite(parseInt(raw.estimated_revenue_high_monthly_12mo, 10))
      ? parseInt(raw.estimated_revenue_high_monthly_12mo, 10) : null,
    revenue_basis: raw.revenue_basis || '',
    first_30_days_plan: raw.first_30_days_plan || '',
    stop_signs: Array.isArray(raw.stop_signs) ? raw.stop_signs.slice(0, 10) : []
  };
}
