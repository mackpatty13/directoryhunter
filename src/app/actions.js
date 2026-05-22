'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createEvaluation, getCandidateById, getEvaluation, updateCandidateStatus } from '../lib/db.js';

export async function setStatus(formData) {
  const id = formData.get('id');
  const status = formData.get('status');
  await updateCandidateStatus(id, status);
  revalidatePath('/');
  revalidatePath(`/candidates/${id}`);
}

// Submitted from the candidate detail page. Picks the niche from the candidate
// row, accepts the metro from the form, inserts a pending evaluation row, then
// redirects to the result page. The Railway worker (src/scripts/run-pending-
// evaluations.js) actually runs the pipeline. The result page auto-refreshes
// while status is pending/running.
export async function evaluateCandidate(formData) {
  const candidateId = formData.get('candidate_id');
  const metro = (formData.get('metro') || '').toString().trim();
  if (!candidateId || !metro) throw new Error('candidate_id and metro are required');

  const candidate = await getCandidateById(candidateId);
  if (!candidate) throw new Error(`candidate ${candidateId} not found`);
  const niche = candidate.niche_canonical || candidate.niche_raw;

  const evaluation = await createEvaluation({ niche, metro, candidateId });
  revalidatePath('/');
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath('/evaluations');
  redirect(`/evaluations/${evaluation.id}`);
}

// Submitted from the eval detail page. Copies niche + metro + candidate_id
// from an existing evaluation and creates a new pending row, leaving the
// original row in place for comparison.
export async function rerunEvaluation(formData) {
  const sourceId = formData.get('evaluation_id');
  if (!sourceId) throw new Error('evaluation_id is required');

  const source = await getEvaluation(sourceId);
  if (!source) throw new Error(`evaluation ${sourceId} not found`);

  const evaluation = await createEvaluation({
    niche: source.niche,
    metro: source.metro,
    candidateId: source.candidate_id,
    force: true
  });
  revalidatePath('/evaluations');
  if (source.candidate_id) revalidatePath(`/candidates/${source.candidate_id}`);
  redirect(`/evaluations/${evaluation.id}`);
}

// Submitted from the /evaluate page for ad-hoc niche evaluation.
export async function evaluateManual(formData) {
  const niche = (formData.get('niche') || '').toString().trim();
  const metro = (formData.get('metro') || '').toString().trim();
  if (!niche || !metro) throw new Error('niche and metro are required');

  const evaluation = await createEvaluation({ niche, metro });
  revalidatePath('/evaluations');
  redirect(`/evaluations/${evaluation.id}`);
}
