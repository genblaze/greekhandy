import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase-server';
import { getAdminAuth } from '../../../lib/admin-auth';

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const max = (value: string, limit: number) => value.slice(0, limit);
const buildReviewsModerationUrl = (params: Record<string, string | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    search.set(key, value);
  }
  return `/professionals/reviews-moderation?${search.toString()}`;
};
const resultFromStatus = (status?: string | null) => {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'pending';
};
const summaryImpactFromResult = (result: string) => (result === 'approved' ? 'included' : 'excluded');

const hasVerifiedLeadMatch = async (reviewerEmail: string, serviceSlug: string) => {
  if (!reviewerEmail || !serviceSlug) return false;

  const normalizedEmail = reviewerEmail.toLowerCase();

  const { data: bookingLead } = await supabaseServer
    .from('bookings')
    .select('id')
    .eq('customer_email', normalizedEmail)
    .eq('service_slug', serviceSlug)
    .in('status', ['confirmed', 'completed'])
    .limit(1);

  if (bookingLead && bookingLead.length > 0) return true;

  const { data: contactLead } = await supabaseServer
    .from('contact_requests')
    .select('id')
    .eq('email', normalizedEmail)
    .eq('service_slug', serviceSlug)
    .in('status', ['contacted', 'converted', 'closed'])
    .limit(1);

  return Boolean(contactLead && contactLead.length > 0);
};

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const moderationKey = clean(formData.get('moderationKey'));
  const { isAuthorized } = getAdminAuth({ request, cookies }, moderationKey);

  if (!isAuthorized) return redirect('/admin?status=unauthorized', 303);

  const action = clean(formData.get('action'));
  const reviewId = clean(formData.get('reviewId'));
  const verified = clean(formData.get('verified')) === 'true';
  const actorIdentifier = max(clean(formData.get('actorIdentifier')) || 'admin', 120);
  const baseReturnParams = {
    actor: actorIdentifier,
    key: moderationKey || null
  };
  const returnUrl = (status: string, extraParams: Record<string, string | null | undefined> = {}) =>
    buildReviewsModerationUrl({
      ...baseReturnParams,
      status,
      ...extraParams
    });

  if (!reviewId || !['approve', 'reject'].includes(action)) {
    return redirect(returnUrl('invalid'), 303);
  }

  const { data: current, error: currentError } = await supabaseServer
    .from('reviews')
    .select('id, status, verified, reviewer_email, service_slug, rating')
    .eq('id', reviewId)
    .maybeSingle();

  if (currentError) {
    console.error('[review-moderation] lookup failed', currentError);
    return redirect(returnUrl('error'), 303);
  }

  if (!current) return redirect(returnUrl('not-found'), 303);
  if (current.status !== 'pending') {
    const currentResult = resultFromStatus(current.status);
    return redirect(
      returnUrl('already-processed', {
        result: currentResult,
        summary: summaryImpactFromResult(currentResult)
      }),
      303
    );
  }

  const nextStatus = action === 'approve' ? 'approved' : 'rejected';
  const verifiedLeadMatched = action === 'approve'
    ? await hasVerifiedLeadMatch(current.reviewer_email || '', current.service_slug || '')
    : false;

  const finalVerified = action === 'approve' ? (verified && verifiedLeadMatched) : false;

  const updatePayload: Record<string, unknown> = { status: nextStatus };
  if (action === 'approve') updatePayload.verified = finalVerified;
  if (action === 'reject') updatePayload.verified = false;

  const { data: updatedRows, error: updateError } = await supabaseServer
    .from('reviews')
    .update(updatePayload)
    .eq('id', reviewId)
    .eq('status', 'pending')
    .select('id')
    .limit(1);

  if (updateError) {
    console.error('[review-moderation] update failed', updateError);
    return redirect(returnUrl('error'), 303);
  }

  if (!updatedRows || updatedRows.length === 0) {
    const { data: latestReview } = await supabaseServer
      .from('reviews')
      .select('status')
      .eq('id', reviewId)
      .maybeSingle();
    const latestResult = resultFromStatus(latestReview?.status);
    return redirect(
      returnUrl('already-processed', {
        result: latestResult,
        summary: summaryImpactFromResult(latestResult)
      }),
      303
    );
  }

  const result = resultFromStatus(nextStatus);
  const verification = action === 'approve'
    ? (finalVerified ? 'verified' : (verified ? 'requested-no-match' : 'not-requested'))
    : 'not-applicable';
  const outcomeParams = {
    result,
    summary: summaryImpactFromResult(result),
    verification
  };

  const { error: auditError } = await supabaseServer.from('review_moderation_actions').insert({
    review_id: reviewId,
    action,
    actor_identifier: actorIdentifier,
    actor_role: 'moderator',
    metadata: {
      scope: 'reviews',
      reviewId,
      previousStatus: current.status,
      nextStatus,
      verifiedRequested: verified,
      verifiedLeadMatched,
      verifiedApplied: finalVerified,
      reviewerEmail: current.reviewer_email || null,
      serviceSlug: current.service_slug || null,
      actorSource: 'reviews-moderation-ui'
    },
    acted_at: new Date().toISOString()
  });

  if (auditError) {
    console.error('[review-moderation] audit insert failed', auditError);
    return redirect(returnUrl('audit-error', outcomeParams), 303);
  }

  return redirect(returnUrl('ok', outcomeParams), 303);
};
