import {copyFile,mkdir,stat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const target=join(root,'templates/assets/branding/pulsed-logo.png');
await mkdir(dirname(target),{recursive:true});
// Use the supplied raster export verbatim: the SVG contains a live font.
try { await copyFile(join(root,'assets/Pulsed Logo.png'),target); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  // Source design exports are optional when the canonical embedded asset exists.
  await stat(target);
}
