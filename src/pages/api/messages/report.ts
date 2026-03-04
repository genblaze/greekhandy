import type { APIRoute } from 'astro';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const REPORTS_FILE_PATH = resolve(process.cwd(), 'data', 'message-reports.ndjson');

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const max = (value: string, limit: number) => value.slice(0, limit);

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const threadId = max(clean(formData.get('threadId')), 220);
  const messageId = max(clean(formData.get('messageId')), 260);
  const senderEmail = max(clean(formData.get('senderEmail')).toLowerCase(), 160);
  const reason = max(clean(formData.get('reason')), 30);
  const details = max(clean(formData.get('details')), 500);
  const returnTo = clean(formData.get('returnTo')) || '/messages/thread';

  if (!threadId || !messageId || !senderEmail || !['spam', 'abuse', 'harassment', 'other'].includes(reason)) {
    return redirect(`${returnTo}&status=report-invalid`, 303);
  }

  try {
    await mkdir(dirname(REPORTS_FILE_PATH), { recursive: true });
    await appendFile(
      REPORTS_FILE_PATH,
      `${JSON.stringify({
        id: `${messageId}|${Date.now()}`,
        threadId,
        messageId,
        senderEmail,
        reason,
        details,
        status: 'open',
        reportedAt: new Date().toISOString()
      })}\n`,
      'utf-8'
    );

    return redirect(`${returnTo}&status=reported`, 303);
  } catch (error) {
    console.error('[message-report] failed', error);
    return redirect(`${returnTo}&status=report-error`, 303);
  }
};
