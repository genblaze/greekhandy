import { spawn } from 'node:child_process';
import { NAV_ALIAS_REDIRECTS, NAV_PLACEHOLDER_TEXT, NAV_TARGETS, TOP_NAV_LINKS } from '../src/config/navigation.js';

const host = '127.0.0.1';
const port = 4329;
const baseUrl = `http://${host}:${port}`;

const normalizePath = (value) => {
  const parsed = value.startsWith('http://') || value.startsWith('https://') ? new URL(value).pathname : value;
  if (parsed !== '/' && parsed.endsWith('/')) return parsed.slice(0, -1);
  return parsed;
};

const required200Routes = [
  '/',
  NAV_TARGETS.guides,
  NAV_TARGETS.professionals,
  '/ilektrologoi',
  '/ydravlikoi',
  '/elaiokhrwmatistes',
  '/katharismoi',
  '/techniki-klimatismou'
];

const aliasRouteMap = {
  '/thermansi': '/techniki-klimatismou',
  ...NAV_ALIAS_REDIRECTS
};

const routeContentChecks = [
  {
    route: NAV_TARGETS.guides,
    requiredSnippets: ['<h1', 'Οδηγοί', `href="${NAV_TARGETS.professionals}"`]
  },
  {
    route: NAV_TARGETS.professionals,
    requiredSnippets: ['<h1', 'Επαγγελματίες', 'href="/professionals/register"']
  }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const server = spawn('node', ['dist/server/entry.mjs'], {
  env: { ...process.env, HOST: host, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverReady = false;
server.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  if (text.toLowerCase().includes('listening') || text.includes(`:${port}`)) {
    serverReady = true;
  }
});

server.stderr.on('data', () => {
  // keep quiet; failures are surfaced via checks below
});

try {
  for (let i = 0; i < 30 && !serverReady; i += 1) {
    await sleep(200);
    try {
      const probe = await fetch(`${baseUrl}/`, { redirect: 'manual' });
      if (probe.status > 0) {
        serverReady = true;
        break;
      }
    } catch {
      // retry until timeout
    }
  }

  if (!serverReady) {
    throw new Error('Preview server did not start for nav health check.');
  }

  const issues = [];

  for (const route of new Set(required200Routes)) {
    const res = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
    if (res.status !== 200) {
      issues.push(`${route} -> expected 200, got ${res.status}`);
    }
  }

  for (const [route, expectedTarget] of Object.entries(aliasRouteMap)) {
    const res = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
    if (res.status === 200) {
      continue;
    }
    if (![301, 302, 307, 308].includes(res.status)) {
      issues.push(`${route} -> expected alias redirect/200, got ${res.status}`);
      continue;
    }
    const locationHeader = res.headers.get('location');
    if (!locationHeader) {
      issues.push(`${route} -> redirect missing Location header`);
      continue;
    }
    const resolvedPath = normalizePath(new URL(locationHeader, baseUrl).toString());
    const expectedPath = normalizePath(expectedTarget);
    if (resolvedPath !== expectedPath) {
      issues.push(`${route} -> expected redirect to ${expectedPath}, got ${resolvedPath}`);
    }
  }

  const homeRes = await fetch(`${baseUrl}/`, { redirect: 'manual' });
  if (homeRes.status === 200) {
    const homeHtml = await homeRes.text();
    const headerHtml = homeHtml.match(/<header[\s\S]*?<\/header>/iu)?.[0];
    if (!headerHtml) {
      issues.push('/ -> top header block not found');
    } else {
      for (const navLink of TOP_NAV_LINKS) {
        if (!headerHtml.includes(`href="${navLink.href}"`)) {
          issues.push(`/ -> missing top-nav href ${navLink.href}`);
        }
        if (!headerHtml.includes(navLink.label)) {
          issues.push(`/ -> missing top-nav label "${navLink.label}"`);
        }
      }
    }
  }

  for (const contentCheck of routeContentChecks) {
    const res = await fetch(`${baseUrl}${contentCheck.route}`, { redirect: 'manual' });
    if (res.status !== 200) continue;
    const html = await res.text();
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
  }

  if (issues.length) {
    console.error('Nav-link health test failed:');
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }

  console.log('Nav-link health test passed. Top-nav and promoted category routes are healthy.');
} finally {
  server.kill('SIGTERM');
}
