import type { APIRoute } from 'astro';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SUBMISSIONS_FILE_PATH = resolve(process.cwd(), 'data', 'review-submissions.ndjson');

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const max = (value: string, limit: number) => value.slice(0, limit);

const toRating = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(1, Math.min(5, parsed));
};

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const professionalSlug = max(clean(formData.get('professionalSlug')), 120);
  const returnTo = clean(formData.get('returnTo')) || `/professionals/${professionalSlug}`;

  const submission = {
    professionalSlug,
    reviewerName: max(clean(formData.get('reviewerName')), 80),
    rating: toRating(clean(formData.get('rating'))),
    comment: max(clean(formData.get('comment')), 1200),
    status: 'pending',
    submittedAt: new Date().toISOString()
  };

  if (!submission.professionalSlug || !submission.rating || !submission.comment) {
    return redirect(`${returnTo}?review=invalid`, 303);
  }

  try {
    await mkdir(dirname(SUBMISSIONS_FILE_PATH), { recursive: true });
    await appendFile(SUBMISSIONS_FILE_PATH, `${JSON.stringify(submission)}\n`, 'utf-8');
    return redirect(`${returnTo}?review=submitted`, 303);
  } catch (error) {
    console.error('[review-submit] failed', error);
    return redirect(`${returnTo}?review=error`, 303);
  }
};
