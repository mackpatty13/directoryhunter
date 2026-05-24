// Indie Hackers product scanner. SPA, needs Playwright. Filters products by
// keywords in title/tagline. Discovery category: revenue_mention (IH products
// page only shows revenue-verified products by design here).

import { launchBrowser } from '../lib/browser.js';
import { canonicalUrl, parseRevenueUsdMonthly } from '../lib/dedupe.js';
import { log } from '../lib/log.js';

const SOURCE_ID = 'indiehackers';
const SEARCH_URL = 'https://www.indiehackers.com/products';
const USER_AGENT = 'directory-hunter/1.0 (+https://buildmyblast.com)';

const KEYWORDS = /\b(director(?:y|ies)|listings|marketplace|finder|near me|local\s+lead|lead\s+gen|local\s+seo|local\s+business)\b/i;

export async function scan({ limit = 100, headless = true, maxCards = 80 } = {}) {
  const browser = await launchBrowser({ headless });
  const ctx = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const candidates = [];

  try {
    log.info('indiehackers.scan started', { url: SEARCH_URL });
    await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for any product card-like element. Indie Hackers uses Ember + custom
    // class names; we match loosely on a link to /product/<slug>.
    await page.waitForSelector('a[href^="/product/"]', { timeout: 25000 }).catch(() => {
      log.warn('indiehackers.scan: product links did not appear within 25s');
    });

    // Scroll to lazy-load more.
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2500);
    }

    const rawCards = await page.$$eval('a[href^="/product/"]', (links) => {
      const seen = new Set();
      const out = [];
      for (const link of links) {
        const href = link.getAttribute('href');
        if (!href || seen.has(href)) continue;
        seen.add(href);
        // Walk up to find the surrounding card with text.
        let card = link;
        for (let i = 0; i < 4 && card; i++) {
          if ((card.textContent || '').length > 60) break;
          card = card.parentElement;
        }
        const text = (card?.textContent || '').replace(/\s+/g, ' ').trim();
        out.push({ href, text: text.slice(0, 600) });
      }
      return out;
    });

    log.info('indiehackers.scan: cards scraped', { total: rawCards.length });

    for (const c of rawCards.slice(0, maxCards)) {
      if (!KEYWORDS.test(c.text)) continue;
      const url = new URL(c.href, 'https://www.indiehackers.com').toString();
      const revAmount = parseRevenueUsdMonthly(c.text);
      // Title heuristic: take everything up to the first delimiter or first
      // sentence break. The slug after /product/ also gives a stable hint.
      const slug = c.href.replace(/^\/product\//, '').replace(/\?.*$/, '');
      const titleGuess = slug.replace(/[-_]+/g, ' ');

      candidates.push({
        source_id: SOURCE_ID,
        source_url: url,
        source_url_canonical: canonicalUrl(url),
        niche_raw: titleGuess,
        geographic_hint: null,
        revenue_signal: revAmount ? `$${revAmount}/mo` : null,
        revenue_amount_usd_monthly: revAmount,
        posted_at: null,
        raw_context: c.text,
        raw_payload: { slug, full_text: c.text },
        discovery_category: 'revenue_mention'
      });
      if (candidates.length >= limit) break;
    }
  } catch (err) {
    log.error('indiehackers.scan failed', { error: err.message });
  } finally {
    await ctx.close();
    await browser.close();
  }

  log.info('indiehackers.scan complete', { candidates: candidates.length });
  return candidates;
}
