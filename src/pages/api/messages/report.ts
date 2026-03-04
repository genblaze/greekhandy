import type { APIRoute } from 'astro';
import {
  appendNdjson,
  clean,
  max,
  MESSAGE_REPORTS_FILE_PATH,
  MESSAGE_SUBMISSIONS_FILE_PATH,
  readNdjson,
  type MessageSubmission
} from '../../../lib/messaging';

const withStatus = (returnTo: string, status: string) => `${returnTo}${returnTo.includes('?') ? '&' : '?'}status=${status}`;

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const threadId = max(clean(formData.get('threadId')), 220);
  const messageId = max(clean(formData.get('messageId')), 260);
  const reporterEmail = max(clean(formData.get('senderEmail')).toLowerCase(), 160);
  const reason = max(clean(formData.get('reason')), 30);
  const details = max(clean(formData.get('details')), 500);
  const returnTo = clean(formData.get('returnTo')) || '/messages/thread';

  if (!threadId || !messageId || !reporterEmail || !['spam', 'abuse', 'harassment', 'other'].includes(reason)) {
    return redirect(withStatus(returnTo, 'report-invalid'), 303);
  }

  const threadMessages = (await readNdjson<MessageSubmission>(MESSAGE_SUBMISSIONS_FILE_PATH)).filter((entry) => entry.threadId === threadId);
  const targetMessage = threadMessages.find((entry) => entry.id === messageId);
  const isParticipant = threadMessages.some(
    (entry) => entry.senderEmail.toLowerCase() === reporterEmail || entry.recipientEmail.toLowerCase() === reporterEmail
  );

  if (!targetMessage || !isParticipant) {
    return redirect(withStatus(returnTo, 'report-forbidden'), 303);
  }

  try {
    await appendNdjson(MESSAGE_REPORTS_FILE_PATH, {
      id: `${messageId}|${Date.now()}`,
      threadId,
      messageId,
      reporterEmail,
      reason,
      details,
      status: 'open',
      reportedAt: new Date().toISOString()
    });

    return redirect(withStatus(returnTo, 'reported'), 303);
  } catch (error) {
    console.error('[message-report] failed', error);
    return redirect(withStatus(returnTo, 'report-error'), 303);
  }
};
