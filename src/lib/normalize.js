// Niche + metro normalization via Claude. Expands shorthand like "DFW" into
// the actual cities to query, picks the primary keyword to search, and
// generates 5-10 keyword variations for SERP / volume lookups.

import { sonnet } from './claude.js';

const SYSTEM = [
  'You normalize directory-site niches and metros into structured query inputs.',
  'You return JSON only, no prose, no markdown.'
].join(' ');

function buildPrompt(niche, metro) {
  return `Normalize a directory-site niche and metro for downstream SERP, Maps, and Trends queries.

Niche (raw): ${niche}
Metro (raw): ${metro}

Return JSON:
{
  "canonical_niche": "lowercase phrase a buyer would search for, no metro modifier",
  "canonical_metro": "human-readable metro name, e.g. 'Dallas-Fort Worth, TX' or 'national'",
  "cities": [
    { "name": "City, ST", "population_band": "small|mid|large" }
  ],
  "primary_keyword": "the most likely search query a buyer would type",
  "keyword_variations": [
    "variation 1", "variation 2", "..."
  ],
  "country_code": "two-letter ISO code, e.g. US, GB",
  "is_national": true|false,
  "reasoning": "one sentence on why these choices"
}

Rules:
- If metro is a shorthand (DFW, NYC, SF Bay Area, Twin Cities) expand to 3-5 specific cities.
- If metro is "national" or empty, set is_national=true and put 3 representative mid-size cities.
- keyword_variations should be 5-10 actual buyer search queries, including local modifiers like "near me", "in <city>", and service-specific variants.
- primary_keyword should NOT include a city, it is the head term.`;
}

export async function normalize({ niche, metro }) {
  const result = await sonnet({
    system: SYSTEM,
    user: buildPrompt(niche, metro),
    maxTokens: 1500,
    temperature: 0,
    jsonOutput: true
  });

  // Defensive defaults so downstream code never crashes on a sparse response.
  return {
    canonical_niche: String(result.canonical_niche || niche).trim().toLowerCase(),
    canonical_metro: String(result.canonical_metro || metro).trim(),
    cities: Array.isArray(result.cities) ? result.cities.slice(0, 5) : [],
    primary_keyword: String(result.primary_keyword || niche).trim().toLowerCase(),
    keyword_variations: Array.isArray(result.keyword_variations)
      ? result.keyword_variations.slice(0, 10).filter(Boolean)
      : [],
    country_code: (result.country_code || 'US').toString().slice(0, 2).toUpperCase(),
    is_national: Boolean(result.is_national),
    reasoning: result.reasoning || null
  };
}
