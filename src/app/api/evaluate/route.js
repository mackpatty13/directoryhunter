// POST /api/evaluate
//   body: { niche, metro, candidate_id? }
//   returns: { evaluation_id }
//
// Runs the evaluation pipeline synchronously and only returns once it's done
// (or has failed). For a personal tool with 5-10 evals/week and a Pro Vercel
// plan, that is the simplest viable shape. If we hit timeouts in prod, we
// move the orchestrator into a Railway worker and have this route just
// enqueue the work.

import { NextResponse } from 'next/server';
import { createEvaluation } from '../../../lib/db.js';
import { runEvaluation } from '../../../lib/evaluate.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const niche = (body.niche || '').toString().trim();
  const metro = (body.metro || '').toString().trim();
  const candidateId = body.candidate_id || null;

  if (!niche || !metro) {
    return NextResponse.json({ error: 'niche and metro are required' }, { status: 400 });
  }

  const evaluation = await createEvaluation({ niche, metro, candidateId });

  if (evaluation.status === 'complete') {
    return NextResponse.json({ evaluation_id: evaluation.id, cached: true });
  }

  const result = await runEvaluation(evaluation);
  return NextResponse.json({
    evaluation_id: evaluation.id,
    ok: result.ok,
    total: result.total ?? null,
    recommendation: result.recommendation ?? null,
    error: result.error ?? null
  });
}
