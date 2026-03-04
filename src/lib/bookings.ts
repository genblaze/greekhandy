import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const BOOKING_SUBMISSIONS_FILE_PATH = resolve(process.cwd(), 'data', 'booking-submissions.ndjson');
export const BOOKING_ACTIONS_FILE_PATH = resolve(process.cwd(), 'data', 'booking-moderation-actions.ndjson');

export interface BookingSubmission {
  id?: string;
  professionalSlug: string;
  service?: string;
  customerName: string;
  phone: string;
  email: string;
  preferredDate?: string;
  message: string;
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | string;
  submittedAt: string;
}

export interface BookingAction {
  bookingId: string;
  action: 'approve' | 'reject' | string;
  actedAt: string;
}

export type BookingModerationState = 'pending' | 'approved' | 'rejected' | 'cancelled';
type BookingModerationStateSource = 'action' | 'submission-status' | 'fallback';
export const BOOKING_STATUS_PAGE_PATH = '/bookings/request';

export const readNdjson = async <T>(path: string): Promise<T[]> => {
  try {
    const raw = await readFile(path, 'utf-8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
};

export const getBookingId = (booking: Pick<BookingSubmission, 'id' | 'professionalSlug' | 'submittedAt'>) =>
  booking.id || `${booking.professionalSlug}|${booking.submittedAt}`;

const normalizeValue = (value?: string | null) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const moderationStateFromValue = (value?: string | null): BookingModerationState | null => {
  const normalized = normalizeValue(value);
  if (normalized === 'approve' || normalized === 'approved') return 'approved';
  if (normalized === 'reject' || normalized === 'rejected') return 'rejected';
  if (normalized === 'cancel' || normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';
  if (normalized === 'pending') return 'pending';
  return null;
};

export const getBookingModerationState = (action?: string): BookingModerationState => moderationStateFromValue(action) ?? 'pending';

export const resolveBookingModerationState = (input: {
  action?: string | null;
  submissionStatus?: string | null;
}): {
  state: BookingModerationState;
  source: BookingModerationStateSource;
  hasUnknownData: boolean;
} => {
  const actionState = moderationStateFromValue(input.action);
  if (actionState) {
    return {
      state: actionState,
      source: 'action',
      hasUnknownData: false
    };
  }

  const submissionState = moderationStateFromValue(input.submissionStatus);
  if (submissionState) {
    return {
      state: submissionState,
      source: 'submission-status',
      hasUnknownData: false
    };
  }

  return {
    state: 'pending',
    source: 'fallback',
    hasUnknownData: Boolean(normalizeValue(input.action) || normalizeValue(input.submissionStatus))
  };
};

const parseTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const findLatestBookingAction = (
  actions: BookingAction[],
  bookingId: string
): BookingAction | null => {
  let latestAction: BookingAction | null = null;
  for (const action of actions) {
    if (action.bookingId !== bookingId) continue;
    if (!latestAction || parseTimestamp(action.actedAt) >= parseTimestamp(latestAction.actedAt)) {
      latestAction = action;
    }
  }
  return latestAction;
};

export const getLatestBookingActionById = (actions: BookingAction[]) => {
  const latestActionById = new Map<string, BookingAction>();
  for (const action of actions) {
    const currentLatest = latestActionById.get(action.bookingId);
    if (!currentLatest || parseTimestamp(action.actedAt) >= parseTimestamp(currentLatest.actedAt)) {
      latestActionById.set(action.bookingId, action);
    }
  }
  return latestActionById;
};

export const getBookingStatusPath = (bookingId: string) =>
  `${BOOKING_STATUS_PAGE_PATH}?bookingId=${encodeURIComponent(bookingId)}`;
