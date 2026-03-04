import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase-server';
import { getAdminAuth } from '../../../lib/admin-auth';

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const moderationKey = clean(formData.get('moderationKey'));
  const { isAuthorized } = getAdminAuth({ request, cookies }, moderationKey);

  if (!isAuthorized) {
    return redirect('/admin?status=unauthorized', 303);
  }

  const action = clean(formData.get('action'));
  const reviewId = clean(formData.get('reviewId'));
  const verified = clean(formData.get('verified')) === 'true';
  const actorIdentifier = clean(formData.get('actorIdentifier')) || 'admin';
  const returnUrl = `/professionals/reviews-moderation?actor=${encodeURIComponent(actorIdentifier)}`;

  if (!reviewId || !['approve', 'reject'].includes(action)) {
    return redirect(`${returnUrl}&status=invalid`, 303);
  }

  const nextStatus = action === 'approve' ? 'approved' : 'rejected';
  const { error } = await supabaseServer.from('reviews').update({ status: nextStatus }).eq('id', reviewId);

  if (error) {
    console.error('[review-moderation] failed', error);
    return redirect(`${returnUrl}&status=error`, 303);
  }

  if (action === 'approve' && verified) {
    // keep audit consistency in moderation logs table
    await supabaseServer.from('message_moderation_actions').insert({
      report_id: null,
      thread_id: `reviews|${reviewId}`,
      message_id: reviewId,
      action: 'review',
      actor_identifier: actorIdentifier,
      actor_role: 'moderator',
      metadata: { scope: 'reviews', reviewId, verified: true },
      acted_at: new Date().toISOString()
    });
  }

  return redirect(`${returnUrl}&status=ok`, 303);
};
