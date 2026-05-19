// Failory scanner. Walks the sitemap, filters to interviews and post-mortems
// that mention directory / listings / lead-gen, extracts niches + revenue
// signal via Claude. Discovery category: revenue_mention (most Failory pieces
// have explicit revenue numbers).

import * as cheerio from 'cheerio';
import { httpGetText } from '../lib/http.js';
import { canonicalUrl, parseRevenueUsdMonthly } from '../lib/dedupe.js';
import { extractNiches } from '../lib/extract-niches.js';
import { log } from '../lib/log.js';

const SOURCE_ID = 'failory';
const ROOT = 'https://www.failory.com';

const URL_KEYWORDS = /\/(interview|post-mortem|stories|founder)/i;
const TOPIC_RE = /\b(directory|directories|listing(?:s)?\s+site|niche\s+site|lead\s+gen)\b/i;

async function fetchSitemapUrls(sitemapUrl) {
  const xml = await httpGetText(sitemapUrl, { throttleMs: 1500, retries: 1 });
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls = [];
  $('url > loc, sitemap > loc').each((_, el) => urls.push($(el).text().trim()));
  return urls;
}

function articleText(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, aside, .comments, form, iframe').remove();
  const main = $('article').first().text()
    || $('main').first().text()
    || $('.post-content, .article-body, .entry-content').first().text()
    || $('body').text();
  return main.replace(/\s+/g, ' ').trim();
}

export async function scan({ limit = 20, maxArticles = 10 } = {}) {
  const candidates = [];
  let urls = [];

  try {
    const top = await fetchSitemapUrls(`${ROOT}/sitemap.xml`);
    // If the sitemap is an index, expand sub-sitemaps.
    for (const u of top) {
      if (/\.xml$/.test(u)) {
        try {
          const sub = await fetchSitemapUrls(u);
          urls.push(...sub);
        } catch (err) {
          log.warn('failory: sub-sitemap failed', { u, error: err.message });
        }
      } else {
        urls.push(u);
      }
    }
    log.info('failory: sitemap urls', { total: urls.length });
  } catch (err) {
    log.error('failory: sitemap fetch failed', { error: err.message });
    return [];
  }

  // Filter by URL pattern first (cheap).
  const interviews = urls.filter(u => URL_KEYWORDS.test(u));
  log.info('failory: interview-pattern urls', { count: interviews.length });

  // Then filter to ones that, on body fetch, mention directory topics.
  // Cap to maxArticles for API spend control.
  const queue = interviews.slice(0, maxArticles * 4);
  const accepted = [];

  for (const u of queue) {
    if (accepted.length >= maxArticles) break;
    try {
      const html = await httpGetText(u, { throttleMs: 2000, retries: 1 });
      const text = articleText(html);
      if (text.length < 500) continue;
      if (!TOPIC_RE.test(text)) continue;
      accepted.push({ url: u, text });
    } catch (err) {
      log.warn('failory: page failed', { u, error: err.message });
    }
  }

  log.info('failory: relevant interviews', { count: accepted.length });

  for (const { url: articleUrl, text } of accepted) {
    if (candidates.length >= limit) break;

    const niches = await extractNiches({ text, sourceLabel: `Failory interview: ${articleUrl}` });
    log.info('failory: extracted', { articleUrl, count: niches.length });

    for (let i = 0; i < niches.length; i++) {
      const n = niches[i];
      const slug = n.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
      const synthetic = `${articleUrl}?dh_niche=${slug}`;
      const revAmt = parseRevenueUsdMonthly(n.revenue_signal || '');
      candidates.push({
        source_id: SOURCE_ID,
        source_url: synthetic,
        source_url_canonical: canonicalUrl(synthetic),
        niche_raw: n.name,
        geographic_hint: n.geo,
        revenue_signal: n.revenue_signal,
        revenue_amount_usd_monthly: revAmt,
        posted_at: null,
        raw_context: n.revenue_signal ? `${n.name} | ${n.revenue_signal}` : n.name,
        raw_payload: { article_url: articleUrl, position: i, niche: n },
        discovery_category: n.revenue_signal ? 'revenue_mention' : 'opportunity_signal'
      });
    }
  }

  log.info('failory.scan complete', { candidates: candidates.length });
  return candidates.slice(0, limit);
}
