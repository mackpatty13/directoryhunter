# Data sources

External services and how this project talks to them.

## Supabase

- One project, one schema (public).
- Connection in `src/lib/db.js` via `@supabase/supabase-js` and the **service role key**. Server-side only.
- Migrations live in `db/migrations/` and are applied manually in the Supabase SQL editor.
- Env: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.

## Anthropic

- SDK: `@anthropic-ai/sdk`.
- Models: `claude-haiku-4-5-20251001` for bulk classification and discovery scoring; `claude-sonnet-4-6` for deep evaluation and plan generation.
- All calls go through `src/lib/claude.js` which exposes `haiku()` and `sonnet()` helpers.
- Env: `ANTHROPIC_API_KEY`.

## Google Places API (paid)

- Used in Phase 5 evaluation and the Phase 6 weekly category sampler.
- Endpoint: `https://places.googleapis.com/v1/places:searchText` (Places API New, Text Search).
- Synchronous: one HTTP request per (keyword, city). Paginate via `nextPageToken` (max 20 per page, 3 pages = 60 results).
- Field mask determines cost SKU. We use Pro SKU ($20 per 1000 results) because we ask for phone, website, hours, and photos.
- First $200/month of GCP usage is free credit, which covers the full weekly sampler (~$90) and Phase 5 evals comfortably.
- Cache results in `evaluation_data` keyed by `(niche, metro)` for 24 hours.
- Env: `GOOGLE_PLACES_API_KEY` (create in Google Cloud console, enable the "Places API (New)" service, restrict the key to that API).

## DataforSEO (paid)

- Used in Phase 5 evaluation only.
- Endpoints under `https://api.dataforseo.com/v3/`. Sandbox at `https://sandbox.dataforseo.com/v3/` during dev.
- Basic auth: `DATAFORSEO_LOGIN` plus `DATAFORSEO_PASSWORD`.
- Cache SERP and keyword data in `evaluation_data` for 24 hours.
- Env: `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `DATAFORSEO_SANDBOX`.

## Google Trends

- `google-trends-api` npm package, no key.
- Trends data is cached in `evaluation_data` for 24 hours per (niche, metro).

## Reddit

- Public JSON endpoints. No OAuth required for read-only access.
- User-Agent format mandated by Reddit: `directory-hunter/1.0 by /u/<REDDIT_USERNAME>`.
- Throttle: 2 second delay between subreddits, and respect 429 backoffs.

## Resend

- Used in Phase 6 for the Sunday digest only.
- Domain `buildmyblast.com` already verified. Sender: `hunter@buildmyblast.com`.
- Env: `RESEND_API_KEY`, `DIGEST_RECIPIENT_EMAIL`.

## Cost guardrails

- Discovery is effectively free (Reddit, sitemaps, Playwright on public pages, Haiku scoring).
- Evaluation is paid. Budget: $1 to $3 per evaluation. Expected volume: 5 to 10 per week. Monthly: $30 to $100.
- Category sampler is paid Google Places: roughly $90 per full weekly run, almost always inside GCP's $200/month free credit.
- All paid calls are 24-hour cached so re-runs in the same day cost nothing.
