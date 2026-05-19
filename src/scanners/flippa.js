// Flippa marketplace scanner.
// Filters publicly browseable listings by the keyword "directory".
// No login required. Discovery category: proven_winner.
//
// Flippa's listings are client-rendered via JS. Playwright is required.
// Selectors below use loose attribute matchers because Flippa's class names
// are hashed and change. After the first real run, refine selectors against
// the actual DOM if results look sparse.

import { chromium } from 'playwright';
import { canonicalUrl, parseRevenueUsdMonthly } from '../lib/dedupe.js';
import { log } from '../lib/log.js';

const SEARCH_URL = 'https://flippa.com/search?keywords=directory';
const SOURCE_ID = 'flippa';
const USER_AGENT = 'directory-hunter/1.0 (+https://buildmyblast.com)';

export async function scan({ limit = 100, headless = true } = {}) {
  const browser = await chromium.launch({ headless });
  const ctx = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1440, height: 900 }
  });
  const page = await ctx.newPage();

  const candidates = [];

  try {
    log.info('flippa.scan started', { url: SEARCH_URL, limit });
    await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Wait for the SPA to populate listings. Try a few likely selectors.
    await page.waitForFunction(
      () => {
        const candidates = document.querySelectorAll(
          'article, [class*="ListingCard"], [class*="listing-card"], [data-testid*="listing"]'
        );
        return candidates.length >= 3;
      },
      { timeout: 20000 }
    ).catch(() => {
      log.warn('flippa.scan: listings did not render within 20s, scraping whatever is present');
    });

    // Scroll a bit to trigger lazy loading.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2500);
    }

    const rawCards = await page.$$eval(
      'article, [class*="ListingCard"], [class*="listing-card"], [data-testid*="listing"]',
      (els) => els.map(el => {
        const text = el.textContent || '';
        const titleEl = el.querySelector('h2, h3, h4, h5, h6, [class*="title"], [class*="Title"]');
        const links = Array.from(el.querySelectorAll('a[href]'));
        const detailLink = links.find(a => /\/(listings|business|website-businesses)\//.test(a.getAttribute('href') || ''))
          ?? links.find(a => (a.getAttribute('href') || '').startsWith('/'));
        const priceEl = el.querySelector('[class*="price" i], [class*="Price"], [data-testid*="price"]');

        const revenueMatch = text.match(/(?:revenue|MRR|profit)[^\n]{0,40}\$\s?[\d,]+(?:\.\d+)?\s?k?\s?\/?\s?(?:mo|month|m|monthly|year|yr|annual|annually)?/i);
        const priceMatch = text.match(/\$\s?[\d,]+(?:\.\d+)?\s?k?(?!\s?\/\s?mo)/);

        return {
          title: titleEl?.textContent?.trim() || null,
          href: detailLink?.getAttribute('href') || null,
          price: priceEl?.textContent?.trim() || (priceMatch ? priceMatch[0] : null),
          revenue: revenueMatch ? revenueMatch[0] : null,
          full_text_snippet: text.replace(/\s+/g, ' ').trim().slice(0, 400)
        };
      })
    );

    const filtered = rawCards.filter(c => c.title && c.href);
    log.info('flippa.scan extracted cards', { total: rawCards.length, with_title_and_link: filtered.length });

    for (const c of filtered.slice(0, limit)) {
      let url;
      try {
        url = new URL(c.href, 'https://flippa.com').toString();
      } catch {
        log.warn('flippa.scan: skipping card with invalid href', { href: c.href });
        continue;
      }

      const revenueAmount = parseRevenueUsdMonthly(c.revenue || '') ?? parseRevenueUsdMonthly(c.full_text_snippet);

      candidates.push({
        source_id: SOURCE_ID,
        source_url: url,
        source_url_canonical: canonicalUrl(url),
        niche_raw: c.title,
        geographic_hint: null,
        revenue_signal: c.revenue || c.price || null,
        revenue_amount_usd_monthly: revenueAmount,
        posted_at: null,
        raw_context: c.full_text_snippet,
        raw_payload: c
      });
    }

  } catch (err) {
    log.error('flippa.scan failed', { error: err.message });
  } finally {
    await ctx.close();
    await browser.close();
  }

  return candidates;
}
