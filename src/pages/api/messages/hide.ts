import type { APIRoute } from 'astro';
import { appendNdjson, clean, MESSAGE_VISIBILITY_FILE_PATH } from '../../../lib/messaging';
import { supabaseServer } from '../../../lib/supabase-server';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const moderationKey = clean(formData.get('moderationKey'));
  const expectedKey = process.env.PROFESSIONAL_MODERATION_KEY || '';
  const threadId = clean(formData.get('threadId'));
  const messageId = clean(formData.get('messageId'));
  const actorIdentifier = clean(formData.get('actorIdentifier')) || 'admin';

  if (!expectedKey || moderationKey !== expectedKey) {
    return redirect('/professionals/messages-moderation?status=unauthorized', 303);
  }

  const returnUrl = `/professionals/messages-moderation?key=${encodeURIComponent(moderationKey)}&actor=${encodeURIComponent(actorIdentifier)}`;

  if (!threadId || !messageId) {
    return redirect(`${returnUrl}&status=invalid`, 303);
  }

  try {
    await appendNdjson(MESSAGE_VISIBILITY_FILE_PATH, {
      threadId,
      messageId,
      action: 'hide',
      actedAt: new Date().toISOString(),
      actorIdentifier
    });

    await supabaseServer.from('message_moderation_actions').insert({
      thread_id: threadId,
      message_id: messageId,
      action: 'hide_latest_message',
      actor_identifier: actorIdentifier,
      actor_role: 'moderator',
      metadata: {},
      acted_at: new Date().toISOString()
    });

    return redirect(`${returnUrl}&status=ok`, 303);
  } catch (error) {
    console.error('[message-hide] failed', error);
    return redirect(`${returnUrl}&status=error`, 303);
  }
};
