import type { APIRoute } from 'astro';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const REVIEWS_FILE_PATH = resolve(process.cwd(), 'data', 'reviews.json');
const ACTIONS_FILE_PATH = resolve(process.cwd(), 'data', 'review-moderation-actions.ndjson');

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const moderationKey = clean(formData.get('moderationKey'));
  const expectedKey = process.env.PROFESSIONAL_MODERATION_KEY || '';

  if (!expectedKey || moderationKey !== expectedKey) {
    return redirect('/professionals/reviews-moderation?status=unauthorized', 303);
  }

  const action = clean(formData.get('action'));
  const reviewId = clean(formData.get('reviewId'));
  const returnUrl = `/professionals/reviews-moderation?key=${encodeURIComponent(moderationKey)}`;

  if (!reviewId || !action) {
    return redirect(`${returnUrl}&status=invalid`, 303);
  }

  try {
    await mkdir(dirname(ACTIONS_FILE_PATH), { recursive: true });
    await appendFile(ACTIONS_FILE_PATH, `${JSON.stringify({ reviewId, action, actedAt: new Date().toISOString() })}\n`, 'utf-8');

    if (action === 'approve') {
      const reviewRaw = clean(formData.get('review')) || '{}';
      const review = JSON.parse(reviewRaw) as {
        professionalSlug: string;
        reviewerName?: string;
        rating: number;
        comment: string;
        submittedAt: string;
      };

      const fileContent = await readFile(REVIEWS_FILE_PATH, 'utf-8');
      const reviews = JSON.parse(fileContent) as Array<Record<string, any>>;

      if (!reviews.some((existing) => existing.id === reviewId)) {
        reviews.push({
          id: reviewId,
          professionalSlug: review.professionalSlug,
          reviewerName: review.reviewerName || 'Ανώνυμος Πελάτης',
          rating: Math.max(1, Math.min(5, Number(review.rating) || 1)),
          comment: review.comment,
          verified: false,
          status: 'approved',
          submittedAt: review.submittedAt,
          approvedAt: new Date().toISOString()
        });
        await writeFile(REVIEWS_FILE_PATH, `${JSON.stringify(reviews, null, 2)}\n`, 'utf-8');
      }
    }

    return redirect(`${returnUrl}&status=ok`, 303);
  } catch (error) {
    console.error('[review-moderation] failed', error);
    return redirect(`${returnUrl}&status=error`, 303);
  }
};
