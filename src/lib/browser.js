// Shared Playwright launcher. Chromium runs as root inside Railway's container,
// where the default sandbox crashes it at launch ("Target page, context or
// browser has been closed"). These flags are the standard container-safe set;
// they are harmless locally.

import { chromium } from 'playwright';

const CONTAINER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];

export function launchBrowser({ headless = true } = {}) {
  return chromium.launch({ headless, args: CONTAINER_ARGS });
}
