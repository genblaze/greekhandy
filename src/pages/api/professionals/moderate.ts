import type { APIRoute } from 'astro';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const PROFESSIONALS_FILE_PATH = resolve(process.cwd(), 'data', 'professionals.json');
const ACTIONS_FILE_PATH = resolve(process.cwd(), 'data', 'professional-registration-actions.ndjson');

const slugify = (value: string) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const parseAreas = (value: string) => value
  .split(',')
  .map((part) => part.trim())
  .filter(Boolean)
  .slice(0, 12);

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const moderationKey = String(formData.get('moderationKey') || '');
  const expectedKey = process.env.PROFESSIONAL_MODERATION_KEY || '';

  if (!expectedKey || moderationKey !== expectedKey) {
    return redirect('/professionals/moderation?status=unauthorized', 303);
  }

  const action = String(formData.get('action') || '');
  const registrationId = String(formData.get('registrationId') || '');

  if (!registrationId || !action) {
    return redirect(`/professionals/moderation?key=${encodeURIComponent(moderationKey)}&status=invalid`, 303);
  }

  const registrationRaw = String(formData.get('registration') || '{}');

  try {
    await mkdir(dirname(ACTIONS_FILE_PATH), { recursive: true });
    await appendFile(ACTIONS_FILE_PATH, `${JSON.stringify({ registrationId, action, actedAt: new Date().toISOString() })}\n`, 'utf-8');

    if (action === 'approve') {
      const registration = JSON.parse(registrationRaw) as {
        name: string;
        profession: string;
        city: string;
        areasServed?: string;
        phone: string;
        email: string;
        bio: string;
      };

      const fileContent = await readFile(PROFESSIONALS_FILE_PATH, 'utf-8');
      const professionals = JSON.parse(fileContent) as Array<Record<string, any>>;

      const baseSlug = slugify(`${registration.name}-${registration.profession}`) || `professional-${Date.now()}`;
      let slug = baseSlug;
      let suffix = 2;
      while (professionals.some((pro) => pro.slug === slug)) {
        slug = `${baseSlug}-${suffix++}`;
      }

      professionals.push({
        slug,
        name: registration.name,
        profession: registration.profession,
        city: registration.city,
        areasServed: parseAreas(registration.areasServed || registration.city),
        approved: true,
        published: false,
        experienceYears: 0,
        bio: registration.bio,
        services: [],
        profilePhotoUrl: '',
        portfolioPhotos: [],
        phone: registration.phone,
        email: registration.email,
        createdFromRegistrationId: registrationId
      });

      await writeFile(PROFESSIONALS_FILE_PATH, `${JSON.stringify(professionals, null, 2)}\n`, 'utf-8');
    }

    return redirect(`/professionals/moderation?key=${encodeURIComponent(moderationKey)}&status=ok`, 303);
  } catch (error) {
    console.error('[professional-moderation] failed', error);
    return redirect(`/professionals/moderation?key=${encodeURIComponent(moderationKey)}&status=error`, 303);
  }
};
