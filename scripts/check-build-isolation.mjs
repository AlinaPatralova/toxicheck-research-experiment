import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const forbidden = ['up.railway.app', 'openfoodfacts.org', '/scan/composition', 'VITE_API_BASE_URL'];
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await check(file);
    else if (/\.(?:js|html|json)$/.test(entry.name)) {
      const contents = await readFile(file, 'utf8');
      for (const marker of forbidden) {
        if (contents.includes(marker)) throw new Error(`Production service reference in build: ${path.relative(root, file)}`);
      }
    }
  }
}
await check(path.join(root, 'dist'));
console.log('Research build contains no production backend/OCR/catalog service references.');
