// Reddit scanner. Pulls /new.json from four target subs, filters by keyword,
// extracts revenue mentions. Public JSON API, no Playwright.
//
// Requires REDDIT_USERNAME in env (Reddit mandates a User-Agent that
// identifies the operator).

import { httpGetJson } from '../lib/http.js';
import { canonicalUrl, parseRevenueUsdMonthly } from '../lib/dedupe.js';
import { log } from '../lib/log.js';

const SUBS = [
  { id: 'reddit-juststart', sub: 'juststart' },
  { id: 'reddit-seo', sub: 'SEO' },
  { id: 'reddit-erm', sub: 'EntrepreneurRideAlong' },
  { id: 'reddit-sideproject', sub: 'SideProject' }
];

// Posts mentioning these terms are likely about directory sites / lead gen.
const TOPIC_RE = /\b(directory|directories|listing(?:s)?\s+site|niche\s+site\s+revenue|lead\s+gen|local\s+seo|local\s+lead(?:s)?|local\s+directory|geo\s+arbitrage)\b/i;

// Used to flag candidates as `revenue_mention` rather than `opportunity_signal`.
const REV_RE = /\$\s?\d[\d,.]*\s?k?\s*(?:\/|\s+per\s+|\s+p\/|p\/)?\s*(?:mo|month|mrr|yr|year)\b/i;

export async function scan({ limit = 100, postsPerSub = 100 } = {}) {
  const username = process.env.REDDIT_USERNAME;
  if (!username) {
    log.error('reddit.scan: REDDIT_USERNAME not set. Add it to .env.local and re-run.');
    return [];
  }

  const userAgent = `directory-hunter/1.0 by /u/${username}`;
  const candidates = [];

  for (const { id, sub } of SUBS) {
    if (candidates.length >= limit) break;
    const url = `https://www.reddit.com/r/${sub}/new.json?limit=${Math.min(postsPerSub, 100)}`;
    try {
      log.info('reddit.scan fetching', { sub, url });
      const data = await httpGetJson(url, { userAgent, throttleMs: 2500 });
      const posts = data?.data?.children ?? [];
      log.info('reddit.scan posts received', { sub, total: posts.length });

      let matched = 0;
      for (const wrapped of posts) {
        const p = wrapped.data;
        const combined = `${p.title || ''}\n${p.selftext || ''}`;
        if (!TOPIC_RE.test(combined)) continue;

        const revMatch = combined.match(REV_RE);
        const revAmount = parseRevenueUsdMonthly(combined);
        const hasRevenue = Boolean(revMatch || revAmount);

        const permalink = `https://www.reddit.com${p.permalink}`;
        candidates.push({
          source_id: id,
          source_url: permalink,
          source_url_canonical: canonicalUrl(permalink),
          niche_raw: (p.title || '').slice(0, 240),
          geographic_hint: null,
          revenue_signal: revMatch ? revMatch[0] : null,
          revenue_amount_usd_monthly: revAmount,
          posted_at: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
          raw_context: (p.selftext || p.title || '').slice(0, 1200),
          raw_payload: {
            id: p.id,
            author: p.author,
            score: p.score,
            num_comments: p.num_comments,
            link_flair_text: p.link_flair_text
          },
          discovery_category: hasRevenue ? 'revenue_mention' : 'opportunity_signal'
        });
        matched++;
        if (candidates.length >= limit) break;
      }
      log.info('reddit.scan sub complete', { sub, matched });
    } catch (err) {
      log.error('reddit.scan sub failed', { sub, error: err.message });
    }
  }

  log.info('reddit.scan complete', { candidates: candidates.length });
  return candidates;
}
