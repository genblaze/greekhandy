import { copyFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const distClient = resolve(root, 'dist', 'client');
const distRoot = resolve(root, 'dist');
const artifacts = ['robots.txt', 'sitemap.xml'];

const ensureFolder = async (path) => {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
};

const copyArtifact = async (name) => {
  const source = resolve(distClient, name);
  const target = resolve(distRoot, name);
  if (!existsSync(source)) return;
  await ensureFolder(dirname(target));
  await copyFile(source, target);
  const stats = await stat(target);
  console.log(`✅ Copied ${name} (${stats.size} bytes) to dist root.`);
};

for (const artifact of artifacts) {
  await copyArtifact(artifact);
}
