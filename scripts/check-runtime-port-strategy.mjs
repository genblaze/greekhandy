import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const ROOT = process.cwd();
const ASTRO_CONFIG_PATH = resolve(ROOT, 'astro.config.mjs');
const README_PATH = resolve(ROOT, 'README.md');
const PACKAGE_PATH = resolve(ROOT, 'package.json');

const SCAN_DIRS = [
  resolve(ROOT, 'src/config'),
  resolve(ROOT, 'scripts')
];
const SCAN_FILE_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.md', '.json']);

const CANONICAL_PORT = 4321;
const LEGACY_PORT = 4322;

const fail = (message) => {
  console.error(`❌ Runtime port strategy check failed: ${message}`);
  process.exit(1);
};

const LEGACY_RUNTIME_PATTERN = /localhost:\s*4322|127\.0\.0\.1:\s*4322|--port\s+4322|:\s*4322\//i;

const walkFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
      continue;
    }
    const extension = entry.name.slice(entry.name.lastIndexOf('.'));
    if (SCAN_FILE_EXTENSIONS.has(extension)) {
      files.push(fullPath);
    }
  }
  return files;
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

if (LEGACY_RUNTIME_PATTERN.test(readme)) {
  fail('README.md still points to legacy runtime URL/port 4322.');
}

if (!readme.includes('QA endpoint: `http://localhost:4321`')) {
  fail('README.md must declare QA endpoint: http://localhost:4321');
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

for (const dir of SCAN_DIRS) {
  const files = await walkFiles(dir);
  for (const file of files) {
    if (file.endsWith('check-runtime-port-strategy.mjs')) continue;
    const source = await readFile(file, 'utf8');
    if (LEGACY_RUNTIME_PATTERN.test(source)) {
      fail(`${file.replace(`${ROOT}/`, '')} still references legacy runtime endpoint/port 4322.`);
    }
  }
}

console.log('Runtime port strategy check passed. Canonical port 4321 is aligned across config/docs/scripts.');
