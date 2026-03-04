import type { APIRoute } from 'astro';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import nodemailer from 'nodemailer';

const ADMIN_EMAIL = process.env.CONTACT_ADMIN_EMAIL || 'info@greekhandy.gr';
const LEADS_FILE_PATH = resolve(process.cwd(), 'data', 'contact-submissions.ndjson');

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const max = (value: string, limit: number) => value.slice(0, limit);

const sendAdminEmail = async (lead: Record<string, string>) => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[contact-form] SMTP not configured. Skipping email notification.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  await transporter.sendMail({
    from: process.env.CONTACT_FROM_EMAIL || user,
    to: ADMIN_EMAIL,
    replyTo: lead.email,
    subject: `Νέο αίτημα: ${lead.serviceName || lead.serviceSlug}`,
    text: [
      `Υπηρεσία: ${lead.serviceName || lead.serviceSlug}`,
      `Σελίδα: ${lead.pageUrl}`,
      `Όνομα: ${lead.name}`,
      `Τηλέφωνο: ${lead.phone}`,
      `Email: ${lead.email}`,
      '',
      'Περιγραφή:',
      lead.description
    ].join('\n')
  });
};

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const lead = {
    name: max(clean(formData.get('name')), 120),
    phone: max(clean(formData.get('phone')), 40),
    email: max(clean(formData.get('email')), 160),
    description: max(clean(formData.get('description')), 3000),
    serviceSlug: max(clean(formData.get('serviceSlug')), 140),
    serviceName: max(clean(formData.get('serviceName')), 180),
    pageUrl: max(clean(formData.get('pageUrl')), 300),
    submittedAt: new Date().toISOString()
  };

  if (!lead.name || !lead.phone || !lead.email || !lead.description || !lead.serviceSlug) {
    return redirect('/thank-you?status=invalid', 303);
  }

  try {
    await mkdir(dirname(LEADS_FILE_PATH), { recursive: true });
    await appendFile(LEADS_FILE_PATH, `${JSON.stringify(lead)}\n`, 'utf-8');
    await sendAdminEmail(lead);
    return redirect(`/thank-you?status=ok&service=${encodeURIComponent(lead.serviceSlug)}`, 303);
  } catch (error) {
    console.error('[contact-form] Failed to save lead', error);
    return redirect('/thank-you?status=error', 303);
  }
};
