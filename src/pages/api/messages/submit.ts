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
import { supabaseServer } from '../../../lib/supabase-server';

export const prerender = false;

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone: string) => /^[0-9+()\-\s]{7,20}$/.test(phone);
const hasHtmlLikeTags = (value: string) => /<[^>]+>/.test(value);
const isValidSlug = (value: string) => /^[a-z0-9](?:[a-z0-9-]{0,119})$/.test(value);
const isValidThreadId = (value: string) => /^[a-z0-9|@._-]{1,220}$/.test(value);

const toSafeLogMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return 'unknown-error';
};

const wantsJson = (request: Request) => {
  const accept = request.headers.get('accept') || '';
  const contentType = request.headers.get('content-type') || '';
  const format = new URL(request.url).searchParams.get('format');
  return format === 'json' || accept.includes('application/json') || contentType.includes('application/json');
};

const jsonError = (status: number, code: string, message: string, fieldErrors?: Record<string, string>) =>
  new Response(JSON.stringify({ ok: false, error: { code, message, fieldErrors: fieldErrors || null } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });

const withMessageStatus = (returnTo: string, status: 'submitted' | 'invalid' | 'blocked' | 'error') => {
  const separator = returnTo.includes('?') ? '&' : '?';
  return `${returnTo}${separator}message=${status}`;
};

const toSafeReturnTo = (candidate: string, fallback: string) => {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  try {
    const url = new URL(candidate, 'https://greekhandy.local');
    if (url.origin !== 'https://greekhandy.local') return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
};

type MessageInput = {
  professionalSlug: string;
  returnTo: string;
  honeypot: string;
  senderEmail: string;
  senderPhone: string;
  senderName: string;
  recipientEmail: string;
  incomingThreadId: string;
  messageBody: string;
};

const extractInput = async (request: Request): Promise<MessageInput> => {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const professionalSlug = max(clean(body.professionalSlug), 120);
    const fallbackReturnTo = professionalSlug ? `/professionals/${professionalSlug}` : '/professionals';

    return {
      professionalSlug,
      returnTo: toSafeReturnTo(clean(body.returnTo), fallbackReturnTo),
      honeypot: clean(body.website),
      senderEmail: max(clean(body.senderEmail).toLowerCase(), 160),
      senderPhone: max(clean(body.senderPhone), 40),
      senderName: max(clean(body.senderName), 120),
      recipientEmail: max(clean(body.recipientEmail).toLowerCase(), 160),
      incomingThreadId: max(clean(body.threadId), 220),
      messageBody: max(clean(body.message), 2000)
    };
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(await request.text());
    const professionalSlug = max(clean(params.get('professionalSlug')), 120);
    const fallbackReturnTo = professionalSlug ? `/professionals/${professionalSlug}` : '/professionals';

    return {
      professionalSlug,
      returnTo: toSafeReturnTo(clean(params.get('returnTo')), fallbackReturnTo),
      honeypot: clean(params.get('website')),
      senderEmail: max(clean(params.get('senderEmail')).toLowerCase(), 160),
      senderPhone: max(clean(params.get('senderPhone')), 40),
      senderName: max(clean(params.get('senderName')), 120),
      recipientEmail: max(clean(params.get('recipientEmail')).toLowerCase(), 160),
      incomingThreadId: max(clean(params.get('threadId')), 220),
      messageBody: max(clean(params.get('message')), 2000)
    };
  }

  const formData = await request.formData();
  const professionalSlug = max(clean(formData.get('professionalSlug')), 120);
  const fallbackReturnTo = professionalSlug ? `/professionals/${professionalSlug}` : '/professionals';

  return {
    professionalSlug,
    returnTo: toSafeReturnTo(clean(formData.get('returnTo')), fallbackReturnTo),
    honeypot: clean(formData.get('website')),
    senderEmail: max(clean(formData.get('senderEmail')).toLowerCase(), 160),
    senderPhone: max(clean(formData.get('senderPhone')), 40),
    senderName: max(clean(formData.get('senderName')), 120),
    recipientEmail: max(clean(formData.get('recipientEmail')).toLowerCase(), 160),
    incomingThreadId: max(clean(formData.get('threadId')), 220),
    messageBody: max(clean(formData.get('message')), 2000)
  };
};

const validateInput = (input: MessageInput) => {
  const fieldErrors: Record<string, string> = {};

  if (!input.professionalSlug || !isValidSlug(input.professionalSlug)) {
    fieldErrors.professionalSlug = 'Μη έγκυρο προφίλ επαγγελματία.';
  }
  if (!input.senderName || hasHtmlLikeTags(input.senderName)) {
    fieldErrors.senderName = 'Μη έγκυρο ονοματεπώνυμο.';
  }
  if (!input.senderEmail || !isValidEmail(input.senderEmail)) {
    fieldErrors.senderEmail = 'Μη έγκυρο email αποστολέα.';
  }
  if (!input.recipientEmail || !isValidEmail(input.recipientEmail)) {
    fieldErrors.recipientEmail = 'Μη έγκυρο email παραλήπτη.';
  }
  if (input.senderPhone && !isValidPhone(input.senderPhone)) {
    fieldErrors.senderPhone = 'Μη έγκυρος αριθμός τηλεφώνου.';
  }
  if (!input.messageBody || hasHtmlLikeTags(input.messageBody)) {
    fieldErrors.message = 'Μη έγκυρο κείμενο μηνύματος.';
  }
  if (input.senderEmail && input.recipientEmail && input.senderEmail === input.recipientEmail) {
    fieldErrors.senderEmail = 'Ο αποστολέας και ο παραλήπτης δεν μπορεί να είναι ίδιοι.';
  }
  if (input.incomingThreadId && (!isValidThreadId(input.incomingThreadId) || hasHtmlLikeTags(input.incomingThreadId))) {
    fieldErrors.threadId = 'Μη έγκυρο thread identifier.';
  }

  return fieldErrors;
};

const isThreadBlocked = async (threadId: string, senderEmail: string) => {
  try {
    const actions = await readNdjson<{ threadId?: string; action?: string }>(MESSAGE_TRIAGE_ACTIONS_FILE_PATH);
    const latestActionByThread = new Map<string, string>();
    for (const action of actions) {
      if (action.threadId && action.action) latestActionByThread.set(action.threadId, action.action);
    }
    if (latestActionByThread.get(threadId) === 'block') return true;
  } catch (error) {
    console.warn('[message-submit] local triage read failed', toSafeLogMessage(error));
  }

  try {
    const { data: moderationActions, error } = await supabaseServer
      .from('message_moderation_actions')
      .select('action, metadata, thread_id')
      .eq('thread_id', threadId)
      .in('action', ['block', 'block_sender']);

    if (error) {
      console.warn('[message-submit] moderation lookup failed', error.message);
      return false;
    }

    if (!moderationActions || moderationActions.length === 0) return false;

    for (const row of moderationActions as Array<{ action: string; metadata?: { blockedSenderEmail?: string } }>) {
      if (row.action === 'block') return true;
      if (row.action === 'block_sender') {
        const blocked = (row.metadata?.blockedSenderEmail || '').toLowerCase();
        if (blocked && blocked === senderEmail.toLowerCase()) return true;
      }
    }
  } catch (error) {
    console.warn('[message-submit] moderation lookup crashed', toSafeLogMessage(error));
  }

  return false;
};

export const POST: APIRoute = async ({ request, redirect }) => {
  const asJson = wantsJson(request);

  let input: MessageInput;
  try {
    input = await extractInput(request);
  } catch {
    return asJson
      ? jsonError(400, 'INVALID_BODY', 'Το σώμα του αιτήματος δεν είναι έγκυρο.')
      : redirect('/professionals?message=invalid', 303);
  }

  if (input.honeypot) {
    return asJson
      ? jsonError(422, 'VALIDATION_ERROR', 'Το αίτημα απορρίφθηκε ως μη έγκυρο.', { website: 'Μη επιτρεπτό πεδίο.' })
      : redirect(withMessageStatus(input.returnTo, 'invalid'), 303);
  }

  const fieldErrors = validateInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return asJson
      ? jsonError(422, 'VALIDATION_ERROR', 'Υπάρχουν σφάλματα σε πεδία.', fieldErrors)
      : redirect(withMessageStatus(input.returnTo, 'invalid'), 303);
  }

  const canonicalThreadId = normalizeConversationId(input.professionalSlug, input.senderEmail, input.recipientEmail);
  if (input.incomingThreadId && input.incomingThreadId !== canonicalThreadId) {
    return asJson
      ? jsonError(422, 'VALIDATION_ERROR', 'Μη έγκυρο thread identifier.', { threadId: 'Το thread δεν αντιστοιχεί στους συμμετέχοντες.' })
      : redirect(withMessageStatus(input.returnTo, 'invalid'), 303);
  }

  try {
    const existing = (await readNdjson<MessageSubmission>(MESSAGE_SUBMISSIONS_FILE_PATH)).filter((message) => message.threadId === canonicalThreadId);

    if (existing.length > 0) {
      const participants = getParticipantSet(existing);
      if (!participants.has(input.senderEmail) || !participants.has(input.recipientEmail)) {
        return asJson
          ? jsonError(422, 'VALIDATION_ERROR', 'Το thread δεν επιτρέπει αυτούς τους συμμετέχοντες.', { threadId: 'Μη έγκυροι συμμετέχοντες.' })
          : redirect(withMessageStatus(input.returnTo, 'invalid'), 303);
      }
    }

    if (await isThreadBlocked(canonicalThreadId, input.senderEmail)) {
      return asJson
        ? jsonError(403, 'THREAD_BLOCKED', 'Η συνομιλία έχει μπλοκαριστεί από moderation.')
        : redirect(withMessageStatus(input.returnTo, 'blocked'), 303);
    }

    const submission: MessageSubmission = {
      id: `${canonicalThreadId}|${Date.now()}`,
      threadId: canonicalThreadId,
      professionalSlug: input.professionalSlug,
      senderName: input.senderName,
      senderEmail: input.senderEmail,
      senderPhone: input.senderPhone,
      recipientEmail: input.recipientEmail,
      message: input.messageBody,
      status: 'pending',
      submittedAt: new Date().toISOString()
    };

    await appendNdjson(MESSAGE_SUBMISSIONS_FILE_PATH, submission);

    return asJson
      ? new Response(JSON.stringify({ ok: true, threadId: canonicalThreadId, status: 'pending' }), {
        status: 201,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      })
      : redirect(withMessageStatus(input.returnTo, 'submitted'), 303);
  } catch (error) {
    console.error(`[message-submit] failed: ${toSafeLogMessage(error)}`);

    return asJson
      ? jsonError(500, 'MESSAGE_SUBMIT_FAILED', 'Αδυναμία υποβολής μηνύματος αυτή τη στιγμή.')
      : redirect(withMessageStatus(input.returnTo, 'error'), 303);
  }
};
