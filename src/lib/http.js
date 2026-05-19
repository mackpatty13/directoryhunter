// Fetch wrapper with User-Agent, retries, and throttling.
// Use this for any non-Playwright HTTP. Playwright pages set their own headers.

import { log } from './log.js';

const DEFAULT_UA = 'directory-hunter/1.0 (+https://buildmyblast.com)';
const DEFAULT_DELAY_MS = 2000;
const DEFAULT_RETRIES = 2;

const lastHitByHost = new Map();

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function throttle(url, throttleMs) {
  const host = new URL(url).hostname;
  const last = lastHitByHost.get(host) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < throttleMs) await delay(throttleMs - elapsed);
  lastHitByHost.set(host, Date.now());
}

export async function httpGet(url, options = {}) {
  const {
    userAgent = DEFAULT_UA,
    throttleMs = DEFAULT_DELAY_MS,
    retries = DEFAULT_RETRIES,
    headers = {},
    timeoutMs = 30000,
    accept = 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
  } = options;

  let attempt = 0;
  let lastErr;

  while (attempt <= retries) {
    await throttle(url, throttleMs);

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': userAgent, Accept: accept, ...headers },
        signal: ctrl.signal
      });
      clearTimeout(timeout);

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`http ${res.status} for ${url}`);
        const wait = 2 ** attempt * 1500;
        log.warn('httpGet retrying', { url, status: res.status, wait });
        await delay(wait);
        attempt++;
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      const wait = 2 ** attempt * 1500;
      log.warn('httpGet error, retrying', { url, error: err.message, wait });
      await delay(wait);
      attempt++;
    }
  }

  throw lastErr ?? new Error(`httpGet exhausted retries for ${url}`);
}

export async function httpGetJson(url, options = {}) {
  const res = await httpGet(url, {
    ...options,
    accept: 'application/json'
  });
  if (!res.ok) throw new Error(`httpGetJson ${res.status} for ${url}`);
  return res.json();
}

export async function httpGetText(url, options = {}) {
  const res = await httpGet(url, options);
  if (!res.ok) throw new Error(`httpGetText ${res.status} for ${url}`);
  return res.text();
}
