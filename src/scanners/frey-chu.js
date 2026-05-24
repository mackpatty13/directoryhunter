// Frey Chu scanner. Two sub-scanners: the Ship Your Directory blog (sitemap-
// based) and his YouTube channel (Playwright + transcript extraction).
// Each extracted niche becomes a candidate with discovery_category
// 'opportunity_signal'. Frey naming a niche is a strong signal even when he
// does not claim he has built it.

import * as cheerio from 'cheerio';
import { launchBrowser } from '../lib/browser.js';
import { YoutubeTranscript } from 'youtube-transcript';
import { httpGetText } from '../lib/http.js';
import { canonicalUrl, parseRevenueUsdMonthly } from '../lib/dedupe.js';
import { extractNiches } from '../lib/extract-niches.js';
import { log } from '../lib/log.js';

const BLOG_ROOT = 'https://shipyourdirectory.com';
const YT_CHANNEL = 'https://www.youtube.com/@freychu/videos';
const BLOG_SOURCE_ID = 'frey-chu-blog';
const YT_SOURCE_ID = 'frey-chu-youtube';
const USER_AGENT = 'directory-hunter/1.0 (+https://buildmyblast.com)';

async function fetchSitemapUrls(sitemapUrl) {
  const xml = await httpGetText(sitemapUrl, { throttleMs: 1500, retries: 1 });
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls = [];
  $('url > loc, sitemap > loc').each((_, el) => urls.push($(el).text().trim()));
  return urls;
}

function articleText(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, aside, form, iframe').remove();
  const main = $('article').first().text()
    || $('main').first().text()
    || $('.post-content, .entry-content, .article-body').first().text()
    || $('body').text();
  return main.replace(/\s+/g, ' ').trim();
}

function makeCandidate({ sourceId, articleUrl, position, niche }) {
  const slug = niche.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const synthetic = `${articleUrl}?dh_niche=${slug}`;
  return {
    source_id: sourceId,
    source_url: synthetic,
    source_url_canonical: canonicalUrl(synthetic),
    niche_raw: niche.name,
    geographic_hint: niche.geo,
    revenue_signal: niche.revenue_signal,
    revenue_amount_usd_monthly: parseRevenueUsdMonthly(niche.revenue_signal || ''),
    posted_at: null,
    raw_context: niche.revenue_signal ? `${niche.name} | ${niche.revenue_signal}` : niche.name,
    raw_payload: { source_url: articleUrl, position, niche },
    discovery_category: 'opportunity_signal'
  };
}

// Frey Chu does not run a public blog on shipyourdirectory.com (it's a
// membership site). We scrape the marketing pages he does publish, which
// often mention specific niche examples in their copy.
const BLOG_PAGES = [
  `${BLOG_ROOT}/`,
  `${BLOG_ROOT}/consulting`,
  `${BLOG_ROOT}/newsletter`
];

async function scanBlog() {
  const candidates = [];
  for (const pageUrl of BLOG_PAGES) {
    try {
      const html = await httpGetText(pageUrl, { throttleMs: 2000, retries: 1 });
      const text = articleText(html);
      if (text.length < 300) {
        log.warn('frey-chu blog: page too short', { pageUrl, length: text.length });
        continue;
      }
      const niches = await extractNiches({ text, sourceLabel: `Ship Your Directory page: ${pageUrl}` });
      log.info('frey-chu blog: extracted', { pageUrl, count: niches.length });
      niches.forEach((n, i) => candidates.push(makeCandidate({
        sourceId: BLOG_SOURCE_ID, articleUrl: pageUrl, position: i, niche: n
      })));
    } catch (err) {
      log.warn('frey-chu blog: page failed', { pageUrl, error: err.message });
    }
  }
  return candidates;
}

async function scanYouTube({ maxVideos }) {
  const candidates = [];
  let videoIds = [];

  // Get the recent video list by navigating the channel page with Playwright.
  // YouTube heavily lazy-loads; we scroll twice to surface ~30-40 thumbnails.
  const browser = await launchBrowser({ headless: true });
  const ctx = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(YT_CHANNEL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2500);
    }
    videoIds = await page.$$eval('a[href*="/watch"]', els => {
      const ids = [];
      for (const el of els) {
        const href = el.getAttribute('href') || '';
        const m = href.match(/[?&]v=([\w-]{11})/);
        if (m && !ids.includes(m[1])) ids.push(m[1]);
      }
      return ids;
    });
    log.info('frey-chu youtube: discovered videos', { count: videoIds.length });
  } catch (err) {
    log.error('frey-chu youtube: channel page failed', { error: err.message });
  } finally {
    await ctx.close();
    await browser.close();
  }

  for (const id of videoIds.slice(0, maxVideos)) {
    const videoUrl = `https://www.youtube.com/watch?v=${id}`;
    try {
      const segments = await YoutubeTranscript.fetchTranscript(id);
      const text = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
      if (text.length < 500) continue;
      const niches = await extractNiches({ text, sourceLabel: `Frey Chu YouTube video: ${videoUrl}` });
      log.info('frey-chu youtube: extracted', { videoUrl, count: niches.length });
      niches.forEach((n, i) => candidates.push(makeCandidate({
        sourceId: YT_SOURCE_ID, articleUrl: videoUrl, position: i, niche: n
      })));
    } catch (err) {
      // Some videos disable transcripts; that is normal.
      log.warn('frey-chu youtube: video skipped', { id, error: err.message });
    }
  }

  return candidates;
}

export async function scan({ limit = 100, maxVideos = 15 } = {}) {
  log.info('frey-chu.scan started', { maxVideos });

  const [blog, yt] = await Promise.allSettled([
    scanBlog(),
    scanYouTube({ maxVideos })
  ]);

  const blogCands = blog.status === 'fulfilled' ? blog.value : [];
  const ytCands = yt.status === 'fulfilled' ? yt.value : [];
  if (blog.status !== 'fulfilled') log.error('frey-chu blog: rejected', { error: blog.reason?.message });
  if (yt.status !== 'fulfilled') log.error('frey-chu youtube: rejected', { error: yt.reason?.message });

  const all = [...blogCands, ...ytCands];
  log.info('frey-chu.scan complete', { blog: blogCands.length, youtube: ytCands.length });
  return all.slice(0, limit);
}
