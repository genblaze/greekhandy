import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const FALLBACK_PROFILE_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='900' viewBox='0 0 1200 900'>
    <defs>
      <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
        <stop offset='0%' stop-color='#dbeafe'/>
        <stop offset='100%' stop-color='#e0e7ff'/>
      </linearGradient>
    </defs>
    <rect width='1200' height='900' fill='url(#g)'/>
    <circle cx='600' cy='350' r='110' fill='#93c5fd'/>
    <rect x='360' y='500' width='480' height='220' rx='110' fill='#bfdbfe'/>
    <text x='600' y='810' text-anchor='middle' font-family='Arial, sans-serif' font-size='36' fill='#1e3a8a'>GreekHandy Professional</text>
  </svg>`
)}`;

const validationCache = new Map<string, boolean>();

const toLocalPublicCandidates = (value: string) => {
  const cleaned = value.trim().replace(/^\.\//, '');
  if (!cleaned) return [] as string[];

  const webCandidates = cleaned.startsWith('/')
    ? [cleaned]
    : [`/${cleaned}`, `/images/professionals/${cleaned}`];

  return webCandidates.map((webPath) => ({
    webPath,
    fsPath: resolve(process.cwd(), 'public', webPath.replace(/^\//, ''))
  }));
};

export const getProfessionalFallbackImage = () => FALLBACK_PROFILE_IMAGE;

export const resolveProfessionalImageSrc = (input?: string | null) => {
  const value = (input || '').trim();
  if (!value) return FALLBACK_PROFILE_IMAGE;

  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;

  for (const candidate of toLocalPublicCandidates(value)) {
    if (existsSync(candidate.fsPath)) return candidate.webPath;
  }

  return FALLBACK_PROFILE_IMAGE;
};

export const resolveProfessionalImageForPublishedProfile = async (input?: string | null) => {
  const valid = await validateProfessionalPublishedImage(input);
  return valid ? resolveProfessionalImageSrc(input) : FALLBACK_PROFILE_IMAGE;
};

const REMOTE_IMAGE_HOST_ALLOWLIST = new Set([
  'images.unsplash.com',
  'cdn.jsdelivr.net',
  'i.imgur.com',
  'res.cloudinary.com'
]);

const validateRemoteImage = async (url: string) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const head = await fetch(url, { method: 'HEAD', signal: controller.signal });
    if (head.ok) return true;
  } catch {
    // fall through to GET fallback
  } finally {
    clearTimeout(timer);
  }

  try {
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) return true;
  } catch {
    // network/cors errors handled by allowlist fallback below
  }

  try {
    const parsed = new URL(url);
    return REMOTE_IMAGE_HOST_ALLOWLIST.has(parsed.hostname) && parsed.pathname.length > 1;
  } catch {
    return false;
  }
};

export const validateProfessionalPublishedImage = async (input?: string | null) => {
  const value = (input || '').trim();
  if (!value) return false;

  if (validationCache.has(value)) return validationCache.get(value) as boolean;

  let valid = false;
  if (/^https?:\/\//i.test(value) || value.startsWith('//')) {
    valid = await validateRemoteImage(resolveProfessionalImageSrc(value));
  } else {
    valid = toLocalPublicCandidates(value).some((candidate) => existsSync(candidate.fsPath));
  }

  validationCache.set(value, valid);
  return valid;
};

export const assertPublishedProfilesHaveValidImages = async (
  profiles: Array<{ slug: string; approved?: boolean; published?: boolean; profilePhotoUrl?: string }>
) => {
  const published = profiles.filter((p) => p.approved === true && p.published === true);

  for (const profile of published) {
    const valid = await validateProfessionalPublishedImage(profile.profilePhotoUrl);
    if (!valid) {
      throw new Error(`[publish-image-gate] Profile ${profile.slug} has invalid profile image URL: ${profile.profilePhotoUrl || '(empty)'}`);
    }
  }
};
