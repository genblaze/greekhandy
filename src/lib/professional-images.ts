import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const FALLBACK_PROFILE_IMAGE = '/images/professionals/fallback-thumbnail.svg';

const validationCache = new Map<string, boolean>();
const REMOTE_IMAGE_TIMEOUT_MS = 4500;
const LOCAL_CANDIDATE_PREFIX = '/images/professionals/';
const IMAGE_CONTENT_TYPE_PATTERN = /^image\//i;

type LocalPublicCandidate = {
  webPath: string;
  fsPath: string;
};

const toLocalPublicCandidates = (value: string) => {
  const cleaned = value.trim().replace(/^\.\//, '');
  if (!cleaned) return [] as LocalPublicCandidate[];

  const webCandidates = cleaned.startsWith('/')
    ? [cleaned]
    : [`/${cleaned}`, `${LOCAL_CANDIDATE_PREFIX}${cleaned}`];

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

const fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = REMOTE_IMAGE_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const hasImageContentType = (res: Response) => {
  const contentType = (res.headers.get('content-type') || '').trim();
  return contentType === '' || IMAGE_CONTENT_TYPE_PATTERN.test(contentType);
};

const validateRemoteImage = async (url: string) => {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  } catch {
    return false;
  }

  const head = await fetchWithTimeout(url, { method: 'HEAD' });
  if (head?.ok && hasImageContentType(head)) return true;

  const get = await fetchWithTimeout(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
  return Boolean(get?.ok && hasImageContentType(get));
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


export const assertPublishedProfilesHaveValidMedia = async (
  profiles: Array<{
    slug: string;
    approved?: boolean;
    published?: boolean;
    profilePhotoUrl?: string;
    portfolioPhotos?: string[];
  }>
) => {
  const published = profiles.filter((p) => p.approved === true && p.published === true);

  for (const profile of published) {
    const hasValidPrimary = await validateProfessionalPublishedImage(profile.profilePhotoUrl);
    if (!hasValidPrimary) {
      throw new Error(`[publish-media-gate] Profile ${profile.slug} has invalid primary image URL: ${profile.profilePhotoUrl || '(empty)'}`);
    }

    const portfolio = Array.isArray(profile.portfolioPhotos) ? profile.portfolioPhotos : [];
    for (const photo of portfolio) {
      const isValidPortfolioPhoto = await validateProfessionalPublishedImage(photo);
      if (!isValidPortfolioPhoto) {
        console.warn(`[publish-media-gate] Profile ${profile.slug} has non-renderable portfolio image; runtime fallback will be used: ${photo || '(empty)'}`);
      }
    }
  }
};
