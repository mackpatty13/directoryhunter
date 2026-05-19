'use server';

import { revalidatePath } from 'next/cache';
import { updateCandidateStatus } from '../lib/db.js';

export async function setStatus(formData) {
  const id = formData.get('id');
  const status = formData.get('status');
  await updateCandidateStatus(id, status);
  revalidatePath('/');
  revalidatePath(`/candidates/${id}`);
}
