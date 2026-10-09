import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, '..', 'dist');
const required = ['index.html', 'manifest.webmanifest', 'icon.svg'];
const assetNames = await readdir(join(dist, 'assets')).catch(() => []);
const paths = [
  './',
  ...required.map((path) => `./${path}`),
  ...assetNames.filter((name) => /\.(?:js|css|svg|woff2?)$/i.test(name)).sort().map((name) => `./assets/${name}`),
];

const template = await readFile(join(root, '..', 'pwa', 'sw.template.js'), 'utf8');
const hash = createHash('sha256');
hash.update(template);
for (const path of paths) {
  const file = path === './' ? join(dist, 'index.html') : join(dist, path.slice(2));
  try {
    hash.update(path);
    hash.update(await readFile(file));
  } catch {
    throw new Error(`Fehlende PWA-Datei im Build: ${path}`);
  }
}
const buildId = hash.digest('hex').slice(0, 16);
const serviceWorker = template
  .replace('__BUILD_ID__', buildId)
  .replace('__PRECACHE_PATHS__', JSON.stringify(paths));
await writeFile(join(dist, 'sw.js'), serviceWorker);
console.log(`PWA-Service-Worker erzeugt (${buildId}, ${paths.length} Dateien im Cache).`);
