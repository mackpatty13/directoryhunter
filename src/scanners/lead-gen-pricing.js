// Lead-gen pricing pages. Evergreen articles that publish CPL data by niche.
// Weekly cadence is enough. Discovery category: opportunity_signal.

import * as cheerio from 'cheerio';
import { httpGetText } from '../lib/http.js';
import { canonicalUrl, parseRevenueUsdMonthly } from '../lib/dedupe.js';
import { extractNiches } from '../lib/extract-niches.js';
import { log } from '../lib/log.js';

const SOURCE_ID = 'lead-gen-pricing';

// Verify each URL is still live and robots-allowed before adding new ones.
const SEED_URLS = [
  'https://leadfindx.com/blog/the-1000-dollar-lead/',
  'https://www.leaddistro.ai/blog/best-lead-generation-niches',
  'https://leadsnap.com/fast-money-strategy-heat-map-ranking-due-diligence/'
];

function extractArticleText(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, aside, .comments, .related, .sidebar').remove();
  const main = $('article').first().text() || $('main').first().text() || $('.post-content, .entry-content, .content').first().text() || $('body').text();
  return main.replace(/\s+/g, ' ').trim();
}

export async function scan({ limit = 100 } = {}) {
  const candidates = [];

  for (const url of SEED_URLS) {
    try {
      log.info('lead-gen-pricing: fetching', { url });
      const html = await httpGetText(url, { throttleMs: 3000, retries: 1 });
      const text = extractArticleText(html);
      if (text.length < 200) {
        log.warn('lead-gen-pricing: article text too short', { url, length: text.length });
        continue;
      }

      const niches = await extractNiches({ text, sourceLabel: `Lead-gen pricing article: ${url}` });
      log.info('lead-gen-pricing: niches extracted', { url, count: niches.length });

      for (let i = 0; i < niches.length; i++) {
        const n = niches[i];
        // Synthesize a unique URL per niche by adding a `dh_niche` query
        // param. canonicalUrl strips tracking params and hash fragments but
        // preserves non-tracking query params, so two niches from the same
        // article get distinct canonical URLs and a re-run dedupes cleanly.
        const slug = n.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
        const synthetic = `${url}?dh_niche=${slug}`;
        candidates.push({
          source_id: SOURCE_ID,
          source_url: synthetic,
          source_url_canonical: canonicalUrl(synthetic),
          niche_raw: n.name,
          geographic_hint: n.geo,
          revenue_signal: n.revenue_signal,
          revenue_amount_usd_monthly: parseRevenueUsdMonthly(n.revenue_signal || ''),
          posted_at: null,
          raw_context: n.revenue_signal
            ? `${n.name} | ${n.revenue_signal}`
            : n.name,
          raw_payload: { article_url: url, position: i, niche: n },
          discovery_category: 'opportunity_signal'
        });
      }
    } catch (err) {
      log.error('lead-gen-pricing: article failed', { url, error: err.message });
    }
  }

  log.info('lead-gen-pricing.scan complete', { candidates: candidates.length });
  return candidates.slice(0, limit);
}
