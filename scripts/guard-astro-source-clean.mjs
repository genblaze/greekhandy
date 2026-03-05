#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const DIST_DIR = resolve(ROOT, 'dist');

const ATTR_PATTERNS = [
  'data-astro-source-file',
  'data-astro-source-loc',
  'data-astro-source-id',
  'data-astro-source'
];

const issues = [];

const scanHtmlRecursively = (dirPath) => {
  let entries = [];
  try {
    entries = readdirSync(dirPath);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      scanHtmlRecursively(fullPath);
      continue;
    }

    if (!entry.endsWith('.html')) continue;

    const html = readFileSync(fullPath, 'utf8');
    for (const pattern of ATTR_PATTERNS) {
      if (html.includes(pattern)) {
        issues.push(`${fullPath}: found ${pattern}`);
      }
    }
  }
};

scanHtmlRecursively(DIST_DIR);

if (issues.length > 0) {
  console.error('❌ Astro source/debug attribute leakage detected in production HTML:');
  for (const issue of issues) console.error(` - ${issue}`);
  process.exit(1);
}

console.log('✅ Astro source/debug attribute guard passed (no data-astro-source-* in dist HTML).');
