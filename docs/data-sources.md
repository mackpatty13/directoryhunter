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

## Outscraper (paid)

- Used in Phase 5 evaluation and the Phase 6 weekly category sampler.
- Endpoint: `https://api.outscraper.cloud`.
- Async pattern: most queries return a `request_id`, results retrieved by polling.
- Cache results in `evaluation_data` keyed by `(niche, metro)` for 24 hours.
- Env: `OUTSCRAPER_API_KEY`.

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
- Outscraper category sampler is paid: $5 to $10 per weekly run.
- All paid calls are 24-hour cached so re-runs in the same day cost nothing.
