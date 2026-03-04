import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase-server';
import { getAdminAuth } from '../../../lib/admin-auth';

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const max = (value: string, limit: number) => value.slice(0, limit);

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
  const returnUrl = `/professionals/reviews-moderation?actor=${encodeURIComponent(actorIdentifier)}`;

  if (!reviewId || !['approve', 'reject'].includes(action)) {
    return redirect(`${returnUrl}&status=invalid`, 303);
  }

  const { data: current, error: currentError } = await supabaseServer
    .from('reviews')
    .select('id, status, verified, reviewer_email, service_slug, rating')
    .eq('id', reviewId)
    .maybeSingle();

  if (currentError) {
    console.error('[review-moderation] lookup failed', currentError);
    return redirect(`${returnUrl}&status=error`, 303);
  }

  if (!current) return redirect(`${returnUrl}&status=not-found`, 303);
  if (current.status !== 'pending') return redirect(`${returnUrl}&status=already-processed`, 303);

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
    return redirect(`${returnUrl}&status=error`, 303);
  }

  if (!updatedRows || updatedRows.length === 0) {
    return redirect(`${returnUrl}&status=already-processed`, 303);
  }

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
    return redirect(`${returnUrl}&status=audit-error`, 303);
  }

  return redirect(`${returnUrl}&status=ok`, 303);
};
