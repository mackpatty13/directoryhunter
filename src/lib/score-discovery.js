// Lightweight discovery scoring using Claude Haiku.
// Scores a candidate 0 to 100 against the Frey Chu playbook using only the
// data the scanner already collected. No paid SERP or Maps calls.
//
// Prompt is sourced from docs/discovery-rubric.md.

import { haiku, mapWithConcurrency } from './claude.js';
import { canonicalNiche } from './dedupe.js';
import { log } from './log.js';

const SYSTEM = [
  'You are a niche analyst for directory site building.',
  'You score candidates against Patrick\'s playbook on a 0 to 100 scale.',
  'You return JSON only, no prose, no markdown fencing.'
].join(' ');

function buildPrompt(c, sourceName) {
  return `Score this directory site niche candidate for Patrick on a 0-100 scale.

Patrick is looking for niches that match Frey Chu's playbook:
- Boring, local, commercial intent (people are buying, not researching)
- High ARPU underlying service (>$500 per transaction ideal)
- Google Maps is disorganized in this category (low completeness)
- Resistant to AI Overview (local searches, not informational)
- Either passive ad model (need 10K+ monthly visits potential) or lead-gen model (need high-ticket service)
- Geographic scalability (works in multiple metros)

Candidate:
- Niche: ${c.niche_raw}
- Geographic hint: ${c.geographic_hint || 'none'}
- Revenue signal: ${c.revenue_signal || 'none'}
- Revenue amount (USD/month): ${c.revenue_amount_usd_monthly ?? 'unknown'}
- Source: ${sourceName} (category: ${c.discovery_category || 'unknown'})
- Raw context: ${c.raw_context}

Score weights:
+30 if source is 'proven_winner' (someone sold a directory in this niche)
+25 if revenue_amount_usd_monthly is reported and > $1000
+15 if niche has clear local commercial intent
+15 if estimated underlying service ARPU > $500
+10 if niche is specific (not "plumbers" but "emergency plumbers serving commercial properties")
+10 if Frey Chu's playbook would suggest it works
-20 if niche is generic and dominated by Yelp/Angi/Yellowpages
-15 if it's an informational niche (recipe sites, how-to)
-15 if ARPU is clearly under $100
-10 if it requires national-level audience to work

Return JSON only:
{
  "discovery_score": <0-100 integer>,
  "estimated_arpu_usd": <integer estimate of average transaction value in this niche>,
  "niche_canonical": <normalized version of niche name for deduplication, lowercase, no metro, no marketing fluff>,
  "fit_reasoning": <2-3 sentences plain language>
}`;
}

function sanitize(result, candidate) {
  const score = Math.max(0, Math.min(100, parseInt(result.discovery_score, 10)));
  const arpu = Number.isFinite(parseInt(result.estimated_arpu_usd, 10))
    ? parseInt(result.estimated_arpu_usd, 10)
    : null;
  const canonical = (result.niche_canonical && typeof result.niche_canonical === 'string')
    ? result.niche_canonical.toLowerCase().trim()
    : canonicalNiche(candidate.niche_raw);
  const reasoning = (typeof result.fit_reasoning === 'string') ? result.fit_reasoning.trim() : '';
  return {
    discovery_score: Number.isFinite(score) ? score : 0,
    estimated_arpu_usd: arpu,
    niche_canonical: canonical,
    fit_reasoning: reasoning
  };
}

export async function scoreOne(candidate, sourceName) {
  const prompt = buildPrompt(candidate, sourceName);
  const raw = await haiku({
    system: SYSTEM,
    user: prompt,
    maxTokens: 512,
    temperature: 0,
    jsonOutput: true
  });
  return sanitize(raw, candidate);
}

// Score an array of candidates with bounded concurrency.
// Returns array of { id, ok, score? , error? }.
export async function scoreMany(candidates, sourcesMap, { concurrency = 20 } = {}) {
  log.info('scoreMany starting', { count: candidates.length, concurrency });

  const out = await mapWithConcurrency(candidates, concurrency, async (c) => {
    const sourceName = sourcesMap[c.source_id] || c.source_id;
    try {
      const score = await scoreOne(c, sourceName);
      return { id: c.id, ok: true, score };
    } catch (err) {
      log.error('scoreMany: candidate failed', { id: c.id, error: err.message });
      return { id: c.id, ok: false, error: err.message };
    }
  });

  const succeeded = out.filter(r => r.ok).length;
  log.info('scoreMany complete', { succeeded, failed: out.length - succeeded });
  return out;
}
