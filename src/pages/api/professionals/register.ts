import type { APIRoute } from 'astro';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import nodemailer from 'nodemailer';
import { writeFormFlash } from '../../../lib/form-flash';

const ADMIN_EMAIL = process.env.CONTACT_ADMIN_EMAIL || 'info@greekhandy.gr';
const REGISTRATIONS_FILE_PATH = resolve(process.cwd(), 'data', 'professional-registrations.ndjson');

type RegistrationInput = {
  name: string;
  profession: string;
  city: string;
  phone: string;
  email: string;
  areasServed: string;
  bio: string;
  gdprConsent?: string;
};

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const max = (value: string, limit: number) => value.slice(0, limit);
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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

const buildRegisterRedirect = (status: 'invalid' | 'error') => `/professionals/register?status=${status}`;

const extractInput = async (request: Request): Promise<RegistrationInput> => {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      name: max(clean(body.name), 120),
      profession: max(clean(body.profession), 120),
      city: max(clean(body.city), 80),
      phone: max(clean(body.phone), 40),
      email: max(clean(body.email).toLowerCase(), 160),
      areasServed: max(clean(body.areasServed), 300),
      bio: max(clean(body.bio), 2000),
      gdprConsent: clean(body.gdprConsent)
    };
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(await request.text());
    return {
      name: max(clean(params.get('name')), 120),
      profession: max(clean(params.get('profession')), 120),
      city: max(clean(params.get('city')), 80),
      phone: max(clean(params.get('phone')), 40),
      email: max(clean(params.get('email')).toLowerCase(), 160),
      areasServed: max(clean(params.get('areasServed')), 300),
      bio: max(clean(params.get('bio')), 2000),
      gdprConsent: clean(params.get('gdprConsent'))
    };
  }

  const formData = await request.formData();
  return {
    name: max(clean(formData.get('name')), 120),
    profession: max(clean(formData.get('profession')), 120),
    city: max(clean(formData.get('city')), 80),
    phone: max(clean(formData.get('phone')), 40),
    email: max(clean(formData.get('email')).toLowerCase(), 160),
    areasServed: max(clean(formData.get('areasServed')), 300),
    bio: max(clean(formData.get('bio')), 2000),
    gdprConsent: clean(formData.get('gdprConsent'))
  };
};

const validateInput = (input: RegistrationInput) => {
  const fieldErrors: Record<string, string> = {};
  if (!input.name) fieldErrors.name = 'Το όνομα είναι υποχρεωτικό.';
  if (!input.profession) fieldErrors.profession = 'Η ειδικότητα είναι υποχρεωτική.';
  if (!input.city) fieldErrors.city = 'Η πόλη είναι υποχρεωτική.';
  if (!input.phone) fieldErrors.phone = 'Το τηλέφωνο είναι υποχρεωτικό.';
  if (!input.email) fieldErrors.email = 'Το email είναι υποχρεωτικό.';
  else if (!isValidEmail(input.email)) fieldErrors.email = 'Το email δεν είναι έγκυρο.';
  if (!input.bio) fieldErrors.bio = 'Το βιογραφικό είναι υποχρεωτικό.';
  if (!input.gdprConsent) fieldErrors.gdprConsent = 'Χρειάζεται αποδοχή της Πολιτικής Απορρήτου.';
  return fieldErrors;
};

const sendAdminEmail = async (registration: Record<string, string>) => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  await transporter.sendMail({
    from: process.env.CONTACT_FROM_EMAIL || user,
    to: ADMIN_EMAIL,
    replyTo: registration.email,
    subject: `Νέα εγγραφή επαγγελματία: ${registration.name}`,
    text: [
      `Όνομα: ${registration.name}`,
      `Ειδικότητα: ${registration.profession}`,
      `Πόλη: ${registration.city}`,
      `Τηλέφωνο: ${registration.phone}`,
      `Email: ${registration.email}`,
      `Περιοχές: ${registration.areasServed}`,
      '',
      'Σύντομο βιογραφικό:',
      registration.bio
    ].join('\n')
  });
};

export const POST: APIRoute = async ({ request, redirect, cookies }) => {
  const asJson = wantsJson(request);

  let input: RegistrationInput;
  try {
    input = await extractInput(request);
  } catch {
    return asJson
      ? jsonError(400, 'INVALID_BODY', 'Το σώμα του αιτήματος δεν είναι έγκυρο.')
      : (writeFormFlash(cookies, 'register', { errors: { form: 'Η υποβολή δεν ήταν έγκυρη. Ελέγξτε τα πεδία και δοκιμάστε ξανά.' } }), redirect(buildRegisterRedirect('invalid'), 303));
  }

  const fieldErrors = validateInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return asJson
      ? jsonError(422, 'VALIDATION_ERROR', 'Υπάρχουν σφάλματα σε πεδία.', fieldErrors)
      : (writeFormFlash(cookies, 'register', {
        values: {
          name: input.name, profession: input.profession, city: input.city, phone: input.phone, email: input.email, areasServed: input.areasServed, bio: input.bio
        },
        errors: fieldErrors
      }), redirect(buildRegisterRedirect('invalid'), 303));
  }

  const registration = {
    name: input.name,
    profession: input.profession,
    city: input.city,
    phone: input.phone,
    email: input.email,
    areasServed: input.areasServed,
    bio: input.bio,
    submittedAt: new Date().toISOString()
  };

  try {
    await mkdir(dirname(REGISTRATIONS_FILE_PATH), { recursive: true });
    await appendFile(REGISTRATIONS_FILE_PATH, `${JSON.stringify(registration)}\n`, 'utf-8');
    await sendAdminEmail(registration);
    return asJson
      ? new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'content-type': 'application/json; charset=utf-8' } })
      : redirect('/professionals/thank-you?status=ok', 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error';
    console.error(`[professional-registration] failed: ${message}`);
    return asJson
      ? jsonError(500, 'REGISTRATION_FAILED', 'Αδυναμία αποθήκευσης εγγραφής αυτή τη στιγμή.')
      : (writeFormFlash(cookies, 'register', {
        values: { name: input.name, profession: input.profession, city: input.city, phone: input.phone, email: input.email, areasServed: input.areasServed, bio: input.bio },
        errors: { form: 'Δεν ολοκληρώθηκε η αποστολή. Προσπαθήστε ξανά.' }
      }), redirect(buildRegisterRedirect('error'), 303));
  }
};
