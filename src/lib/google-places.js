// Google Places API (New) client.
// Public API matches the old outscraper.js: fetchGoogleMapsBusinesses(keyword, cities, { limit })
// returns [{ city, keyword, businesses, completeness }].
//
// Endpoint: POST https://places.googleapis.com/v1/places:searchText
// Pricing tier: Pro SKU ($20 per 1000 results) because we ask for phone,
// website, hours, and photos. First $200/month is free for every GCP account.
//
// Pagination: pageSize maxes at 20 per page, hard cap 60 results across 3 pages.
// We request 2 seconds between page calls so the pageToken has time to settle.

import { log } from './log.js';

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const PAGE_SIZE_MAX = 20;
const MAX_PAGES = 3;
const PAGE_TOKEN_DELAY_MS = 2000;

const FIELD_MASK = [
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours.periods',
  'places.photos',
  'places.businessStatus',
  'nextPageToken'
].join(',');

function requireKey() {
  const k = process.env.GOOGLE_PLACES_API_KEY;
  if (!k) throw new Error('GOOGLE_PLACES_API_KEY is not set in env');
  return k;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function searchOnePage({ textQuery, pageSize, pageToken }) {
  const key = requireKey();
  // Google requires paging requests to repeat ALL original params (textQuery,
  // pageSize, languageCode) and add pageToken. Sending pageToken alone returns
  // "Empty text_query. Request parameters for paging requests must match the
  // initial SearchText request."
  const body = { textQuery, pageSize, languageCode: 'en' };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': FIELD_MASK
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`google-places ${res.status}: ${errBody.slice(0, 300)}`);
  }

  return res.json();
}

async function searchText(textQuery, totalLimit) {
  const out = [];
  let pageToken = null;
  let pages = 0;

  while (out.length < totalLimit && pages < MAX_PAGES) {
    const remaining = totalLimit - out.length;
    const pageSize = Math.min(PAGE_SIZE_MAX, remaining);

    if (pageToken) await sleep(PAGE_TOKEN_DELAY_MS);

    let json;
    try {
      json = await searchOnePage({ textQuery, pageSize, pageToken });
    } catch (err) {
      // Page 2+ failures shouldn't throw away page 1 results. Log and stop.
      if (pages === 0) throw err;
      log.warn('google-places: subsequent page failed, returning partial', { textQuery, pages, error: err.message });
      break;
    }
    pages++;

    const places = Array.isArray(json.places) ? json.places : [];
    out.push(...places);

    if (!json.nextPageToken || places.length === 0) break;
    pageToken = json.nextPageToken;
  }

  return out.slice(0, totalLimit);
}

// Map a Google Places "Place" object to the legacy Outscraper-shaped business
// record the rest of the codebase already expects. Keeps downstream code
// (lib/evaluate.js, score-evaluation.js, the category sampler) unchanged.
function mapPlace(place) {
  const hours = place.regularOpeningHours?.periods ?? null;
  return {
    name: place.displayName?.text ?? null,
    site: place.websiteUri ?? null,
    phone: place.nationalPhoneNumber ?? null,
    full_address: place.formattedAddress ?? null,
    rating: place.rating ?? null,
    reviews: place.userRatingCount ?? 0,
    working_hours: hours && hours.length > 0 ? hours : null,
    photos_count: Array.isArray(place.photos) ? place.photos.length : 0,
    verified: place.businessStatus === 'OPERATIONAL'
  };
}

function computeCompleteness(businesses) {
  if (!businesses || businesses.length === 0) return { rate: 0, complete: 0, total: 0 };
  let complete = 0;
  for (const b of businesses) {
    const hasPhone = Boolean(b.phone);
    const hasSite = Boolean(b.site);
    const hasHours = Boolean(b.working_hours);
    const hasReviews = (b.reviews ?? 0) >= 5;
    const hasPhotos = (b.photos_count ?? 0) > 0;
    const score = [hasPhone, hasSite, hasHours, hasReviews, hasPhotos].filter(Boolean).length;
    if (score >= 4) complete++;
  }
  return {
    rate: complete / businesses.length,
    complete,
    total: businesses.length
  };
}

// Public API. Same signature and return shape as the old outscraper.js so
// callers don't change.
export async function fetchGoogleMapsBusinesses(keyword, cities, { limit = 30 } = {}) {
  if (!Array.isArray(cities) || cities.length === 0) return [];
  log.info('google-places: starting', { keyword, cities, limit });

  const out = [];
  for (const city of cities) {
    const textQuery = `${keyword} in ${city}`;
    let businesses = [];
    try {
      const places = await searchText(textQuery, limit);
      businesses = places.map(mapPlace);
    } catch (err) {
      log.error('google-places: city failed', { city, keyword, error: err.message });
    }
    out.push({
      city,
      keyword,
      businesses,
      completeness: computeCompleteness(businesses)
    });
  }

  const avg = out.length > 0
    ? (out.reduce((s, x) => s + x.completeness.rate, 0) / out.length).toFixed(2)
    : '0.00';
  log.info('google-places: complete', { cities: out.length, avg_completeness: avg });
  return out;
}
