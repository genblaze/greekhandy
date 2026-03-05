#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const distIndex = join(process.cwd(), 'dist', 'index.html');
const distExists = existsSync(distIndex);

const patterns = [
  'data-astro-source-file',
  'data-astro-source-loc',
  'data-astro-source-id',
  'data-astro-source'
];

const checkText = (label, text) => {
  const hits = patterns.filter((p) => text.includes(p));
  return hits.map((hit) => `${label}: found ${hit}`);
};

let issues = [];

for (const rel of ['src/layouts/Layout.astro', 'src/pages/index.astro']) {
  const text = readFileSync(join(process.cwd(), rel), 'utf8');
  issues.push(...checkText(rel, text));
}

if (distExists) {
  const dist = readFileSync(distIndex, 'utf8');
  issues.push(...checkText('dist/index.html', dist));
}

if (issues.length > 0) {
  console.error('❌ Astro source debug attributes detected:');
  for (const issue of issues) console.error(` - ${issue}`);
  process.exit(1);
}

console.log('✅ Astro source debug attributes check passed.');
