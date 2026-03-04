import type { APIRoute } from 'astro';
import {
  clean,
  MESSAGE_READ_STATE_FILE_PATH,
  MESSAGE_SUBMISSIONS_FILE_PATH,
  getMessageThreadId,
  readNdjson,
  writeNdjson,
  type MessageReadState,
  type MessageSubmission
} from '../../../lib/messaging';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const threadId = clean(formData.get('threadId'));
  const viewerEmail = clean(formData.get('viewerEmail')).toLowerCase();
  const returnTo = clean(formData.get('returnTo')) || '/messages';

  if (!threadId || !viewerEmail) return redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}status=invalid`, 303);

  try {
    const threadMessages = (await readNdjson<MessageSubmission>(MESSAGE_SUBMISSIONS_FILE_PATH)).filter((message) => getMessageThreadId(message) === threadId);
    const isParticipant = threadMessages.some(
      (message) => message.senderEmail.toLowerCase() === viewerEmail || message.recipientEmail.toLowerCase() === viewerEmail
    );

    if (!isParticipant) return redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}status=forbidden`, 303);

    const states = await readNdjson<MessageReadState>(MESSAGE_READ_STATE_FILE_PATH);
    const next = states.filter((entry) => !(entry.threadId === threadId && entry.viewerEmail === viewerEmail));
    const lastReadAt = threadMessages.at(-1)?.submittedAt || new Date().toISOString();
    next.push({ threadId, viewerEmail, lastReadAt });
    await writeNdjson(MESSAGE_READ_STATE_FILE_PATH, next);
    return redirect(returnTo, 303);
  } catch (error) {
    console.error('[message-read] failed', error);
    return redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}status=error`, 303);
  }
};
