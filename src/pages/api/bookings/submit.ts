import type { APIRoute } from 'astro';

export const prerender = false;
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { BOOKING_SUBMISSIONS_FILE_PATH, getBookingStatusPath } from '../../../lib/bookings';
import { writeFormFlash } from '../../../lib/form-flash';

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const max = (value: string, limit: number) => value.slice(0, limit);

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone: string) => /^[0-9+()\-\s]{7,20}$/.test(phone);
const isValidSlug = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
const hasHtmlLikeTags = (value: string) => /<[^>]+>/.test(value);

const wantsJson = (request: Request) => {
  const accept = request.headers.get('accept') || '';
  const contentType = request.headers.get('content-type') || '';
  const format = new URL(request.url).searchParams.get('format');
  return format === 'json' || accept.includes('application/json') || contentType.includes('application/json');
};

const jsonError = (status: number, code: string, message: string, fieldErrors?: Record<string, string>) =>
  new Response(JSON.stringify({ ok: false, error: { code, message, fieldErrors: fieldErrors || null } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });

const toSafeLogMessage = (error: unknown) => {
  if (error instanceof Error) {
    const normalized = error.message.replace(/^TypeError:\s*/i, '').trim();
    return normalized || 'unknown-error';
  }
  return 'unknown-error';
};

const withBookingStatus = (returnTo: string, status: 'invalid' | 'error') => {
  const url = new URL(returnTo, 'https://greekhandy.local');
  url.searchParams.set('booking', status);
  return `${url.pathname}${url.search}`;
};

const toSafeReturnTo = (candidate: string, fallback: string) => {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  try {
    const url = new URL(candidate, 'https://greekhandy.local');
    if (url.origin !== 'https://greekhandy.local') return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
};

type BookingInput = {
  professionalSlug: string;
  returnTo: string;
  honeypot: string;
  service: string;
  customerName: string;
  phone: string;
  email: string;
  preferredDate: string;
  message: string;
};

const extractInput = async (request: Request): Promise<BookingInput> => {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const professionalSlug = max(clean(body.professionalSlug as FormDataEntryValue | null), 120);
    const fallbackReturnTo = professionalSlug ? `/professionals/${professionalSlug}` : '/professionals';
    return {
      professionalSlug,
      returnTo: toSafeReturnTo(clean(body.returnTo as FormDataEntryValue | null), fallbackReturnTo),
      honeypot: clean(body.website as FormDataEntryValue | null),
      service: max(clean(body.service as FormDataEntryValue | null), 160),
      customerName: max(clean(body.customerName as FormDataEntryValue | null), 120),
      phone: max(clean(body.phone as FormDataEntryValue | null), 40),
      email: max(clean(body.email as FormDataEntryValue | null).toLowerCase(), 160),
      preferredDate: max(clean(body.preferredDate as FormDataEntryValue | null), 80),
      message: max(clean(body.message as FormDataEntryValue | null), 2000)
    };
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(await request.text());
    const professionalSlug = max(clean(params.get('professionalSlug')), 120);
    const fallbackReturnTo = professionalSlug ? `/professionals/${professionalSlug}` : '/professionals';
    return {
      professionalSlug,
      returnTo: toSafeReturnTo(clean(params.get('returnTo')), fallbackReturnTo),
      honeypot: clean(params.get('website')),
      service: max(clean(params.get('service')), 160),
      customerName: max(clean(params.get('customerName')), 120),
      phone: max(clean(params.get('phone')), 40),
      email: max(clean(params.get('email')).toLowerCase(), 160),
      preferredDate: max(clean(params.get('preferredDate')), 80),
      message: max(clean(params.get('message')), 2000)
    };
  }

  const formData = await request.formData();
  const professionalSlug = max(clean(formData.get('professionalSlug')), 120);
  const fallbackReturnTo = professionalSlug ? `/professionals/${professionalSlug}` : '/professionals';
  return {
    professionalSlug,
    returnTo: toSafeReturnTo(clean(formData.get('returnTo')), fallbackReturnTo),
    honeypot: clean(formData.get('website')),
    service: max(clean(formData.get('service')), 160),
    customerName: max(clean(formData.get('customerName')), 120),
    phone: max(clean(formData.get('phone')), 40),
    email: max(clean(formData.get('email')).toLowerCase(), 160),
    preferredDate: max(clean(formData.get('preferredDate')), 80),
    message: max(clean(formData.get('message')), 2000)
  };
};

const validateInput = (input: BookingInput) => {
  const fieldErrors: Record<string, string> = {};
  if (!input.professionalSlug || !isValidSlug(input.professionalSlug)) {
    fieldErrors.professionalSlug = 'Μη έγκυρο προφίλ επαγγελματία.';
  }
  if (!input.service || hasHtmlLikeTags(input.service)) {
    fieldErrors.service = 'Επιλέξτε έγκυρη υπηρεσία.';
  }
  if (!input.customerName || input.customerName.length < 2 || hasHtmlLikeTags(input.customerName)) {
    fieldErrors.customerName = 'Συμπληρώστε έγκυρο ονοματεπώνυμο.';
  }
  if (!input.phone || !isValidPhone(input.phone)) {
    fieldErrors.phone = 'Συμπληρώστε έγκυρο τηλέφωνο.';
  }
  if (!input.email || !isValidEmail(input.email)) {
    fieldErrors.email = 'Συμπληρώστε έγκυρο email.';
  }
  if (!input.message || hasHtmlLikeTags(input.message)) {
    fieldErrors.message = 'Συμπληρώστε έγκυρες λεπτομέρειες αιτήματος.';
  }
  if (input.preferredDate && !(input.preferredDate.length >= 4 && /\d/.test(input.preferredDate))) {
    fieldErrors.preferredDate = 'Προσθέστε σαφή ημέρα/ώρα (π.χ. 12/03 πρωί).';
  }
  return fieldErrors;
};

export const POST: APIRoute = async ({ request, redirect, cookies }) => {
  const asJson = wantsJson(request);
  let input: BookingInput;

  try {
    input = await extractInput(request);
  } catch {
    const referer = request.headers.get('referer') || '';
    const safeReturnTo = toSafeReturnTo(referer, '/professionals');
    return asJson
      ? jsonError(400, 'INVALID_BODY', 'Το σώμα του αιτήματος δεν είναι έγκυρο.')
      : (writeFormFlash(cookies, `booking:${input?.professionalSlug || 'unknown'}`, { errors: { form: 'Η υποβολή δεν ήταν έγκυρη. Διορθώστε τα πεδία και δοκιμάστε ξανά.' } }), redirect(withBookingStatus(safeReturnTo, 'invalid'), 303));
  }

  if (input.honeypot) {
    return asJson
      ? jsonError(422, 'VALIDATION_ERROR', 'Το αίτημα απορρίφθηκε ως μη έγκυρο.', { website: 'Μη επιτρεπτό πεδίο.' })
      : (writeFormFlash(cookies, `booking:${input.professionalSlug}`, { values: { service: input.service, customerName: input.customerName, phone: input.phone, email: input.email, preferredDate: input.preferredDate, message: input.message }, errors: { website: 'Μη επιτρεπτό πεδίο.' } }), redirect(withBookingStatus(input.returnTo, 'invalid'), 303));
  }

  const fieldErrors = validateInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return asJson
      ? jsonError(422, 'VALIDATION_ERROR', 'Υπάρχουν σφάλματα σε πεδία.', fieldErrors)
      : (writeFormFlash(cookies, `booking:${input.professionalSlug}`, { values: { service: input.service, customerName: input.customerName, phone: input.phone, email: input.email, preferredDate: input.preferredDate, message: input.message }, errors: fieldErrors }), redirect(withBookingStatus(input.returnTo, 'invalid'), 303));
  }

  const submission = {
    id: `${input.professionalSlug}|${Date.now()}`,
    professionalSlug: input.professionalSlug,
    service: input.service,
    customerName: input.customerName,
    phone: input.phone,
    email: input.email,
    preferredDate: input.preferredDate,
    message: input.message,
    status: 'pending',
    submittedAt: new Date().toISOString()
  };

  try {
    await mkdir(dirname(BOOKING_SUBMISSIONS_FILE_PATH), { recursive: true });
    await appendFile(BOOKING_SUBMISSIONS_FILE_PATH, `${JSON.stringify(submission)}\n`, 'utf-8');

    const statusUrl = new URL(getBookingStatusPath(submission.id), 'https://greekhandy.local');
    statusUrl.searchParams.set('status', 'submitted');
    statusUrl.searchParams.set('returnTo', input.returnTo);

    const redirectTo = `${statusUrl.pathname}?${statusUrl.searchParams.toString()}`;
    if (asJson) {
      return new Response(JSON.stringify({
        ok: true,
        status: 'submitted',
        bookingId: submission.id,
        redirectTo
      }), {
        status: 201,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    }

    return redirect(redirectTo, 303);
  } catch (error) {
    console.error(`[booking-submit] failed: ${toSafeLogMessage(error)}`);
    return asJson
      ? jsonError(500, 'BOOKING_SUBMIT_FAILED', 'Αδυναμία υποβολής αιτήματος αυτή τη στιγμή.')
      : (writeFormFlash(cookies, `booking:${input.professionalSlug}`, { values: { service: input.service, customerName: input.customerName, phone: input.phone, email: input.email, preferredDate: input.preferredDate, message: input.message }, errors: { form: 'Η αποστολή δεν ολοκληρώθηκε. Δοκιμάστε ξανά.' } }), redirect(withBookingStatus(input.returnTo, 'error'), 303));
  }
};
