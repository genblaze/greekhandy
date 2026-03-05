import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase-server';

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const max = (value: string, limit: number) => value.slice(0, limit);
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const toRating = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(1, Math.min(5, parsed));
};

const wantsJson = (request: Request) => {
  const accept = request.headers.get('accept') || '';
  const contentType = request.headers.get('content-type') || '';
  const format = new URL(request.url).searchParams.get('format');
  return format === 'json' || accept.includes('application/json') || contentType.includes('application/json');
};

const jsonError = (status: number, code: string, message: string, fieldErrors?: Record<string, string>) =>
  new Response(JSON.stringify({ ok: false, error: { code, message, fieldErrors: fieldErrors || null } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });

type ReviewInput = {
  professionalSlug: string;
  returnTo: string;
  honeypot: string;
  reviewerName: string;
  reviewerEmail: string;
  rating: number;
  comment: string;
};

const toSafeReturnTo = (candidate: string, fallback: string) => {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  try {
    const url = new URL(candidate, 'https://greekhandy.local');
    if (url.origin !== 'https://greekhandy.local') return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
};

const withReviewStatus = (
  returnTo: string,
  status: 'invalid' | 'error' | 'submitted',
  values: Partial<ReviewInput> = {},
  fieldErrors: Record<string, string> = {}
) => {
  const url = new URL(returnTo, 'https://greekhandy.local');
  url.searchParams.set('review', status);

  const ratingValue = typeof values.rating === 'number' && values.rating > 0 ? String(values.rating) : '';
  const valueMap: Record<string, string> = {
    reviewerName: clean(values.reviewerName),
    reviewerEmail: clean(values.reviewerEmail),
    rating: ratingValue,
    comment: clean(values.comment)
  };

  for (const [field, value] of Object.entries(valueMap)) {
    if (value) url.searchParams.set(`rv_${field}`, value);
  }

  for (const [field, message] of Object.entries(fieldErrors)) {
    if (message) url.searchParams.set(`re_${field}`, message);
  }

  return `${url.pathname}${url.search}`;
};

const extractInput = async (request: Request): Promise<ReviewInput> => {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const professionalSlug = max(clean(body.professionalSlug), 120);
    const fallbackReturnTo = professionalSlug ? `/professionals/${professionalSlug}` : '/professionals';
    return {
      professionalSlug,
      returnTo: toSafeReturnTo(clean(body.returnTo), fallbackReturnTo),
      honeypot: clean(body.website),
      reviewerName: max(clean(body.reviewerName), 80) || 'Ανώνυμος Πελάτης',
      reviewerEmail: max(clean(body.reviewerEmail).toLowerCase(), 160),
      rating: toRating(clean(body.rating)),
      comment: max(clean(body.comment), 1200)
    };
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(await request.text());
    const professionalSlug = max(clean(params.get('professionalSlug')), 120);
    const fallbackReturnTo = professionalSlug ? `/professionals/${professionalSlug}` : '/professionals';
    return {
      professionalSlug,
      returnTo: toSafeReturnTo(clean(params.get('returnTo')), fallbackReturnTo),
      honeypot: clean(params.get('website')),
      reviewerName: max(clean(params.get('reviewerName')), 80) || 'Ανώνυμος Πελάτης',
      reviewerEmail: max(clean(params.get('reviewerEmail')).toLowerCase(), 160),
      rating: toRating(clean(params.get('rating'))),
      comment: max(clean(params.get('comment')), 1200)
    };
  }

  const formData = await request.formData();
  const professionalSlug = max(clean(formData.get('professionalSlug')), 120);
  const fallbackReturnTo = professionalSlug ? `/professionals/${professionalSlug}` : '/professionals';
  return {
    professionalSlug,
    returnTo: toSafeReturnTo(clean(formData.get('returnTo')), fallbackReturnTo),
    honeypot: clean(formData.get('website')),
    reviewerName: max(clean(formData.get('reviewerName')), 80) || 'Ανώνυμος Πελάτης',
    reviewerEmail: max(clean(formData.get('reviewerEmail')).toLowerCase(), 160),
    rating: toRating(clean(formData.get('rating'))),
    comment: max(clean(formData.get('comment')), 1200)
  };
};

const validateInput = (input: ReviewInput) => {
  const fieldErrors: Record<string, string> = {};
  if (!input.professionalSlug) fieldErrors.professionalSlug = 'Το professionalSlug είναι υποχρεωτικό.';
  if (!input.rating) fieldErrors.rating = 'Η βαθμολογία είναι υποχρεωτική (1-5).';
  if (!input.comment) fieldErrors.comment = 'Το σχόλιο είναι υποχρεωτικό.';
  if (input.reviewerEmail && !isValidEmail(input.reviewerEmail)) fieldErrors.reviewerEmail = 'Το email δεν είναι έγκυρο.';
  return fieldErrors;
};

export const POST: APIRoute = async ({ request, redirect }) => {
  const asJson = wantsJson(request);

  let input: ReviewInput;
  try {
    input = await extractInput(request);
  } catch {
    const referer = request.headers.get('referer') || '';
    const safeReturnTo = toSafeReturnTo(referer, '/professionals');
    return asJson
      ? jsonError(400, 'INVALID_BODY', 'Το σώμα του αιτήματος δεν είναι έγκυρο.')
      : redirect(withReviewStatus(safeReturnTo, 'invalid', {}, { form: 'Η υποβολή δεν ήταν έγκυρη. Διορθώστε τα πεδία και δοκιμάστε ξανά.' }), 303);
  }

  if (input.honeypot) {
    return asJson
      ? jsonError(422, 'VALIDATION_ERROR', 'Το αίτημα απορρίφθηκε ως μη έγκυρο.', { website: 'Μη επιτρεπτό πεδίο.' })
      : redirect(withReviewStatus(input.returnTo, 'invalid', input, { website: 'Μη επιτρεπτό πεδίο.' }), 303);
  }

  const fieldErrors = validateInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return asJson
      ? jsonError(422, 'VALIDATION_ERROR', 'Υπάρχουν σφάλματα σε πεδία.', fieldErrors)
      : redirect(withReviewStatus(input.returnTo, 'invalid', input, fieldErrors), 303);
  }

  const { error } = await supabaseServer.from('reviews').insert({
    professional_id: null,
    reviewer_name: input.reviewerName,
    reviewer_email: input.reviewerEmail || null,
    rating: input.rating,
    comment: input.comment,
    service_slug: input.professionalSlug,
    status: 'pending'
  });

  if (error) {
    const message = error instanceof Error ? error.message : 'supabase-error';
    console.error(`[review-submit] failed: ${message}`);
    return asJson
      ? jsonError(500, 'REVIEW_SUBMIT_FAILED', 'Αδυναμία υποβολής κριτικής αυτή τη στιγμή.')
      : redirect(withReviewStatus(input.returnTo, 'error', input, { form: 'Η υποβολή δεν ολοκληρώθηκε. Προσπαθήστε ξανά.' }), 303);
  }

  return asJson
    ? new Response(JSON.stringify({ ok: true, status: 'pending' }), { status: 201, headers: { 'content-type': 'application/json; charset=utf-8' } })
    : redirect(withReviewStatus(input.returnTo, 'submitted'), 303);
};
