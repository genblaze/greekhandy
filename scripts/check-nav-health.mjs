import { spawn } from 'node:child_process';

const host = '127.0.0.1';
const port = 4329;
const baseUrl = `http://${host}:${port}`;

const required200Routes = [
  '/',
  '/blog',
  '/professionals',
  '/ilektrologoi',
  '/ydravlikoi',
  '/elaiokhrwmatistes',
  '/katharismoi',
  '/techniki-klimatismou'
];

const aliasRoutes = [
  '/thermansi'
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

  for (const route of required200Routes) {
    const res = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
    if (res.status !== 200) {
      issues.push(`${route} -> expected 200, got ${res.status}`);
    }
  }

  for (const route of aliasRoutes) {
    const res = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
    if (![200, 301, 302, 307, 308].includes(res.status)) {
      issues.push(`${route} -> expected alias redirect/200, got ${res.status}`);
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
