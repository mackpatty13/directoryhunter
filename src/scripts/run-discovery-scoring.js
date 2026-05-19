// Fetch all unscored niche candidates and run the Haiku scoring pass on them.
// Idempotent: candidates with scored_at set are skipped.
//
// Usage:
//   npm run score:discovery
//   npm run score:discovery -- --limit=50 --concurrency=10

import { log } from '../lib/log.js';
import { fetchUnscoredCandidates, updateCandidateScore, getSourcesMap } from '../lib/db.js';
import { scoreMany } from '../lib/score-discovery.js';

const args = process.argv.slice(2);
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '100', 10);
const concurrency = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] ?? '20', 10);

log.info('run-discovery-scoring starting', { limit, concurrency });

const candidates = await fetchUnscoredCandidates({ limit });
if (candidates.length === 0) {
  log.info('run-discovery-scoring: nothing to score');
  process.exit(0);
}

const sourcesMap = await getSourcesMap();
const t0 = Date.now();
const results = await scoreMany(candidates, sourcesMap, { concurrency });
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

let written = 0;
let failed = 0;

for (const r of results) {
  if (!r.ok) { failed++; continue; }
  try {
    await updateCandidateScore(r.id, r.score);
    written++;
  } catch (err) {
    log.error('run-discovery-scoring: db write failed', { id: r.id, error: err.message });
    failed++;
  }
}

log.info('run-discovery-scoring complete', {
  scored: candidates.length,
  written,
  failed,
  elapsed_seconds: elapsed
});

if (failed > 0) process.exit(1);
process.exit(0);
