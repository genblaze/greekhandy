import type { APIRoute } from 'astro';
import {
  appendNdjson,
  clean,
  max,
  MESSAGE_VISIBILITY_FILE_PATH,
  readNdjson,
  MESSAGE_SUBMISSIONS_FILE_PATH,
  type MessageSubmission
} from '../../../lib/messaging';
import { supabaseServer } from '../../../lib/supabase-server';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const moderationKey = clean(formData.get('moderationKey'));
  const expectedKey = process.env.PROFESSIONAL_MODERATION_KEY || '';

  if (!expectedKey || moderationKey !== expectedKey) {
    return redirect('/professionals/messages-moderation?status=unauthorized', 303);
  }

  const reportId = max(clean(formData.get('reportId')), 260);
  const action = clean(formData.get('action')) as 'hide_message' | 'dismiss_report' | 'block_sender';
  const actorIdentifier = max(clean(formData.get('actorIdentifier')) || 'admin', 120);
  const returnUrl = `/professionals/messages-moderation?key=${encodeURIComponent(moderationKey)}&actor=${encodeURIComponent(actorIdentifier)}`;

  if (!reportId || !['hide_message', 'dismiss_report', 'block_sender'].includes(action)) {
    return redirect(`${returnUrl}&status=invalid`, 303);
  }

  const { data: report, error: reportError } = await supabaseServer
    .from('message_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (reportError || !report) return redirect(`${returnUrl}&status=invalid`, 303);

  const { data: existingActions } = await supabaseServer
    .from('message_moderation_actions')
    .select('id')
    .eq('report_id', reportId)
    .limit(1);

  if (existingActions && existingActions.length > 0) return redirect(`${returnUrl}&status=ok`, 303);

  let metadata: Record<string, unknown> = {};

  try {
    if (action === 'hide_message') {
      await appendNdjson(MESSAGE_VISIBILITY_FILE_PATH, {
        threadId: report.thread_id,
        messageId: report.message_id,
        action: 'hide',
        actedAt: new Date().toISOString()
      });
    }

    if (action === 'block_sender') {
      let blockedSenderEmail = report.reported_sender_email as string | null;
      if (!blockedSenderEmail) {
        const submissions = await readNdjson<MessageSubmission>(MESSAGE_SUBMISSIONS_FILE_PATH);
        blockedSenderEmail = submissions.find((m) => m.id === report.message_id)?.senderEmail?.toLowerCase() ?? null;
      }
      if (blockedSenderEmail) metadata.blockedSenderEmail = blockedSenderEmail;
    }

    const { error: actionError } = await supabaseServer.from('message_moderation_actions').insert({
      report_id: reportId,
      action,
      message_id: report.message_id,
      thread_id: report.thread_id,
      actor_identifier: actorIdentifier,
      actor_role: 'moderator',
      metadata,
      acted_at: new Date().toISOString()
    });

    if (actionError) throw actionError;

    const { error: updateError } = await supabaseServer
      .from('message_reports')
      .update({ status: 'resolved' })
      .eq('id', reportId);

    if (updateError) throw updateError;

    return redirect(`${returnUrl}&status=ok`, 303);
  } catch (error) {
    console.error('[message-report-action] failed', error);
    return redirect(`${returnUrl}&status=error`, 303);
  }
};
