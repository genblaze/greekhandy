import type { APIRoute } from 'astro';
import { appendNdjson, clean, MESSAGE_VISIBILITY_FILE_PATH } from '../../../lib/messaging';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const moderationKey = clean(formData.get('moderationKey'));
  const expectedKey = process.env.PROFESSIONAL_MODERATION_KEY || '';
  const threadId = clean(formData.get('threadId'));
  const messageId = clean(formData.get('messageId'));

  if (!expectedKey || moderationKey !== expectedKey) {
    return redirect('/professionals/messages-moderation?status=unauthorized', 303);
  }

  const returnUrl = `/professionals/messages-moderation?key=${encodeURIComponent(moderationKey)}`;

  if (!threadId || !messageId) {
    return redirect(`${returnUrl}&status=invalid`, 303);
  }

  try {
    await appendNdjson(MESSAGE_VISIBILITY_FILE_PATH, {
      threadId,
      messageId,
      action: 'hide',
      actedAt: new Date().toISOString()
    });
    return redirect(`${returnUrl}&status=ok`, 303);
  } catch (error) {
    console.error('[message-hide] failed', error);
    return redirect(`${returnUrl}&status=error`, 303);
  }
};
