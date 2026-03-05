#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const candidates = [
  resolve(root, 'dist/professionals/register/index.html'),
  resolve(root, 'dist/client/professionals/register/index.html')
];

const target = candidates.find((p) => existsSync(p));
if (!target) {
  console.error('❌ Register route smoke check failed: missing /professionals/register HTML artifact in dist.');
  process.exit(1);
}

const size = statSync(target).size;
const html = readFileSync(target, 'utf8');

if (size < 500 || html.trim().length < 500) {
  console.error(`❌ Register route smoke check failed: ${target.replace(`${root}/`, '')} is unexpectedly small/empty.`);
  process.exit(1);
}

if (!html.includes('<form') || !html.includes('/api/professionals/register')) {
  console.error('❌ Register route smoke check failed: register form markup missing from rendered HTML.');
  process.exit(1);
}

console.log('✅ Register route smoke check passed (/professionals/register renders non-empty HTML with form).');
