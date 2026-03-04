import type { APIRoute } from 'astro';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  BOOKING_ACTIONS_FILE_PATH,
  BOOKING_SUBMISSIONS_FILE_PATH,
  findLatestBookingAction,
  getBookingId,
  readNdjson,
  resolveBookingModerationState,
  type BookingAction,
  type BookingSubmission
} from '../../../lib/bookings';

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const bookingId = clean(formData.get('bookingId'));
  const email = clean(formData.get('email')).toLowerCase();
  const requestedAction = clean(formData.get('requestedAction'));
  const returnTo = clean(formData.get('returnTo'));
  const safeReturnTo = returnTo.startsWith('/bookings/request') ? returnTo : `/bookings/request?bookingId=${encodeURIComponent(bookingId)}`;

  if (!bookingId || !email || requestedAction !== 'reschedule') {
    return redirect(`${safeReturnTo}&status=invalid`, 303);
  }

  try {
    const submissions = await readNdjson<BookingSubmission>(BOOKING_SUBMISSIONS_FILE_PATH);
    const booking = submissions.find((entry) => getBookingId(entry) === bookingId);
    if (!booking || (booking.email || '').trim().toLowerCase() !== email) {
      return redirect(`${safeReturnTo}&status=invalid`, 303);
    }

    const actions = await readNdjson<BookingAction>(BOOKING_ACTIONS_FILE_PATH);
    const latestAction = findLatestBookingAction(actions, bookingId);
    const state = resolveBookingModerationState({ action: latestAction?.action, submissionStatus: booking.status }).state;

    if (state !== 'approved') {
      return redirect(`${safeReturnTo}&status=reschedule-not-allowed`, 303);
    }

    await mkdir(dirname(BOOKING_ACTIONS_FILE_PATH), { recursive: true });
    await appendFile(
      BOOKING_ACTIONS_FILE_PATH,
      `${JSON.stringify({ bookingId, action: 'reschedule_requested', actedAt: new Date().toISOString() })}\n`,
      'utf-8'
    );

    return redirect(`${safeReturnTo}&status=reschedule-requested`, 303);
  } catch (error) {
    console.error('[booking-request-update] failed', error);
    return redirect(`${safeReturnTo}&status=error`, 303);
  }
};
