#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const artifactRoots = [
  resolve(root, 'dist', 'client'),
  resolve(root, 'dist'),
  resolve(root, 'dist', 'server')
];

const findArtifactCandidates = (filename) =>
  artifactRoots
    .map((base) => join(base, filename))
    .filter((path) => existsSync(path));

const robotsCandidates = findArtifactCandidates('robots.txt');
const sitemapCandidates = findArtifactCandidates('sitemap.xml');

const issues = [];

if (robotsCandidates.length === 0) {
  issues.push('Missing robots.txt artifact in dist outputs (checked dist/client, dist, dist/server).');
} else {
  const robotsPath = robotsCandidates[0];
  const robots = readFileSync(robotsPath, 'utf8');
  if (!/User-agent:\s*\*/i.test(robots)) issues.push(`robots.txt missing User-agent: * directive (${robotsPath.replace(`${root}/`, '')})`);
  if (!/Sitemap:\s*https:\/\/greekhandy\.gr\/sitemap\.xml/i.test(robots)) {
    issues.push(`robots.txt missing canonical Sitemap: https://greekhandy.gr/sitemap.xml (${robotsPath.replace(`${root}/`, '')})`);
  }
}

if (sitemapCandidates.length === 0) {
  issues.push('Missing sitemap.xml artifact in dist outputs (checked dist/client, dist, dist/server).');
} else {
  const sitemapPath = sitemapCandidates[0];
  const sitemap = readFileSync(sitemapPath, 'utf8');
  if (!/<\?xml\s+version="1.0"/i.test(sitemap)) issues.push(`sitemap.xml missing XML declaration (${sitemapPath.replace(`${root}/`, '')})`);
  if (!/<urlset[\s>]|<sitemapindex[\s>]/i.test(sitemap)) issues.push(`sitemap.xml missing <urlset> or <sitemapindex> (${sitemapPath.replace(`${root}/`, '')})`);
  if (!/<loc>https:\/\/greekhandy\.gr\//i.test(sitemap)) {
    issues.push(`sitemap.xml missing canonical loc entries for https://greekhandy.gr (${sitemapPath.replace(`${root}/`, '')})`);
  }
}

if (issues.length > 0) {
  console.error('❌ SEO endpoint check failed:');
  for (const issue of issues) console.error(` - ${issue}`);
  process.exit(1);
}

console.log('✅ SEO endpoint check passed (robots.txt + sitemap.xml present and canonical across dist artifacts).');
