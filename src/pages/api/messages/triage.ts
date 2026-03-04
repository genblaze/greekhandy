import type { APIRoute } from 'astro';
import { appendNdjson, clean, MESSAGE_TRIAGE_ACTIONS_FILE_PATH } from '../../../lib/messaging';
import { supabaseServer } from '../../../lib/supabase-server';
import { getAdminAuth } from '../../../lib/admin-auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const moderationKey = clean(formData.get('moderationKey'));
  const { isAuthorized } = getAdminAuth({ request, cookies }, moderationKey);

  if (!isAuthorized) {
    return redirect('/admin?status=unauthorized', 303);
  }

  const action = clean(formData.get('action'));
  const threadId = clean(formData.get('threadId'));
  const actorIdentifier = clean(formData.get('actorIdentifier')) || 'admin';
  const returnUrl = `/professionals/messages-moderation?actor=${encodeURIComponent(actorIdentifier)}`;

  if (!threadId || !['review', 'reject', 'block'].includes(action)) {
    return redirect(`${returnUrl}&status=invalid`, 303);
  }

  try {
    await appendNdjson(MESSAGE_TRIAGE_ACTIONS_FILE_PATH, { threadId, action, actedAt: new Date().toISOString(), actorIdentifier });

    const { error } = await supabaseServer.from('message_moderation_actions').insert({
      report_id: null,
      thread_id: threadId,
      message_id: null,
      action,
      actor_identifier: actorIdentifier,
      actor_role: 'moderator',
      metadata: {},
      acted_at: new Date().toISOString()
    });

    if (error) throw error;

    return redirect(`${returnUrl}&status=ok`, 303);
  } catch (error) {
    console.error('[message-triage] failed', error);
    return redirect(`${returnUrl}&status=error`, 303);
  }
};
