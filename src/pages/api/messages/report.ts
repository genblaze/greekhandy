import type { APIRoute } from 'astro';
import {
  clean,
  max,
  MESSAGE_SUBMISSIONS_FILE_PATH,
  getMessageThreadId,
  readNdjson,
  type MessageSubmission
} from '../../../lib/messaging';
import { supabaseServer } from '../../../lib/supabase-server';

const withStatus = (returnTo: string, status: string) => `${returnTo}${returnTo.includes('?') ? '&' : '?'}status=${status}`;
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const threadId = max(clean(formData.get('threadId')), 220);
  const messageId = max(clean(formData.get('messageId')), 260);
  const reporterEmail = max(clean(formData.get('senderEmail')).toLowerCase(), 160);
  const reason = max(clean(formData.get('reason')), 30);
  const details = max(clean(formData.get('details')), 500);
  const returnTo = clean(formData.get('returnTo')) || '/messages/thread';

  if (!threadId || !messageId || !reporterEmail || !isValidEmail(reporterEmail) || !['spam', 'abuse', 'harassment', 'other'].includes(reason)) {
    return redirect(withStatus(returnTo, 'report-invalid'), 303);
  }

  const threadMessages = (await readNdjson<MessageSubmission>(MESSAGE_SUBMISSIONS_FILE_PATH)).filter((entry) => getMessageThreadId(entry) === threadId);
  const targetMessage = threadMessages.find((entry) => entry.id === messageId);
  const isParticipant = threadMessages.some(
    (entry) => entry.senderEmail.toLowerCase() === reporterEmail || entry.recipientEmail.toLowerCase() === reporterEmail
  );

  if (!targetMessage || !isParticipant || targetMessage.senderEmail.toLowerCase() === reporterEmail) {
    return redirect(withStatus(returnTo, 'report-forbidden'), 303);
  }

  const reportId = `${messageId}|${Date.now()}`;

  const { error } = await supabaseServer.from('message_reports').insert({
    id: reportId,
    thread_id: threadId,
    message_id: messageId,
    reporter_email: reporterEmail,
    reported_sender_email: targetMessage.senderEmail.toLowerCase(),
    reason,
    details,
    status: 'open',
    reported_at: new Date().toISOString()
  });

  if (error) {
    console.error('[message-report] failed', error);
    return redirect(withStatus(returnTo, 'report-error'), 303);
  }

  return redirect(withStatus(returnTo, 'reported'), 303);
};
