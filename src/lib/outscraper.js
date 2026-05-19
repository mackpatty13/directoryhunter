// Outscraper wrapper. Public API:
//   fetchGoogleMapsBusinesses(keyword, cities, { limit }) -> [{city, businesses, completeness}]
//
// Outscraper uses an async pattern: POST returns a request_id, then we poll
// GET /requests/{id} until status === 'Success'.

import { log } from './log.js';

const BASE = 'https://api.outscraper.cloud';

function requireKey() {
  const k = process.env.OUTSCRAPER_API_KEY;
  if (!k) throw new Error('OUTSCRAPER_API_KEY is not set in env');
  return k;
}

async function startRequest(keyword, cities, limit) {
  const key = requireKey();
  // Outscraper accepts multiple queries per call; one per city = one parallel run.
  const queries = cities.map(c => `${keyword}, ${c}`);
  const params = new URLSearchParams();
  for (const q of queries) params.append('query', q);
  params.set('limit', String(limit));
  params.set('async', 'true');
  params.set('fields', 'name,site,phone,full_address,city,state,country,rating,reviews,working_hours,photos_count,verified');

  const res = await fetch(`${BASE}/maps/search-v3?${params.toString()}`, {
    method: 'GET',
    headers: { 'X-API-KEY': key, Accept: 'application/json' }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`outscraper start failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  // Outscraper returns { id, status: "Pending" }
  if (!json.id) throw new Error(`outscraper start: no request id in response`);
  return json.id;
}

async function pollResult(requestId, { maxWaitMs = 120000, intervalMs = 4000 } = {}) {
  const key = requireKey();
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${BASE}/requests/${requestId}`, {
      headers: { 'X-API-KEY': key, Accept: 'application/json' }
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`outscraper poll failed: ${res.status} ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    if (json.status === 'Success') return json.data;
    if (json.status === 'Failed') throw new Error(`outscraper request failed: ${JSON.stringify(json).slice(0, 200)}`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`outscraper poll timed out after ${maxWaitMs}ms`);
}

function computeCompleteness(businesses) {
  if (!businesses || businesses.length === 0) return { rate: 0, complete: 0, total: 0 };
  let complete = 0;
  for (const b of businesses) {
    const hasPhone = Boolean(b.phone);
    const hasSite = Boolean(b.site);
    const hasHours = Boolean(b.working_hours && Object.keys(b.working_hours).length > 0);
    const hasReviews = (b.reviews ?? 0) >= 5;
    const hasPhotos = (b.photos_count ?? 0) > 0;
    const score = [hasPhone, hasSite, hasHours, hasReviews, hasPhotos].filter(Boolean).length;
    // "Complete" = 4 of 5 signals present.
    if (score >= 4) complete++;
  }
  return {
    rate: complete / businesses.length,
    complete,
    total: businesses.length
  };
}

export async function fetchGoogleMapsBusinesses(keyword, cities, { limit = 30 } = {}) {
  if (!Array.isArray(cities) || cities.length === 0) return [];
  log.info('outscraper: starting request', { keyword, cities, limit });

  const requestId = await startRequest(keyword, cities, limit);
  log.info('outscraper: polling', { requestId });
  const data = await pollResult(requestId);
  // data is parallel-aligned with the queries array.
  const out = [];
  for (let i = 0; i < cities.length; i++) {
    const businesses = Array.isArray(data?.[i]) ? data[i] : [];
    out.push({
      city: cities[i],
      keyword,
      businesses,
      completeness: computeCompleteness(businesses)
    });
  }
  log.info('outscraper: complete', {
    cities: out.length,
    avg_completeness: (out.reduce((s, x) => s + x.completeness.rate, 0) / out.length).toFixed(2)
  });
  return out;
}
