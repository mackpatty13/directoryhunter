# Discovery sources

Eight scanners feed `niche_candidates`. Each exports `async function scan(options)` returning an array of candidate objects in the `niche_candidates` insert shape, minus auto fields.

A candidate looks like:

```js
{
  source_id: 'acquire',                       // matches a row in discovery_sources
  source_url: 'https://example.com/listing/123',
  source_url_canonical: 'https://example.com/listing/123',  // via lib/dedupe.canonicalUrl
  niche_raw: 'mobile dog grooming directory',
  geographic_hint: 'national' | 'DFW' | null,
  revenue_signal: '$3,400/mo MRR' | null,
  revenue_amount_usd_monthly: 3400 | null,    // parsed when possible
  posted_at: '2026-05-10T00:00:00Z' | null,
  raw_context: 'snippet of surrounding text',
  raw_payload: { /* whatever the scanner found */ }
}
```

`niche_canonical`, `discovery_score`, `estimated_arpu_usd`, and `fit_reasoning` are filled by the Haiku scoring pass, not by the scanner.

---

## 1. Acquire.com (`scanners/acquire.js`) - first scanner built

Public listings page. Filter to directory businesses for sale.

- Use Playwright (page is JS-rendered).
- Filter to category that includes the word "directory" or matching tags.
- Extract per listing: business name, niche/category text, asking price, MRR or revenue if shown, brief description, listing URL.
- Each listing becomes a candidate with `discovery_category = 'proven_winner'`. Niches with real revenue listed for sale are validated by economics, the highest-signal source.
- Do not bypass auth. Pull only what is publicly visible.
- Pagination: scroll or click "load more". Cap at 200 listings per run.
- 3 second delay between page loads.

Known issue: as of the start of Phase 1, the public marketplace at `acquire.com` requires signup to view individual listings. If this remains true, swap the first scanner to Flippa (see below) and treat Acquire as a Phase 3 follow-up that may require Patrick to provide a manual session cookie.

## 1a. Flippa fallback (`scanners/flippa.js`)

Public marketplace with no login required.

- Start URL: `https://flippa.com/search?filter%5Bcategory%5D=websites` plus a keyword filter for "directory".
- Use Playwright if needed; Flippa serves a lot client-side.
- Extract per listing: title, niche tags, asking price, monthly revenue, monthly profit, listing URL.
- Each becomes a candidate with `discovery_category = 'proven_winner'`.

## 2. Indie Hackers products (`scanners/indiehackers.js`)

Solo founders running directory sites with public revenue.

- Start URL: `https://www.indiehackers.com/products?revenueVerification=stripe`, sorted by revenue descending.
- Playwright.
- Filter products whose title, tagline, or description contains: directory, listings, marketplace, finder, near me.
- Extract: product name, tagline, founder, monthly revenue, product URL.
- Each becomes a candidate with `discovery_category = 'revenue_mention'`.

## 3. Reddit (`scanners/reddit.js`)

Subreddits: `r/juststart`, `r/SEO`, `r/EntrepreneurRideAlong`, `r/SideProject`.

- Public JSON API: `https://www.reddit.com/r/<sub>/new.json?limit=100`.
- User-Agent: `directory-hunter/1.0 by /u/<REDDIT_USERNAME>` from env.
- 2 second delay between subreddits.
- Filter posts where title or selftext contains: directory, listings site, niche site revenue, lead gen.
- Run regex for revenue mentions to populate `revenue_signal` and `revenue_amount_usd_monthly`.
- Each becomes a candidate with `discovery_category = 'revenue_mention'` when revenue is mentioned, else `opportunity_signal`.

## 4. Frey Chu content (`scanners/frey-chu.js`)

Two sub-scrapers in one file.

**Blog** (`https://shipyourdirectory.com`)
- Fetch `sitemap.xml`. For each post, extract title and body text.
- Run a Claude Haiku extraction prompt: "Return a JSON array of every specific niche (industry plus location modifier if any) mentioned in this post."

**YouTube** (`https://www.youtube.com/@freychu`)
- Use `youtube-transcript-api` or `googleapis` to pull recent video transcripts.
- Run the same niche-extraction prompt per transcript.
- First run: last 50 videos. Subsequent weekly runs: last 10 only.

Each extracted niche becomes a candidate with `discovery_category = 'opportunity_signal'`. Frey naming a niche is itself a strong signal even when he does not claim he has built it.

## 5. Niche Pursuits (`scanners/niche-pursuits.js`)

- Sitemap: `https://www.nichepursuits.com/sitemap.xml`, or scrape category pages tagged "directory", "local SEO", "niche site".
- Run Claude extraction over post bodies.
- Each becomes a candidate with `discovery_category = 'opportunity_signal'`.

## 6. Failory (`scanners/failory.js`)

- Sitemap: `https://www.failory.com/sitemap.xml`.
- Filter URLs containing `/interview/` or `/post-mortem/`.
- Filter further to interviews mentioning: directory, listings, lead gen, niche site.
- Extract niche plus revenue mention via Claude.
- Each becomes a candidate with `discovery_category = 'revenue_mention'`.

## 7. Lead-gen pricing pages (`scanners/lead-gen-pricing.js`)

Evergreen articles that publish CPL data by niche. Weekly cadence is fine.

Seed URLs (verify still live and robots-allowed):

- `https://leadfindx.com/blog/the-1000-dollar-lead/`
- `https://www.leaddistro.ai/blog/best-lead-generation-niches`
- `https://leadsnap.com/fast-money-strategy-heat-map-ranking-due-diligence/`

For each, extract niche name, CPL or CPC range, why it is profitable. ARPU is derived from CPL (high CPL implies high ARPU). Each becomes a candidate with `discovery_category = 'opportunity_signal'`.

## 8. Outscraper category sampler (`scanners/outscraper-categories.js`)

The only paid scanner. Runs weekly, not nightly. Budget: $5 to $10 per run.

- Outscraper has roughly 8,000 Google Maps categories.
- On each run, sample 50 categories not sampled in the last 90 days.
- For each, pull 30 businesses across 3 random mid-sized cities.
- Compute completeness rate (businesses with hours plus website plus 5+ reviews plus photos).
- Under 50% completeness, the category becomes a candidate with `discovery_category = 'opportunity_signal'`.

This is the only scanner that surfaces niches no one has named yet.
