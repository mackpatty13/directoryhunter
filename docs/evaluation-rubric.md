# Evaluation rubric

Runs only when Patrick clicks Evaluate on a candidate, or when he manually enters a niche plus metro. Uses Outscraper plus DataforSEO plus Google Trends plus Claude Sonnet (`claude-sonnet-4-6`).

Score across 6 dimensions, weighted, total max 100.

## Dimension 1: Market size (max 20)
- 0 pts: under 50 businesses in top metro OR search volume under 100/mo
- 8 pts: 50 to 200 businesses, 100 to 500/mo volume
- 14 pts: 200 to 1000 businesses, 500 to 2000/mo volume
- 20 pts: 1000+ businesses, 2000+/mo volume

## Dimension 2: Competition strength (max 20, inverse)
- 0 pts: Top 3 SERP are Yelp/Angi/Yellowpages/BBB/Thumbtack (DA 80+)
- 5 pts: Top 3 are mid-strength directories (DA 40 to 70)
- 12 pts: Top 3 are weak directories (DA under 40) or mixed with business sites
- 20 pts: Top 3 are individual business sites, Maps pack dominates

## Dimension 3: Buyer-intent strength (max 20)
- 0 pts: ARPU under $100
- 8 pts: $100 to $500
- 14 pts: $500 to $2000
- 20 pts: $2000+

## Dimension 4: Google Maps disorganization (max 15)
- 0 pts: 90%+ businesses have complete profiles
- 5 pts: 60 to 90% complete
- 10 pts: 30 to 60% complete
- 15 pts: under 30% complete

## Dimension 5: Geographic distribution (max 10)
- 0 pts: only 3 to 5 viable metros
- 5 pts: 10 to 20 viable metros
- 10 pts: 30+ viable metros

## Dimension 6: AI Overview resistance (max 15)
- 0 pts: 30%+ of niche keywords trigger AI Overview
- 5 pts: 10 to 30% trigger
- 15 pts: under 10% trigger

## Total interpretation
- 80 to 100: BUILD
- 60 to 79: VALIDATE
- 40 to 59: RISKY
- Under 40: SKIP

## Build plan generation

If total >= 60, generate a 30-day plan via Claude Sonnet.

```
You are generating a 30-day action plan for Patrick to build a directory site.

Niche: {niche}
Metro: {metro}
Total score: {score}/100
Dimension scores: {dimension_scores}
Top 5 SERP competitors: {competitors_with_da}
Outscraper data summary: {summary}

Patrick's context:
- Self-taught builder on Next.js + Supabase + Vercel + Playwright
- Already builds scrapers and programmatic pages
- Uses Outscraper for data, Mediavine/Ezoic for ads if traffic justifies
- DFW-based, ~10 hours/week side capacity
- Frey Chu playbook: boring + local + buyer intent

Return JSON:
{
  "recommended_model": <"passive_ad" | "lead_gen" | "hybrid">,
  "model_reasoning": <2-3 sentences>,
  "target_metros": [<5-10 specific cities, mid-sized preferred>],
  "primary_keywords": [<top 5>],
  "secondary_keywords": [<10-20 long-tail>],
  "top_competitors": [{"domain": ..., "da": ..., "weakness": ...}],
  "estimated_revenue_low_monthly_12mo": <integer USD>,
  "estimated_revenue_high_monthly_12mo": <integer USD>,
  "revenue_basis": <one paragraph citing comp benchmarks>,
  "first_30_days_plan": <markdown checklist with weekly milestones>,
  "stop_signs": [<5-7 early failure signals>]
}
```
