import type { APIRoute } from 'astro';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SUBMISSIONS_FILE_PATH = resolve(process.cwd(), 'data', 'message-submissions.ndjson');
const ACTIONS_FILE_PATH = resolve(process.cwd(), 'data', 'message-triage-actions.ndjson');

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const max = (value: string, limit: number) => value.slice(0, limit);

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone: string) => /^[0-9+()\-\s]{7,20}$/.test(phone);
const hasHtmlLikeTags = (value: string) => /<[^>]+>/.test(value);

const isThreadBlocked = async (threadId: string) => {
  try {
    const raw = await readFile(ACTIONS_FILE_PATH, 'utf-8');
    const latestActionByThread = new Map<string, string>();

    for (const line of raw.split('\n').map((entry) => entry.trim()).filter(Boolean)) {
      const parsed = JSON.parse(line) as { threadId?: string; action?: string };
      if (parsed.threadId && parsed.action) latestActionByThread.set(parsed.threadId, parsed.action);
    }

    return latestActionByThread.get(threadId) === 'block';
  } catch {
    return false;
  }
};

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const professionalSlug = max(clean(formData.get('professionalSlug')), 120);
  const returnTo = clean(formData.get('returnTo')) || `/professionals/${professionalSlug}`;

  if (clean(formData.get('website'))) {
    return redirect(`${returnTo}?message=invalid`, 303);
  }

  const senderEmail = max(clean(formData.get('senderEmail')).toLowerCase(), 160);
  const senderPhone = max(clean(formData.get('senderPhone')), 40);
  const threadId = max(clean(formData.get('threadId')), 220) || `${professionalSlug}|${senderEmail}`;

  const submission = {
    id: `${threadId}|${Date.now()}`,
    threadId,
    professionalSlug,
    senderName: max(clean(formData.get('senderName')), 120),
    senderEmail,
    senderPhone,
    message: max(clean(formData.get('message')), 2000),
    status: 'pending',
    submittedAt: new Date().toISOString()
  };

  if (
    !submission.threadId ||
    !submission.professionalSlug ||
    !submission.senderName ||
    !submission.senderEmail ||
    !submission.message ||
    !isValidEmail(submission.senderEmail) ||
    (submission.senderPhone && !isValidPhone(submission.senderPhone)) ||
    hasHtmlLikeTags(submission.message)
  ) {
    return redirect(`${returnTo}?message=invalid`, 303);
  }

  if (await isThreadBlocked(submission.threadId)) {
    return redirect(`${returnTo}?message=blocked`, 303);
  }

  try {
    await mkdir(dirname(SUBMISSIONS_FILE_PATH), { recursive: true });
    await appendFile(SUBMISSIONS_FILE_PATH, `${JSON.stringify(submission)}\n`, 'utf-8');

    return redirect(`${returnTo}?message=submitted`, 303);
  } catch (error) {
    console.error('[message-submit] failed', error);
    return redirect(`${returnTo}?message=error`, 303);
  }
};
