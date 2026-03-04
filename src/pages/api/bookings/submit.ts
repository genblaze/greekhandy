import type { APIRoute } from 'astro';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { BOOKING_SUBMISSIONS_FILE_PATH, getBookingStatusPath } from '../../../lib/bookings';

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const max = (value: string, limit: number) => value.slice(0, limit);

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone: string) => /^[0-9+()\-\s]{7,20}$/.test(phone);

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const professionalSlug = max(clean(formData.get('professionalSlug')), 120);
  const returnTo = clean(formData.get('returnTo')) || `/professionals/${professionalSlug}`;

  if (clean(formData.get('website'))) {
    return redirect(`${returnTo}?booking=invalid`, 303);
  }

  const submission = {
    id: `${professionalSlug}|${Date.now()}`,
    professionalSlug,
    service: max(clean(formData.get('service')), 160),
    customerName: max(clean(formData.get('customerName')), 120),
    phone: max(clean(formData.get('phone')), 40),
    email: max(clean(formData.get('email')), 160),
    preferredDate: max(clean(formData.get('preferredDate')), 80),
    message: max(clean(formData.get('message')), 2000),
    status: 'pending',
    submittedAt: new Date().toISOString()
  };

  if (
    !submission.professionalSlug ||
    !submission.service ||
    !submission.customerName ||
    !submission.phone ||
    !submission.email ||
    !submission.message ||
    !isValidEmail(submission.email) ||
    !isValidPhone(submission.phone)
  ) {
    return redirect(`${returnTo}?booking=invalid`, 303);
  }

  try {
    await mkdir(dirname(BOOKING_SUBMISSIONS_FILE_PATH), { recursive: true });
    await appendFile(BOOKING_SUBMISSIONS_FILE_PATH, `${JSON.stringify(submission)}\n`, 'utf-8');

    const query = new URLSearchParams({ status: 'submitted' });
    if (returnTo.startsWith('/') && !returnTo.startsWith('//')) query.set('returnTo', returnTo);

    return redirect(`${getBookingStatusPath(submission.id)}?${query.toString()}`, 303);
  } catch (error) {
    console.error('[booking-submit] failed', error);
    return redirect(`${returnTo}?booking=error`, 303);
  }
};
