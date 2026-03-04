import type { APIRoute } from 'astro';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import nodemailer from 'nodemailer';

const ADMIN_EMAIL = process.env.CONTACT_ADMIN_EMAIL || 'info@greekhandy.gr';
const REGISTRATIONS_FILE_PATH = resolve(process.cwd(), 'data', 'professional-registrations.ndjson');

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const max = (value: string, limit: number) => value.slice(0, limit);

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

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const registration = {
    name: max(clean(formData.get('name')), 120),
    profession: max(clean(formData.get('profession')), 120),
    city: max(clean(formData.get('city')), 80),
    phone: max(clean(formData.get('phone')), 40),
    email: max(clean(formData.get('email')), 160),
    areasServed: max(clean(formData.get('areasServed')), 300),
    bio: max(clean(formData.get('bio')), 2000),
    submittedAt: new Date().toISOString()
  };

  if (!registration.name || !registration.profession || !registration.city || !registration.phone || !registration.email || !registration.bio) {
    return redirect('/professionals/thank-you?status=invalid', 303);
  }

  try {
    await mkdir(dirname(REGISTRATIONS_FILE_PATH), { recursive: true });
    await appendFile(REGISTRATIONS_FILE_PATH, `${JSON.stringify(registration)}\n`, 'utf-8');
    await sendAdminEmail(registration);
    return redirect('/professionals/thank-you?status=ok', 303);
  } catch (error) {
    console.error('[professional-registration] failed', error);
    return redirect('/professionals/thank-you?status=error', 303);
  }
};
