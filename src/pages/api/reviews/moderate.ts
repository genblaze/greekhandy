import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase-server';
import { getAdminAuth } from '../../../lib/admin-auth';

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const max = (value: string, limit: number) => value.slice(0, limit);

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
    .select('id, status, verified')
    .eq('id', reviewId)
    .maybeSingle();

  if (currentError) {
    console.error('[review-moderation] lookup failed', currentError);
    return redirect(`${returnUrl}&status=error`, 303);
  }

  if (!current) return redirect(`${returnUrl}&status=not-found`, 303);
  if (current.status !== 'pending') return redirect(`${returnUrl}&status=already-processed`, 303);

  const nextStatus = action === 'approve' ? 'approved' : 'rejected';
  const updatePayload: Record<string, unknown> = { status: nextStatus };
  if (action === 'approve') updatePayload.verified = verified;
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
