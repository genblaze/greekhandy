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
  status?: 'pending';
  submittedAt: string;
}

export interface BookingAction {
  bookingId: string;
  action: 'approve' | 'reject' | string;
  actedAt: string;
}

export type BookingModerationState = 'pending' | 'approved' | 'rejected';

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

export const getBookingModerationState = (action?: string): BookingModerationState => {
  if (action === 'approve') return 'approved';
  if (action === 'reject') return 'rejected';
  return 'pending';
};

export const getBookingStatusPath = (bookingId: string) => `/bookings/${encodeURIComponent(bookingId)}`;
