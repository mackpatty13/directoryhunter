// Master discovery runner. Runs every scanner sequentially, stores results,
// then runs the Haiku scoring pass. Idempotent end-to-end.
//
// This is what Railway cron will execute nightly. For one-off runs:
//   npm run discover
//   npm run discover -- --only=flippa
//   npm run discover -- --skip=indiehackers,frey-chu
//   npm run discover -- --no-score

import { log } from '../lib/log.js';
import { upsertCandidates, markSourceScanned, getSourcesMap, fetchUnscoredCandidates, updateCandidateScore } from '../lib/db.js';
import { scoreMany } from '../lib/score-discovery.js';

const ALL_SCANNERS = [
  'flippa',
  'reddit',
  'indiehackers',
  'niche-pursuits',
  'failory',
  'frey-chu',
  'lead-gen-pricing'
  // 'outscraper-categories' is paid and lives in Phase 6.
];

const args = process.argv.slice(2);
const onlyArg = args.find(a => a.startsWith('--only='))?.split('=')[1];
const skipArg = args.find(a => a.startsWith('--skip='))?.split('=')[1];
const skipScoring = args.includes('--no-score');

let toRun = onlyArg ? onlyArg.split(',') : ALL_SCANNERS;
if (skipArg) {
  const skip = new Set(skipArg.split(','));
  toRun = toRun.filter(s => !skip.has(s));
}

log.info('run-scanners starting', { scanners: toRun, skipScoring });

const summary = {};
const t0 = Date.now();

for (const name of toRun) {
  const tStart = Date.now();
  let mod;
  try {
    mod = await import(`../scanners/${name}.js`);
  } catch (err) {
    log.error('run-scanners: cannot load scanner', { name, error: err.message });
    summary[name] = { ok: false, error: 'import failed' };
    continue;
  }

  let results = [];
  try {
    results = await mod.scan({});
  } catch (err) {
    log.error('run-scanners: scanner threw', { name, error: err.message });
    summary[name] = { ok: false, error: err.message };
    continue;
  }

  if (results.length === 0) {
    summary[name] = { ok: true, results: 0, inserted: 0, conflicts: 0, elapsed: ((Date.now() - tStart) / 1000).toFixed(1) };
    continue;
  }

  let inserted = 0;
  let conflicts = 0;
  try {
    const r = await upsertCandidates(results);
    inserted = r.inserted;
    conflicts = r.conflicts;
  } catch (err) {
    log.error('run-scanners: upsert failed', { name, error: err.message });
    summary[name] = { ok: false, results: results.length, error: err.message };
    continue;
  }

  // Mark each source touched by this scanner. Several scanners write to more
  // than one source row (e.g. reddit writes to four).
  const touchedSources = Array.from(new Set(results.map(r => r.source_id)));
  for (const sid of touchedSources) {
    try { await markSourceScanned(sid); }
    catch (err) { log.warn('run-scanners: markSourceScanned failed', { sid, error: err.message }); }
  }

  summary[name] = {
    ok: true,
    results: results.length,
    inserted,
    conflicts,
    elapsed: ((Date.now() - tStart) / 1000).toFixed(1)
  };

  log.info('run-scanners: scanner done', { name, ...summary[name] });
}

log.info('run-scanners: all scanners complete', { summary, total_elapsed_s: ((Date.now() - t0) / 1000).toFixed(1) });

if (skipScoring) {
  log.info('run-scanners: --no-score set, skipping scoring pass');
  process.exit(0);
}

// Scoring pass.
const unscored = await fetchUnscoredCandidates({ limit: 500 });
if (unscored.length === 0) {
  log.info('run-scanners: nothing to score');
  process.exit(0);
}

const sourcesMap = await getSourcesMap();
const scored = await scoreMany(unscored, sourcesMap, { concurrency: 20 });

let written = 0;
let failed = 0;
for (const r of scored) {
  if (!r.ok) { failed++; continue; }
  try { await updateCandidateScore(r.id, r.score); written++; }
  catch (err) { log.error('run-scanners: db write failed', { id: r.id, error: err.message }); failed++; }
}

log.info('run-scanners DONE', {
  scanner_summary: summary,
  scored: unscored.length,
  written,
  failed,
  total_elapsed_s: ((Date.now() - t0) / 1000).toFixed(1)
});

process.exit(failed > 0 ? 1 : 0);
