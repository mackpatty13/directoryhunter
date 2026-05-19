// Run a single scanner and print the first N results.
// Usage:
//   npm run test:scanner -- flippa
//   npm run test:scanner -- flippa --headed         # show the browser window
//   npm run test:scanner -- flippa --limit=25
//   npm run test:scanner -- flippa --store          # also insert into dh_niche_candidates

import { log } from '../lib/log.js';
import { upsertCandidates, markSourceScanned } from '../lib/db.js';

const args = process.argv.slice(2);
const scannerName = args.find(a => !a.startsWith('--'));
const headed = args.includes('--headed');
const store = args.includes('--store');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10;

if (!scannerName) {
  console.error('usage: npm run test:scanner -- <scanner> [--headed] [--limit=N] [--store]');
  console.error('available scanners: flippa');
  process.exit(2);
}

let mod;
try {
  mod = await import(`../scanners/${scannerName}.js`);
} catch (err) {
  log.error('test-scanner: could not load scanner', { scanner: scannerName, error: err.message });
  process.exit(1);
}

if (typeof mod.scan !== 'function') {
  log.error('test-scanner: scanner has no scan() export', { scanner: scannerName });
  process.exit(1);
}

log.info('test-scanner starting', { scanner: scannerName, limit, headed, store });
const start = Date.now();

let results;
try {
  results = await mod.scan({ limit, headless: !headed });
} catch (err) {
  log.error('test-scanner: scan() threw', { error: err.message, stack: err.stack });
  process.exit(1);
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
log.info(`test-scanner: scan() complete in ${elapsed}s`, { count: results.length });

console.log('\n=== RESULTS ===\n');
if (results.length === 0) {
  console.log('(no results)');
  console.log('\nTroubleshooting:');
  console.log('  1. Re-run with --headed to watch what the browser does.');
  console.log('  2. If listings render but selectors miss them, inspect the DOM and');
  console.log('     refine the CSS selectors in src/scanners/' + scannerName + '.js');
} else {
  for (let i = 0; i < Math.min(results.length, limit); i++) {
    const r = results[i];
    console.log(`#${i + 1}  ${r.niche_raw}`);
    console.log(`     url: ${r.source_url}`);
    if (r.revenue_signal) console.log(`     revenue: ${r.revenue_signal}` + (r.revenue_amount_usd_monthly ? `  (parsed: $${r.revenue_amount_usd_monthly}/mo)` : ''));
    if (r.geographic_hint) console.log(`     geo: ${r.geographic_hint}`);
    if (r.raw_context) console.log(`     context: ${r.raw_context.slice(0, 200)}`);
    console.log('');
  }
}

if (store) {
  if (results.length === 0) {
    log.warn('--store: nothing to insert');
  } else {
    const sourceId = results[0]?.source_id;
    const { inserted, conflicts } = await upsertCandidates(results);
    log.info('--store: upsert complete', { inserted, conflicts, total: results.length });
    if (sourceId) await markSourceScanned(sourceId);
  }
}

process.exit(0);
