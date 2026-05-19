# Discovery scoring rubric

After scanners deposit candidates, the discovery scoring pass uses Claude Haiku to rank each candidate 0 to 100 without spending paid API budget. This is lightweight ranking, not deep evaluation.

Model: `claude-haiku-4-5-20251001`. Batch 20 candidates concurrently. Cheap, fast, runs after every scanner pass.

## Prompt template

```
Score this directory site niche candidate for Patrick on a 0-100 scale.

Patrick is looking for niches that match Frey Chu's playbook:
- Boring, local, commercial intent (people are buying, not researching)
- High ARPU underlying service (>$500 per transaction ideal)
- Google Maps is disorganized in this category (low completeness)
- Resistant to AI Overview (local searches, not informational)
- Either passive ad model (need 10K+ monthly visits potential) or lead-gen model (need high-ticket service)
- Geographic scalability (works in multiple metros)

Candidate:
- Niche: {niche_raw}
- Geographic hint: {geographic_hint or 'none'}
- Revenue signal: {revenue_signal or 'none'}
- Source: {source_name} (category: {discovery_category})
- Raw context: {raw_context}

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
  "niche_canonical": <normalized version of niche name for deduplication, lowercase, no metro>,
  "fit_reasoning": <2-3 sentences plain language>
}
```

## Thresholds

- 70 and up: surfaced in weekly digest, recommended for evaluation.
- 50 to 69: visible in inbox, manual review.
- Under 50: stored but hidden by default (filter to show).

## Output fields written to `niche_candidates`

- `discovery_score` (int)
- `estimated_arpu_usd` (int)
- `niche_canonical` (text, used for cross-source dedupe)
- `fit_reasoning` (text)
- `scored_at` (timestamptz)
