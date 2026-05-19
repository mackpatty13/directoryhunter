// DataforSEO wrapper. Public API:
//   fetchSerpResults(keyword, locationName, locationCode?) -> { serp, ai_overview, has_local_pack }
//   fetchKeywordVolume(keywords, locationCode?) -> [{ keyword, search_volume, cpc, competition }]
//
// Sandbox endpoint at sandbox.dataforseo.com returns deterministic dummy data
// when DATAFORSEO_SANDBOX=true. Useful during dev to avoid spend.

import { log } from './log.js';

function creds() {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error('DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD must be set in env');
  }
  return { login, password };
}

function baseUrl() {
  return process.env.DATAFORSEO_SANDBOX === 'true'
    ? 'https://sandbox.dataforseo.com/v3'
    : 'https://api.dataforseo.com/v3';
}

// DataforSEO `location_name` expects "City,Country" or "City,FullState,Country".
// Our normalize step emits "Dallas, TX" style strings; the API rejects abbreviated
// states with the comma-space layout, so we drop the state and use "City,Country".
const COUNTRY_NAMES = {
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  AU: 'Australia',
  IE: 'Ireland',
  NZ: 'New Zealand'
};

export function formatLocation(cityName, countryCode = 'US') {
  const code = (countryCode || 'US').toString().toUpperCase();
  const country = COUNTRY_NAMES[code] || 'United States';
  const city = (cityName || '').toString().split(',')[0].trim();
  return city ? `${city},${country}` : country;
}

function authHeader() {
  const { login, password } = creds();
  return 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');
}

async function post(path, body) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`dataforseo ${path} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json.status_code !== 20000) {
    throw new Error(`dataforseo ${path} error: ${json.status_message}`);
  }
  return json.tasks?.[0]?.result ?? [];
}

// "live/regular" returns Google organic SERP for the keyword in the location.
// We use a string location name (e.g. "Dallas,Texas,United States") which the
// API resolves; location codes are also accepted.
export async function fetchSerpResults(keyword, locationName) {
  log.info('dataforseo: SERP', { keyword, locationName });
  const result = await post('/serp/google/organic/live/regular', [{
    keyword,
    location_name: locationName,
    language_code: 'en',
    device: 'desktop',
    depth: 20
  }]);
  const items = result?.[0]?.items ?? [];

  const organic = items
    .filter(i => i.type === 'organic')
    .map(i => ({
      rank: i.rank_absolute,
      url: i.url,
      domain: i.domain,
      title: i.title,
      description: i.description
    }));

  const hasAiOverview = items.some(i => i.type === 'ai_overview' || i.type === 'generative_ai');
  const hasLocalPack = items.some(i => i.type === 'local_pack' || i.type === 'maps');

  return {
    keyword,
    location: locationName,
    organic_top10: organic.slice(0, 10),
    organic_top20: organic,
    has_ai_overview: hasAiOverview,
    has_local_pack: hasLocalPack,
    item_types: Array.from(new Set(items.map(i => i.type)))
  };
}

// Batches keywords in one call. Returns volume + CPC + competition per keyword.
export async function fetchKeywordVolume(keywords, locationName) {
  if (!keywords || keywords.length === 0) return [];
  log.info('dataforseo: keyword volume', { count: keywords.length, locationName });
  const result = await post('/keywords_data/google_ads/search_volume/live', [{
    keywords,
    location_name: locationName,
    language_code: 'en'
  }]);
  return (result ?? []).map(r => ({
    keyword: r.keyword,
    search_volume: r.search_volume ?? null,
    cpc: r.cpc ?? null,
    competition: r.competition ?? null,
    competition_level: r.competition_level ?? null
  }));
}
