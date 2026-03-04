import type { APIRoute } from 'astro';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  BOOKING_ACTIONS_FILE_PATH,
  findLatestBookingAction,
  readNdjson,
  resolveBookingModerationState,
  type BookingAction
} from '../../../lib/bookings';

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const moderationKey = clean(formData.get('moderationKey'));
  const expectedKey = process.env.PROFESSIONAL_MODERATION_KEY || '';

  if (!expectedKey || moderationKey !== expectedKey) {
    return redirect('/professionals/bookings-moderation?status=unauthorized', 303);
  }

  const action = clean(formData.get('action'));
  const bookingId = clean(formData.get('bookingId'));
  const returnUrl = `/professionals/bookings-moderation?key=${encodeURIComponent(moderationKey)}`;

  if (!bookingId || !action || !['approve', 'reject'].includes(action)) {
    return redirect(`${returnUrl}&status=invalid`, 303);
  }

  try {
    const actions = await readNdjson<BookingAction>(BOOKING_ACTIONS_FILE_PATH);
    const latestAction = findLatestBookingAction(actions, bookingId);

    const currentState = resolveBookingModerationState({
      action: latestAction?.action
    }).state;
    if (currentState !== 'pending') {
      return redirect(`${returnUrl}&status=already-processed`, 303);
    }

    await mkdir(dirname(BOOKING_ACTIONS_FILE_PATH), { recursive: true });
    await appendFile(
      BOOKING_ACTIONS_FILE_PATH,
      `${JSON.stringify({ bookingId, action, actedAt: new Date().toISOString() })}\n`,
      'utf-8'
    );

    return redirect(`${returnUrl}&status=ok`, 303);
  } catch (error) {
    console.error('[booking-moderation] failed', error);
    return redirect(`${returnUrl}&status=error`, 303);
  }
};
