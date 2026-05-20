-- Phase 6: rename the category sampler source from 'outscraper-categories'
-- to 'category-sampler' now that the implementation uses Google Places API.
-- Apply manually in the Supabase SQL editor.
--
-- Safe: nothing has been ingested under the old source_id yet. If you have
-- already inserted rows under 'outscraper-categories' (you should not have,
-- in this rebuild), this migration will fail loudly on the foreign-key
-- constraint and you'll need to update those rows first.

delete from dh_discovery_sources where id = 'outscraper-categories';

insert into dh_discovery_sources (id, name, base_url, enabled) values
  ('category-sampler', 'Google Maps Category Sampler', 'https://places.googleapis.com', true);
