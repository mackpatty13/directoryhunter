# Directory Hunter

Personal tool. Mines real sources for directory-site niches that match Frey Chu's playbook, ranks them, and on demand runs a deep paid-API evaluation that produces a 0-100 score and a 30-day build plan.

Not a product. No public auth, no marketing site, no customers.

## What it does

**Discovery (nightly).** Eight scanners pull candidates from Acquire.com (or Flippa), Indie Hackers, Reddit, Frey Chu's blog and YouTube, Niche Pursuits, Failory, lead-gen pricing pages, and a weekly Google Maps category sweep. Candidates land in `niche_candidates`. Claude Haiku scores them 0-100 with no paid API calls. Top scorers surface in the UI inbox and a Sunday digest email.

**Evaluation (on demand).** Click Evaluate on a candidate. Pipeline fans out to Google Places, DataforSEO, and Google Trends, then Claude Sonnet scores 6 dimensions to 100 and writes a build plan if the score clears 60.

The goal: open the tool Monday morning and see fifteen niches worth considering this week, instead of inventing them from scratch.

## Stack

- Next.js 14 App Router (plain JS, no TypeScript)
- Tailwind, no UI libraries
- Supabase for storage
- Vercel for the web app
- Railway for cron jobs (Vercel cron is too restricted for this workload)
- Resend for the Sunday digest (sender: `hunter@buildmyblast.com`)
- Anthropic: `claude-haiku-4-5-20251001` for bulk classification, `claude-sonnet-4-6` for deep evaluation
- Playwright for JS-heavy scraping, `cheerio` for HTML parsing
- Google Places API and DataforSEO (paid, evaluation only)
- `google-trends-api` npm package (no key)

## Local setup

Requires Node 20.6 or newer (we use `node --env-file` flag, no `dotenv` dependency).

```bash
npm install
npx playwright install chromium
cp .env.example .env.local
# fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY, etc.
```

Run the web app:

```bash
npm run dev
```

Run a single scanner from the terminal (prints first 10 results, does not store):

```bash
npm run test:scanner -- <scanner-name>
# example:
npm run test:scanner -- acquire
```

## Database

Migrations live in `db/migrations/`. Run them manually in the Supabase SQL editor. Phase 1 ships `0001_initial.sql`.

## Repository layout

```
.
├── CLAUDE.md                 # persistent context for Claude Code sessions
├── README.md
├── package.json
├── next.config.mjs
├── tailwind.config.mjs
├── postcss.config.mjs
├── .env.example
├── docs/                     # discovery and evaluation rubrics, source notes
├── db/migrations/            # SQL migrations
└── src/
    ├── app/                  # Next.js App Router
    ├── lib/                  # db, http, log, dedupe, claude, etc.
    ├── scanners/             # one file per discovery source
    ├── scripts/              # CLI entry points (cron-triggered in prod)
    └── components/           # UI components (Phase 4+)
```

## Build sequence

Built in phases. Each phase stops for review before the next starts.

1. Skeleton, DB schema, first scanner, test-scanner script. (in progress)
2. Storage wiring, Haiku scoring.
3. Remaining scanners.
4. Discovery UI.
5. Evaluation pipeline and UI.
6. Google Maps category sampler, weekly digest email.
7. Deploy to Vercel and Railway.

## House rules

See `CLAUDE.md` for the full list. Highlights:

- No em-dashes or en-dashes in any user-facing prose.
- No AI-slop language (dive, leverage, robust, seamless, etc.).
- Plain functions, no premature abstractions.
- Server-side API routes for anything touching paid APIs. Never expose keys to the browser.
- Cache aggressively. Same niche plus metro evaluation does not re-hit paid APIs within 24 hours.
- Idempotent scanners and evaluations. Re-runs do not duplicate rows.
- Respect robots.txt. Real User-Agent identifying the bot. 2 second default delay between requests.
