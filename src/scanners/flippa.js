// Flippa marketplace scanner.
// Filters to sitetype=directory and pulls public listing cards.
// No login required. Discovery category: proven_winner.

import { launchBrowser } from '../lib/browser.js';
import { canonicalUrl, parseRevenueUsdMonthly } from '../lib/dedupe.js';
import { log } from '../lib/log.js';

const SEARCH_URL = 'https://flippa.com/search?filter%5Bsitetype%5D=directory';
const SOURCE_ID = 'flippa';
const USER_AGENT = 'directory-hunter/1.0 (+https://buildmyblast.com)';

// Detail (full) cards have class `tw-space-y-2.5`. Truncated sponsor/NDA cards
// share the GTM class but have far less text.
const FULL_CARD_SELECTOR = 'a.GTM-search-result-card.tw-space-y-2\\.5';
const ANY_CARD_SELECTOR = 'a.GTM-search-result-card';

// Parse Flippa's structured profit line: "Net Profit USD $1,338 p/mo"
// or negative: "Net Profit -USD $90 p/mo".
function parseFlippaProfit(text) {
  const m = text.match(/Net\s+Profit\s+(-?)\s?(USD\s*)?\$?\s?([\d,]+(?:\.\d+)?)\s?p\/mo/i);
  if (!m) return { amount: null, raw: null };
  const sign = m[1] === '-' ? -1 : 1;
  const n = parseFloat(m[3].replace(/,/g, ''));
  if (!Number.isFinite(n)) return { amount: null, raw: m[0] };
  return { amount: Math.round(sign * n), raw: m[0] };
}

// Pull a location chip ("FL, United States", "India", "GA, United States").
// Heuristic: the location sits between the verification badge text and the
// listing description. We approximate by matching the first chunk that looks
// like a country or US-state pattern.
function parseLocation(text) {
  const usStateCountry = text.match(/\b([A-Z]{2}),\s+United\s+States\b/);
  if (usStateCountry) return usStateCountry[0];
  const knownCountries = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Ireland', 'India', 'Singapore', 'South Africa', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'New Zealand', 'Philippines', 'Romania', 'Brazil', 'Mexico'];
  for (const c of knownCountries) {
    if (text.includes(c)) return c;
  }
  return null;
}

function parseDescription(text, title) {
  // The description is the free-text segment after the location chip and
  // before the structured "Type X Industry Y" block. Cheap approximation:
  // grab the chunk between the title and the "Type" keyword.
  const afterTitle = text.split(title).slice(1).join(title);
  const stop = afterTitle.search(/\bType\s+(?:Content|SaaS|Service|Ecommerce|Business|App)/i);
  if (stop > 0) return afterTitle.slice(0, stop).replace(/\s+/g, ' ').trim();
  return afterTitle.replace(/\s+/g, ' ').trim().slice(0, 400);
}

export async function scan({ limit = 100, headless = true } = {}) {
  const browser = await launchBrowser({ headless });
  const ctx = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1440, height: 900 }
  });
  const page = await ctx.newPage();

  const candidates = [];

  try {
    log.info('flippa.scan started', { url: SEARCH_URL, limit });
    await page.goto(SEARCH_URL, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for at least a few real cards to render.
    await page.waitForSelector(FULL_CARD_SELECTOR, { timeout: 25000 }).catch(() => {
      log.warn('flippa.scan: full-detail cards did not appear within 25s; scraping whatever is present');
    });

    // Lazy-load more by scrolling.
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
    }

    const totalAny = await page.$$eval(ANY_CARD_SELECTOR, els => els.length);
    const rawCards = await page.$$eval(FULL_CARD_SELECTOR, (els) => els.map(el => {
      const h = el.querySelector('h6');
      return {
        href: el.getAttribute('href'),
        title: h?.textContent?.trim() ?? null,
        text: (el.textContent || '').replace(/\s+/g, ' ').trim()
      };
    }));

    log.info('flippa.scan: cards found', {
      total_cards_any: totalAny,
      full_detail_cards: rawCards.length
    });

    const seen = new Set();
    for (const c of rawCards) {
      if (!c.href || !c.title) continue;
      if (seen.has(c.href)) continue;
      seen.add(c.href);

      let url;
      try { url = new URL(c.href, 'https://flippa.com').toString(); }
      catch { continue; }

      const profit = parseFlippaProfit(c.text);
      const revenueAmount = profit.amount ?? parseRevenueUsdMonthly(c.text);
      const geo = parseLocation(c.text);
      const description = parseDescription(c.text, c.title);

      candidates.push({
        source_id: SOURCE_ID,
        source_url: url,
        source_url_canonical: canonicalUrl(url),
        niche_raw: c.title,
        geographic_hint: geo,
        revenue_signal: profit.raw,
        revenue_amount_usd_monthly: revenueAmount,
        posted_at: null,
        raw_context: description || c.text.slice(0, 400),
        raw_payload: {
          href: c.href,
          title: c.title,
          description,
          flippa_profit_line: profit.raw,
          location: geo
        },
        // Marketplace listings are validated by real prior sales.
        discovery_category: 'proven_winner'
      });

      if (candidates.length >= limit) break;
    }

  } catch (err) {
    log.error('flippa.scan failed', { error: err.message });
  } finally {
    await ctx.close();
    await browser.close();
  }

  log.info('flippa.scan complete', { candidates: candidates.length });
  return candidates;
}
