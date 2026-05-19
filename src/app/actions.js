'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createEvaluation, getCandidateById, updateCandidateStatus } from '../lib/db.js';
import { runEvaluation } from '../lib/evaluate.js';

export async function setStatus(formData) {
  const id = formData.get('id');
  const status = formData.get('status');
  await updateCandidateStatus(id, status);
  revalidatePath('/');
  revalidatePath(`/candidates/${id}`);
}

// Submitted from the candidate detail page. Picks the niche from the candidate
// row, accepts the metro from the form, runs the pipeline, redirects to the
// result page.
export async function evaluateCandidate(formData) {
  const candidateId = formData.get('candidate_id');
  const metro = (formData.get('metro') || '').toString().trim();
  if (!candidateId || !metro) throw new Error('candidate_id and metro are required');

  const candidate = await getCandidateById(candidateId);
  if (!candidate) throw new Error(`candidate ${candidateId} not found`);
  const niche = candidate.niche_canonical || candidate.niche_raw;

  const evaluation = await createEvaluation({ niche, metro, candidateId });
  if (evaluation.status !== 'complete') {
    await runEvaluation(evaluation);
  }
  revalidatePath('/');
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath('/evaluations');
  redirect(`/evaluations/${evaluation.id}`);
}

// Submitted from the /evaluate page for ad-hoc niche evaluation.
export async function evaluateManual(formData) {
  const niche = (formData.get('niche') || '').toString().trim();
  const metro = (formData.get('metro') || '').toString().trim();
  if (!niche || !metro) throw new Error('niche and metro are required');

  const evaluation = await createEvaluation({ niche, metro });
  if (evaluation.status !== 'complete') {
    await runEvaluation(evaluation);
  }
  revalidatePath('/evaluations');
  redirect(`/evaluations/${evaluation.id}`);
}
