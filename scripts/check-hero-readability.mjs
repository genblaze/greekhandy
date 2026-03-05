#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const filePath = resolve(process.cwd(), 'src/pages/index.astro');
const source = readFileSync(filePath, 'utf8');

const issues = [];

const requireIncludes = [
  'class="gh-hero',
  'gh-hero-bg',
  'gh-hero-overlay',
  'Ξεκινήστε Αναζήτηση',
  'Γίνετε Συνεργάτης',
  'text-[2.2rem]',
  'md:text-[4rem]'
];

for (const token of requireIncludes) {
  if (!source.includes(token)) {
    issues.push(`Missing hero readability token: ${token}`);
  }
}

const forbidden = [
  'gh-hero-glow',
  'backdrop-blur-md',
  'bg-white/10',
  'text-slate-300'
];

for (const token of forbidden) {
  if (source.includes(token)) {
    issues.push(`Forbidden low-contrast/haze token in homepage hero slice: ${token}`);
  }
}

if (issues.length > 0) {
  console.error('❌ Hero readability check failed:');
  for (const issue of issues) console.error(` - ${issue}`);
  process.exit(1);
}

console.log('✅ Hero readability check passed.');
