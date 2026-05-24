// Installs the Playwright Chromium browser after `npm install`, but only where
// the scrapers actually run. Vercel only serves the Next.js app (no scraping)
// and has no apt for --with-deps, so it is skipped. Railway and local dev both
// get the browser.
//
// Best-effort on purpose: a failed browser download must not fail the whole
// build. The Playwright scanners already catch a missing browser and return [],
// so the nightly run degrades on those three sources instead of crashing.

import { execSync } from 'node:child_process';

if (process.env.VERCEL) {
  console.log('[postinstall] Vercel build detected, skipping Playwright browser install');
  process.exit(0);
}

function run(cmd) {
  console.log(`[postinstall] ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

try {
  // --with-deps pulls the OS libraries Chromium needs. Works on Railway's
  // Debian build image (runs as root with apt); a no-op for deps on Windows.
  run('npx playwright install --with-deps chromium');
} catch (err) {
  console.warn(`[postinstall] install --with-deps failed (${err.message}); retrying browser-only`);
  try {
    run('npx playwright install chromium');
  } catch (err2) {
    console.warn(`[postinstall] Playwright browser install failed: ${err2.message}. Playwright scanners will be skipped.`);
  }
}
