# Directory Hunter - Claude Code Kickoff (Discovery-first)

This supersedes any previous Directory Hunter spec. Discard the old one.

Paste this entire file as your first message in a new Claude Code session inside an empty repo. It doubles as the persistent `CLAUDE.md`.

---

## Context

I'm building Directory Hunter. It does two things, in this order:

1. **Discovery (the primary thing).** Continuously mines real sources for directory niches that match Frey Chu's playbook. Surfaces a ranked feed of candidate niches I've never heard of. Runs on a schedule, deposits candidates in a Supabase inbox, emails me a weekly digest.

2. **Evaluation (the secondary thing).** For any candidate I click "evaluate" on, runs a deep validation using paid APIs (Outscraper + DataforSEO + Google Trends), produces a 100-point score across 6 dimensions, and generates a 30-day build plan if the score clears 60.

The whole point is: I open the tool Monday morning and see "here are 15 niches worth considering this week" instead of having to come up with niche ideas from scratch. I deep-evaluate the best 3-5. I build directories for the ones that clear 80.

This is for me, not a product. No public auth, no marketing site, no customers.

Read this entire file before writing code. Build in phases. Stop after each phase and confirm.

---

## Hard rules for you (Claude Code)

1. No em-dashes or en-dashes anywhere. Use commas, periods, or rephrase.
2. No AI slop language. Banned: dive, navigate, leverage, comprehensive, robust, seamless, delve, embark, journey, unleash, unlock potential, empower, harness. Write like a person.
3. Don't over-engineer. Plain functions. Server actions over REST routes when possible.
4. One step at a time. Stop after each phase.
5. Confirm before destructive operations.
6. Respect robots.txt. Set a real User-Agent identifying the bot. Throttle scrapers (2 second default delay).
7. Never hardcode secrets. Crash clearly if env vars missing.
8. Use server-side API routes for anything touching paid APIs. Never expose keys to the browser.
9. Cache aggressively. Same niche+metro evaluation should not re-hit paid APIs within 24 hours.
10. Idempotent everything. Re-running a scraper or evaluation does not create duplicates.
11. Discovery sources are free or near-free. Evaluation is the only step that touches paid APIs, and only when I click evaluate.

---

## My stack and environment

- Next.js 14+ App Router, plain JS, no TypeScript
- Tailwind, no UI component libraries
- Supabase for storage. I provide URL and service key.
- Vercel for hosting. I connect the GitHub repo.
- Railway for cron jobs that run the discovery scanners (Vercel's cron is too limited for what we need).
- Resend for the weekly digest email. Domain `buildmyblast.com` already verified, sender will be `hunter@buildmyblast.com`.
- Anthropic API for niche classification, ARPU estimation, evaluation scoring, and build plan generation. Models: `claude-haiku-4-5-20251001` for bulk classification, `claude-sonnet-4-6` for deep evaluation and planning.
- Playwright for JS-heavy scraping, `undici` or fetch for plain HTTP, `cheerio` for HTML parsing
- `google-trends-api` npm package for Trends (no key needed)
- Outscraper API for Google Maps data (paid, only used in evaluation)
- DataforSEO for SERP + keyword data (paid, only used in evaluation)
- Windows 11 + Git Bash for local dev

---

## What this tool does, end to end

### Discovery pipeline (runs nightly via Railway cron)

Eight scanners run independently and write candidates to a `niche_candidates` table:

1. **Acquire.com directory listings** - actively-for-sale directory sites tell you what niches have proven economics
2. **Indie Hackers products tagged directory** - solo founders running directory sites with public revenue
3. **Reddit (r/juststart, r/SEO, r/EntrepreneurRideAlong, r/SideProject)** - revenue posts mentioning directory wins
4. **Frey Chu's content** (shipyourdirectory.com blog + his YouTube transcripts) - he names niches he's seen work
5. **Niche Pursuits articles** tagged directory or local SEO
6. **Failory interviews** mentioning directory businesses
7. **Lead-gen industry pricing pages** (LeadFindX, Lead Distro AI, etc.) - these list high-CPL niches publicly
8. **Outscraper category taxonomy sampler** - periodic sweep of Google Maps categories scoring data completeness (this one is paid but cheap and runs weekly, not nightly)

Each scanner extracts: niche name, geographic hint (if any), revenue signal (if mentioned), source URL, posted date, raw context.

Discovery runs a lightweight scoring pass via Claude Haiku (no paid SERP/Maps calls) to rank candidates by:
- Source quality (proven win > revenue mention > inferred opportunity)
- Niche specificity (specific beats generic)
- ARPU heuristic (Claude estimates from niche name)
- Frey-rubric pre-fit (commercial intent, local, boring, beatable)

Output: every nightly run produces 0-50 new candidates. The Supabase inbox grows. I see ranked candidates in the UI. Sunday morning I get a digest email with the top 10 new candidates of the week.

### Evaluation pipeline (runs on demand)

I click "Evaluate" on any candidate (or I type in a niche manually). The tool runs the deep pipeline:

1. Normalize niche + metro using Claude (expand "DFW" to specific cities, generate 5-10 keyword variations)
2. Fetch Outscraper data for the primary keyword in 3 cities
3. Fetch DataforSEO SERP results + keyword volume for 5 variations
4. Fetch Google Trends for primary keyword
5. Score across 6 dimensions using Claude with all the data as context
6. If score >= 60, generate a build plan via Claude (target metros, keywords, competitor weaknesses, revenue range, 30-day plan, stop signs)
7. Save everything to Supabase, render result page

Cost per evaluation: roughly $1-3 in API spend. I'll do 5-10 evaluations per week, so total monthly cost is $30-100.

---

## Repository structure

```
directory-hunter/
├── CLAUDE.md
├── README.md
├── package.json
├── .env.example
├── .gitignore
├── next.config.js
├── tailwind.config.js
├── railway.json
├── docs/
│   ├── discovery-sources.md
│   ├── discovery-rubric.md
│   ├── evaluation-rubric.md
│   └── data-sources.md
├── db/
│   └── migrations/
│       └── 0001_initial.sql
├── src/
│   ├── app/
│   │   ├── layout.js
│   │   ├── page.js                   (Discovery inbox: ranked candidates)
│   │   ├── candidates/
│   │   │   └── [id]/page.js          (Candidate detail + Evaluate button)
│   │   ├── evaluate/page.js          (Manual niche entry)
│   │   ├── evaluations/
│   │   │   ├── page.js               (History of evaluations)
│   │   │   └── [id]/page.js          (Single evaluation result)
│   │   └── api/
│   │       ├── evaluate/route.js     (POST: kick off deep evaluation)
│   │       ├── candidates/route.js   (GET: list with filters)
│   │       └── digest/route.js       (POST: send weekly digest, cron triggers)
│   ├── lib/
│   │   ├── db.js
│   │   ├── claude.js
│   │   ├── http.js                   (fetch with retries, UA, throttling)
│   │   ├── log.js
│   │   ├── dedupe.js                 (niche name canonicalization)
│   │   ├── outscraper.js
│   │   ├── dataforseo.js
│   │   ├── trends.js
│   │   ├── normalize.js              (niche + metro normalization)
│   │   ├── score-discovery.js        (lightweight Haiku scoring)
│   │   ├── score-evaluation.js       (deep Sonnet scoring)
│   │   ├── plan.js                   (build plan generator)
│   │   └── email.js                  (Resend digest)
│   ├── scanners/
│   │   ├── acquire.js
│   │   ├── indiehackers.js
│   │   ├── reddit.js
│   │   ├── frey-chu.js               (blog + YouTube transcripts)
│   │   ├── niche-pursuits.js
│   │   ├── failory.js
│   │   ├── lead-gen-pricing.js
│   │   └── outscraper-categories.js
│   ├── components/
│   │   ├── CandidateCard.jsx
│   │   ├── ScoreBadge.jsx
│   │   ├── FilterBar.jsx
│   │   ├── EvalForm.jsx
│   │   ├── ScoreGauge.jsx
│   │   ├── DimensionBar.jsx
│   │   ├── CompetitorList.jsx
│   │   ├── BuildPlan.jsx
│   │   └── HistoryTable.jsx
│   └── scripts/
│       ├── run-scanners.js           (production: runs all scanners, called by cron)
│       ├── run-discovery-scoring.js  (scores unscored candidates)
│       ├── send-digest.js            (Sunday digest)
│       ├── test-scanner.js           (run one scanner, print results)
│       └── evaluate-niche.js         (CLI: full evaluation from terminal)
```

---

## Database schema (`db/migrations/0001_initial.sql`)

```sql
create extension if not exists pgcrypto;

-- Discovery: where niches come from
create table discovery_sources (
  id text primary key,
  name text not null,
  base_url text not null,
  enabled boolean not null default true,
  last_scanned_at timestamptz,
  notes text
);

-- Discovery: niche candidates found by scanners
create table niche_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references discovery_sources(id),
  source_url text not null,
  source_url_canonical text not null unique,
  niche_raw text not null,                    -- as extracted
  niche_canonical text,                       -- normalized for dedupe
  geographic_hint text,                       -- city/state/national if mentioned
  revenue_signal text,                        -- raw text mention
  revenue_amount_usd_monthly numeric,
  posted_at timestamptz,
  found_at timestamptz not null default now(),
  raw_context text not null,                  -- the text snippet around the niche mention
  raw_payload jsonb not null,
  
  -- Discovery scoring (lightweight)
  discovery_score int,
  discovery_category text,                    -- 'proven_winner', 'revenue_mention', 'opportunity_signal'
  estimated_arpu_usd int,
  fit_reasoning text,
  scored_at timestamptz,
  
  -- Status tracking
  status text not null default 'new',         -- 'new', 'queued_for_eval', 'evaluated', 'archived', 'building'
  evaluation_id uuid                          -- linked once evaluated
);

create index niche_candidates_score_idx
  on niche_candidates (discovery_score desc nulls last, found_at desc);

create index niche_candidates_canonical_idx
  on niche_candidates (niche_canonical);

create index niche_candidates_status_idx
  on niche_candidates (status, discovery_score desc nulls last);

-- Deep evaluation (the previous Directory Hunter core)
create table evaluations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references niche_candidates(id),  -- nullable if manually entered
  niche text not null,
  metro text not null,
  normalized_niche jsonb,
  normalized_metro jsonb,
  status text not null default 'pending',     -- 'pending', 'running', 'complete', 'failed'
  total_score int,
  recommendation text,                         -- 'build', 'validate', 'risky', 'skip'
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index evaluations_niche_metro_idx
  on evaluations (lower(niche), lower(metro))
  where status != 'failed';

create table evaluation_data (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  source text not null,                       -- 'outscraper', 'dataforseo-serp', 'dataforseo-keywords', 'trends'
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create index evaluation_data_eval_idx on evaluation_data (evaluation_id, source);

create table dimension_scores (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  dimension text not null,
  score int not null,
  max_score int not null,
  reasoning text not null,
  evidence jsonb
);

create unique index dimension_scores_unique on dimension_scores (evaluation_id, dimension);

create table build_plans (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade unique,
  recommended_model text not null,
  target_metros text[],
  primary_keywords text[],
  secondary_keywords text[],
  top_competitors jsonb,
  estimated_revenue_low int,
  estimated_revenue_high int,
  revenue_basis text,
  first_30_days_plan text,
  stop_signs text[],
  generated_at timestamptz not null default now()
);

-- Weekly digest tracking
create table digests (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  candidate_ids uuid[] not null,
  email_subject text,
  email_body_md text,
  email_provider_id text
);

insert into discovery_sources (id, name, base_url, enabled) values
  ('acquire', 'Acquire.com', 'https://acquire.com', true),
  ('indiehackers', 'Indie Hackers', 'https://www.indiehackers.com', true),
  ('reddit-juststart', 'r/juststart', 'https://www.reddit.com/r/juststart', true),
  ('reddit-seo', 'r/SEO', 'https://www.reddit.com/r/SEO', true),
  ('reddit-erm', 'r/EntrepreneurRideAlong', 'https://www.reddit.com/r/EntrepreneurRideAlong', true),
  ('reddit-sideproject', 'r/SideProject', 'https://www.reddit.com/r/SideProject', true),
  ('frey-chu-blog', 'Ship Your Directory blog', 'https://shipyourdirectory.com', true),
  ('frey-chu-youtube', 'Frey Chu YouTube', 'https://www.youtube.com/@freychu', true),
  ('niche-pursuits', 'Niche Pursuits', 'https://www.nichepursuits.com', true),
  ('failory', 'Failory', 'https://www.failory.com', true),
  ('lead-gen-pricing', 'Lead-gen pricing pages', 'multiple', true),
  ('outscraper-categories', 'Outscraper Categories', 'https://api.outscraper.cloud', true);
```

---

## Discovery scanners (`docs/discovery-sources.md`)

Each scanner exports `async function scan(options)` that returns an array of candidate objects matching the `niche_candidates` insert shape, minus auto fields.

### 1. Acquire.com (`scanners/acquire.js`) - START HERE

Public listings page. Filter to directory businesses for sale.

- Start URL: `https://acquire.com/explore?type=directories` or similar filter URL
- Use Playwright (JS-rendered)
- Extract: business name, niche/category, asking price, MRR if shown, brief description, listing URL
- Each listing becomes a candidate where `discovery_category='proven_winner'` because it had real revenue and is sellable
- Pull what's public, don't try to bypass auth
- Pagination: scroll or click "load more", cap at 200 listings
- 3 second delay between page loads

Most reliable signal of all. Niches that someone built, ran, and listed for sale are validated by economics.

### 2. Indie Hackers products (`scanners/indiehackers.js`)

Products explicitly tagged or described as directories.

- Start URL: `https://www.indiehackers.com/products?revenueVerification=stripe`
- Sort by revenue descending
- Use Playwright
- Filter products where title, tagline, or description contains: directory, listings, marketplace, finder, near me
- Extract: product name, tagline, founder, monthly revenue, product URL
- Each becomes a candidate with `discovery_category='revenue_mention'`

### 3. Reddit scanners (`scanners/reddit.js`)

Subreddits: r/juststart, r/SEO, r/EntrepreneurRideAlong, r/SideProject

- Public JSON API: `https://www.reddit.com/r/juststart/new.json?limit=100`
- User-Agent: `directory-hunter/1.0 by /u/{my_username}` (I provide username)
- 2 second delay between subreddits
- Filter posts where title or selftext contains: directory, listings site, niche site revenue, lead gen
- Extract: title, selftext, author, score, num_comments, created_utc, permalink
- Run regex for revenue mentions to populate `revenue_signal` and `revenue_amount_usd_monthly`
- Each becomes a candidate with `discovery_category='revenue_mention'` if revenue is mentioned, else `'opportunity_signal'`

### 4. Frey Chu content (`scanners/frey-chu.js`)

Two sub-scrapers in one file.

**Blog (shipyourdirectory.com):**
- Fetch sitemap.xml
- For each post, extract title, content, mentioned niches
- Use Claude (Haiku) to extract niches mentioned with one prompt: "Extract every specific niche (industry + location modifier if any) mentioned in this post. Return JSON array."

**YouTube:**
- Use `youtube-transcript-api` npm package or `googleapis` to pull recent videos from his channel
- For each transcript, run same niche-extraction prompt
- Cap at last 50 videos on first run, last 10 per week on subsequent runs

Each extracted niche becomes a candidate with `discovery_category='opportunity_signal'`. Frey naming a niche is a strong signal it's worth investigating, even when he doesn't claim he's built it.

### 5. Niche Pursuits (`scanners/niche-pursuits.js`)

- Sitemap: `https://www.nichepursuits.com/sitemap.xml` (or scrape category pages)
- Filter to posts tagged "directory", "local SEO", "niche site"
- Extract niches mentioned via Claude
- Each becomes a candidate with `discovery_category='opportunity_signal'`

### 6. Failory (`scanners/failory.js`)

- Sitemap: `https://www.failory.com/sitemap.xml`
- Filter URLs containing `/interview/` or `/post-mortem/`
- Filter further to interviews where content mentions: directory, listings, lead gen, niche site
- Extract niche + revenue mention
- Each becomes a candidate with `discovery_category='revenue_mention'`

### 7. Lead-gen pricing pages (`scanners/lead-gen-pricing.js`)

A short list of public articles that publish CPL data by niche. These are evergreen and don't need to be re-scraped often (weekly is fine).

Source URLs (verify they still work, robots.txt allows):
- `https://leadfindx.com/blog/the-1000-dollar-lead/`
- `https://www.leaddistro.ai/blog/best-lead-generation-niches`
- `https://leadsnap.com/fast-money-strategy-heat-map-ranking-due-diligence/`
- Any others Claude suggests with a Google search

For each, extract: niche name, CPL or CPC range, why it's profitable
Each becomes a candidate with `discovery_category='opportunity_signal'`, with ARPU derived from CPL (high CPL = high ARPU)

### 8. Outscraper category sampler (`scanners/outscraper-categories.js`)

This is the only paid scanner. Runs weekly, not nightly. Budget: $5-10 per weekly run.

- Outscraper has ~8,000 Google Maps categories
- On each run, sample 50 categories that haven't been sampled in 90 days
- For each category, pull 30 businesses across 3 random mid-sized cities
- Compute completeness rate (businesses with hours + website + 5+ reviews + photos)
- If completeness is under 50%, the category is a candidate
- Each becomes a candidate with `discovery_category='opportunity_signal'`

This is the only scanner that surfaces niches no one has named yet.

---

## Discovery scoring rubric (`docs/discovery-rubric.md`)

After scanners deposit candidates, the discovery scoring pass uses Claude Haiku to score each candidate from 0-100 without spending paid API budget. This is lightweight ranking, not deep evaluation.

For each candidate, send to Claude:

```
Score this directory site niche candidate for Patrick on a 0-100 scale.

Patrick is looking for niches that match Frey Chu's playbook:
- Boring, local, commercial intent (people are buying, not researching)
- High ARPU underlying service (>$500 per transaction ideal)
- Google Maps is disorganized in this category (low completeness)
- Resistant to AI Overview (local searches, not informational)
- Either passive ad model (need 10K+ monthly visits potential) or lead-gen model (need high-ticket service)
- Geographic scalability (works in multiple metros)

Candidate:
- Niche: {niche_raw}
- Geographic hint: {geographic_hint or 'none'}
- Revenue signal: {revenue_signal or 'none'}
- Source: {source name} (category: {discovery_category})
- Raw context: {raw_context}

Score weights:
+30 if source is 'proven_winner' (someone sold a directory in this niche)
+25 if revenue_amount_usd_monthly is reported and > $1000
+15 if niche has clear local commercial intent
+15 if estimated underlying service ARPU > $500
+10 if niche is specific (not "plumbers" but "emergency plumbers serving commercial properties")
+10 if Frey Chu's playbook would suggest it works
-20 if niche is generic and dominated by Yelp/Angi/Yellowpages
-15 if it's an informational niche (recipe sites, how-to)
-15 if ARPU is clearly under $100
-10 if it requires national-level audience to work

Return JSON only:
{
  "discovery_score": <0-100 integer>,
  "estimated_arpu_usd": <integer estimate of average transaction value in this niche>,
  "niche_canonical": <normalized version of niche name for deduplication, lowercase, no metro>,
  "fit_reasoning": <2-3 sentences plain language>
}
```

Use Claude Haiku. Cheap, fast. Process in batches of 20 concurrently.

Thresholds:
- 70+: surfaced in weekly digest, recommended for evaluation
- 50-69: visible in inbox, manual review
- Under 50: stored but hidden by default (filter to show)

---

## Evaluation rubric (`docs/evaluation-rubric.md`)

This runs only when I click "Evaluate" on a candidate or manually enter a niche. Uses Outscraper + DataforSEO + Trends + Claude Sonnet.

Score across 6 dimensions, weighted, total = 100.

### Dimension 1: Market size (max 20)
- 0 pts: under 50 businesses in top metro OR search volume under 100/mo
- 8 pts: 50-200 businesses, 100-500/mo volume
- 14 pts: 200-1000 businesses, 500-2000/mo volume
- 20 pts: 1000+ businesses, 2000+/mo volume

### Dimension 2: Competition strength (max 20, inverse)
- 0 pts: Top 3 SERP are Yelp/Angi/Yellowpages/BBB/Thumbtack (DA 80+)
- 5 pts: Top 3 are mid-strength directories (DA 40-70)
- 12 pts: Top 3 are weak directories (DA <40) or mixed with business sites
- 20 pts: Top 3 are individual business sites, Maps pack dominates

### Dimension 3: Buyer-intent strength (max 20)
- 0 pts: ARPU under $100
- 8 pts: $100-500
- 14 pts: $500-2000
- 20 pts: $2000+

### Dimension 4: Google Maps disorganization (max 15)
- 0 pts: 90%+ businesses have complete profiles
- 5 pts: 60-90% complete
- 10 pts: 30-60% complete
- 15 pts: under 30% complete

### Dimension 5: Geographic distribution (max 10)
- 0 pts: only 3-5 viable metros
- 5 pts: 10-20 viable metros
- 10 pts: 30+ viable metros

### Dimension 6: AI Overview resistance (max 15)
- 0 pts: 30%+ of niche keywords trigger AI Overview
- 5 pts: 10-30% trigger
- 15 pts: under 10% trigger

### Total interpretation
- 80-100: BUILD
- 60-79: VALIDATE
- 40-59: RISKY
- Under 40: SKIP

---

## Build plan generation

When evaluation score >= 60, generate build plan via Claude Sonnet 4.6. Same prompt as previously specified:

```
You are generating a 30-day action plan for Patrick to build a directory site.

Niche: {niche}
Metro: {metro}
Total score: {score}/100
Dimension scores: {dimension_scores}
Top 5 SERP competitors: {competitors_with_da}
Outscraper data summary: {summary}

Patrick's context:
- Self-taught builder on Next.js + Supabase + Vercel + Playwright
- Already builds scrapers and programmatic pages
- Uses Outscraper for data, Mediavine/Ezoic for ads if traffic justifies
- DFW-based, ~10 hours/week side capacity
- Frey Chu playbook: boring + local + buyer intent

Return JSON:
{
  "recommended_model": <"passive_ad" | "lead_gen" | "hybrid">,
  "model_reasoning": <2-3 sentences>,
  "target_metros": [<5-10 specific cities, mid-sized preferred>],
  "primary_keywords": [<top 5>],
  "secondary_keywords": [<10-20 long-tail>],
  "top_competitors": [{"domain": ..., "da": ..., "weakness": ...}],
  "estimated_revenue_low_monthly_12mo": <integer USD>,
  "estimated_revenue_high_monthly_12mo": <integer USD>,
  "revenue_basis": <one paragraph citing comp benchmarks>,
  "first_30_days_plan": <markdown checklist with weekly milestones>,
  "stop_signs": [<5-7 early failure signals>]
}
```

---

## UI design

Same brutalist/utilitarian aesthetic as my other internal tools. Dark mode. Monospace for data, sans-serif for body. Tailwind, no UI libraries.

### Home page (Discovery inbox at `/`)

- Big header: "Directory Hunter"
- Filter bar: status (new/all), score threshold, source, category, search
- Ranked list of candidate cards. Each card:
  - Niche name (large)
  - Score badge (color-coded)
  - Source name + posted date
  - ARPU estimate, revenue signal if present
  - Fit reasoning (2-3 lines)
  - Buttons: "Evaluate", "Archive", "Mark Building"
- Pagination, 25 per page

### Candidate detail (`/candidates/[id]`)

- Full niche context
- Source URL with link
- Raw context expanded
- Discovery score breakdown
- Big "Evaluate this niche" button with metro input

### Evaluation result (`/evaluations/[id]`)

- Big total score with recommendation chip (BUILD green, VALIDATE amber, SKIP red)
- 6 dimension bars with reasoning
- Build plan section (if score >= 60):
  - Recommended model with reasoning
  - Target metros as chips
  - Keywords in code block
  - Competitor table with weaknesses
  - Revenue estimate range
  - 30-day plan as markdown
  - Stop signs in warning callout
- Skip reasoning section (if score < 40)
- Raw data section (collapsible)

### Manual evaluation (`/evaluate`)

- Form: niche + metro inputs
- Submit kicks off evaluation pipeline
- Same result page

### History (`/evaluations`)

- Table of all evaluations: niche, metro, score, recommendation, date
- Sortable, filterable
- Export to markdown

---

## Weekly digest email

Sundays at 7am Central.

Pull from `niche_candidates` where:
- `discovery_score >= 70`
- `status = 'new'`
- `found_at` within last 7 days

Take top 10, dedupe by `niche_canonical`. Email me a markdown digest.

Subject: `Directory Hunter // {N} new niches this week`

Body:

```
{N} new niches scored 70+ this week. Top fit: {top_niche} at {top_score}.

---

### {niche_canonical}

Score: {discovery_score}/100 | ARPU: ${estimated_arpu_usd} | Source: [{source name}]({source_url})

{fit_reasoning}

{revenue_signal or ''}

[Evaluate this niche](https://directory-hunter.vercel.app/candidates/{id})

---

(repeat for each)
```

Use Resend. Send from `hunter@buildmyblast.com`. Convert markdown to HTML for the email body.

---

## Railway cron schedule

Two cron jobs:

1. **Discovery scanners + scoring**: `0 6 * * *` UTC (1am Central nightly)
   Runs `node src/scripts/run-scanners.js && node src/scripts/run-discovery-scoring.js`

2. **Weekly digest**: `0 13 * * 0` UTC (7am Sunday Central)
   Runs `node src/scripts/send-digest.js`

3. **Outscraper category sampler**: `0 8 * * 0` UTC (3am Sunday Central, weekly)
   Runs `node src/scripts/run-scanners.js --only=outscraper-categories`

---

## Build sequence

Confirm with me after each phase. Do not start the next phase until I say go.

### Phase 1: Skeleton + database + one scanner

- Init Next.js 14 app with Tailwind
- Drop in `CLAUDE.md` and all docs files
- I run the SQL migration manually in Supabase, you give me the file
- Build `src/lib/db.js`, `http.js`, `log.js`, `dedupe.js`, `claude.js`
- Build `src/scanners/acquire.js` (start with this one, highest signal)
- Build `src/scripts/test-scanner.js` that takes a scanner name, runs it, prints first 10 results without storing

Test: `node src/scripts/test-scanner.js acquire` from Git Bash prints 10 candidate directories.

**Stop. Wait for me to confirm.**

### Phase 2: Storage + discovery scoring

- Wire `test-scanner.js` to optionally `--store` results to `niche_candidates`
- Build `src/lib/score-discovery.js` using Claude Haiku
- Build `src/scripts/run-discovery-scoring.js` (scores all unscored candidates)
- Verify dedupe by `niche_canonical` works
- I run scanner + scoring, verify candidates are in DB with scores

**Stop. Wait for me to confirm.**

### Phase 3: More scanners

Build these in order, test each via `test-scanner.js`, then wire into the master `run-scanners.js`:
- reddit
- indiehackers
- niche-pursuits
- failory
- frey-chu (blog first, YouTube second)
- lead-gen-pricing

Skip outscraper-categories for now (Phase 6).

**Stop. Wait for me to confirm.**

### Phase 4: Discovery UI

- Build home page (`/`) with candidate inbox
- Filter bar
- Candidate cards
- Candidate detail page
- Status updates (archive, queue for eval)

I should be able to browse, filter, and triage candidates entirely from the UI.

**Stop. Wait for me to confirm.**

### Phase 5: Evaluation pipeline

- Build `src/lib/normalize.js`, `outscraper.js`, `dataforseo.js`, `trends.js`
- Build `src/lib/score-evaluation.js` and `plan.js`
- Build `/evaluate` page and `/api/evaluate` route
- Build `/evaluations/[id]` result page with all sections
- Build `/evaluations` history page

Test on 3 candidates from the discovery inbox. Verify scores look sane.

**Stop. Wait for me to confirm.**

### Phase 6: Outscraper category sampler + digest

- Build `src/scanners/outscraper-categories.js`
- Build `src/lib/email.js` and `src/scripts/send-digest.js`
- Send myself a test digest

**Stop. Wait for me to confirm.**

### Phase 7: Deploy + cron

- Deploy to Vercel
- Deploy a Railway service for the cron scripts (Railway, not Vercel, because Vercel cron is too restricted)
- Configure cron schedules
- Verify nightly run completes
- Verify Sunday digest sends

Done.

---

## What to do right now

1. Read this entire file.
2. Ask clarifying questions. Common ones I'll answer up front:
   - Supabase project: new project called `directory-hunter`. I send URL + service key.
   - Reddit username: I send when needed.
   - Outscraper key: I send.
   - DataforSEO credentials: I send. Sandbox during dev.
   - Anthropic key: I send.
   - GitHub repo: I create empty.
   - Resend already set up under `buildmyblast.com`.
3. Start Phase 1 with the Acquire.com scanner.

Do not start Phase 2 until Phase 1 is tested and I say go.
