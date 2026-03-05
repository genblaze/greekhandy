#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const distClient = resolve(root, 'dist', 'client');
const outDir = existsSync(distClient) ? distClient : dist;

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const issues = [];

const home = read(join(outDir, 'index.html'));
if (!home) issues.push('Missing built index.html for JSON-LD checks.');
if (home && !home.includes('"@type":"Organization"')) issues.push('Homepage missing Organization JSON-LD.');
if (home && !home.includes('"@type":"WebSite"')) issues.push('Homepage missing WebSite JSON-LD.');

const profileDir = join(outDir, 'professionals');
let profileHtml = '';
if (existsSync(profileDir)) {
  const entries = readdirSync(profileDir)
    .map((entry) => join(profileDir, entry, 'index.html'))
    .filter((p) => existsSync(p));
  if (entries.length > 0) profileHtml = read(entries[0]);
}

if (!profileHtml) {
  issues.push('No built professional profile HTML found for JSON-LD checks.');
} else {
  if (!profileHtml.includes('ProfessionalService') || !profileHtml.includes('LocalBusiness')) {
    issues.push('Professional profile missing ProfessionalService/LocalBusiness JSON-LD.');
  }
  if (!profileHtml.includes('AggregateRating')) {
    issues.push('Professional profile missing aggregateRating JSON-LD.');
  }
}

const htmlFiles = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (entry.endsWith('.html')) htmlFiles.push(full);
  }
};
walk(outDir);

const serviceCandidate = htmlFiles.find((p) => {
  const rel = p.replace(outDir, '').replace(/\\/g, '/');
  if (rel === '/index.html') return false;
  if (rel.startsWith('/professionals/') || rel.startsWith('/blog/') || rel.startsWith('/admin/') || rel.startsWith('/messages')) return false;
  return true;
});

if (!serviceCandidate) {
  issues.push('No built category/service HTML candidate found for Service JSON-LD check.');
} else {
  const html = read(serviceCandidate);
  if (!html.includes('"@type":"Service"')) {
    issues.push(`Service-like page missing Service JSON-LD: ${serviceCandidate}`);
  }
}

if (issues.length > 0) {
  console.error('❌ JSON-LD coverage check failed:');
  for (const issue of issues) console.error(` - ${issue}`);
  process.exit(1);
}

console.log('✅ JSON-LD coverage check passed (home/service/profile).');
