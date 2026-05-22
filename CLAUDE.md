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
- `google-trends-api` for Trends. Google Places API (New) for Maps. DataforSEO for SERP and keywords.

## Phase plan

1. Skeleton + DB schema + first scanner + test-scanner script. **(done)**
2. Storage wiring + Haiku discovery scoring. **(done)**
3. Remaining scanners (reddit, indiehackers, niche-pursuits, failory, frey-chu blog+YouTube, lead-gen-pricing). **(done)**
4. Discovery UI (inbox, candidate detail, filters). **(done)**
5. Evaluation pipeline + UI (normalize, Google Places, DataforSEO, Trends, Sonnet scoring, build plan). **(done)**
6. Google Maps category sampler + Sunday digest email. **(done)**
7. Deploy to Vercel + Railway. **(done 2026-05-21)**

Do not start a phase until the previous one is confirmed.

## Deployment state (2026-05-21)

- **Vercel** is live at https://directoryhunter.vercel.app on the Hobby plan. The only env vars set there are `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`, because the web app only reads/writes Supabase. All paid-API keys live on Railway.
- **Railway** project `directory-hunter` runs four services, all pointing at the same GitHub repo with per-service start commands:
  1. `eval-worker` — always-on (no cron), start cmd `sh -c 'while true; do npm run eval:pending; sleep 60; done'`. Always-on instead of a cron because Railway's minimum cron interval is 5 minutes and we want sub-minute pickup of pending evals.
  2. `nightly-discovery` — cron `0 6 * * *` UTC, start cmd `npm run discover && npm run score:discovery`.
  3. `weekly-sampler` — cron `0 8 * * 0` UTC, start cmd `npm run discover -- --only=category-sampler --limit=50`.
  4. `weekly-digest` — cron `0 13 * * 0` UTC, start cmd `npm run digest`.
- The four Railway services have the **same env-var set** (Supabase, Anthropic, Google Places, DataforSEO, Resend, Reddit username, APP_BASE_URL). Use the `variableCollectionUpsert` GraphQL mutation to keep them in sync.
- **Cron services do NOT auto-rebuild on GitHub push.** Only the always-on `eval-worker` rebuilds automatically. After pushing code changes, force-redeploy the three cron services with `serviceInstanceDeployV2` or they'll keep running the previous image until their cron fires.
- **Vercel Hobby's 10-second server-action cap** is why the Evaluate flow is async (insert pending row, redirect, meta-refresh until the worker completes it). Any new server action must also fit in 10 seconds or follow the same async pattern.
- **Node 22 is required.** `engines.node` is `>=22.0.0`. Supabase's client requires native WebSocket support that Node 20 lacks. Railway's Nixpacks defaults to Node 20.20.2, so without this pin the worker crashes at `createClient`.
- **Supabase client has `cache: 'no-store'` set on its fetch.** Next.js 14 App Router patches global fetch to cache by default, and `export const dynamic = 'force-dynamic'` doesn't reliably disable it for supabase-js calls. Without no-store, the eval detail page kept serving the cached `pending` HTML even after the worker flipped the row to `complete`. See `src/lib/db.js`.

## Commands

- `npm run dev` — Next dev server
- `npm run build` / `npm start` — production build and serve
- `npm run test:scanner -- <name>` — run one scanner and print the first 10. Flags: `--headed` (show browser), `--limit=N`, `--store` (also upsert to DB)
- `npm run discover` — run all scanners then the Haiku scoring pass. Flags: `--only=flippa`, `--skip=reddit,frey-chu`, `--no-score`, `--limit=N` (passes through to scanners; only meaningful with `--only`)
- `npm run score:discovery` — score unscored candidates only (no scanning)
- `npm run digest` — build and send the Sunday digest. Flags: `--dry-run` (print body, no send), `--to=other@example.com` (override recipient)
- `npm run eval:pending` — claim and run one pending evaluation, then exit. The Railway `eval-worker` service loops this every 60 seconds (always-on, not a cron). Runs nothing if no pending evals.

After `npm install`, also run `npx playwright install chromium`. Apply DB migrations manually in the Supabase SQL editor. Current migrations: `0001_initial.sql`, `0002_category_samples.sql`, `0003_rename_category_source.sql`, `0004_drop_eval_dedupe_index.sql`.

Scripts use `--env-file-if-exists=.env.local` so the same command works locally (loads `.env.local`) and on Railway (uses injected env vars, no file).

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
    ├── app/
    │   ├── page.js                # discovery inbox (list candidates)
    │   ├── candidates/[id]/       # candidate detail + evaluate form
    │   ├── evaluate/              # ad-hoc niche+metro form
    │   ├── evaluations/           # eval history + single eval result
    │   ├── api/evaluate/          # POST endpoint for ad-hoc API submission
    │   └── actions.js             # server actions (setStatus, evaluateCandidate, rerunEvaluation, evaluateManual)
    ├── lib/                       # db, http, log, dedupe, claude, normalize, google-places, dataforseo, trends, evaluate, score-discovery, score-evaluation, plan, extract-niches, email
    ├── scanners/                  # flippa, reddit, indiehackers, niche-pursuits, failory, frey-chu, lead-gen-pricing
    ├── scripts/                   # test-scanner.js, run-scanners.js, run-discovery-scoring.js
    └── components/                # CandidateCard, FilterBar, ScoreGauge, ScoreBadge, DimensionBar, CompetitorList, BuildPlan, HistoryTable, StatusActions
```

## Evaluation pipeline

Evaluations are **async**: the Evaluate button (server action in `src/app/actions.js`) creates a `dh_evaluations` row with `status='pending'` and immediately redirects. The Railway `eval-worker` service picks it up within ~60 seconds via `claimPendingEvaluation` (atomic flip from `pending` to `running`) and runs the pipeline. The result page (`src/app/evaluations/[id]/page.js`) auto-refreshes every 5 seconds via meta-refresh while status is pending or running, plus has a re-run button (with editable metro) that creates a fresh evaluation against the same niche. This split exists because Vercel Hobby caps server actions at 10 seconds and the pipeline takes 30 to 90.

`runEvaluation(evaluation)` in `src/lib/evaluate.js` runs 7 steps in order against a `dh_evaluations` row already in `pending` state:

1. `normalize` (Sonnet) — canonical niche, primary keyword, variations, cities, country code
2. `trends` (free) — Google Trends via `google-trends-api`
3. `google-places` (paid) — Google Maps businesses for top 3 cities
4. `dataforseo-serp` (paid) — SERP for up to 5 keyword variations in city #1
5. `dataforseo-keywords` (paid, batched) — keyword volume for the variations
6. `score-evaluation` (Sonnet) — 6 dimensions, total score, recommendation
7. `plan` (Sonnet) — build plan, only if total score >= 60

Each step wraps its fetch in `cachedOrFetch(evalId, source, fn)`, which checks `dh_evaluation_data` for a payload from the same source within the last 24 hours before paying. Re-submitting an old eval re-runs Sonnet scoring against cached data with no paid calls. The 24h cache lives at the `dh_evaluation_data` level, not the `dh_evaluations` row.

**DataforSEO gotchas (learned the hard way):**
- `location_name` must be the FULL state name, not the abbreviation: `Dallas,Texas,United States` works; `Dallas,TX,United States` and `Dallas,United States` both return 40501 Invalid Field. `src/lib/dataforseo.js` has a US-state-abbreviation map.
- Sandbox (`DATAFORSEO_SANDBOX=true`) accepts ANY garbage location format and silently returns dummy data. Always test prod against at least one real city before trusting eval scores.
- The top-level `status_code: 20000` only means the request was accepted. Each task has its own `status_code`. `post()` in `dataforseo.js` checks both. Don't add new endpoint wrappers that skip the task-level check.
- New DataforSEO accounts may get fraud-locked after a small burst of requests. Email `support@dataforseo.com` with your account email to unlock.

**Re-run button:** the eval detail page has a re-run form (editable metro). `rerunEvaluation` in `actions.js` calls `createEvaluation({ ..., force: true })` to bypass the app-level dedupe. Migration 0004 dropped the matching DB unique index so multiple evals per niche+metro can co-exist.

## Category sampler

`src/scanners/category-sampler.js` is the only paid scanner. Uses Google Places API (New). It is **excluded from the nightly default** and only runs on demand or via the weekly cron.

- Categories live in `data/sampler-categories.json`. Metros in `data/sampler-metros.json`. Edit either freely.
- Each run picks N categories not sampled in the last 90 days (oldest first), samples 3 random metros each, 30 businesses per metro. Writes a `dh_category_samples` row for every category processed, and a candidate row only when aggregate completeness < 50%.
- Default `limit` is 5 (safety floor). Cron should pass `--limit=50`. Full weekly run:
  ```
  npm run discover -- --only=category-sampler --limit=50
  ```
- For a small test first: `npm run discover -- --only=category-sampler --limit=2`
- Cost: Google Places Pro SKU is $20/1000 results. The first $200/mo of GCP usage is free credit. Full weekly run (~4,500 results) sits in the free tier; the limit=2 test is effectively zero.

## Scanner contract

- Each scanner exports `async scan({ limit?, headless? })` returning rows shaped for `dh_niche_candidates` (minus auto fields like `id`, `found_at`, `discovery_score`, `scored_at`).
- Required fields per row: `source_id` (must match a row in `dh_discovery_sources`), `source_url`, `source_url_canonical` (set via `lib/dedupe.canonicalUrl()`), `niche_raw`, `raw_context`, `raw_payload`.
- `niche_canonical` is set later by the Haiku scoring pass, not by the scanner.
- One scanner can write to multiple sources (reddit writes to 4). `run-scanners.js` marks every distinct `source_id` it sees as scanned.
- Scanners may catch errors and return `[]` so one broken source does not kill the nightly run, but they must `log.warn` or `log.error` the failure.
- Lib code (`db.js`, `http.js`, `claude.js`) crashes loud. No swallowed catches.

## Conventions

- Every scanner exports `async function scan(options)` returning an array of candidate objects matching the `niche_candidates` insert shape minus auto fields.
- `source_url_canonical` is computed by `lib/dedupe.canonicalUrl()` before insert.
- `niche_canonical` is set by Claude Haiku during the discovery scoring pass, not by the scanner.
- Scripts load env via `node --env-file-if-exists=.env.local` so the same command works locally and on Railway (where there's no .env.local). Node 22+ required.
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
- Phase 5: `GOOGLE_PLACES_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `DATAFORSEO_SANDBOX`.
- Phase 6: `RESEND_API_KEY`, `DIGEST_RECIPIENT_EMAIL`, `APP_BASE_URL`.

## When in doubt

Re-read the kickoff doc. Ask Patrick before guessing. Pick the smaller, simpler implementation. Stop at phase boundaries.
