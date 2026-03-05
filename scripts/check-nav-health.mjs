import { access, readdir, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NAV_ALIAS_REDIRECTS, NAV_CLIENT_ALIAS_REDIRECTS, NAV_PLACEHOLDER_TEXT, NAV_TARGETS, PRIMARY_NAV_LINKS, TOP_NAV_LINKS } from '../src/config/navigation.js';

const distClientCandidateDir = resolve(process.cwd(), 'dist', 'client');
const distStaticCandidateDir = resolve(process.cwd(), 'dist');
const distServerDir = resolve(process.cwd(), 'dist', 'server');

const candidateClientDirs = [distClientCandidateDir, distStaticCandidateDir];
let distClientDir = distClientCandidateDir;
for (const candidate of candidateClientDirs) {
  try {
    await access(candidate, fsConstants.R_OK);
    distClientDir = candidate;
    break;
  } catch {
    // keep trying
  }
}

const primaryNavPaths = PRIMARY_NAV_LINKS.map((navLink) => {
  const base = (navLink.href.split('#')[0] || '/').replace(/\/+$/, '') || '/';
  return base;
});

const requiredStaticRoutes = [
  '/',
  NAV_TARGETS.guides,
  NAV_TARGETS.professionals,
  NAV_TARGETS.contact,
  ...primaryNavPaths,
  '/ilektrologoi',
  '/ydravlikoi',
  '/elaiokhrwmatistes',
  '/katharismoi',
  '/techniki-klimatismou'
];

const requiredRootFiles = [
  { path: '/robots.txt', expectedSnippet: 'Sitemap: https://greekhandy.gr/sitemap.xml' },
  { path: '/sitemap.xml', expectedSnippet: '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' }
];

const routeContentChecks = [
  {
    route: NAV_TARGETS.guides,
    requiredSnippets: ['<h1', 'Οδηγοί', `href="${NAV_TARGETS.professionals}"`]
  },
  {
    route: NAV_TARGETS.professionals,
    requiredSnippets: ['<h1', 'Επαγγελματίες', 'href="/professionals/register"']
  },
  {
    route: NAV_TARGETS.contact,
    requiredSnippets: ['<h1', 'Επικοινωνία', 'info@greekhandy.gr'],
    forbiddenSnippets: ['href="/#contact"']
  }
];

const normalizePath = (value) => {
  if (!value) return '';
  const parsed = value.startsWith('http://') || value.startsWith('https://') ? new URL(value).pathname : value;
  if (parsed !== '/' && parsed.endsWith('/')) return parsed.slice(0, -1);
  return parsed;
};

const routeToClientHtml = (route) => {
  const normalized = normalizePath(route);
  if (normalized === '/') return resolve(distClientDir, 'index.html');
  return resolve(distClientDir, normalized.slice(1), 'index.html');
};

const rootFileToClientPath = (routePath) => resolve(distClientDir, routePath.replace(/^\//, ''));

const fileExists = async (path) => {
  try {
    await access(path, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const issues = [];

for (const route of new Set(requiredStaticRoutes)) {
  const filePath = routeToClientHtml(route);
  if (!(await fileExists(filePath))) {
    issues.push(`${route} -> missing built HTML file: ${filePath}`);
  }
}

for (const requiredFile of requiredRootFiles) {
  const filePath = rootFileToClientPath(requiredFile.path);
  if (!(await fileExists(filePath))) {
    issues.push(`${requiredFile.path} -> missing built file: ${filePath}`);
    continue;
  }
  const content = await readFile(filePath, 'utf-8');
  if (!content.includes(requiredFile.expectedSnippet)) {
    issues.push(`${requiredFile.path} -> missing expected content snippet: ${requiredFile.expectedSnippet}`);
  }
}

const homeHtmlPath = routeToClientHtml('/');
if (await fileExists(homeHtmlPath)) {
  const homeHtml = await readFile(homeHtmlPath, 'utf-8');
  const headerHtml = homeHtml.match(/<header[\s\S]*?<\/header>/iu)?.[0];
  if (!headerHtml) {
    issues.push('/ -> top header block not found');
  } else {
    if (!headerHtml.includes(`href="${NAV_TARGETS.contact}"`)) {
      issues.push(`/ -> missing canonical header contact href ${NAV_TARGETS.contact}`);
    }
    if (headerHtml.includes('href="/#contact"')) {
      issues.push('/ -> legacy header contact href /#contact is still present');
    }

    for (const navLink of TOP_NAV_LINKS) {
      if (!headerHtml.includes(`href="${navLink.href}"`)) {
        issues.push(`/ -> missing top-nav href ${navLink.href}`);
      }
      if (!headerHtml.includes(navLink.label)) {
        issues.push(`/ -> missing top-nav label "${navLink.label}"`);
      }
    }

    for (const navLink of PRIMARY_NAV_LINKS) {
      if (!headerHtml.includes(`href="${navLink.href}"`)) {
        issues.push(`/ -> missing mobile-primary href ${navLink.href}`);
      }
      if (!headerHtml.includes(navLink.label)) {
        issues.push(`/ -> missing mobile-primary label "${navLink.label}"`);
      }
    }
  }

  const footerHtml = homeHtml.match(/<footer[\s\S]*?<\/footer>/iu)?.[0];
  if (!footerHtml) {
    issues.push('/ -> footer block not found');
  } else {
    if (!footerHtml.includes(`href="${NAV_TARGETS.contact}"`)) {
      issues.push(`/ -> missing canonical footer contact href ${NAV_TARGETS.contact}`);
    }
    if (footerHtml.includes('href="/#contact"')) {
      issues.push('/ -> legacy footer contact href /#contact is still present');
    }
  }

  for (const [aliasRoute, expectedTarget] of Object.entries(NAV_CLIENT_ALIAS_REDIRECTS)) {
    const expectedPath = normalizePath(expectedTarget);
    if (!homeHtml.includes(aliasRoute)) {
      issues.push(`/ -> missing client alias redirect marker for ${aliasRoute}`);
    }
    if (!homeHtml.includes(expectedPath)) {
      issues.push(`/ -> missing client alias redirect target ${expectedPath}`);
    }
  }
}

for (const contentCheck of routeContentChecks) {
  const filePath = routeToClientHtml(contentCheck.route);
  if (!(await fileExists(filePath))) continue;
  const html = await readFile(filePath, 'utf-8');
  const htmlLower = html.toLowerCase();

  for (const requiredSnippet of contentCheck.requiredSnippets) {
    if (!html.includes(requiredSnippet)) {
      issues.push(`${contentCheck.route} -> missing expected content snippet: ${requiredSnippet}`);
    }
  }

  for (const placeholderText of NAV_PLACEHOLDER_TEXT) {
    if (htmlLower.includes(placeholderText.toLowerCase())) {
      issues.push(`${contentCheck.route} -> contains placeholder marker: "${placeholderText}"`);
    }
  }

  for (const forbiddenSnippet of contentCheck.forbiddenSnippets ?? []) {
    if (html.includes(forbiddenSnippet)) {
      issues.push(`${contentCheck.route} -> contains forbidden snippet: ${forbiddenSnippet}`);
    }
  }
}

const manifestFileName = (await readdir(distServerDir)).find((fileName) => fileName.startsWith('manifest_') && fileName.endsWith('.mjs'));
if (!manifestFileName) {
  issues.push('dist/server -> manifest_*.mjs not found, cannot verify redirect guardrails');
} else {
  const manifestPath = resolve(distServerDir, manifestFileName);
  const manifestModule = await import(pathToFileURL(manifestPath).href);
  const manifest = manifestModule.manifest;

  if (!manifest || !Array.isArray(manifest.routes)) {
    issues.push('dist/server manifest is missing route definitions');
  } else {
    const manifestRoutes = new Map();
    const redirectRoutes = new Map();

    for (const route of manifest.routes) {
      const routeData = route?.routeData;
      if (!routeData || typeof routeData.route !== 'string') continue;
      const routePath = normalizePath(routeData.route);
      manifestRoutes.set(routePath, routeData.type);

      if (routeData.type === 'redirect') {
        const redirectValue = typeof routeData.redirect === 'string'
          ? routeData.redirect
          : routeData.redirect?.destination;
        redirectRoutes.set(routePath, normalizePath(redirectValue ?? ''));
      }
    }

    for (const canonicalRoute of [NAV_TARGETS.guides, NAV_TARGETS.professionals, NAV_TARGETS.contact]) {
      const routeType = manifestRoutes.get(normalizePath(canonicalRoute));
      if (routeType !== 'page') {
        issues.push(`${canonicalRoute} -> expected page route in manifest, got ${routeType ?? 'missing'}`);
      }
    }

    for (const [aliasRoute, expectedTarget] of Object.entries(NAV_ALIAS_REDIRECTS)) {
      const routePath = normalizePath(aliasRoute);
      const expectedPath = normalizePath(expectedTarget);
      const actualPath = redirectRoutes.get(routePath);
      if (!actualPath) {
        issues.push(`${aliasRoute} -> missing redirect route in build manifest`);
      } else if (actualPath !== expectedPath) {
        issues.push(`${aliasRoute} -> expected redirect to ${expectedPath}, got ${actualPath}`);
      }
    }

    const thermansiTarget = redirectRoutes.get('/thermansi');
    if (thermansiTarget !== '/techniki-klimatismou') {
      issues.push(`/thermansi -> expected redirect to /techniki-klimatismou, got ${thermansiTarget ?? 'missing'}`);
    }
  }
}

if (issues.length) {
  console.error('Nav-link health test failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log('Nav-link health test passed. Canonical contact IA, promoted routes, and robots/sitemap artifacts are healthy.');
