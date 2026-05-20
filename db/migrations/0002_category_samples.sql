-- Phase 6: category sampler tracking table.
-- Apply manually in the Supabase SQL editor.
--
-- One row per (category, run). The sampler reads this to know which
-- categories haven't been touched in 90 days so we don't burn budget
-- re-sampling the same ones every week.

create table dh_category_samples (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  sampled_metros text[] not null,
  total_businesses int not null,
  avg_completeness numeric(4,3) not null,  -- 0.000 to 1.000
  candidate_created boolean not null default false,
  sampled_at timestamptz not null default now()
);

create index dh_category_samples_category_idx
  on dh_category_samples (category, sampled_at desc);

create index dh_category_samples_recent_idx
  on dh_category_samples (sampled_at desc);
