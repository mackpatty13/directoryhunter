-- Directory Hunter initial schema.
-- Apply manually in the Supabase SQL editor.
--
-- All tables are prefixed `dh_` because this Supabase project is shared with
-- another project (Opportunity Scraper). The prefix guarantees no collisions
-- now or later. JS code references the prefixed names directly.

-- ---------------------------------------------------------------------------
-- Cleanup: drop any unprefixed Directory Hunter tables left behind by a
-- previous partial migration attempt. These names belong only to this project,
-- so it is safe to drop them. We deliberately do NOT touch `digests` because
-- the Opportunity Scraper project owns that name in this database.
-- ---------------------------------------------------------------------------

drop table if exists build_plans cascade;
drop table if exists dimension_scores cascade;
drop table if exists evaluation_data cascade;
drop table if exists evaluations cascade;
drop table if exists niche_candidates cascade;
drop table if exists discovery_sources cascade;

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

create table dh_discovery_sources (
  id text primary key,
  name text not null,
  base_url text not null,
  enabled boolean not null default true,
  last_scanned_at timestamptz,
  notes text
);

create table dh_niche_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references dh_discovery_sources(id),
  source_url text not null,
  source_url_canonical text not null unique,
  niche_raw text not null,
  niche_canonical text,
  geographic_hint text,
  revenue_signal text,
  revenue_amount_usd_monthly numeric,
  posted_at timestamptz,
  found_at timestamptz not null default now(),
  raw_context text not null,
  raw_payload jsonb not null,

  -- Discovery scoring (lightweight Haiku pass)
  discovery_score int,
  discovery_category text,    -- 'proven_winner', 'revenue_mention', 'opportunity_signal'
  estimated_arpu_usd int,
  fit_reasoning text,
  scored_at timestamptz,

  -- Status tracking
  status text not null default 'new',  -- 'new', 'queued_for_eval', 'evaluated', 'archived', 'building'
  evaluation_id uuid
);

create index dh_niche_candidates_score_idx
  on dh_niche_candidates (discovery_score desc nulls last, found_at desc);

create index dh_niche_candidates_canonical_idx
  on dh_niche_candidates (niche_canonical);

create index dh_niche_candidates_status_idx
  on dh_niche_candidates (status, discovery_score desc nulls last);

create table dh_evaluations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references dh_niche_candidates(id),
  niche text not null,
  metro text not null,
  normalized_niche jsonb,
  normalized_metro jsonb,
  status text not null default 'pending',  -- 'pending', 'running', 'complete', 'failed'
  total_score int,
  recommendation text,                      -- 'build', 'validate', 'risky', 'skip'
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index dh_evaluations_niche_metro_idx
  on dh_evaluations (lower(niche), lower(metro))
  where status != 'failed';

create table dh_evaluation_data (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references dh_evaluations(id) on delete cascade,
  source text not null,    -- 'outscraper', 'dataforseo-serp', 'dataforseo-keywords', 'trends'
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create index dh_evaluation_data_eval_idx on dh_evaluation_data (evaluation_id, source);

create table dh_dimension_scores (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references dh_evaluations(id) on delete cascade,
  dimension text not null,
  score int not null,
  max_score int not null,
  reasoning text not null,
  evidence jsonb
);

create unique index dh_dimension_scores_unique on dh_dimension_scores (evaluation_id, dimension);

create table dh_build_plans (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references dh_evaluations(id) on delete cascade unique,
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

create table dh_digests (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  candidate_ids uuid[] not null,
  email_subject text,
  email_body_md text,
  email_provider_id text
);

-- ---------------------------------------------------------------------------
-- Seed the source registry. Toggle `enabled` to disable a source without
-- touching code.
-- ---------------------------------------------------------------------------

insert into dh_discovery_sources (id, name, base_url, enabled) values
  ('acquire', 'Acquire.com', 'https://acquire.com', true),
  ('flippa', 'Flippa', 'https://flippa.com', true),
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
