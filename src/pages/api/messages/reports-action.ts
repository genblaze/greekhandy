import type { APIRoute } from 'astro';
import {
  MESSAGE_REPORTS_FILE_PATH,
  MESSAGE_REPORT_ACTIONS_FILE_PATH,
  MESSAGE_VISIBILITY_FILE_PATH,
  appendNdjson,
  clean,
  max,
  readNdjson,
  type MessageReport,
  type MessageReportAction
} from '../../../lib/messaging';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const moderationKey = clean(formData.get('moderationKey'));
  const expectedKey = process.env.PROFESSIONAL_MODERATION_KEY || '';

  if (!expectedKey || moderationKey !== expectedKey) {
    return redirect('/professionals/messages-moderation?status=unauthorized', 303);
  }

  const reportId = max(clean(formData.get('reportId')), 260);
  const action = clean(formData.get('action')) as MessageReportAction['action'];
  const returnUrl = `/professionals/messages-moderation?key=${encodeURIComponent(moderationKey)}`;

  if (!reportId || !['hide_message', 'dismiss_report'].includes(action)) {
    return redirect(`${returnUrl}&status=invalid`, 303);
  }

  const reports = await readNdjson<MessageReport>(MESSAGE_REPORTS_FILE_PATH);
  const report = reports.find((entry) => entry.id === reportId);
  if (!report) return redirect(`${returnUrl}&status=invalid`, 303);

  const actions = await readNdjson<MessageReportAction>(MESSAGE_REPORT_ACTIONS_FILE_PATH);
  const alreadyHandled = actions.some((entry) => entry.reportId === reportId);
  if (alreadyHandled) return redirect(`${returnUrl}&status=ok`, 303);

  try {
    if (action === 'hide_message') {
      await appendNdjson(MESSAGE_VISIBILITY_FILE_PATH, {
        threadId: report.threadId,
        messageId: report.messageId,
        action: 'hide',
        actedAt: new Date().toISOString()
      });
    }

    await appendNdjson(MESSAGE_REPORT_ACTIONS_FILE_PATH, {
      reportId,
      action,
      messageId: report.messageId,
      threadId: report.threadId,
      actedAt: new Date().toISOString()
    } satisfies MessageReportAction);

    return redirect(`${returnUrl}&status=ok`, 303);
  } catch (error) {
    console.error('[message-report-action] failed', error);
    return redirect(`${returnUrl}&status=error`, 303);
  }
};
