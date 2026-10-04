import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../frontend/vendor/', import.meta.url);
const manifest = JSON.parse((await readFile(new URL('manifest.json', root), 'utf8')).replace(/^\uFEFF/, ''));
for (const module of manifest.modules) {
  for (const file of module.files) {
    const source = await readFile(new URL(`${module.name}/${file.path}`, root));
    if (createHash('sha256').update(source).digest('hex') !== file.sha256) {
      throw new Error(`Versytl snapshot changed: ${module.name}/${file.path}`);
    }
  }
}
console.log('Versytl source snapshot hashes verified.');
