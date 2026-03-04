import type { APIRoute } from 'astro';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const ACTIONS_FILE_PATH = resolve(process.cwd(), 'data', 'message-triage-actions.ndjson');

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const moderationKey = clean(formData.get('moderationKey'));
  const expectedKey = process.env.PROFESSIONAL_MODERATION_KEY || '';

  if (!expectedKey || moderationKey !== expectedKey) {
    return redirect('/professionals/messages-moderation?status=unauthorized', 303);
  }

  const action = clean(formData.get('action'));
  const threadId = clean(formData.get('threadId'));
  const returnUrl = `/professionals/messages-moderation?key=${encodeURIComponent(moderationKey)}`;

  if (!threadId || !['review', 'reject', 'block'].includes(action)) {
    return redirect(`${returnUrl}&status=invalid`, 303);
  }

  try {
    await mkdir(dirname(ACTIONS_FILE_PATH), { recursive: true });
    await appendFile(
      ACTIONS_FILE_PATH,
      `${JSON.stringify({ threadId, action, actedAt: new Date().toISOString() })}\n`,
      'utf-8'
    );

    return redirect(`${returnUrl}&status=ok`, 303);
  } catch (error) {
    console.error('[message-triage] failed', error);
    return redirect(`${returnUrl}&status=error`, 303);
  }
};
