// Niche Pursuits scanner. Walks the sitemap, filters posts by directory/local
// keywords, fetches the article body, runs Claude niche extraction.
// Discovery category: opportunity_signal.

import * as cheerio from 'cheerio';
import { httpGetText } from '../lib/http.js';
import { canonicalUrl, parseRevenueUsdMonthly } from '../lib/dedupe.js';
import { extractNiches } from '../lib/extract-niches.js';
import { log } from '../lib/log.js';

const SOURCE_ID = 'niche-pursuits';
const ROOT = 'https://www.nichepursuits.com';

const URL_KEYWORDS = /\b(directory|directories|local-seo|niche-site|local-business|lead-gen|listings)\b/i;

async function fetchSitemapUrls(sitemapUrl) {
  const xml = await httpGetText(sitemapUrl, { throttleMs: 1500, retries: 1 });
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls = [];
  $('url > loc').each((_, el) => urls.push($(el).text().trim()));
  // Some sites have a sitemap index. If we got fewer than a handful of urls,
  // try treating the result as an index.
  if (urls.length === 0) {
    $('sitemap > loc').each((_, el) => urls.push($(el).text().trim()));
  }
  return urls;
}

function articleText(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, aside, .comments, .related, .sidebar, form, iframe').remove();
  const main = $('article').first().text()
    || $('main').first().text()
    || $('.entry-content, .post-content, .single-post, .article-body').first().text()
    || $('body').text();
  return main.replace(/\s+/g, ' ').trim();
}

export async function scan({ limit = 20, maxArticles = 10 } = {}) {
  const candidates = [];
  let urls = [];

  try {
    // Try the main sitemap first. Niche Pursuits uses WP, so its sitemap is
    // an index pointing to post-sitemap1.xml, post-sitemap2.xml, etc.
    const indexUrls = await fetchSitemapUrls(`${ROOT}/sitemap.xml`);

    // Expand sub-sitemaps that look like post sitemaps.
    for (const u of indexUrls) {
      if (/post-sitemap/i.test(u)) {
        try {
          const subUrls = await fetchSitemapUrls(u);
          urls.push(...subUrls);
        } catch (err) {
          log.warn('niche-pursuits: sub-sitemap failed', { u, error: err.message });
        }
      } else if (/\.xml$/.test(u)) {
        // skip non-post sitemaps (pages, categories)
      } else {
        urls.push(u);
      }
    }

    log.info('niche-pursuits: sitemap urls', { total: urls.length });
  } catch (err) {
    log.error('niche-pursuits: sitemap fetch failed', { error: err.message });
    return [];
  }

  // Filter by keywords in URL slug.
  const filtered = urls.filter(u => URL_KEYWORDS.test(u));
  log.info('niche-pursuits: filtered articles', { kept: filtered.length });

  // Cap to maxArticles to control API spend during testing.
  const articles = filtered.slice(0, maxArticles);

  for (const articleUrl of articles) {
    if (candidates.length >= limit) break;
    try {
      const html = await httpGetText(articleUrl, { throttleMs: 2000, retries: 1 });
      const text = articleText(html);
      if (text.length < 500) {
        log.warn('niche-pursuits: article too short', { articleUrl, length: text.length });
        continue;
      }

      const niches = await extractNiches({ text, sourceLabel: `Niche Pursuits article: ${articleUrl}` });
      log.info('niche-pursuits: extracted', { articleUrl, count: niches.length });

      for (let i = 0; i < niches.length; i++) {
        const n = niches[i];
        const slug = n.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
        const synthetic = `${articleUrl}?dh_niche=${slug}`;
        candidates.push({
          source_id: SOURCE_ID,
          source_url: synthetic,
          source_url_canonical: canonicalUrl(synthetic),
          niche_raw: n.name,
          geographic_hint: n.geo,
          revenue_signal: n.revenue_signal,
          revenue_amount_usd_monthly: parseRevenueUsdMonthly(n.revenue_signal || ''),
          posted_at: null,
          raw_context: n.revenue_signal ? `${n.name} | ${n.revenue_signal}` : n.name,
          raw_payload: { article_url: articleUrl, position: i, niche: n },
          discovery_category: 'opportunity_signal'
        });
      }
    } catch (err) {
      log.warn('niche-pursuits: article failed', { articleUrl, error: err.message });
    }
  }

  log.info('niche-pursuits.scan complete', { candidates: candidates.length });
  return candidates.slice(0, limit);
}
