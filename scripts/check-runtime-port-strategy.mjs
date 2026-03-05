import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const ASTRO_CONFIG_PATH = resolve(ROOT, 'astro.config.mjs');
const README_PATH = resolve(ROOT, 'README.md');
const PACKAGE_PATH = resolve(ROOT, 'package.json');

const CANONICAL_PORT = 4321;
const LEGACY_PORT = 4322;

const fail = (message) => {
  console.error(`❌ Runtime port strategy check failed: ${message}`);
  process.exit(1);
};

const [astroConfig, readme, packageRaw] = await Promise.all([
  readFile(ASTRO_CONFIG_PATH, 'utf8'),
  readFile(README_PATH, 'utf8'),
  readFile(PACKAGE_PATH, 'utf8')
]);

if (!/server\s*:\s*\{[\s\S]*?port\s*:\s*4321[\s\S]*?\}/m.test(astroConfig)) {
  fail('astro.config.mjs must define server.port = 4321.');
}

if (astroConfig.includes(String(LEGACY_PORT))) {
  fail('astro.config.mjs still references legacy port 4322.');
}

if (!readme.includes(`http://localhost:${CANONICAL_PORT}`)) {
  fail(`README.md must document canonical local runtime URL http://localhost:${CANONICAL_PORT}.`);
}

if (/localhost:\s*4322|127\.0\.0\.1:\s*4322|:\s*4322\//i.test(readme)) {
  fail('README.md still points to legacy runtime URL/port 4322.');
}

const pkg = JSON.parse(packageRaw);
const scripts = pkg?.scripts || {};
if (typeof scripts.dev !== 'string' || !scripts.dev.includes(`--port ${CANONICAL_PORT}`)) {
  fail('package.json script "dev" must include --port 4321.');
}
if (typeof scripts.preview !== 'string' || !scripts.preview.includes(`--port ${CANONICAL_PORT}`)) {
  fail('package.json script "preview" must include --port 4321.');
}

for (const [name, value] of Object.entries(scripts)) {
  if (typeof value === 'string' && value.includes(String(LEGACY_PORT))) {
    fail(`package.json script "${name}" still references legacy port 4322.`);
  }
}

console.log('Runtime port strategy check passed. Canonical port 4321 is aligned across config/docs/scripts.');
