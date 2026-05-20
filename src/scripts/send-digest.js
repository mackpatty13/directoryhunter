// Sunday digest. Pulls top candidates from the last 7 days, emails Patrick.
//
// Usage:
//   npm run digest                  # send for real
//   npm run digest -- --dry-run     # print body, no send, no DB write
//   npm run digest -- --to=other@example.com   # override recipient (testing)
//
// Cron in prod: 0 13 * * 0 UTC (7am Sunday Central).

import { log } from '../lib/log.js';
import { fetchDigestCandidates, recordDigestSent, getSourcesMap } from '../lib/db.js';
import { sendEmail } from '../lib/email.js';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatArpu(n) {
  if (!Number.isFinite(n)) return 'unknown';
  return `$${n.toLocaleString('en-US')}`;
}

function buildSubject(count, topScore) {
  if (count === 0) return 'Directory Hunter // 0 new niches this week';
  return `Directory Hunter // ${count} new niche${count === 1 ? '' : 's'} this week (top ${topScore})`;
}

function buildMarkdown(candidates, sourcesMap, baseUrl) {
  if (candidates.length === 0) {
    return 'No candidates cleared 70 in the last 7 days. Nothing to report.\n';
  }
  const top = candidates[0];
  const topNiche = top.niche_canonical || top.niche_raw;
  const lines = [
    `${candidates.length} new niches scored 70+ this week. Top fit: ${topNiche} at ${top.discovery_score}.`,
    '',
    '---',
    ''
  ];
  for (const c of candidates) {
    const niche = c.niche_canonical || c.niche_raw;
    const sourceName = sourcesMap[c.source_id] || c.source_id;
    lines.push(`### ${niche}`);
    lines.push('');
    lines.push(`Score: ${c.discovery_score}/100 | ARPU: ${formatArpu(c.estimated_arpu_usd)} | Source: [${sourceName}](${c.source_url})`);
    lines.push('');
    if (c.fit_reasoning) {
      lines.push(c.fit_reasoning);
      lines.push('');
    }
    if (c.revenue_signal) {
      lines.push(`Revenue signal: ${c.revenue_signal}`);
      lines.push('');
    }
    lines.push(`[Evaluate this niche](${baseUrl}/candidates/${c.id})`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

function buildHtml(candidates, sourcesMap, baseUrl) {
  const wrap = (inner) => `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #1f2933; line-height: 1.5;">
${inner}
</body></html>`;

  if (candidates.length === 0) {
    return wrap('<p>No candidates cleared 70 in the last 7 days. Nothing to report.</p>');
  }

  const top = candidates[0];
  const topNiche = escapeHtml(top.niche_canonical || top.niche_raw);
  const parts = [
    `<p>${escapeHtml(candidates.length)} new niches scored 70+ this week. Top fit: <strong>${topNiche}</strong> at ${top.discovery_score}.</p>`,
    '<hr style="border: none; border-top: 1px solid #e3e8ee; margin: 24px 0;">'
  ];
  for (const c of candidates) {
    const niche = escapeHtml(c.niche_canonical || c.niche_raw);
    const sourceName = escapeHtml(sourcesMap[c.source_id] || c.source_id);
    parts.push(`<h3 style="margin: 16px 0 8px;">${niche}</h3>`);
    parts.push(`<p style="color: #52606d; font-size: 14px; margin: 0 0 12px;">Score: <strong>${c.discovery_score}/100</strong> &middot; ARPU: ${escapeHtml(formatArpu(c.estimated_arpu_usd))} &middot; Source: <a href="${escapeHtml(c.source_url)}" style="color: #3b82f6;">${sourceName}</a></p>`);
    if (c.fit_reasoning) {
      parts.push(`<p>${escapeHtml(c.fit_reasoning)}</p>`);
    }
    if (c.revenue_signal) {
      parts.push(`<p style="color: #52606d; font-size: 14px;">Revenue signal: ${escapeHtml(c.revenue_signal)}</p>`);
    }
    parts.push(`<p><a href="${escapeHtml(baseUrl)}/candidates/${escapeHtml(c.id)}" style="display: inline-block; padding: 8px 14px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Evaluate this niche</a></p>`);
    parts.push('<hr style="border: none; border-top: 1px solid #e3e8ee; margin: 24px 0;">');
  }
  return wrap(parts.join('\n'));
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const overrideTo = args.find(a => a.startsWith('--to='))?.split('=')[1];

const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const recipient = overrideTo || requireEnv('DIGEST_RECIPIENT_EMAIL');

log.info('send-digest starting', { dryRun, recipient, baseUrl });

const candidates = await fetchDigestCandidates({ minScore: 70, sinceDays: 7, limit: 10 });
const sourcesMap = await getSourcesMap();

const topScore = candidates[0]?.discovery_score ?? 0;
const subject = buildSubject(candidates.length, topScore);
const bodyMd = buildMarkdown(candidates, sourcesMap, baseUrl);
const bodyHtml = buildHtml(candidates, sourcesMap, baseUrl);

log.info('send-digest: composed', {
  count: candidates.length,
  topScore,
  subject,
  candidateIds: candidates.map(c => c.id)
});

if (dryRun) {
  console.log('\n=== SUBJECT ===');
  console.log(subject);
  console.log('\n=== MARKDOWN ===\n');
  console.log(bodyMd);
  console.log('\n=== HTML LENGTH ===');
  console.log(`${bodyHtml.length} chars`);
  log.info('send-digest: dry run, skipping send and DB write');
  process.exit(0);
}

if (candidates.length === 0) {
  log.info('send-digest: no candidates to send, skipping email (pass --dry-run to see the empty body)');
  process.exit(0);
}

const { id: providerId } = await sendEmail({
  to: recipient,
  subject,
  html: bodyHtml,
  text: bodyMd
});

await recordDigestSent({
  candidateIds: candidates.map(c => c.id),
  subject,
  bodyMd,
  providerId
});

log.info('send-digest DONE', { providerId, sent: candidates.length });
process.exit(0);
