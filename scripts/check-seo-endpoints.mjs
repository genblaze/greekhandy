#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const distClient = resolve(root, 'dist', 'client');

const pickArtifactPath = (filename) => {
  const clientPath = join(distClient, filename);
  if (existsSync(clientPath)) return clientPath;
  return join(dist, filename);
};

const robotsPath = pickArtifactPath('robots.txt');
const sitemapPath = pickArtifactPath('sitemap.xml');

const issues = [];

if (!existsSync(robotsPath)) {
  issues.push('Missing dist/robots.txt');
} else {
  const robots = readFileSync(robotsPath, 'utf8');
  if (!/User-agent:\s*\*/i.test(robots)) issues.push('robots.txt missing User-agent: * directive');
  if (!/Sitemap:\s*https:\/\/greekhandy\.gr\/sitemap\.xml/i.test(robots)) {
    issues.push('robots.txt missing canonical Sitemap: https://greekhandy.gr/sitemap.xml');
  }
}

if (!existsSync(sitemapPath)) {
  issues.push('Missing dist/sitemap.xml');
} else {
  const sitemap = readFileSync(sitemapPath, 'utf8');
  if (!/<\?xml\s+version="1.0"/i.test(sitemap)) issues.push('sitemap.xml missing XML declaration');
  if (!/<urlset[\s>]/i.test(sitemap)) issues.push('sitemap.xml missing <urlset>');
  if (!/<loc>https:\/\/greekhandy\.gr\//i.test(sitemap)) {
    issues.push('sitemap.xml missing canonical loc entries for https://greekhandy.gr');
  }
}

if (issues.length > 0) {
  console.error('❌ SEO endpoint check failed:');
  for (const issue of issues) console.error(` - ${issue}`);
  process.exit(1);
}

console.log('✅ SEO endpoint check passed (robots.txt + sitemap.xml present and canonical).');
