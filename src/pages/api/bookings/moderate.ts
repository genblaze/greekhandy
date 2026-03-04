import type { APIRoute } from 'astro';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  BOOKING_ACTIONS_FILE_PATH,
  findLatestBookingAction,
  readNdjson,
  resolveBookingModerationState,
  type BookingAction,
  type BookingModerationState
} from '../../../lib/bookings';

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const short = (value: string, max = 80) => encodeURIComponent(value.slice(0, max));

const isState = (value: string): value is BookingModerationState => ['pending', 'approved', 'rejected', 'cancelled', 'reschedule_requested', 'reschedule_rejected'].includes(value);

const toTargetState = (inputAction: string, inputTargetState: string): BookingModerationState | null => {
  if (isState(inputTargetState)) return inputTargetState;
  if (inputAction === 'approve') return 'approved';
  if (inputAction === 'reject') return 'rejected';
  if (inputAction === 'cancel') return 'cancelled';
  if (inputAction === 'request-reschedule') return 'reschedule_requested';
  if (inputAction === 'reject-reschedule') return 'reschedule_rejected';
  if (inputAction === 'reset') return 'pending';
  return null;
};

const isAllowedTransition = (from: BookingModerationState, to: BookingModerationState) => {
  if (from === to) return true;
  if (from === 'pending') return ['approved', 'rejected', 'cancelled'].includes(to);
  if (from === 'approved') return ['reschedule_requested'].includes(to);
  if (from === 'reschedule_requested') return ['approved', 'reschedule_rejected', 'cancelled'].includes(to);
  return false;
};

const transitionGuardrailReason = (from: BookingModerationState, to: BookingModerationState) => {
  if (to === 'reschedule_requested' && from !== 'approved') return 'reschedule-request-only-from-approved';
  if (from === 'reschedule_requested' && !['approved', 'reschedule_rejected', 'cancelled'].includes(to)) return 'invalid-reschedule-resolution';
  return 'invalid-transition';
};

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const moderationKey = clean(formData.get('moderationKey'));
  const expectedKey = process.env.PROFESSIONAL_MODERATION_KEY || '';

  if (!expectedKey || moderationKey !== expectedKey) {
    return redirect('/professionals/bookings-moderation?status=unauthorized', 303);
  }

  const action = clean(formData.get('action'));
  const targetState = toTargetState(action, clean(formData.get('targetState')));
  const expectedState = clean(formData.get('expectedState'));
  const bookingId = clean(formData.get('bookingId'));
  const returnUrl = `/professionals/bookings-moderation?key=${encodeURIComponent(moderationKey)}`;

  if (!bookingId || !targetState || !expectedState || !isState(expectedState)) {
    return redirect(`${returnUrl}&status=invalid&reason=missing-or-invalid-expected-state`, 303);
  }

  try {
    const actions = await readNdjson<BookingAction>(BOOKING_ACTIONS_FILE_PATH);
    const latestAction = findLatestBookingAction(actions, bookingId);

    const currentState = resolveBookingModerationState({
      action: latestAction?.action
    }).state;

    if (expectedState && currentState !== expectedState) {
      return redirect(`${returnUrl}&status=stale&bookingId=${short(bookingId)}&expected=${short(expectedState)}&actual=${short(currentState)}`, 303);
    }

    if (!isAllowedTransition(currentState, targetState)) {
      const reason = transitionGuardrailReason(currentState, targetState);
      return redirect(`${returnUrl}&status=guardrail&bookingId=${short(bookingId)}&expected=${short('lifecycle-transition-rules')}&actual=${short(currentState)}&reason=${short(reason)}`, 303);
    }

    if (currentState === targetState) {
      return redirect(`${returnUrl}&status=no-change&bookingId=${short(bookingId)}&actual=${short(currentState)}`, 303);
    }

    await mkdir(dirname(BOOKING_ACTIONS_FILE_PATH), { recursive: true });
    await appendFile(
      BOOKING_ACTIONS_FILE_PATH,
      `${JSON.stringify({ bookingId, action: targetState, actedAt: new Date().toISOString() })}\n`,
      'utf-8'
    );

    return redirect(`${returnUrl}&status=updated&bookingId=${short(bookingId)}&from=${short(currentState)}&to=${short(targetState)}`, 303);
  } catch (error) {
    console.error('[booking-moderation] failed', error);
    return redirect(`${returnUrl}&status=error`, 303);
  }
};
