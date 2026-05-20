// Process one pending evaluation, then exit. Designed for Railway cron:
// invoked once a minute. Picks up the oldest pending eval, runs the full
// pipeline (normalize + Google Places + DataforSEO + Trends + Sonnet scoring
// + plan), writes results back, exits.
//
// If two crons fire close together with two pending evals, both get processed
// in parallel (one per worker). If two crons race for the same eval, only one
// wins the claim. See db.claimPendingEvaluation.
//
// Local run:
//   npm run eval:pending

import { log } from '../lib/log.js';
import { claimPendingEvaluation } from '../lib/db.js';
import { runEvaluation } from '../lib/evaluate.js';

const evaluation = await claimPendingEvaluation();

if (!evaluation) {
  log.info('run-pending-evaluations: nothing pending');
  process.exit(0);
}

log.info('run-pending-evaluations: claimed', {
  id: evaluation.id,
  niche: evaluation.niche,
  metro: evaluation.metro
});

const result = await runEvaluation(evaluation);

if (!result.ok) {
  log.error('run-pending-evaluations: eval failed', { id: evaluation.id, error: result.error });
  process.exit(1);
}

log.info('run-pending-evaluations: done', {
  id: evaluation.id,
  total: result.total,
  recommendation: result.recommendation
});
process.exit(0);
