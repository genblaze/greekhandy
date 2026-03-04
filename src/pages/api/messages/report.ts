import type { APIRoute } from 'astro';
import { appendNdjson, clean, max, MESSAGE_REPORTS_FILE_PATH } from '../../../lib/messaging';

const withStatus = (returnTo: string, status: string) => `${returnTo}${returnTo.includes('?') ? '&' : '?'}status=${status}`;

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const threadId = max(clean(formData.get('threadId')), 220);
  const messageId = max(clean(formData.get('messageId')), 260);
  const senderEmail = max(clean(formData.get('senderEmail')).toLowerCase(), 160);
  const reason = max(clean(formData.get('reason')), 30);
  const details = max(clean(formData.get('details')), 500);
  const returnTo = clean(formData.get('returnTo')) || '/messages/thread';

  if (!threadId || !messageId || !senderEmail || !['spam', 'abuse', 'harassment', 'other'].includes(reason)) {
    return redirect(withStatus(returnTo, 'report-invalid'), 303);
  }

  try {
    await appendNdjson(MESSAGE_REPORTS_FILE_PATH, {
      id: `${messageId}|${Date.now()}`,
      threadId,
      messageId,
      senderEmail,
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
