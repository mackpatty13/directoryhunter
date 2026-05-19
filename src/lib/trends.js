// Google Trends wrapper. Free, no key. Returns interest-over-time + a coarse
// trend direction over the last 12 months.

import googleTrends from 'google-trends-api';
import { log } from './log.js';

function lastYear() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d;
}

function classify(values) {
  if (!values || values.length < 8) return 'unknown';
  const firstQuarter = values.slice(0, Math.floor(values.length / 4));
  const lastQuarter = values.slice(-Math.floor(values.length / 4));
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const a = avg(firstQuarter);
  const b = avg(lastQuarter);
  const delta = a > 0 ? (b - a) / a : 0;
  if (delta > 0.15) return 'rising';
  if (delta < -0.15) return 'declining';
  return 'flat';
}

export async function fetchTrends(keyword, { geo = 'US' } = {}) {
  log.info('trends: fetching', { keyword, geo });
  try {
    const raw = await googleTrends.interestOverTime({
      keyword,
      startTime: lastYear(),
      geo
    });
    const json = JSON.parse(raw);
    const points = json?.default?.timelineData ?? [];
    const values = points.map(p => Number(p.value?.[0] ?? 0));
    const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    const peak = values.length ? Math.max(...values) : 0;
    return {
      keyword,
      geo,
      avg_interest: avg,
      peak_interest: peak,
      trend: classify(values),
      points: points.map(p => ({ date: p.formattedTime, value: Number(p.value?.[0] ?? 0) }))
    };
  } catch (err) {
    log.warn('trends: failed', { keyword, error: err.message });
    return {
      keyword,
      geo,
      avg_interest: null,
      peak_interest: null,
      trend: 'unknown',
      points: [],
      error: err.message
    };
  }
}
