import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase-server';

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const max = (value: string, limit: number) => value.slice(0, limit);
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const toRating = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(1, Math.min(5, parsed));
};

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const professionalSlug = max(clean(formData.get('professionalSlug')), 120);
  const returnTo = clean(formData.get('returnTo')) || `/professionals/${professionalSlug}`;

  if (clean(formData.get('website'))) return redirect(`${returnTo}?review=invalid`, 303);

  const reviewerName = max(clean(formData.get('reviewerName')), 80) || 'Ανώνυμος Πελάτης';
  const reviewerEmail = max(clean(formData.get('reviewerEmail')).toLowerCase(), 160);
  const rating = toRating(clean(formData.get('rating')));
  const comment = max(clean(formData.get('comment')), 1200);

  if (!professionalSlug || !rating || !comment || (reviewerEmail && !isValidEmail(reviewerEmail))) {
    return redirect(`${returnTo}?review=invalid`, 303);
  }

  const { error } = await supabaseServer.from('reviews').insert({
    professional_id: null,
    reviewer_name: reviewerName,
    reviewer_email: reviewerEmail || null,
    rating,
    comment,
    service_slug: professionalSlug,
    status: 'pending'
  });

  if (error) {
    console.error('[review-submit] failed', error);
    return redirect(`${returnTo}?review=error`, 303);
  }

  return redirect(`${returnTo}?review=submitted`, 303);
};
