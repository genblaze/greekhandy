import type { APIRoute } from 'astro';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const clean = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const logFile = '/home/weakwire/projects/greekhandy/data/contact-submissions.ndjson';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const returnTo = '/epikoinonia';

  const fullName = clean(form.get('fullName'));
  const email = clean(form.get('email')).toLowerCase();
  const topic = clean(form.get('topic'));
  const message = clean(form.get('message'));
  const website = clean(form.get('website'));

  if (website) return redirect(`${returnTo}?status=invalid`, 303);

  if (!fullName || fullName.length < 2 || !EMAIL.test(email) || !topic || !message || message.length < 10) {
    return redirect(`${returnTo}?status=invalid`, 303);
  }

  try {
    await mkdir(dirname(logFile), { recursive: true });
    await appendFile(
      logFile,
      `${JSON.stringify({
        submittedAt: new Date().toISOString(),
        fullName,
        email,
        topic,
        message
      })}\n`,
      'utf8'
    );
    return redirect(`${returnTo}?status=submitted`, 303);
  } catch {
    return redirect(`${returnTo}?status=error`, 303);
  }
};
