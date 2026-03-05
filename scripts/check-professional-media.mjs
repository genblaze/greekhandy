import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const PROFILES_PATH = resolve(ROOT, 'data', 'professionals.json');
const FALLBACK_PATH = resolve(ROOT, 'public', 'images', 'professionals', 'fallback-thumbnail.svg');

const fail = (message) => {
  console.error(`❌ Professional media check failed: ${message}`);
  process.exit(1);
};

const ensureFile = async (filePath, label) => {
  try {
    await access(filePath, constants.R_OK);
  } catch {
    fail(`${label} not found: ${filePath}`);
  }
};

const ensureProfileMediaGuardInTemplate = async () => {
  const profileTemplatePath = resolve(ROOT, 'src', 'pages', 'professionals', '[slug].astro');
  const listingTemplatePath = resolve(ROOT, 'src', 'pages', 'professionals', 'index.astro');
  const [profileTemplate, listingTemplate] = await Promise.all([
    readFile(profileTemplatePath, 'utf8'),
    readFile(listingTemplatePath, 'utf8')
  ]);

  const requiredTokens = [
    'data-prof-media-img',
    'data-fallback-src',
    'data-prof-media-shell'
  ];

  for (const token of requiredTokens) {
    if (!profileTemplate.includes(token)) fail(`Missing token in profile template: ${token}`);
    if (!listingTemplate.includes(token)) fail(`Missing token in listing template: ${token}`);
  }
};

const ensurePublishedProfilesUseRenderablePrimaryMedia = async () => {
  const raw = await readFile(PROFILES_PATH, 'utf8');
  const profiles = JSON.parse(raw);
  const published = profiles.filter((profile) => profile.approved === true && profile.published === true);

  for (const profile of published) {
    const src = String(profile.profilePhotoUrl || '').trim();
    if (!src) fail(`Published profile ${profile.slug} has empty profilePhotoUrl.`);

    if (!src.startsWith('/images/professionals/')) {
      fail(`Published profile ${profile.slug} must use local /images/professionals media for deterministic rendering, got: ${src}`);
    }

    const filePath = resolve(ROOT, 'public', src.replace(/^\//, ''));
    await ensureFile(filePath, `Primary profile media for ${profile.slug}`);
  }
};

await ensureFile(FALLBACK_PATH, 'Fallback professional thumbnail');
await ensurePublishedProfilesUseRenderablePrimaryMedia();
await ensureProfileMediaGuardInTemplate();

console.log('Professional media guard test passed. Published profiles have deterministic primary media + fallback guards.');
