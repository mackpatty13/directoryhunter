// Shared Haiku helper for extracting directory-site niches from text blobs
// (blog posts, interviews, video transcripts, lead-gen pricing pages, etc.).
//
// Returns a flat array of niche strings. Geographic modifiers are kept inline
// if mentioned. Generic phrases like "local businesses" are filtered out by
// the prompt.

import { haiku } from './claude.js';
import { log } from './log.js';

const SYSTEM = [
  'You extract specific directory-site niches from articles, interviews, and transcripts.',
  'A niche is a specific industry vertical that could plausibly support a directory site,',
  'matching Frey Chu\'s playbook of boring, local, commercial-intent businesses.',
  'Good examples: "emergency plumbers serving commercial buildings",',
  '"mobile dog grooming in tier-2 cities", "veterinary practices that accept exotic pets",',
  '"wedding photographers for indian weddings", "mobile car detailing".',
  'Bad examples that you should NEVER include: "local businesses", "service providers",',
  '"small companies", "small businesses", "lead generation", "SEO", "marketing", "SaaS",',
  '"online businesses", "websites", "blogs", "content sites".',
  'You return JSON only.'
].join(' ');

const USER_TEMPLATE = (sourceLabel, text) => `Source: ${sourceLabel}

Extract every specific directory-site niche mentioned in the text below.
Include any geographic modifier the source attached to a niche (city, region, country),
but do not invent one when none is mentioned.

Return JSON of the form:
{
  "niches": [
    { "name": "<niche string>", "geo": "<geo or null>", "revenue_signal": "<a verbatim revenue/CPL quote from the text, or null>" }
  ]
}

If nothing qualifies, return { "niches": [] }.

Text:
${text.slice(0, 9000)}`;

export async function extractNiches({ text, sourceLabel }) {
  if (!text || text.trim().length < 100) return [];
  try {
    const result = await haiku({
      system: SYSTEM,
      user: USER_TEMPLATE(sourceLabel, text),
      maxTokens: 2500,
      temperature: 0,
      jsonOutput: true
    });
    if (!result || !Array.isArray(result.niches)) return [];
    return result.niches
      .filter(n => n && typeof n.name === 'string' && n.name.trim().length > 2)
      .map(n => ({
        name: n.name.trim(),
        geo: (typeof n.geo === 'string' && n.geo.trim()) ? n.geo.trim() : null,
        revenue_signal: (typeof n.revenue_signal === 'string' && n.revenue_signal.trim()) ? n.revenue_signal.trim() : null
      }));
  } catch (err) {
    log.warn('extractNiches failed', { sourceLabel, error: err.message });
    return [];
  }
}
