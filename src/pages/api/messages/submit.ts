import type { APIRoute } from 'astro';
import {
  appendNdjson,
  clean,
  getParticipantSet,
  max,
  MESSAGE_SUBMISSIONS_FILE_PATH,
  MESSAGE_TRIAGE_ACTIONS_FILE_PATH,
  normalizeConversationId,
  readNdjson,
  type MessageSubmission
} from '../../../lib/messaging';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone: string) => /^[0-9+()\-\s]{7,20}$/.test(phone);
const hasHtmlLikeTags = (value: string) => /<[^>]+>/.test(value);

const isThreadBlocked = async (threadId: string) => {
  const actions = await readNdjson<{ threadId?: string; action?: string }>(MESSAGE_TRIAGE_ACTIONS_FILE_PATH);
  const latestActionByThread = new Map<string, string>();
  for (const action of actions) {
    if (action.threadId && action.action) latestActionByThread.set(action.threadId, action.action);
  }
  return latestActionByThread.get(threadId) === 'block';
};

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const professionalSlug = max(clean(formData.get('professionalSlug')), 120);
  const returnTo = clean(formData.get('returnTo')) || `/professionals/${professionalSlug}`;

  if (clean(formData.get('website'))) return redirect(`${returnTo}?message=invalid`, 303);

  const senderEmail = max(clean(formData.get('senderEmail')).toLowerCase(), 160);
  const senderPhone = max(clean(formData.get('senderPhone')), 40);
  const senderName = max(clean(formData.get('senderName')), 120);
  const recipientEmail = max(clean(formData.get('recipientEmail')).toLowerCase(), 160);
  const incomingThreadId = max(clean(formData.get('threadId')), 220);

  const canonicalThreadId = normalizeConversationId(professionalSlug, senderEmail, recipientEmail);
  const threadId = canonicalThreadId;
  const messageBody = max(clean(formData.get('message')), 2000);

  if (
    !threadId ||
    !professionalSlug ||
    !senderName ||
    !senderEmail ||
    !recipientEmail ||
    !messageBody ||
    !isValidEmail(senderEmail) ||
    !isValidEmail(recipientEmail) ||
    (senderPhone && !isValidPhone(senderPhone)) ||
    hasHtmlLikeTags(messageBody)
  ) {
    return redirect(`${returnTo}?message=invalid`, 303);
  }

  if (incomingThreadId && incomingThreadId !== canonicalThreadId) {
    return redirect(`${returnTo}?message=invalid`, 303);
  }

  const existing = (await readNdjson<MessageSubmission>(MESSAGE_SUBMISSIONS_FILE_PATH)).filter((message) => message.threadId === threadId);

  if (existing.length > 0) {
    const participants = getParticipantSet(existing);
    if (!participants.has(senderEmail) || !participants.has(recipientEmail)) {
      return redirect(`${returnTo}?message=invalid`, 303);
    }
  }

  if (await isThreadBlocked(threadId)) {
    return redirect(`${returnTo}?message=blocked`, 303);
  }

  const submission: MessageSubmission = {
    id: `${threadId}|${Date.now()}`,
    threadId,
    professionalSlug,
    senderName,
    senderEmail,
    senderPhone,
    recipientEmail,
    message: messageBody,
    status: 'pending',
    submittedAt: new Date().toISOString()
  };

  try {
    await appendNdjson(MESSAGE_SUBMISSIONS_FILE_PATH, submission);
    return redirect(`${returnTo}?message=submitted`, 303);
  } catch (error) {
    console.error('[message-submit] failed', error);
    return redirect(`${returnTo}?message=error`, 303);
  }
};
