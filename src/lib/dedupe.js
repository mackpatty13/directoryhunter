// Deterministic canonicalization helpers used at insert time.
// Final `niche_canonical` for the DB column is set by Claude Haiku during
// the scoring pass. The function here gives scanners a stable fallback
// for early dedupe and for sanity comparisons.

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src',
  'igshid', 's', 'amp', 'spm', 'source', 'mkt_tok'
]);

export function canonicalUrl(rawUrl) {
  if (!rawUrl) throw new Error('canonicalUrl: empty input');
  let u;
  try {
    u = new URL(rawUrl);
  } catch (err) {
    throw new Error(`canonicalUrl: not a valid URL: ${rawUrl}`);
  }

  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.protocol = 'https:';
  u.hash = '';

  const cleaned = new URLSearchParams();
  for (const [k, v] of u.searchParams) {
    if (!TRACKING_PARAMS.has(k.toLowerCase())) cleaned.append(k, v);
  }
  u.search = cleaned.toString();

  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.slice(0, -1);
  }

  return u.toString();
}

const FILLER = new Set([
  'the', 'a', 'an', 'best', 'top', 'top-rated', 'near', 'me', 'local',
  'cheap', 'affordable', 'professional', 'site', 'sites', 'directory', 'directories'
]);

export function canonicalNiche(rawName) {
  if (!rawName) return null;
  const tokens = rawName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean)
    .filter(t => !FILLER.has(t));
  if (tokens.length === 0) return null;
  return tokens.join(' ');
}

const REVENUE_PATTERNS = [
  // "$3.4k/mo", "$3.4k per month", "$3.4k p/mo"
  /\$\s?([\d,]+(?:\.\d+)?)\s?k\s?(?:\/|\s+per\s+|p\/)?(?:mo|month|m)\b/i,
  // "$3,400/mo", "$3,400 per month", "$3,400 p/mo" (Flippa profit line)
  /\$\s?([\d,]+(?:\.\d+)?)\s?(?:\/|\s+per\s+|p\/|\s+p\/)(?:mo|month|m)\b/i,
  // "$3,400 MRR" or "$3,400 monthly revenue"
  /\$\s?([\d,]+(?:\.\d+)?)\s?(?:mrr|monthly\s+revenue)/i,
  // "MRR: $3,400" or "Net Profit USD $3,400" or similar prefix forms
  /(?:mrr|monthly\s+revenue|net\s+profit|gross\s+revenue)[:\s]+(?:-?\s?USD\s*)?\$?\s?([\d,]+(?:\.\d+)?)\s?k?\b/i
];

export function parseRevenueUsdMonthly(text) {
  if (!text) return null;
  for (const re of REVENUE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const raw = m[1].replace(/,/g, '');
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n > 0) {
        const isThousands = /k\s?(?:\/|\s+per\s+)?(?:mo|month|m)?\b/i.test(m[0])
          && !m[0].toLowerCase().includes('mrr');
        return Math.round(isThousands ? n * 1000 : n);
      }
    }
  }
  return null;
}
