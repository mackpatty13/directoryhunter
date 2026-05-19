# CLAUDE.md

Persistent context for any Claude Code session working in this repo. Read this entire file before touching code.

## What this project is

Directory Hunter is Patrick's personal tool. It discovers directory-site niches that match Frey Chu's playbook (boring, local, commercial intent, high ARPU, beatable competition) and on demand runs a deep paid-API evaluation. Not a product. No public auth, no customers.

The canonical spec is `directory-hunter-discovery-kickoff.md` at the repo root. If anything below conflicts with that file, the kickoff wins.

## Hard rules

1. No em-dashes (—) or en-dashes (–) anywhere. Use commas, periods, or rephrase.
2. No AI-slop language. Banned words: dive, navigate, leverage, comprehensive, robust, seamless, delve, embark, journey, unleash, unlock potential, empower, harness. Write like a person.
3. Do not over-engineer. Plain functions. Server actions over REST routes when reasonable.
4. One step at a time. Stop at the end of each phase and wait for confirmation.
5. Confirm before destructive operations.
6. Respect robots.txt. Set a real User-Agent identifying the bot. Throttle scrapers (2 second default delay).
7. Never hardcode secrets. Crash clearly if env vars are missing. No silent defaults.
8. Server-side API routes only for anything touching paid APIs. Never expose keys to the browser.
9. Cache aggressively. Same niche plus metro evaluation must not re-hit paid APIs within 24 hours.
10. Idempotent everything. Re-running a scraper or an evaluation must not create duplicates.
11. Discovery sources are free or near-free. Evaluation is the only step that touches paid APIs, and only when Patrick clicks Evaluate.

## Stack

- Next.js 14 App Router, plain JS, no TypeScript. ESM (`"type": "module"`).
- Tailwind, no UI component libraries.
- Supabase for storage. URL and service key in env.
- Vercel for hosting. Railway for cron jobs (Vercel cron is too restricted).
- Resend for the weekly digest. Sender: `hunter@buildmyblast.com`. Domain already verified.
- Anthropic: `claude-haiku-4-5-20251001` for bulk classification and Discovery scoring; `claude-sonnet-4-6` for deep evaluation and build-plan generation.
- Playwright for JS-heavy scraping. `cheerio` for HTML parsing. Built-in `fetch` for plain HTTP (Node 20.6+).
- `google-trends-api` for Trends. Outscraper for Maps. DataforSEO for SERP and keywords.

## Phase plan

1. Skeleton + DB schema + first scanner + test-scanner script.
2. Storage wiring + Haiku discovery scoring.
3. Remaining scanners (reddit, indiehackers, niche-pursuits, failory, frey-chu blog+YouTube, lead-gen-pricing).
4. Discovery UI (inbox, candidate detail, filters).
5. Evaluation pipeline + UI (normalize, Outscraper, DataforSEO, Trends, Sonnet scoring, build plan).
6. Outscraper category sampler + Sunday digest email.
7. Deploy to Vercel + Railway cron.

Do not start a phase until the previous one is confirmed.

## Database table naming

All Directory Hunter tables are prefixed `dh_` (e.g., `dh_niche_candidates`, `dh_evaluations`, `dh_digests`). This Supabase project is shared with at least one other app (Opportunity Scraper, which owns the unprefixed `digests` and other names). The prefix is non-negotiable: do not add an unprefixed table.

JS code reads table names from `T` exported by `src/lib/db.js`. Use `T.candidates`, `T.sources`, etc., not literal strings, so a future rename is a one-file change.

## Directory layout

```
.
├── CLAUDE.md
├── README.md
├── package.json
├── next.config.mjs, tailwind.config.mjs, postcss.config.mjs
├── .env.example
├── docs/
│   ├── discovery-sources.md       # one section per scanner
│   ├── discovery-rubric.md        # Haiku scoring prompt + thresholds
│   ├── evaluation-rubric.md       # six dimensions for Sonnet scoring
│   └── data-sources.md            # paid API notes, rate limits, costs
├── db/migrations/                 # run manually in Supabase SQL editor
└── src/
    ├── app/                       # App Router pages and API routes
    ├── lib/                       # db, http, log, dedupe, claude, ...
    ├── scanners/                  # one file per source, all export scan()
    ├── scripts/                   # CLI entry points, cron-triggered in prod
    └── components/                # Phase 4+
```

## Conventions

- Every scanner exports `async function scan(options)` returning an array of candidate objects matching the `niche_candidates` insert shape minus auto fields.
- `source_url_canonical` is computed by `lib/dedupe.canonicalUrl()` before insert.
- `niche_canonical` is set by Claude Haiku during the discovery scoring pass, not by the scanner.
- Scripts load env via `node --env-file=.env.local` (Node 20.6+). No `dotenv` package.
- Logging goes through `lib/log.js`. Do not call `console.log` directly in lib or scanners.
- HTTP requests go through `lib/http.js`. It enforces User-Agent and throttling.
- Anthropic calls go through `lib/claude.js`. It exposes `haiku()` and `sonnet()` helpers and validates JSON output against a schema when one is passed.
- Errors crash loud during dev (no swallowed catches in lib code). Scanners may catch and return `[]` so one broken source does not kill the nightly run, but they must log the failure.

## Env vars

All in `.env.example`. Required for each phase:

- Phase 1 to test scanners: none (Playwright runs against public pages).
- Phase 1 to apply migration: Supabase via the dashboard, not via the app.
- Phase 2 onward: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`.
- Phase 3 (Reddit): `REDDIT_USERNAME` for the User-Agent string.
- Phase 5: `OUTSCRAPER_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `DATAFORSEO_SANDBOX`.
- Phase 6: `RESEND_API_KEY`, `DIGEST_RECIPIENT_EMAIL`, `APP_BASE_URL`.

## When in doubt

Re-read the kickoff doc. Ask Patrick before guessing. Pick the smaller, simpler implementation. Stop at phase boundaries.
